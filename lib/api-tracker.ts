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
const GUEST_MODE_KEY = "sealfx_is_guest_mode";

// Internal volatile flag for server-side or non-browser environments
let _isGuestModeVolatile = true;

/**
 * Gets the current guest mode status, checking persistence if available.
 */
function getIsGuestMode(): boolean {
    if (typeof window !== "undefined") {
        const stored = localStorage.getItem(GUEST_MODE_KEY);
        // If no value is stored, assume guest mode (blocked) for safety during initial load
        if (stored === null) return true;
        return stored === "true";
    }
    return _isGuestModeVolatile;
}

/**
 * Enable or disable global API blocking for guest mode
 */
export function setGuestMode(isGuest: boolean) {
    console.log(`[GuestSync] Setting guest mode to: ${isGuest}`);
    _isGuestModeVolatile = isGuest;
    if (typeof window !== "undefined") {
        localStorage.setItem(GUEST_MODE_KEY, String(isGuest));
    }
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
    const isGuestMode = getIsGuestMode();
    if (isGuestMode) {
        const aiUrl = String(process.env.NEXT_PUBLIC_AI_URI);
        const isAiCall = url.includes(aiUrl);
        const allowGuestAi = process.env.NEXT_PUBLIC_ALLOW_GUEST_AI === "true";

        if (!(isAiCall && allowGuestAi)) {
            console.log(`[Tracker] Blocking call to ${url} (isGuestMode: true)`);
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

    // Categorize the endpoint
    let category = "other";
    if (url.includes(String(process.env.NEXT_PUBLIC_USERS_URI))) category = "Users";
    else if (url.includes(String(process.env.NEXT_PUBLIC_LISTINGS_URI))) category = "Listings";
    else if (url.includes(String(process.env.NEXT_PUBLIC_PAYOUTS_URI))) category = "Payouts";
    else if (url.includes(String(process.env.NEXT_PUBLIC_NOTES_URI))) category = "Notes";
    else if (url.includes(String(process.env.NEXT_PUBLIC_ACCOUNT_URI))) category = "Account";
    else if (url.includes(String(process.env.NEXT_PUBLIC_NOTIFICATION_URI))) category = "Notification";
    else if (url.includes(String(process.env.NEXT_PUBLIC_TRANSACTION_SUMMARIES_URI))) category = "Transaction Summaries";
    else if (url.includes(String(process.env.NEXT_PUBLIC_INBOX_URI))) category = "Inbox";
    else if (url.includes(String(process.env.NEXT_PUBLIC_AI_URI))) category = "AI Assistant";

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
