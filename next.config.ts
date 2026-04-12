import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
