/**
 * Canonical eBay data fetching for the analytics pages.
 *
 * Listings, Gallery and Charts each carried their own copy of the date
 * chunking, page-draining and merge logic. The copies drifted, and two of the
 * bugs that caused were visible to users:
 *
 *  - the chunk boundary was computed in milliseconds but the API takes whole
 *    dates, so consecutive chunks both queried the boundary day and every item
 *    listed that day was counted twice (the default range is exactly one chunk
 *    length, so this fired on the default view). Nothing deduplicated.
 *  - Payouts and Charts used different loop-termination conditions for the same
 *    endpoint, so the same seller could report different totals on two pages.
 *
 * Everything here works in whole local days, deduplicates by ItemID, uses one
 * termination rule per endpoint, and is cancellable.
 */

import { trackedFetch as fetch } from "@/lib/api-tracker";
import { formatApiDate, getDateChunks } from "@/lib/date-range";

export { formatApiDate, getDateChunks, MAX_DAYS_PER_CHUNK } from "@/lib/date-range";

// --- Types -----------------------------------------------------------------

export interface SellingStatus {
    CurrentPrice: { Value: number; CurrencyID?: string };
    QuantitySold?: number;
    ListingStatus?: string;
}

export interface ListingDetails {
    StartTime: string;
    EndTime?: string;
    ViewItemURL?: string;
}

export interface PictureDetails {
    PictureURLs?: string[] | null;
    GalleryURL?: string;
}

export interface PrimaryCategory {
    CategoryID?: string;
    CategoryName?: string;
}

export interface Item {
    ItemID: string;
    Title: string;
    Quantity: number;
    SellingStatus: SellingStatus;
    ListingDetails: ListingDetails;
    PictureDetails?: PictureDetails;
    PrimaryCategory?: PrimaryCategory;
    [key: string]: unknown;
}

export interface Listings {
    PaginationResult: { TotalNumberOfPages: number; TotalNumberOfEntries: number };
    HasMoreItems: boolean;
    ItemArray: { Items: Item[] };
    ItemsPerPage: number;
    PageNumber: number;
    ReturnedItemCountActual: number;
    [key: string]: unknown;
}

export interface Amount {
    value: string;
    currency?: string;
}

export interface PayoutInstrument {
    nickname?: string;
    accountLastFourDigits?: string;
    instrumentType?: string;
}

export interface Payout {
    payoutId: string;
    payoutStatus?: string;
    payoutStatusDescription?: string;
    payoutDate?: string;
    transactionCount?: number;
    payoutInstrument?: PayoutInstrument;
    amount: Amount;
    [key: string]: unknown;
}

export interface PayoutsResponse {
    href: string;
    next: string;
    prev: string;
    limit: number;
    offset: number;
    payouts: Payout[];
    total: number;
}

export interface UserPayouts {
    user: string;
    payouts: PayoutsResponse;
}

// --- Constants -------------------------------------------------------------

/** Rows requested per API call. */
export const API_PAGE_SIZE = 200;

/**
 * Hard stop on the page-drain loops. They previously ran until the server said
 * stop, so a backend that always reported "more" span forever at full speed.
 * 200 pages is ~40k listings — far past anything the UI can usefully show.
 */
const MAX_PAGES = 200;

export class ReauthRequiredError extends Error {
    readonly user: string;

    constructor(user: string, message: string) {
        super(message);
        this.name = "ReauthRequiredError";
        this.user = user;
    }
}

// --- Fetching --------------------------------------------------------------

export interface FetchOptions {
    signal?: AbortSignal;
}

function requireEnv(name: string, value: string | undefined): string {
    if (!value) throw new Error(`${name} is not configured`);
    return value;
}

async function readError(response: Response, user: string): Promise<never> {
    // The backend answers 409 when a seller's eBay authorization has lapsed;
    // that needs a reconnect prompt, not a generic failure.
    if (response.status === 409) {
        let message = "This seller needs to be reconnected to eBay.";
        try {
            const body = await response.json();
            if (body?.error === "reauth_required" && body?.message) message = body.message;
        } catch {
            /* fall through to the default message */
        }
        throw new ReauthRequiredError(user, message);
    }
    throw new Error(`Request failed for ${user} (${response.status})`);
}

