# Listings cache

Session-only. Lives in this tab’s JS heap. Not `localStorage`, not the server. Close the tab or hard-reload and it is gone.

Two layers:

1. **SWR** — one view per `(users, from, to)`. Stops Inventory and Tracking from crawling the same window twice. No background recrawl (`revalidateOnFocus` / `revalidateIfStale` off). Freshness is the **Refresh** button.
2. **Interval store** (`lib/listings-interval-cache.ts`) — one copy of each listing per seller, plus the local-day spans already covered. Sits *under* the SWR fetcher.

## Why two layers

SWR keys are exact. These are different entries:

```
["ebayListings", ["alice"], "2026-01-01", "2026-08-15"]
["ebayListings", ["alice"], "2026-03-01", "2026-04-30"]
```

Without the interval store, Apply on a subset recrawled eBay and stored the same items twice. The interval store answers “which days do we already have for this seller?” and only fetches the gaps.

Crawls queue per seller. Each request calculates its missing days after earlier requests finish, so concurrent overlapping views reuse their shared days. Different sellers still load in parallel. Failed or page-capped crawls leave their unfinished gap uncovered; a capped crawl reports an error asking for a narrower range instead of presenting partial data as complete.

```
Apply Jan–Aug  → crawl Jan–Aug, remember that span
Apply Mar–Apr  → span already covered → no crawl, filter the store
Apply Dec–Feb  → crawl only Dec (gap before Jan)
Refresh        → drop the *applied* span, recrawl that span only
```

Listings are `Map<ItemID, Item>` per seller. Overlapping views point at the same objects.

## Date rules

- Whole **local** calendar days (`formatApiDate` / `parseLocalDate`). Never `toISOString()` / `new Date("YYYY-MM-DD")` — those are UTC and shift the day west of UTC.
- Default window: today and the 119 local days before it (`defaultListingsRange`, 120 inclusive). Inventory Reset and Tracking both use this, so they share one SWR key.
- Inventory pickers are a draft. The cache key uses `appliedDates` (Apply / Reset). Changing From/To without Apply does not crawl.

## What Refresh does

- **Inventory:** invalidate the applied day span in the interval store, then `mutate()` that SWR key. Recrawls listings for that range only.
- **Tracking:** same listings recrawl, **plus** a new `GET /tracking` (fulfillment / orders). Fulfillment is not in SWR.

Invalidation cancels that seller's active and queued listings crawls. Their late responses cannot restore removed coverage or overwrite refreshed items. Session clearing cancels every seller's pending crawls before dropping the store.

The “Last updated at …” stamp is `fetchedAt` on the SWR payload — time of that view’s last listings crawl, not fulfillment.

## What is not cached

| Data | Where it lives |
|---|---|
| Listing items + images | Interval store + SWR |
| Fulfillment / orders | One-shot `/tracking` fetch (Tracking remount or Refresh) |
| Users list | One-shot users API on mount |
| Order photos outside the 120-day StartTime window | Per-item `GetItem` (see `specs/tracking-order-photos.md`) |

## RAM

Each applied range still has a small SWR view (array of pointers). Item payloads are not copied per range. A long session with many overlapping Applies is cheap. A long session with many *disjoint* ranges still holds every listing you crawled until the tab dies.
Clear on logout / account delete (`clearListingsSession` in `useEbayListings.ts`). Interval store + every SWR listings view. Next account on the same tab starts empty.

## Files

- `lib/listings-interval-cache.ts` — per-seller items + covered intervals, gap fetch, invalidate
- `lib/useEbayListings.ts` — SWR view + Refresh
- `lib/date-range.ts` — local-day helpers, default 120-day window, `formatFetchedAt`

Run the cache regression tests with Node 24+: `node --test lib/listings-interval-cache.test.mjs`.
