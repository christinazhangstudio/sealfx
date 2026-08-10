import { type NextRequest } from "next/server";

const API_BASE = process.env.INTERNAL_API_URL || "http://sealift:9998/api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function proxyInboxRules(req: NextRequest, method: "GET" | "POST" | "PUT") {
  try {
    const upstream = await fetch(`${API_BASE}/ai/inbox-rules`, {
      method,
      headers: {
        "content-type": req.headers.get("content-type") ?? "application/json",
        cookie: req.headers.get("cookie") ?? "",
      },
      body: method === "GET" ? undefined : await req.text(),
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

export function GET(req: NextRequest) {
  return proxyInboxRules(req, "GET");
}

export function POST(req: NextRequest) {
  return proxyInboxRules(req, "POST");
}

export function PUT(req: NextRequest) {
  return proxyInboxRules(req, "PUT");
}