async function fetchListingsPage(
    user: string,
    pageIdx: number,
    from: Date,
    to: Date,
    opts: FetchOptions,
): Promise<Listings | null> {
    const base = requireEnv("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL);
    const uri = requireEnv("NEXT_PUBLIC_LISTINGS_URI", process.env.NEXT_PUBLIC_LISTINGS_URI);

    const params = new URLSearchParams({
        pageSize: String(API_PAGE_SIZE),
        pageIdx: String(pageIdx),
        startFrom: formatApiDate(from),
        startTo: formatApiDate(to),
    });

    const response = await fetch(`${base}/${uri}/${user}?${params}`, { signal: opts.signal });
    if (!response.ok) await readError(response, user);

    const data = await response.json();
    // The backend returns `listings: null` for an empty result; callers used to
    // dereference it straight into a TypeError mid-crawl.
    return (data?.listings as Listings) ?? null;
}

export interface ListingsResult {
    items: Item[];
    /** Distinct items actually retrieved. */
    total: number;
    /** True if a page cap was hit, so `items` is incomplete. */
    truncated: boolean;
}

/**
 * Retrieves every listing for a seller in a date range, across as many API
 * pages and date windows as needed, deduplicated by ItemID.
 */
export async function fetchAllListings(
    user: string,
    from: Date,
    to: Date,
    opts: FetchOptions = {},
): Promise<ListingsResult> {
    const byItemId = new Map<string, Item>();
    let truncated = false;

    for (const { start, end } of getDateChunks(from, to)) {
        let pageIdx = 1;

        while (pageIdx <= MAX_PAGES) {
            if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

            const page = await fetchListingsPage(user, pageIdx, start, end, opts);
            const items = Array.isArray(page?.ItemArray?.Items) ? page!.ItemArray.Items : [];

            for (const item of items) {
                // Windows are exclusive now, but a seller can still appear twice
                // across retries; keying by ItemID makes merging idempotent.
                if (item?.ItemID) byItemId.set(item.ItemID, item);
            }

            if (!page?.HasMoreItems) break;
            pageIdx++;

            if (pageIdx > MAX_PAGES) truncated = true;
        }
    }

    const items = Array.from(byItemId.values());
    return { items, total: items.length, truncated };
}

/**
 * Retrieves every payout for a seller.
 *
 * Termination follows the API's own `next` link. The Payouts page previously
 * also required a full page (`length === pageSize`), which silently stopped
 * after page one whenever the backend returned fewer rows than requested —
 * while Charts kept going, so the two pages disagreed.
 */
export async function fetchAllPayouts(
    user: string,
    opts: FetchOptions = {},
): Promise<PayoutsResponse> {
    const base = requireEnv("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL);
    const uri = requireEnv("NEXT_PUBLIC_PAYOUTS_URI", process.env.NEXT_PUBLIC_PAYOUTS_URI);

    const all: Payout[] = [];
    const seen = new Set<string>();
    let pageIdx = 0;
    let total = 0;
    let href = "";

    while (pageIdx < MAX_PAGES) {
        if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

        const params = new URLSearchParams({
            pageSize: String(API_PAGE_SIZE),
            pageIdx: String(pageIdx),
        });

        const response = await fetch(`${base}/${uri}/${user}?${params}`, { signal: opts.signal });
        if (!response.ok) await readError(response, user);

        const data: UserPayouts = await response.json();
        const page = data?.payouts;
        const payouts = Array.isArray(page?.payouts) ? page.payouts : [];

        for (const payout of payouts) {
            const key = payout?.payoutId;
            if (key && seen.has(key)) continue;
            if (key) seen.add(key);
            all.push(payout);
        }

        total = page?.total || total;
        href = page?.href || href;

        // An empty page also stops the loop, so a backend that always returns a
        // `next` link can't spin forever.
        if (!page?.next || payouts.length === 0) break;
        pageIdx++;
    }

    return {
        href,
        next: "",
        prev: "",
        limit: API_PAGE_SIZE,
        offset: 0,
        payouts: all,
        total: total || all.length,
    };
}
