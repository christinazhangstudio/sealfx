/**
 * API Tracker Utility
 * Intercepts and counts API calls, persisting them to localStorage.
 */

export interface ApiUsage {
    total: number;
    endpoints: Record<string, number>;
    lastReset: string; // ISO date string
}

const STORAGE_KEY = "sealfx_api_usage";

/**
 * Guest status is derived from the session by GuestSync, which reports it here
 * as soon as the session resolves.
 *
 * It is deliberately NOT persisted and NOT guessed. Both were bugs:
 *
 *  - A missing value used to mean "assume guest, block the request". That is
 *    exactly the state during the first render, so any page fetching from a
 *    mount-only effect got a synthetic 403 and never retried — Gallery, Notes
 *    and Notifications broke on a fresh load, in incognito, or after clearing
 *    site data, and a manual refresh fixed it, which made it look random.
 *  - Persisting it to localStorage leaked across tabs: signing out in one tab
 *    wrote "true", so a different tab with a valid session started blocking.
 *
 * While the status is still unknown a request waits briefly for it rather than
 * being denied — the answer is arriving momentarily. This gate is a UX
 * optimisation to avoid pointless calls; the backend is what actually enforces
 * access, and it rejects guest tokens on every data endpoint.
 */
type GuestState = "unknown" | "guest" | "member";

let guestState: GuestState = "unknown";
let markResolved: (() => void) | null = null;
const guestResolved = new Promise<void>((resolve) => {
    markResolved = resolve;
});

/** How long a request waits for the session before proceeding anyway. */
const GUEST_RESOLVE_TIMEOUT_MS = 3000;

/**
 * Reports the session's guest status. Called by GuestSync once the session
 * resolves, on every page load.
 */
export function setGuestMode(isGuest: boolean) {
    guestState = isGuest ? "guest" : "member";
    markResolved?.();
    markResolved = null;
}

async function resolveGuestState(): Promise<GuestState> {
    if (guestState !== "unknown") return guestState;
    if (typeof window === "undefined") return "unknown";

    await Promise.race([
        guestResolved,
        new Promise((resolve) => setTimeout(resolve, GUEST_RESOLVE_TIMEOUT_MS)),
    ]);
    // Still unknown means GuestSync never reported — let the request through and
    // let the server decide, rather than failing a signed-in user's page.
    return guestState;
}

function getUsage(): ApiUsage {
    if (typeof window === "undefined") return { total: 0, endpoints: {}, lastReset: new Date().toISOString() };

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            // Reset if it's a new day
            const lastResetDate = new Date(parsed.lastReset).toDateString();
            const today = new Date().toDateString();

            if (lastResetDate !== today) {
                return { total: 0, endpoints: {}, lastReset: new Date().toISOString() };
            }
            return parsed;
        } catch (e) {
            console.error("Failed to parse API usage", e);
        }
    }
    return { total: 0, endpoints: {}, lastReset: new Date().toISOString() };
}

function saveUsage(usage: ApiUsage) {
    if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
        // Dispatch a custom event so components can listen for updates
        window.dispatchEvent(new CustomEvent("api-usage-update", { detail: usage }));
    }
}

/**
 * Custom fetch wrapper that tracks calls
 */
export async function trackedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" ? input : (input instanceof URL ? input.toString() : input.url);

    if ((await resolveGuestState()) === "guest") {
        const aiUrl = String(process.env.NEXT_PUBLIC_AI_URI);
        const isAiCall = url.includes(aiUrl);
        const allowGuestAi = process.env.NEXT_PUBLIC_ALLOW_GUEST_AI === "true";

        if (!(isAiCall && allowGuestAi)) {
            return new Response(JSON.stringify({
                error: "Action not permitted for guest users",
                success: false
            }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    const usage = getUsage();

    // Categorize the endpoint. Unset env vars are skipped: String(undefined)
    // is "undefined", which silently matched nothing (or worse, any URL that
    // happened to contain that word).
    const CATEGORIES: [string | undefined, string][] = [
        [process.env.NEXT_PUBLIC_USERS_URI, "Users"],
        [process.env.NEXT_PUBLIC_LISTINGS_URI, "Listings"],
        [process.env.NEXT_PUBLIC_PAYOUTS_URI, "Payouts"],
        [process.env.NEXT_PUBLIC_NOTES_URI, "Notes"],
        [process.env.NEXT_PUBLIC_ACCOUNT_URI, "Account"],
        [process.env.NEXT_PUBLIC_NOTIFICATIONS_TOPICS_URI, "Notification"],
        [process.env.NEXT_PUBLIC_TRANSACTION_SUMMARIES_URI, "Transaction Summaries"],
        [process.env.NEXT_PUBLIC_INBOX_URI, "Inbox"],
        [process.env.NEXT_PUBLIC_AI_URI, "AI Assistant"],
    ];

    let category = "other";
    for (const [uri, label] of CATEGORIES) {
        if (uri && url.includes(uri)) {
            category = label;
            break;
        }
    }

    usage.total += 1;
    usage.endpoints[category] = (usage.endpoints[category] || 0) + 1;

    saveUsage(usage);

    const fetchInit: RequestInit = {
        ...init,
        // Wrap fetch calls with NextAuth tokens
        credentials: init?.credentials || "include",
    };

    return fetch(input, fetchInit);
}

/**
 * Hook-like function to get current usage stats
 */
export function getApiUsageStats(): ApiUsage {
    return getUsage();
}
