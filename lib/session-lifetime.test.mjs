import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { Auth, raw, skipCSRFCheck } from "@auth/core";
import Credentials from "@auth/core/providers/credentials";
import { exportPKCS8, exportSPKI, generateKeyPair, SignJWT } from "jose";

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (context.parentURL?.endsWith("/auth.config.ts") && specifier.startsWith("./lib/")) {
            return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context);
        }
        return nextResolve(specifier, context);
    },
});

// Always replace signing inputs before loading the real configuration. These
// disposable keys never touch a service or a production credentials file.
const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
process.env.AUTH_PRIVATE_KEY = await exportPKCS8(privateKey);
process.env.AUTH_PUBLIC_KEY = await exportSPKI(publicKey);
const { authConfig } = await import("../auth.config.ts");

const DAY = 86_400;
const NOW = Date.UTC(2026, 8, 7, 12);
const cookieName = authConfig.cookies.sessionToken.name;

const encode = (token, maxAge = authConfig.session.maxAge) => authConfig.jwt.encode({
    token: { sub: "test-member", ...token },
    maxAge,
    secret: "unused-test-secret",
    salt: cookieName,
});
const decode = (token) => authConfig.jwt.decode({ token, secret: "unused-test-secret", salt: cookieName });

function coreConfig(user) {
    return {
        ...authConfig,
        secret: "test-only-auth-secret",
        trustHost: true,
        basePath: "/api/auth",
        raw,
        // Test only: credentials are supplied by a disposable local provider.
        skipCSRFCheck,
        providers: [Credentials({ authorize: async () => ({ id: "test-member", ...user }) })],
    };
}

async function signIn(user) {
    const result = await Auth(new Request("https://sealift.test/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "callbackUrl=https%3A%2F%2Fsealift.test%2F",
    }), coreConfig(user));
    const cookie = result.cookies?.find((cookie) => cookie.name === cookieName && cookie.value);
    assert.ok(cookie, "Auth.js must issue the session cookie");
    return cookie;
}

async function refresh(cookie, user, data) {
    return Auth(new Request("https://sealift.test/api/auth/session", {
        method: data ? "POST" : "GET",
        headers: {
            Cookie: `${cookieName}=${cookie.value}`,
            ...(data ? { "Content-Type": "application/json" } : {}),
        },
        ...(data ? { body: JSON.stringify({ data }) } : {}),
    }), coreConfig(user));
}

test.beforeEach((t) => {
    t.mock.timers.enable({ apis: ["Date"], now: NOW });
});

for (const [name, claims, expected] of [
    ["remembered member", { rememberDevice: true }, 30 * DAY],
    ["unchecked member", { rememberDevice: false }, DAY],
    ["legacy token without a choice", {}, DAY],
    ["string true", { rememberDevice: "true" }, DAY],
    ["truthy number", { rememberDevice: 1 }, DAY],
    ["guest with a remembered flag", { rememberDevice: true, isGuest: true }, DAY],
]) {
    test(`real JWT encode/decode uses the correct lifetime for ${name}`, async () => {
        const encoded = await encode(claims);
        const decoded = await decode(encoded);
        assert.ok(decoded);
        assert.equal(decoded.exp - decoded.iat, expected);
        assert.equal(decoded.sessionExpiresAt, decoded.exp);
        assert.equal(decoded.sub, "test-member");
        assert.ok(decoded.jti);
    });
}

test("the configured cookie ceiling and signed remembered JWT both allow 30 days", async () => {
    assert.equal(authConfig.session.maxAge, 30 * DAY);
    const cookie = await signIn({ rememberDevice: true });
    assert.equal(cookie.options.expires.getTime(), NOW + 30 * DAY * 1000);
    assert.equal((await decode(cookie.value)).exp, NOW / 1000 + 30 * DAY);
});

test("expired short JWTs are rejected even while their longer-lived cookie remains", async (t) => {
    const cookie = await signIn({ rememberDevice: false });
    assert.equal(cookie.options.expires.getTime(), NOW + 30 * DAY * 1000);
    t.mock.timers.tick(DAY * 1000);
    t.mock.method(console, "error", () => {});
    assert.equal(await decode(cookie.value), null);

    const response = await refresh(cookie, { rememberDevice: false });
    assert.equal(response.body, null);
    const cleared = response.cookies.find((entry) => entry.name === cookieName);
    assert.equal(cleared.options.maxAge, 0);
    assert.equal(cleared.value, "");
});

test("remembered JWTs remain valid after one day and expire at 30 days", async (t) => {
    const encoded = await encode({ rememberDevice: true });
    t.mock.timers.tick(DAY * 1000);
    assert.ok(await decode(encoded));
    t.mock.timers.tick(29 * DAY * 1000);
    t.mock.method(console, "error", () => {});
    assert.equal(await decode(encoded), null);
});

