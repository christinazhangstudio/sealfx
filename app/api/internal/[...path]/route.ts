// Denies public access to the backend's /api/internal/* endpoints.
//
// Those endpoints are server-to-server (the Auth.js sign-in flow calls them
// directly over the cluster network) and the backend deliberately skips session
// auth on them. Without this file the catch-all /api/:path* rewrite in
// next.config.mjs would expose them to the internet.
//
// A filesystem route takes precedence over a rewrite, so every method lands here.

export const dynamic = "force-dynamic";

function notFound() {
  return new Response("Not found", { status: 404 });
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const HEAD = notFound;
export const OPTIONS = notFound;
