import type { NextAuthConfig } from "next-auth";
import * as jose from "jose";
import { AUTH_PRIVATE_KEY, AUTH_PUBLIC_KEY } from "./lib/auth-keys";
import { REMEMBERED_SESSION_MAX_AGE, sessionExpiresAt, sessionMaxAgeSeconds } from "./lib/session-lifetime";

export const authConfig = {
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
        // Auth.js uses one cookie lifetime for every account. The signed JWT
        // below enforces the member's shorter choice (and every guest's limit).
        maxAge: REMEMBERED_SESSION_MAX_AGE,
    },
    useSecureCookies: process.env.NODE_ENV === "production",
    cookies: {
        sessionToken: {
            name: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
            options: {
                httpOnly: true,
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                path: "/",
                secure: process.env.NODE_ENV === "production",
                domain: process.env.NODE_ENV === "production" ? ".lystic.dev" : undefined,
            },
        },
    },
    jwt: {
        encode: async ({ token }) => {
            const privateKeyObj = await jose.importPKCS8(AUTH_PRIVATE_KEY, "RS256");
            const jti = token?.jti || crypto.randomUUID();
            const expiresAt = sessionExpiresAt(token);
            return new jose.SignJWT({ ...token, jti, sessionExpiresAt: expiresAt })
                .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "sealift-key-1" })
                .setIssuedAt()
                .setExpirationTime(expiresAt)
                .sign(privateKeyObj);
        },
        decode: async ({ secret, token }) => {
            if (!token) return null;
            try {
                const publicKeyObj = await jose.importSPKI(AUTH_PUBLIC_KEY, "RS256");
                const { payload } = await jose.jwtVerify(token, publicKeyObj, { algorithms: ["RS256"] });
                return payload as any;
            } catch (err) {
                console.error("JWT verification failed:", err);
                return null;
            }
        },
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isGuest = (auth?.user as any)?.isGuest === true;
            const isOnLoginPage = nextUrl.pathname.startsWith("/login");
            const isOnRegisterPage = nextUrl.pathname.startsWith("/register");

            if (isOnLoginPage || isOnRegisterPage) {
                if (isLoggedIn && !isGuest) return Response.redirect(new URL("/", nextUrl));
                return true;
            }

            return isLoggedIn || isGuest;
        },
        async jwt({ token, user }) {
            if (user) {
                token.isGuest = (user as any).isGuest === true;
                token.rememberDevice = (user as any).rememberDevice === true && !token.isGuest;
                // All tokens sharing this session's JTI must expire together,
                // so refresh cannot outlive the backend's revocation record.
                token.sessionExpiresAt = Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds(token);
            }
            return token;
        },
        async session({ session, token }) {
            // Auth.js re-signs the JWT after this callback. Both must preserve
            // the original deadline instead of its rolling cookie ceiling.
            const expires = new Date(sessionExpiresAt(token) * 1000).toISOString();
            if (token && session.user) {
                (session as any).rememberDevice = token.rememberDevice === true && token.isGuest !== true;
                (session.user as any).isGuest = token.isGuest || false;
            }
            return { ...session, expires };
        },
    },
    events: {
        async signOut(message) {
            // Check if the sign-out event contains a decoded JWT token with our custom ID
            if ("token" in message && message.token?.jti) {
                try {
                    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:443/api";
                    await fetch(`${apiUrl}/revoke`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ jti: message.token.jti }),
                    });
                } catch (e) {
                    console.error("Failed to notify backend of token revocation:", e);
                }
            }
        }
    },
    providers: [], // Add providers in auth.ts
} satisfies NextAuthConfig;
