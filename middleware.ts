import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
    // The backend skips session auth on /api/internal/* because the sign-in
    // flow calls it server-to-server, before a session exists — those calls go
    // straight to INTERNAL_API_URL and never pass through here. Anything that
    // reaches this path came from the internet, so refuse it.
    //
    // This has to live in middleware: the /api/:path* rewrite in
    // next.config.mjs is an "afterFiles" rewrite, which takes precedence over
    // dynamic route handlers, so a catch-all route file cannot block it.
    if (req.nextUrl.pathname.startsWith("/api/internal/")) {
        return new NextResponse("Not found", { status: 404 });
    }

    const isLoggedIn = !!req.auth;
    const isGuest = (req.auth?.user as any)?.isGuest === true;
    const isLoginPage = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/register");

    // 1. If not logged in and not a guest, redirect to login (if not already there)
    if (!isLoggedIn && !isGuest && !isLoginPage) {
        return Response.redirect(new URL("/login", req.nextUrl));
    }

    // 2. If guest, rewrite to /guest view (unless already on login/guest or guest-allowed pages)
    const guestAllowedPaths = [
        "/create-listing",
        ...(process.env.NEXT_PUBLIC_FORCE_SANDBOX_INBOX === "true" ? ["/sandbox-inbox-preview"] : []),
    ];
    if (isGuest && !guestAllowedPaths.includes(req.nextUrl.pathname) && req.nextUrl.pathname !== "/guest" && !isLoginPage) {
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
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.jpeg$|login|register|guest|forgot-password|reset-password|terms|privacy|about).*)",
        // Exempted from the pattern above (it excludes all of /api), so it has
        // to be listed explicitly.
        "/api/internal/:path*",
    ],
};
