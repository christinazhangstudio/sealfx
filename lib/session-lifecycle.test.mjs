import assert from "node:assert/strict";
import test from "node:test";
import "./test-module-hooks.mjs";
import React from "react";
import { act, create } from "react-test-renderer";
import { SessionContext } from "next-auth/react";
import { useSWRConfig } from "swr";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
process.env.NEXT_PUBLIC_API_URL = "/api";
process.env.NEXT_PUBLIC_USERS_URI = "users";
process.env.NEXT_PUBLIC_LISTINGS_URI = "listings";

const { default: SessionDataBoundary } = await import("../components/SessionDataBoundary.tsx");
const { UsersProvider, useUsers } = await import("../components/UsersContext.tsx");
const { NotificationProvider, useNotifications } = await import("../components/NotificationContext.tsx");
const { default: GuestSync } = await import("../components/GuestSync.tsx");
const { isPublicSessionRoute, sessionDataKey } = await import("./session-data-key.ts");
const { clearListingsIntervalCache, getCachedListingItem, loadListingItem, loadListingsForRange } =
    await import("./listings-interval-cache.ts");
const { setGuestMode } = await import("./api-tracker.ts");

const member = (id) => ({ user: { id, email: `${id}@example.test`, isGuest: false }, expires: "2026-09-08" });
const guest = (id) => ({ user: { id, email: "guest@localhost", isGuest: true }, expires: "2026-09-08" });

function setup(t, response) {
    const sources = [];
    const previousEventSource = globalThis.EventSource;
    globalThis.EventSource = class {
        constructor(url) { this.url = url; this.closed = false; this.listeners = new Map(); sources.push(this); }
        addEventListener(type, listener) { this.listeners.set(type, listener); }
        close() { this.closed = true; }
        emit(type, value) { this.listeners.get(type)?.({ data: JSON.stringify(value) }); }
    };
    t.after(() => { globalThis.EventSource = previousEventSource; });
    t.mock.method(globalThis, "fetch", response);
    let latest;
    let mounts = 0;
    function Probe() {
        const [pageValue, setPageValue] = React.useState("");
        const users = useUsers();
        const inbox = useNotifications();
        const { cache } = useSWRConfig();
        React.useEffect(() => { mounts++; }, []);
        latest = { users, inbox, cache, pageValue, setPageValue };
        return React.createElement("output", null, JSON.stringify({ users: users.users, envelopes: inbox.envelopes, pageValue }));
    }
    function tree(session, status = session ? "authenticated" : "unauthenticated", pathname = "/inbox") {
        return React.createElement(SessionContext.Provider, { value: { data: session, status, update: async () => session } },
            React.createElement(SessionDataBoundary, {
                identity: sessionDataKey(session, status),
                allowAnonymousWhileLoading: isPublicSessionRoute(pathname),
            },
                React.createElement(UsersProvider, null,
                    React.createElement(NotificationProvider, null,
                        React.createElement(GuestSync), React.createElement(Probe)))));
    }
    let renderer;
    t.after(async () => { if (renderer) await act(async () => renderer.unmount()); });
    return {
        sources,
        get state() { return latest; },
        get mounts() { return mounts; },
        get output() { return renderer?.toJSON(); },
        async render(session, status, pathname) {
            await act(async () => {
                if (renderer) renderer.update(tree(session, status, pathname));
                else renderer = create(tree(session, status, pathname));
            });
        },
    };
}

test.beforeEach(() => {
    clearListingsIntervalCache();
    setGuestMode(false);
    delete process.env.NEXT_PUBLIC_FORCE_SANDBOX_INBOX;
});
test.afterEach(() => clearListingsIntervalCache());

test("account changes reset users, inbox, page state, streams and SWR without remounting on token renewal", async (t) => {
    let account = "alice";
    const app = setup(t, async (url) => {
        if (url === "/api/users") return Response.json({ users: [account], sellers: [{ user: account, status: "connected" }] });
        if (url === "/api/settings") return Response.json({ ebayDeveloperConfig: { isSandbox: false } });
        throw new Error(`Unexpected URL: ${url}`);
    });
    await app.render(member("alice"));
    assert.deepEqual(app.state.users.users, ["alice"]);
    const oldSource = app.sources.at(-1);
    await act(async () => {
        oldSource.emit("message", { notification: { notificationId: "alice-private-message" } });
        app.state.setPageValue("private draft");
    });
    const oldCache = app.state.cache;
    oldCache.set("private-view", { data: "alice" });
    assert.equal(app.state.inbox.envelopes.length, 1);

    await app.render({ ...member("alice"), expires: "2026-10-08" });
    assert.equal(app.mounts, 1);
    assert.equal(app.state.pageValue, "private draft");
    assert.equal(app.state.cache, oldCache);
    assert.equal(app.state.inbox.envelopes[0].id, "alice-private-message");

    account = "bob";
    await app.render(member("bob"));
    assert.equal(app.mounts, 2);
    assert.deepEqual(app.state.users.users, ["bob"]);
    assert.deepEqual(app.state.users.sellers, [{ user: "bob", status: "connected" }]);
    assert.deepEqual(app.state.inbox.envelopes, []);
    assert.equal(app.state.pageValue, "");
    assert.notEqual(app.state.cache, oldCache);
    assert.equal(app.state.cache.get("private-view"), undefined);
    assert.equal(oldSource.closed, true);

    // A queued old SSE event and old SWR response cannot repopulate Bob's tree.
    await act(async () => {
        oldSource.emit("message", { notification: { notificationId: "late-alice-message" } });
        oldCache.set("late-view", { data: "alice" });
    });
    assert.deepEqual(app.state.inbox.envelopes, []);
    assert.equal(app.state.cache.get("late-view"), undefined);
});

