import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    pages: {
        signIn: "/login",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnLoginPage = nextUrl.pathname.startsWith("/login");

            if (isOnLoginPage) {
                if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
                return true;
            }

            return isLoggedIn;
        },
    },
    providers: [], // Add providers in auth.ts
} satisfies NextAuthConfig;
