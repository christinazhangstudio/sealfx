import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
    // req.auth contains the JWT. Check if the user is explicitly flagged as a guest
    const isGuest = (req.auth?.user as any)?.isGuest === true;

    const isLoginPage = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/register");

    if (isGuest && req.nextUrl.pathname !== "/guest" && !isLoginPage) {
        const url = req.nextUrl.clone();
        url.pathname = "/guest";

        // Create new headers to pass to the React server component
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
