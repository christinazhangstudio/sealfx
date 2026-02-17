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
    const usage = getUsage();
    const url = typeof input === "string" ? input : (input instanceof URL ? input.toString() : input.url);

    // Categorize the endpoint
    let category = "other";
    if (url.includes(process.env.NEXT_PUBLIC_USERS_URI || "users")) category = "Users";
    else if (url.includes(process.env.NEXT_PUBLIC_LISTINGS_URI || "listings")) category = "Listings";
    else if (url.includes(process.env.NEXT_PUBLIC_PAYOUTS_URI || "payouts")) category = "Payouts";
    else if (url.includes(process.env.NEXT_PUBLIC_NOTES_URI || "notes")) category = "Notes";
    else if (url.includes(process.env.NEXT_PUBLIC_ACCOUNT_URI || "accounts")) category = "Accounts";
    else if (url.includes(process.env.NEXT_PUBLIC_NOTIFICATION_URI || "notification")) category = "Notifications";
    else if (url.includes("transaction")) category = "Transactions";
    else if (url.includes("charts")) category = "Charts";

    usage.total += 1;
    usage.endpoints[category] = (usage.endpoints[category] || 0) + 1;

    saveUsage(usage);

    return fetch(input, init);
}

/**
 * Hook-like function to get current usage stats
 */
export function getApiUsageStats(): ApiUsage {
    return getUsage();
}
