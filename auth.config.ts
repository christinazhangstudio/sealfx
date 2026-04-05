import type { NextAuthConfig } from "next-auth";
import * as jose from "jose";
import { AUTH_PRIVATE_KEY, AUTH_PUBLIC_KEY } from "./lib/auth-keys";

export const authConfig = {
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60, // Lowered to 1 day
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
        encode: async ({ secret, token, maxAge }) => {
            const privateKeyObj = await jose.importPKCS8(AUTH_PRIVATE_KEY, "RS256");
            const jti = token?.jti || crypto.randomUUID();
            return new jose.SignJWT({ ...token, jti })
                .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "sealift-key-1" })
                .setIssuedAt()
                .setExpirationTime(Math.floor(Date.now() / 1000) + (maxAge || 24 * 60 * 60))
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
            const isOnLoginPage = nextUrl.pathname.startsWith("/login");
            const isOnRegisterPage = nextUrl.pathname.startsWith("/register");

            if (isOnLoginPage || isOnRegisterPage) {
                if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
                return true;
            }

            return isLoggedIn;
        },
    },
    events: {
        async signOut(message) {
            // Check if the sign-out event contains a decoded JWT token with our custom ID
            if ("token" in message && message.token?.jti) {
                try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:443/api";
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
