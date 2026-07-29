// Health endpoint for Kubernetes probes.
//
// Reaching this handler means Next.js has booted and is serving, which is
// exactly what both probes need to know: the frontend is a proxy and a renderer,
// so it has no dependency of its own worth failing a probe over. (If the backend
// is down, that is the backend's readiness probe to report — taking the
// frontend out of rotation too would only replace a useful error page with a
// connection refusal.)
//
// next.config.mjs carves this path out of the /api/:path* rewrite, which would
// otherwise proxy it to the backend.

export const dynamic = "force-dynamic";

export function GET() {
    return Response.json({ status: "ok" });
}
