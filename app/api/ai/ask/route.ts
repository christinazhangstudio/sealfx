import { type NextRequest } from "next/server";

// Streams the Go backend's AI response through to the browser unbuffered.
//
// This route exists because the generic /api/:path* rewrite in next.config.mjs
// runs responses through Next's gzip compression, which buffers the whole SSE
// stream until completion (browsers and Cloudflare always send
// Accept-Encoding: gzip, so in production no tokens arrived until the model
// finished). A filesystem route takes precedence over the rewrite, and setting
// Content-Encoding here keeps the compressor away so tokens stream live.

const API_BASE = process.env.INTERNAL_API_URL || "http://sealift:9998/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const upstream = await fetch(`${API_BASE}/ai/ask${req.nextUrl.search}`, {
    headers: {
      accept: req.headers.get("accept") ?? "*/*",
      cookie: req.headers.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const headers = new Headers({
    "content-type": contentType,
    "cache-control": "no-cache, no-transform",
  });
  if (contentType.includes("text/event-stream")) {
    headers.set("x-accel-buffering", "no");
    headers.set("content-encoding", "identity");
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