test("a users response from the previous account cannot replace the current account's sellers", async (t) => {
    const oldResponse = Promise.withResolvers();
    let calls = 0;
    const app = setup(t, async (url) => {
        if (url === "/api/settings") return Response.json({ ebayDeveloperConfig: { isSandbox: false } });
        if (url === "/api/users") {
            if (++calls === 1) return oldResponse.promise;
            return Response.json({ users: ["bob"], sellers: [] });
        }
        throw new Error(`Unexpected URL: ${url}`);
    });
    await app.render(member("alice"));
    await app.render(member("bob"));
    assert.deepEqual(app.state.users.users, ["bob"]);
    await act(async () => oldResponse.resolve(Response.json({ users: ["alice"], sellers: [] })));
    assert.deepEqual(app.state.users.users, ["bob"]);
});

test("session loading waits for identity, while guest and sandbox sessions retain their intended behavior", async (t) => {
    let calls = 0;
    const app = setup(t, async (url) => {
        calls++;
        if (url === "/api/users") return Response.json({ users: ["sandbox-seller"], sellers: [] });
        if (url === "/api/settings") return Response.json({ ebayDeveloperConfig: { isSandbox: true } });
        throw new Error(`Unexpected URL: ${url}`);
    });
    await app.render(null, "loading");
    assert.equal(app.output, null);
    assert.equal(calls, 0);
    await app.render(member("sandbox-member"));
    assert.equal(app.state.inbox.isSandbox, true);
    assert.ok(app.state.inbox.envelopes.length > 0);
    assert.equal(app.sources.length, 0);
    const memberCalls = calls;
    await app.render(guest("guest-1"));
    assert.equal(app.state.inbox.isSandbox, false);
    assert.deepEqual(app.state.inbox.envelopes, []);
    assert.deepEqual(app.state.users.users, []);
    assert.equal(calls, memberCalls);
    await app.render(null, "unauthenticated");
    assert.deepEqual(app.state.users.users, []);
    assert.equal(calls, memberCalls);
    process.env.NEXT_PUBLIC_FORCE_SANDBOX_INBOX = "true";
    await app.render(guest("guest-2"));
    assert.equal(app.state.inbox.isSandbox, true);
    assert.ok(app.state.inbox.envelopes.length > 0);
    assert.equal(calls, memberCalls);
});

test("sandbox messages and local mutations survive same-account renewal during a stalled settings refresh", async (t) => {
    const refreshedSettings = Promise.withResolvers();
    const writes = [];
    let settingsCalls = 0;
    const app = setup(t, async (url, init) => {
        if (url === "/api/users") return Response.json({ users: ["sandbox-seller"], sellers: [] });
        if (url === "/api/settings") {
            if (++settingsCalls > 1) return refreshedSettings.promise;
            return Response.json({ ebayDeveloperConfig: { isSandbox: true } });
        }
        writes.push({ url, method: init?.method });
        return new Response(null, { status: 500 });
    });
    await app.render(member("sandbox-member"));
    const message = app.state.inbox.envelopes.find((entry) => !entry.trashed);
    assert.ok(message, "the initial settings response should load sandbox messages");
    const originalCount = app.state.inbox.envelopes.length;

    await app.render({ ...member("sandbox-member"), expires: "2026-10-08" });
    assert.equal(app.mounts, 1);
    assert.equal(app.state.inbox.isSandbox, true);
    assert.equal(app.state.inbox.envelopes.length, originalCount);
    assert.equal(app.sources.length, 0);
    const selected = () => app.state.inbox.envelopes.find((entry) => entry.id === message.id && entry.user === message.user);
    await act(async () => app.state.inbox.selectMessage(message.id, message.user));
    assert.equal(selected().read, true);
    await act(async () => app.state.inbox.trashMessage(message.id, message.user));
    assert.equal(selected().trashed, true);
    await act(async () => app.state.inbox.deleteMessage(message.id, message.user));
    assert.equal(selected(), undefined);
    assert.deepEqual(writes, []);

    await act(async () => refreshedSettings.resolve(Response.json({ ebayDeveloperConfig: { isSandbox: true } })));
    assert.equal(app.state.inbox.isSandbox, true);
    assert.equal(app.state.inbox.envelopes.length, originalCount - 1);
    assert.equal(selected(), undefined);
    assert.equal(app.sources.length, 0);
});