for (const [name, user, expected] of [
    ["remembered member", { rememberDevice: true }, 30 * DAY],
    ["unchecked member", { rememberDevice: false }, DAY],
    ["guest", { isGuest: true, rememberDevice: true }, DAY],
]) {
    test(`Auth.js session refresh preserves ${name} identity and absolute deadline`, async (t) => {
        const cookie = await signIn(user);
        const original = await decode(cookie.value);
        t.mock.timers.tick(12 * 60 * 60 * 1000);
        const response = await refresh(cookie, user);
        const updatedCookie = response.cookies.find((entry) => entry.name === cookieName && entry.value);
        assert.ok(updatedCookie);
        const updated = await decode(updatedCookie.value);

        assert.equal(updated.exp, NOW / 1000 + expected);
        assert.equal(updated.exp, original.exp);
        assert.equal(updated.sessionExpiresAt, original.sessionExpiresAt);
        assert.equal(updated.jti, original.jti, "refresh must keep the revocable session identity");
        assert.equal(updated.rememberDevice, original.rememberDevice);
        assert.equal(updatedCookie.options.expires.getTime(), Date.now() + 30 * DAY * 1000);
        assert.equal(response.body.expires, new Date(updated.exp * 1000).toISOString());
        assert.equal(response.body.rememberDevice, name === "remembered member");
    });
}

test("a session update cannot change the signed choice or extend the deadline", async () => {
    const cookie = await signIn({ rememberDevice: false });
    const response = await refresh(cookie, { rememberDevice: false }, {
        rememberDevice: true,
        sessionExpiresAt: NOW / 1000 + 30 * DAY,
        exp: NOW / 1000 + 30 * DAY,
    });
    const updatedCookie = response.cookies.find((entry) => entry.name === cookieName && entry.value);
    const updated = await decode(updatedCookie.value);
    assert.equal(updated.rememberDevice, false);
    assert.equal(updated.exp - updated.iat, DAY);
    assert.equal(updated.sessionExpiresAt, NOW / 1000 + DAY);
    assert.equal(response.body.rememberDevice, false);
});

test("repeated Auth.js refresh cannot renew a remembered token past its original deadline", async (t) => {
    let cookie = await signIn({ rememberDevice: true });
    const original = await decode(cookie.value);
    for (const days of [10, 10, 9]) {
        t.mock.timers.tick(days * DAY * 1000);
        const response = await refresh(cookie, { rememberDevice: true });
        cookie = response.cookies.find((entry) => entry.name === cookieName && entry.value);
        const updated = await decode(cookie.value);
        assert.equal(updated.exp, original.exp);
        assert.equal(updated.sessionExpiresAt, original.sessionExpiresAt);
        assert.equal(updated.jti, original.jti);
        assert.equal(response.body.expires, new Date(original.exp * 1000).toISOString());
    }
    t.mock.timers.tick(DAY * 1000);
    t.mock.method(console, "error", () => {});
    assert.equal(await decode(cookie.value), null);
    const expired = await refresh(cookie, { rememberDevice: true });
    assert.equal(expired.body, null);
});

test("a legacy remembered session keeps its original expiry instead of gaining 30 days", async (t) => {
    const legacy = await new SignJWT({ sub: "test-member", rememberDevice: true, jti: "legacy-session" })
        .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "sealift-key-1" })
        .setIssuedAt()
        .setExpirationTime(NOW / 1000 + DAY)
        .sign(privateKey);
    t.mock.timers.tick(12 * 60 * 60 * 1000);
    const response = await refresh({ value: legacy }, { rememberDevice: true });
    const cookie = response.cookies.find((entry) => entry.name === cookieName && entry.value);
    const updated = await decode(cookie.value);
    assert.equal(updated.exp, NOW / 1000 + DAY);
    assert.equal(updated.sessionExpiresAt, updated.exp);
    assert.equal(updated.jti, "legacy-session");
    assert.equal(response.body.expires, new Date(updated.exp * 1000).toISOString());
    t.mock.timers.tick(12 * 60 * 60 * 1000);
    t.mock.method(console, "error", () => {});
    assert.equal(await decode(cookie.value), null);
});

test("encoding never revives an expired session or replaces a malformed deadline", async (t) => {
    t.mock.method(console, "error", () => {});
    const expired = await encode({ rememberDevice: true, sessionExpiresAt: NOW / 1000 - 1 });
    assert.equal(await decode(expired), null);
    await assert.rejects(encode({ rememberDevice: true, sessionExpiresAt: "tomorrow" }), /Invalid session expiration/);
});
