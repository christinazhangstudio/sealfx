interface SessionIdentity {
    user?: {
        id?: string;
        email?: string | null;
        isGuest?: boolean;
    };
}

/** Stable across token refreshes, distinct for different tenants and guest sessions. */
export function sessionDataKey(
    session: SessionIdentity | null | undefined,
    status: "loading" | "authenticated" | "unauthenticated",
): string | null {
    if (session?.user) {
        const user = session.user;
        // The email fallback also handles sessions created before the session
        // callback exposed the JWT subject to the browser.
        const identity = user.id || user.email;
        return identity ? `${user.isGuest ? "guest" : "member"}:${identity}` : null;
    }
    return status === "loading" ? null : "anonymous";
}

/** These pages must remain usable before the initial session lookup finishes. */
export function isPublicSessionRoute(pathname: string | null): boolean {
    return isFooterPath(pathname) || ["/login", "/register", "/forgot-password", "/reset-password"]
        .some((path) => pathname === path || pathname?.startsWith(`${path}/`));
}
import { isFooterPath } from "@/lib/footer-links";
