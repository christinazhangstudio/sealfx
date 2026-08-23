import { useState } from "react";
import useSWR, { mutate } from "swr";
import { defaultListingsRange, formatApiDate, parseLocalDate } from "@/lib/date-range";
import {
    clearListingsIntervalCache,
    invalidateListingsRange,
    loadListingsForRange,
} from "@/lib/listings-interval-cache";
import type { Item } from "@/lib/ebay-data";

// Stable empty fallbacks. Returning a fresh `{}` literal on every render gave
// `listingsByUser` / `errorsByUser` a new object identity while SWR had no data,
// which re-triggered downstream effects (deps on these objects) on every render —
// an infinite setState loop ("Maximum update depth exceeded").
const EMPTY_RESULTS: Record<string, Item[]> = {};
const EMPTY_ERRORS: Record<string, string> = {};

const fetcher = async ([_, users, startFromStr, startToStr]: [string, string[], string, string]) => {
    const startFrom = parseLocalDate(startFromStr);
    const startTo = parseLocalDate(startToStr);

    const results: Record<string, Item[]> = {};
    const errors: Record<string, string> = {};

    await Promise.all(
        users.map(async (user) => {
            try {
                results[user] = await loadListingsForRange(user, startFrom, startTo);
            } catch (err) {
                console.error(`Failed to fetch listings for ${user}:`, err);
                errors[user] = err instanceof Error ? err.message : String(err);
                results[user] = [];
            }
        }),
    );

    return { results, errors, fetchedAt: Date.now() };
};

export function useEbayListings(users: string[], startFrom: Date, startTo: Date) {
    const sortedUsers = [...users].sort();
    const startFromStr = formatApiDate(startFrom);
    const startToStr = formatApiDate(startTo);

    const key = sortedUsers.length > 0
        ? ["ebayListings", sortedUsers, startFromStr, startToStr]
        : null;

    // Session cache only. No background recrawl — the eBay crawl is too expensive
    // to fire on focus/remount. Freshness is manual Refresh. Default ~2s dedupe is
    // enough to merge Inventory + Tracking if they mount together.
    const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
        revalidateOnFocus: false,
        revalidateIfStale: false,
    });

    return {
        listingsByUser: data?.results ?? EMPTY_RESULTS,
        errorsByUser: data?.errors ?? EMPTY_ERRORS,
        fetchedAt: data?.fetchedAt ?? null,
        isLoading,
        isValidating,
        globalError: error,
        // Drop this range from the interval store, then recrawl. SWR views for
        // other ranges stay; overlapping days will be refetched next time they're needed.
        refresh: () => {
            const from = parseLocalDate(startFromStr);
            const to = parseLocalDate(startToStr);
            for (const user of sortedUsers) invalidateListingsRange(user, from, to);
            return mutate();
        },
    };
}
/**
 * Listings for the rolling default window. If a tab crosses midnight, Refresh
 * advances the window before SWR loads the newly entered local day.
 */
export function useDefaultEbayListings(users: string[]) {
    const [range, setRange] = useState(() => defaultListingsRange());
    const listings = useEbayListings(users, range.start, range.end);

    return {
        ...listings,
        refresh: () => {
            const next = defaultListingsRange();
            if (next.end.getTime() !== range.end.getTime()) {
                setRange(next);
                return Promise.resolve();
            }
            return listings.refresh();
        },
    };
}


/** Interval store + every SWR listings view. Use before signOut. */
export function clearListingsSession(): void {
    clearListingsIntervalCache();
    void mutate(
        (key) => Array.isArray(key) && key[0] === "ebayListings",
        undefined,
        { revalidate: false },
    );
}
