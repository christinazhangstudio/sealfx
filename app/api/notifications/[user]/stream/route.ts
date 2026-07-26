import { type NextRequest } from "next/server";

// Streams the Go backend's inbox SSE (EventSource) through unbuffered — same
// reasoning as app/api/ai/ask/route.ts: the generic /api/:path* rewrite gzips
// the stream, which buffers every notification until the connection closes.
// Cookies are forwarded because this endpoint is session-authenticated.

const API_BASE = process.env.INTERNAL_API_URL || "http://sealift:9998/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const upstreamPath = req.nextUrl.pathname.replace(/^\/api/, "");
  const upstream = await fetch(`${API_BASE}${upstreamPath}${req.nextUrl.search}`, {
    headers: {
      accept: req.headers.get("accept") ?? "text/event-stream",
      cookie: req.headers.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  const contentType = upstream.headers.get("content-type") ?? "text/event-stream";
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
