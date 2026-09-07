import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith("@/")) {
            return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
        }
        return nextResolve(specifier, context);
    },
});

const { mergeNotifications, messageSelectionKey, mutateNotification } = await import("./notification-state.ts");

function message(user, id = "shared", extra = {}) {
    return { user, id, read: false, trashed: false, notif: {}, ...extra };
}

function store(initial) {
    let state = initial;
    return {
        get messages() { return state; },
        update(apply) { state = apply(state); },
    };
}

function mutate(state, action, overrides = {}) {
    return mutateNotification({
        action,
        message: state.messages[0],
        localOnly: false,
        apiBaseUrl: "/api",
        inboxUri: "inbox",
        actionUri: action === "read" ? "mark_read" : "trash",
        update: state.update,
        ...overrides,
    });
}

test("SSE merging retains equal message IDs for different sellers", () => {
    const alice = message("alice");
    const bob = message("bob");
    const messages = mergeNotifications([alice], [bob]);
    assert.equal(messages.length, 2);
    assert.equal(new Set(messages.map(messageSelectionKey)).size, 2);
    assert.equal(messages.find((entry) => messageSelectionKey(entry) === messageSelectionKey(bob)), bob);
});

test("SSE replay and repeated entries within a batch do not duplicate or reset local state", () => {
    const read = message("alice", "shared", { read: true });
    const previous = [read];
    assert.equal(mergeNotifications(previous, [message("alice")]), previous);
    const bob = message("bob");
    const merged = mergeNotifications(previous, [bob, bob, message("alice")]);
    assert.equal(merged.length, 2);
    assert.equal(merged.find((entry) => entry.user === "alice").read, true);
});

for (const action of ["read", "trash", "delete"]) {
    test(`local ${action} updates only the chosen seller and makes no API request`, async (t) => {
        const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected request"); });
        const alice = message("alice");
        const bob = message("bob");
        const state = store([alice, bob]);
        await mutate(state, action, { localOnly: true, apiBaseUrl: undefined });
        assert.equal(fetch.mock.callCount(), 0);
        assert.equal(state.messages.find((entry) => entry.user === "bob"), bob);
        if (action === "delete") assert.deepEqual(state.messages, [bob]);
        else assert.equal(state.messages[0][action === "read" ? "read" : "trashed"], true);
        assert.equal(alice.read, false);
        assert.equal(alice.trashed, false);
    });
}

test("failed deletion leaves the message and concurrently delivered messages visible", async (t) => {
    const started = Promise.withResolvers();
    const response = Promise.withResolvers();
    t.mock.method(globalThis, "fetch", () => {
        started.resolve();
        return response.promise;
    });
    const alice = message("alice", "shared", { trashed: true });
    const state = store([alice, message("bob")]);
    const deletion = mutate(state, "delete");
    const rejected = assert.rejects(deletion, /Could not delete message \(500\)/);
    await started.promise;
    assert.equal(state.messages[0], alice);
    state.update((current) => mergeNotifications(current, [message("alice", "arrived")]));
    response.resolve(new Response(null, { status: 500 }));
    await rejected;
    assert.equal(state.messages.length, 3);
    assert.equal(state.messages.find((entry) => entry.user === "alice" && entry.id === "shared"), alice);
});

test("confirmed deletion encodes the API path and removes only the selected seller's message", async (t) => {
    const fetch = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
    const bob = message("bob", "id/with?parts");
    const state = store([message("seller/name", "id/with?parts"), bob]);
    await mutate(state, "delete");
    assert.equal(fetch.mock.calls[0].arguments[0], "/api/inbox/seller%2Fname/id%2Fwith%3Fparts/trash");
    assert.equal(fetch.mock.calls[0].arguments[1].method, "DELETE");
    assert.deepEqual(state.messages, [bob]);
});

test("failed trash restores only the chosen message and keeps existing trash state", async (t) => {
    const started = Promise.withResolvers();
    const response = Promise.withResolvers();
    t.mock.method(globalThis, "fetch", () => {
        started.resolve();
        return response.promise;
    });
    const bob = message("bob", "shared", { trashed: true });
    const state = store([message("alice"), bob]);
    const trash = mutate(state, "trash");
    const rejected = assert.rejects(trash, /Could not trash message/);
    await started.promise;
    assert.equal(state.messages[0].trashed, true);
    state.update((current) => mergeNotifications(current, [message("alice", "arrived")]));
    response.resolve(new Response(null, { status: 403 }));
    await rejected;
    assert.equal(state.messages.find((entry) => entry.id === "shared" && entry.user === "alice").trashed, false);
    assert.equal(state.messages.find((entry) => entry.user === "bob"), bob);
    assert.equal(state.messages.length, 3);
});

test("network errors roll back optimistic read state", async (t) => {
    t.mock.method(globalThis, "fetch", async () => { throw new Error("Network unavailable"); });
    const state = store([message("alice"), message("bob", "shared", { read: true })]);
    await assert.rejects(mutate(state, "read"), /Network unavailable/);
    assert.equal(state.messages[0].read, false);
    assert.equal(state.messages[1].read, true);
});

test("already-read and already-trashed messages do not send redundant mutations", async (t) => {
    const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected request"); });
    const state = store([message("alice", "shared", { read: true, trashed: true })]);
    await mutate(state, "read");
    await mutate(state, "trash");
    assert.equal(fetch.mock.callCount(), 0);
});

test("missing API configuration reports an error without changing member messages", async (t) => {
    const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected request"); });
    for (const action of ["read", "trash", "delete"]) {
        const initial = [message("alice")];
        const state = store(initial);
        await assert.rejects(mutate(state, action, { inboxUri: undefined }), /configuration is incomplete/);
        assert.equal(state.messages, initial);
    }
    assert.equal(fetch.mock.callCount(), 0);
});
