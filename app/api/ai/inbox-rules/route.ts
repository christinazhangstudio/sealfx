import { type NextRequest } from "next/server";

const API_BASE = process.env.INTERNAL_API_URL || "http://sealift:9998/api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const upstream = await fetch(`${API_BASE}/ai/inbox-rules`, {
      method: "POST",
      headers: {
        "content-type": req.headers.get("content-type") ?? "application/json",
        cookie: req.headers.get("cookie") ?? "",
      },
      body: await req.text(),
      cache: "no-store",
      signal: req.signal,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to proxy Qwen inbox analysis", error);
    return Response.json({ error: "Qwen inbox analysis is unavailable" }, { status: 502 });
  }
}
