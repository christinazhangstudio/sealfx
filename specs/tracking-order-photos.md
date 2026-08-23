# Tracking order photos

Orders and listings use different clocks. Do not widen the listings crawl to “fix” missing Tracking images.

## The mismatch

| API | Window | Clock |
|---|---|---|
| Fulfillment `GetOrders` | last **90 days** (eBay default; we pass no filter) | order `creationDate` |
| Trading `GetSellerList` | last **120 days** (API cap) | listing `StartTime` |

A GTC / long-running listing started 8 months ago and sold yesterday is on the Tracking board and **not** in the 120-day listings cache. 90 ⊂ 120 is false when the clocks differ.

## Display window vs API window

`GET /tracking` is still the unfiltered 90-day eBay default. The board defaults to **last 30 local days** (`creationDate`). **Last 90 days** is a client filter on that same payload — no second GetOrders.

## What we do

GetItem runs for line items **on the current board** whose `legacyItemId` is not in the 120-day listings cache:

```
GET /api/listings/{seller}/items/{itemId}
```

Default board is 30 days, so only those misses are fetched. Switching to 90 days fetches the additional misses (days 31–90). Already-tried ids are not refetched.

Sealift calls Trading `GetItem`. One request per missing id. Store the item in the same per-seller interval map (`rememberListingItem`) so a later Inventory/Tracking view can reuse the photo. That write does **not** mark a day-span as covered — we did not crawl those days.

Failed lookups are remembered for the session so we do not hammer GetItem.

Sandbox orders keep using `SANDBOX_LISTING_IMAGES`. No GetItem.

## What we do not do

- Crawl listings further than 120 days (Trading will not)
- Hide orders that still have no photo
- Put fulfillment / orders into SWR

## Files

- `sealift/ebay/trading.go` — `GetItem`
- `sealift/handlers_ebay.go` — `handleGetListingItem`
- `sealfx/lib/ebay-data.ts` — `fetchListingItem`
- `sealfx/lib/listings-interval-cache.ts` — `rememberListingItem` / `getCachedListingItem`
- `sealfx/app/tracking/page.tsx` — fill missing card images after the 120-day crawl