test("stable identity ignores expiry and session loading with an existing user", () => {
    assert.equal(sessionDataKey(member("alice"), "authenticated"), sessionDataKey(member("alice"), "loading"));
    assert.notEqual(sessionDataKey(guest("one"), "authenticated"), sessionDataKey(guest("two"), "authenticated"));
    assert.notEqual(sessionDataKey(member("alice"), "authenticated"), sessionDataKey(guest("alice"), "authenticated"));
    assert.equal(sessionDataKey({ user: { email: "legacy@example.test" } }, "authenticated"), "member:legacy@example.test");
});

test("public forms remain usable during session loading and keep input when anonymous status resolves", async (t) => {
    const app = setup(t, async () => { throw new Error("Public loading must not fetch private data"); });
    await app.render(null, "loading", "/login");
    assert.notEqual(app.output, null);
    assert.deepEqual(app.state.users.users, []);
    assert.deepEqual(app.state.inbox.envelopes, []);
    await act(async () => app.state.setPageValue("partially entered email"));
    await app.render(null, "loading", "/login");
    assert.equal(app.state.pageValue, "partially entered email");
    await app.render(null, "unauthenticated", "/login");
    assert.equal(app.mounts, 1);
    assert.equal(app.state.pageValue, "partially entered email");
});

test("switching from a member to a public loading state still clears all member data", async (t) => {
    const app = setup(t, async (url) => {
        if (url === "/api/users") return Response.json({ users: ["alice"], sellers: [] });
        if (url === "/api/settings") return Response.json({ ebayDeveloperConfig: { isSandbox: false } });
        throw new Error(`Unexpected URL: ${url}`);
    });
    await app.render(member("alice"));
    const source = app.sources.at(-1);
    await act(async () => source.emit("message", { notification: { notificationId: "private" } }));
    await app.render(null, "loading", "/forgot-password");
    assert.notEqual(app.output, null);
    assert.deepEqual(app.state.users.users, []);
    assert.deepEqual(app.state.inbox.envelopes, []);
    assert.equal(source.closed, true);
});

test("late order-photo responses cannot recreate a cleared account cache", async (t) => {
    const oldResponse = Promise.withResolvers();
    const started = Promise.withResolvers();
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
        if (++calls === 1) { started.resolve(); return oldResponse.promise; }
        return Response.json({ ItemID: "same-item", Title: "current-account-item", PictureDetails: { GalleryURL: "https://i.ebayimg.com/current.jpg" } });
    });
    const old = loadListingItem("shared-seller", "same-item");
    await started.promise;
    clearListingsIntervalCache();
    const current = await loadListingItem("shared-seller", "same-item");
    oldResponse.resolve(Response.json({ ItemID: "same-item", Title: "previous-account-item" }));
    assert.equal(await old, null);
    assert.equal(getCachedListingItem("shared-seller", "same-item"), current);
    assert.equal(current.Title, "current-account-item");
    assert.equal(await loadListingItem("shared-seller", "same-item"), current);
    assert.equal(calls, 2);
});

test("cached listings without pictures still load item details", async (t) => {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
        if (++calls === 1) return Response.json({ listings: { ItemArray: { Items: [{ ItemID: "missing-photo" }] }, HasMoreItems: false } });
        return Response.json({ ItemID: "missing-photo", PictureDetails: { GalleryURL: "https://i.ebayimg.com/photo.jpg" } });
    });
    const day = new Date(2026, 8, 1);
    await loadListingsForRange("seller", day, day);
    assert.equal(getCachedListingItem("seller", "missing-photo").PictureDetails, undefined);
    const item = await loadListingItem("seller", "missing-photo");
    assert.equal(item.PictureDetails.GalleryURL, "https://i.ebayimg.com/photo.jpg");
    assert.equal(await loadListingItem("seller", "missing-photo"), item);
    assert.equal(calls, 2);
});

test("late range responses cannot repopulate a cleared account cache", async (t) => {
    const response = Promise.withResolvers();
    const started = Promise.withResolvers();
    t.mock.method(globalThis, "fetch", async () => { started.resolve(); return response.promise; });
    const day = new Date(2026, 8, 1);
    const old = loadListingsForRange("seller", day, day);
    // The crawl may finish against its detached store or be canceled by the
    // interval cache. Neither outcome may publish into the next account.
    const settled = old.catch((error) => assert.equal(error.name, "AbortError"));
    await started.promise;
    clearListingsIntervalCache();
    response.resolve(Response.json({ listings: { ItemArray: { Items: [{ ItemID: "private-item" }] }, HasMoreItems: false } }));
    await settled;
    assert.equal(getCachedListingItem("seller", "private-item"), undefined);
});
