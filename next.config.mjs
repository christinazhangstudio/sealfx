// Plain .mjs (was next.config.ts) so `next start` doesn't need TypeScript at
// runtime — the production image only installs prod deps, and Next's on-the-fly
// `npm install typescript` at boot is slow and currently broken (typescript is a
// devDependency, so npm's --production omit wins and it never lands).

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next's gzip buffers responses until it has enough bytes, which stalls SSE:
  // a stream that emits a little and then idles (the inbox stream, AI heartbeats)
  // never fills the buffer, so the browser receives nothing. Setting
  // Content-Encoding on the response is not enough — compression is applied
  // after the route handler returns. Cloudflare compresses at the edge, so
  // browsers still get compressed assets; only the internal hop is plain.
  compress: false,
  experimental: {
    // Belt-and-suspenders with the client-side downscale in create-listing:
    // the default 1mb server-action limit silently rejected photo uploads.
    serverActions: { bodySizeLimit: "8mb" },
  },
  async rewrites() {
    // If the internal URL already includes /api, don't append it again
    const internalApiUrl = process.env.INTERNAL_API_URL || 'http://sealift:9998/api';
    const destination = internalApiUrl.endsWith('/api')
      ? `${internalApiUrl}/:path*`
      : `${internalApiUrl}/api/:path*`;

    return [
      {
        // Do NOT proxy Auth.js requests
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*',
      },
      {
        // Do NOT proxy JWKS requests
        source: '/api/jwks/:path*',
        destination: '/api/jwks/:path*',
      },
      {
        // Proxy everything else under /api to the Go backend
        source: '/api/:path*',
        destination: destination,
      },
    ];
  },
};

export default nextConfig;
