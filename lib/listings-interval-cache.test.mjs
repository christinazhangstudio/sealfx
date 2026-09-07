import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// Match Next's TypeScript aliases when running directly with Node 24+.
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith("@/")) {
            return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
        }
        if (specifier === "./mock-listings") {
            return nextResolve(new URL("./mock-listings.ts", context.parentURL).href, context);
        }
        return nextResolve(specifier, context);
    },
});

process.env.NEXT_PUBLIC_API_URL = "/api";
process.env.NEXT_PUBLIC_LISTINGS_URI = "listings";
process.env.TZ = "America/Chicago";

const {
    clearListingsIntervalCache,
    getCachedListingItem,
    invalidateListingsRange,
    loadListingsForRange,
} = await import("./listings-interval-cache.ts");
const { formatApiDate, parseLocalDate } = await import("./date-range.ts");

function listing(id, day, title = id) {
    return {
        ItemID: id,
        Title: title,
        Quantity: 1,
        SellingStatus: { CurrentPrice: { Value: 10 } },
        ListingDetails: { StartTime: new Date(`${day}T12:00:00`).toISOString() },
    };
}

function page(items = [], more = false) {
    return Response.json({ listings: { ItemArray: { Items: items }, HasMoreItems: more } });
}

function range(url) {
    const query = new URL(url, "http://sealift.test").searchParams;
    return ["startFrom", "startTo"].map((key) => formatApiDate(new Date(query.get(key))));
}

function load(from, to = from, seller = "seller") {
    return loadListingsForRange(seller, parseLocalDate(from), parseLocalDate(to));
}

function deferred() {
    return Promise.withResolvers();
}

test.beforeEach(() => clearListingsIntervalCache());
test.afterEach(() => clearListingsIntervalCache());

test("concurrent overlapping views crawl only the uncovered days", async (t) => {
    const started = deferred();
    const release = deferred();
    const ranges = [];
    t.mock.method(globalThis, "fetch", async (url) => {
        ranges.push(range(url));
        if (ranges.length === 1) {
            started.resolve();
            await release.promise;
            return page([listing("shared", "2026-09-02")]);
        }
        return page([listing("last", "2026-09-03")]);
    });

    const first = load("2026-09-01", "2026-09-02");
    await started.promise;
    const second = load("2026-09-02", "2026-09-03");
    release.resolve();
    const [firstItems, secondItems] = await Promise.all([first, second]);

    assert.deepEqual(ranges, [["2026-09-01", "2026-09-02"], ["2026-09-03", "2026-09-03"]]);
    assert.deepEqual(firstItems.map((item) => item.ItemID), ["shared"]);
    assert.deepEqual(secondItems.map((item) => item.ItemID), ["shared", "last"]);
});

test("concurrent identical ranges share a crawl", async (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () => page([listing("one", "2026-09-01")]));
    const results = await Promise.all([load("2026-09-01"), load("2026-09-01")]);
    assert.equal(fetch.mock.callCount(), 1);
    assert.deepEqual(results[0], results[1]);
});

test("different sellers can crawl in parallel", async (t) => {
    const firstStarted = deferred();
    const release = deferred();
    t.mock.method(globalThis, "fetch", async (url) => {
        if (url.includes("/alice?")) {
            firstStarted.resolve();
            await release.promise;
        }
        return page();
    });
    const first = load("2026-09-01", "2026-09-01", "alice");
    await firstStarted.promise;
    await load("2026-09-01", "2026-09-01", "bob");
    release.resolve();
    await first;
});

test("a failed crawl does not block the next request", async (t) => {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
        calls++;
        return calls === 1 ? new Response(null, { status: 500 }) : page([listing("retry", "2026-09-01")]);
    });
    const first = load("2026-09-01");
    const second = load("2026-09-01");
    await assert.rejects(first, /500/);
    assert.equal((await second)[0].ItemID, "retry");
    assert.equal(calls, 2);
});

test("a page cap reports incomplete data and leaves the range uncached", async (t) => {
    let capped = true;
    const fetch = t.mock.method(globalThis, "fetch", async () => page([listing("one", "2026-09-01")], capped));
    await assert.rejects(load("2026-09-01"), /incomplete|narrower/i);
    assert.equal(fetch.mock.callCount(), 200);
    assert.equal(getCachedListingItem("seller", "one"), undefined);

    capped = false;
    assert.equal((await load("2026-09-01"))[0].ItemID, "one");
    assert.equal(fetch.mock.callCount(), 201);
});

test("Refresh discards an older in-flight crawl and preserves other covered days", async (t) => {
    const started = deferred();
    const release = deferred();
    let staleSignal;
    let calls = 0;
    t.mock.method(globalThis, "fetch", async (_url, init) => {
        calls++;
        if (calls === 1) return page([listing("other", "2026-09-01")]);
        if (calls === 2) {
            staleSignal = init.signal;
            started.resolve();
            await release.promise; // Simulate a response that ignores cancellation.
            return page([listing("changed", "2026-09-02", "stale")]);
        }
        return page([listing("changed", "2026-09-02", "fresh")]);
    });
    await load("2026-09-01");
    const old = load("2026-09-02");
    const rejected = assert.rejects(old, { name: "AbortError" });
    await started.promise;
    invalidateListingsRange("seller", parseLocalDate("2026-09-02"), parseLocalDate("2026-09-02"));
    const fresh = await load("2026-09-02");
    release.resolve();
    await rejected;

    assert.equal(staleSignal.aborted, true);
    assert.equal(fresh[0].Title, "fresh");
    assert.equal(getCachedListingItem("seller", "changed").Title, "fresh");
    assert.equal((await load("2026-09-01"))[0].ItemID, "other");
    assert.equal(calls, 3);
});

test("session clearing cancels both active and queued old requests", async (t) => {
    const started = deferred();
    const release = deferred();
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
        calls++;
        if (calls === 1) {
            started.resolve();
            await release.promise;
            return page([listing("old", "2026-09-01")]);
        }
        return page([listing("new", "2026-09-01")]);
    });
    const old = load("2026-09-01");
    const oldRejected = assert.rejects(old, { name: "AbortError" });
    await started.promise;
    const queued = load("2026-09-01", "2026-09-02");
    const queuedRejected = assert.rejects(queued, { name: "AbortError" });
    clearListingsIntervalCache();
    const fresh = await load("2026-09-01");
    release.resolve();
    await Promise.all([oldRejected, queuedRejected]);

    assert.equal(calls, 2);
    assert.deepEqual(fresh.map((item) => item.ItemID), ["new"]);
    assert.equal(getCachedListingItem("seller", "old"), undefined);
});

test("cached subsets and empty days do not recrawl, including across DST", async (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () => page());
    await load("2026-10-31", "2026-11-02");
    assert.deepEqual(await load("2026-11-01"), []);
    assert.equal(fetch.mock.callCount(), 1);
    invalidateListingsRange("seller", parseLocalDate("2026-11-01"), parseLocalDate("2026-11-01"));
    await load("2026-10-31", "2026-11-02");
    assert.deepEqual(range(fetch.mock.calls[1].arguments[0]), ["2026-11-01", "2026-11-01"]);
});
