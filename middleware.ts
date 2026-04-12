import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const isGuest = (req.auth?.user as any)?.isGuest === true;
    const isLoginPage = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/register");

    // 1. If not logged in and not a guest, redirect to login (if not already there)
    if (!isLoggedIn && !isGuest && !isLoginPage) {
        return Response.redirect(new URL("/login", req.nextUrl));
    }

    // 2. If guest, rewrite to /guest view (unless already on login/guest)
    if (isGuest && req.nextUrl.pathname !== "/guest" && !isLoginPage) {
        const url = req.nextUrl.clone();
        url.pathname = "/guest";
        url.searchParams.set("p", req.nextUrl.pathname);

        const requestHeaders = new Headers(req.headers);
        requestHeaders.set("x-pathname", req.nextUrl.pathname);

        return NextResponse.rewrite(url, {
            request: {
                headers: requestHeaders,
            },
        });
    }

    return NextResponse.next();
});

export const config = {
    // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.jpeg$|login|register|guest).*)"],
};
