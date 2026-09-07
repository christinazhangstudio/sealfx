import assert from "node:assert/strict";
import test from "node:test";

process.env.INTERNAL_API_URL = "http://backend.test/api";
const { GET } = await import("./route.ts");

function request(signal = new AbortController().signal, headers = {}) {
  return {
    nextUrl: new URL("https://sealift.test/api/ai/ask?q=hello%20world&stream=1"),
    headers: new Headers(headers),
    signal,
  };
}

test("browser cancellation aborts the backend request while waiting for headers", async (t) => {
  const browser = new AbortController();
  const started = Promise.withResolvers();
  const canceled = Promise.withResolvers();
  let backendSignal;
  t.mock.method(globalThis, "fetch", (_url, init) => {
    backendSignal = init.signal;
    started.resolve();
    return new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        canceled.resolve();
        reject(init.signal.reason);
      }, { once: true });
    });
  });

  const response = GET(request(browser.signal));
  await started.promise;
  assert.equal(backendSignal, browser.signal);
  const reason = new DOMException("Browser disconnected", "AbortError");
  const rejected = assert.rejects(response, (error) => error === reason);
  browser.abort(reason);
  await Promise.all([canceled.promise, rejected]);
});

test("SSE proxy preserves request metadata, status, headers, and live chunks", async (t) => {
  let stream;
  const body = new ReadableStream({ start(controller) { stream = controller; } });
  const upstream = new Response(body, {
    status: 206,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
  const fetch = t.mock.method(globalThis, "fetch", async () => upstream);
  const req = request(undefined, { accept: "text/event-stream", cookie: "session=test" });
  const response = await GET(req);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, "http://backend.test/api/ai/ask?q=hello%20world&stream=1");
  assert.equal(options.headers.accept, "text/event-stream");
  assert.equal(options.headers.cookie, "session=test");
  assert.equal(options.cache, "no-store");
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-cache, no-transform");
  assert.equal(response.headers.get("content-encoding"), "identity");
  assert.equal(response.headers.get("x-accel-buffering"), "no");
  assert.equal(response.body, upstream.body);

  const reader = response.body.getReader();
  const chunk = new TextEncoder().encode('data: {"token":"hello"}\n\n');
  stream.enqueue(chunk);
  assert.deepEqual(await reader.read(), { value: chunk, done: false });
  stream.close();
  assert.equal((await reader.read()).done, true);
});

test("non-stream errors retain their status and body", async (t) => {
  const body = JSON.stringify({ error: "AI service unavailable" });
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(body, {
    status: 503,
    headers: { "content-type": "application/json" },
  }));
  const response = await GET(request());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.equal(response.headers.get("content-encoding"), null);
  assert.equal(response.headers.get("x-accel-buffering"), null);
  assert.equal(await response.text(), body);
  const [, options] = fetch.mock.calls[0].arguments;
  assert.equal(options.headers.accept, "*/*");
  assert.equal(options.headers.cookie, "");
});
