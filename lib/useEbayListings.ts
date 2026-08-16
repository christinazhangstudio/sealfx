import useSWR from "swr";
import { fetchAllListings, type Item } from "@/lib/ebay-data";

const fetcher = async ([_, users, startFromStr, startToStr]: [string, string[], string, string]) => {
  const startFrom = new Date(startFromStr);
  const startTo = new Date(startToStr);

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

  return { results, errors };
};

export function useEbayListings(users: string[], startFrom: Date, startTo: Date) {
  // Sort users to ensure a stable cache key regardless of array order
  const sortedUsers = [...users].sort();
  
  // Normalize dates to YYYY-MM-DD so cache hits even if timestamps differ by milliseconds
  const startFromStr = startFrom.toISOString().split('T')[0];
  const startToStr = startTo.toISOString().split('T')[0];

  const key = sortedUsers.length > 0 
    ? ["ebayListings", sortedUsers, startFromStr, startToStr] 
    : null;

  const { data, error, isLoading, isValidating } = useSWR(key, fetcher, {
    revalidateOnFocus: false,      // Prevent spam on tab focus
    revalidateIfStale: false,      // Trust the cache implicitly
    dedupingInterval: 86400000,    // 24 hours (86,400,000 ms)
  });

  return {
    listingsByUser: data?.results || {},
    errorsByUser: data?.errors || {},
    isLoading,
    isValidating,
    globalError: error,
  };
}
