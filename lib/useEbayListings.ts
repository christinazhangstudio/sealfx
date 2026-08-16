import useSWR from "swr";
import { fetchAllListings, formatApiDate, type Item } from "@/lib/ebay-data";

// Stable empty fallbacks. Returning a fresh `{}` literal on every render gave
// `listingsByUser` / `errorsByUser` a new object identity while SWR had no data,
// which re-triggered downstream effects (deps on these objects) on every render —
// an infinite setState loop ("Maximum update depth exceeded").
const EMPTY_RESULTS: Record<string, Item[]> = {};
const EMPTY_ERRORS: Record<string, string> = {};

// YYYY-MM-DD as a local calendar day. `new Date("YYYY-MM-DD")` is UTC midnight,
// which west of UTC is the previous evening — same off-by-one formatApiDate exists to avoid.
function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const fetcher = async ([_, users, startFromStr, startToStr]: [string, string[], string, string]) => {
  const startFrom = parseLocalDate(startFromStr);
  const startTo = parseLocalDate(startToStr);

  const results: Record<string, Item[]> = {};
  const errors: Record<string, string> = {};

  await Promise.all(
    users.map(async (user) => {
      try {
        const { items } = await fetchAllListings(user, startFrom, startTo, {});
        results[user] = items;
      } catch (err) {
        console.error(`Failed to fetch listings for ${user}:`, err);
        errors[user] = err instanceof Error ? err.message : String(err);
        results[user] = []; // Fallback to empty array on failure
      }
    })
  );

  return { results, errors, fetchedAt: Date.now() };
};

export function useEbayListings(users: string[], startFrom: Date, startTo: Date) {
  // Sort users so Gallery and Tracking share a cache key regardless of array order.
  const sortedUsers = [...users].sort();

  // Local YYYY-MM-DD — same calendar the date pickers and eBay API use.
  const startFromStr = formatApiDate(startFrom);
  const startToStr = formatApiDate(startTo);

  const key = sortedUsers.length > 0
    ? ["ebayListings", sortedUsers, startFromStr, startToStr]
    : null;

  // Session cache only. No background recrawl — the eBay crawl is too expensive
  // to fire on focus/remount. Freshness is manual Refresh. Default ~2s dedupe is
  // enough to merge Gallery + Tracking if they mount together.
  const { data, error, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });

  // `data` is a stable reference across renders (SWR caches it), so these
  // fall back to the module-level constants only while empty — no per-render churn.
  return {
    listingsByUser: data?.results ?? EMPTY_RESULTS,
    errorsByUser: data?.errors ?? EMPTY_ERRORS,
    // When this payload was crawled. Lives on the cached SWR data so a remount
    // shows the real fetch time, and a refresh updates it even if listings didn't change.
    fetchedAt: data?.fetchedAt ?? null,
    isLoading,
    isValidating,
    globalError: error,
    // Forces a fresh fetch, bypassing the cache. Used by the manual Refresh button.
    refresh: () => mutate(),
  };
}
