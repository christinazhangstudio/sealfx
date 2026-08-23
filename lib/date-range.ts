/**
 * Date helpers for eBay's whole-day range parameters.
 *
 * Kept dependency-free and pure so the boundary arithmetic can be exercised
 * directly — it is the part that was silently wrong (see getDateChunks).
 */

/** eBay rejects Trading API date ranges longer than 120 days. */
export const MAX_DAYS_PER_CHUNK = 120;

/**
 * Formats a date as YYYY-MM-DD in the *local* calendar.
 *
 * toISOString() converts to UTC first, so for anyone west of UTC an evening
 * date becomes tomorrow — shifting the whole requested range by a day.
 */
export function formatApiDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/** Inverse of formatApiDate. `new Date("YYYY-MM-DD")` is UTC midnight — don't use it. */
export function parseLocalDate(ymd: string): Date {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d);
}

export function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

/**
 * Splits a range into consecutive windows of at most MAX_DAYS_PER_CHUNK whole
 * local days, with no day in two windows and no day skipped between them.
 *
 * A 120-day local span that crosses the fall DST transition is 120 days plus
 * one hour as an absolute timestamp range. eBay rejects spans over 120 × 24
 * hours, so that one exceptional window is shortened by a day.
 */
export function getDateChunks(from: Date, to: Date): { start: Date; end: Date }[] {
    const chunks: { start: Date; end: Date }[] = [];
    const finalEnd = startOfDay(to);
    let currentStart = startOfDay(from);

    if (currentStart > finalEnd) return chunks;

    while (currentStart <= finalEnd) {
        // -1 because both endpoints are inclusive.
        const proposedEnd = addDays(currentStart, MAX_DAYS_PER_CHUNK - 1);
        let end = proposedEnd > finalEnd ? finalEnd : proposedEnd;
        const endExclusive = addDays(end, 1);
        if (endExclusive.getTime() - currentStart.getTime() > MAX_DAYS_PER_CHUNK * 86_400_000) {
            end = addDays(end, -1);
        }
        chunks.push({ start: currentStart, end });
        currentStart = addDays(end, 1);
    }
    return chunks;
}

/** Default listings window: today and the 119 local days before it (120 inclusive). */
export function defaultListingsRange(now: Date = new Date()): { start: Date; end: Date } {
    const end = startOfDay(now);
    return { start: addDays(end, -(MAX_DAYS_PER_CHUNK - 1)), end };
}

/** Clock only if today; otherwise include a date so a days-old session cache isn't misleading. */
export function formatFetchedAt(d: Date, now: Date = new Date()): string {
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const startOfToday = startOfDay(now);
    const startOfThatDay = startOfDay(d);
    const dayDiff = Math.round((startOfToday.getTime() - startOfThatDay.getTime()) / 86_400_000);
    if (dayDiff === 0) return time;
    if (dayDiff === 1) return `Yesterday, ${time}`;
    const date = d.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
    });
    return `${date}, ${time}`;
}

/** True if `iso` falls on one of the last `days` local calendar days (inclusive of today). Missing date keeps the row. */
export function isWithinLocalDays(iso: string | undefined, days: number, now: Date = new Date()): boolean {
    if (!iso) return true;
    const when = startOfDay(new Date(iso));
    if (Number.isNaN(when.getTime())) return true;
    const cutoff = addDays(startOfDay(now), -(days - 1));
    return when >= cutoff;
}
