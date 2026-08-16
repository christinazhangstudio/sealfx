/**
 * Session listings store keyed by seller, then by covered local-day intervals.
 *
 * SWR still keys views by (users, from, to). This module sits under the fetcher
 * so a later Apply whose range is already covered does not recrawl, and a
 * partial overlap only fetches the missing days. Listings are stored once per
 * ItemID per seller — overlapping ranges share the same Item objects.
 *
 * See listings-cache.md.
 */

import { fetchAllListings, type Item } from "@/lib/ebay-data";
import {
    addDays,
    formatApiDate,
    parseLocalDate,
    startOfDay,
} from "@/lib/date-range";

export type DayInterval = { start: string; end: string };

type SellerStore = {
    items: Map<string, Item>;
    intervals: DayInterval[];
};

const sellers = new Map<string, SellerStore>();

function dayMs(ymd: string): number {
    return parseLocalDate(ymd).getTime();
}

function cmpDay(a: string, b: string): number {
    return dayMs(a) - dayMs(b);
}

/** Merge overlapping / touching intervals. Touching days are one span (end+1 == next.start). */
export function mergeIntervals(intervals: DayInterval[]): DayInterval[] {
    if (intervals.length === 0) return [];
    const sorted = [...intervals].sort((a, b) => cmpDay(a.start, b.start) || cmpDay(a.end, b.end));
    const out: DayInterval[] = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
        const cur = sorted[i];
        const last = out[out.length - 1];
        const lastEndNext = formatApiDate(addDays(parseLocalDate(last.end), 1));
        if (cmpDay(cur.start, lastEndNext) <= 0) {
            if (cmpDay(cur.end, last.end) > 0) last.end = cur.end;
        } else {
            out.push({ ...cur });
        }
    }
    return out;
}

/** Inclusive local-day gaps in [from, to] not covered by `covered`. */
export function missingIntervals(
    from: string,
    to: string,
    covered: DayInterval[],
): DayInterval[] {
    if (cmpDay(from, to) > 0) return [];
    const merged = mergeIntervals(covered);
    const gaps: DayInterval[] = [];
    let cursor = from;
    for (const span of merged) {
        if (cmpDay(span.end, cursor) < 0) continue;
        if (cmpDay(span.start, to) > 0) break;
        if (cmpDay(span.start, cursor) > 0) {
            const gapEnd = formatApiDate(addDays(parseLocalDate(span.start), -1));
            if (cmpDay(cursor, gapEnd) <= 0) gaps.push({ start: cursor, end: gapEnd });
        }
        const after = formatApiDate(addDays(parseLocalDate(span.end), 1));
        if (cmpDay(after, cursor) > 0) cursor = after;
        if (cmpDay(cursor, to) > 0) return gaps;
    }
    if (cmpDay(cursor, to) <= 0) gaps.push({ start: cursor, end: to });
    return gaps;
}

function getSeller(user: string): SellerStore {
    let store = sellers.get(user);
    if (!store) {
        store = { items: new Map(), intervals: [] };
        sellers.set(user, store);
    }
    return store;
}

function listingInRange(item: Item, from: string, to: string): boolean {
    const raw = item.ListingDetails?.StartTime;
    if (!raw) return true;
    const start = formatApiDate(startOfDay(new Date(raw)));
    return cmpDay(start, from) >= 0 && cmpDay(start, to) <= 0;
}

export async function loadListingsForRange(
    user: string,
    from: Date,
    to: Date,
): Promise<Item[]> {
    const fromStr = formatApiDate(from);
    const toStr = formatApiDate(to);
    const store = getSeller(user);
    const gaps = missingIntervals(fromStr, toStr, store.intervals);

    for (const gap of gaps) {
        const { items } = await fetchAllListings(
            user,
            parseLocalDate(gap.start),
            parseLocalDate(gap.end),
            {},
        );
        for (const item of items) {
            if (item?.ItemID) store.items.set(item.ItemID, item);
        }
        store.intervals = mergeIntervals([...store.intervals, gap]);
    }

    return Array.from(store.items.values()).filter((item) =>
        listingInRange(item, fromStr, toStr),
    );
}

/** Drop covered days in [from, to] so the next load recrawls them. Items in that window are removed. */
export function invalidateListingsRange(user: string, from: Date, to: Date): void {
    const fromStr = formatApiDate(from);
    const toStr = formatApiDate(to);
    const store = sellers.get(user);
    if (!store) return;

    for (const [id, item] of store.items) {
        if (listingInRange(item, fromStr, toStr)) store.items.delete(id);
    }

    const remaining: DayInterval[] = [];
    for (const span of store.intervals) {
        remaining.push(...subtractInterval(span, fromStr, toStr));
    }
    store.intervals = mergeIntervals(remaining);
    if (store.items.size === 0 && store.intervals.length === 0) sellers.delete(user);
}

function subtractInterval(span: DayInterval, cutFrom: string, cutTo: string): DayInterval[] {
    if (cmpDay(span.end, cutFrom) < 0 || cmpDay(span.start, cutTo) > 0) return [span];
    const out: DayInterval[] = [];
    if (cmpDay(span.start, cutFrom) < 0) {
        out.push({
            start: span.start,
            end: formatApiDate(addDays(parseLocalDate(cutFrom), -1)),
        });
    }
    if (cmpDay(span.end, cutTo) > 0) {
        out.push({
            start: formatApiDate(addDays(parseLocalDate(cutTo), 1)),
            end: span.end,
        });
    }
    return out;
}

/** Drop every seller. Call on logout so the next account cannot see this tab's listings. */
export function clearListingsIntervalCache(): void {
    sellers.clear();
}
