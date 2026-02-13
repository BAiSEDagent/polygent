import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Redirect .well-known/farcaster.json to our static file
  async rewrites() {
    return [
      {
        source: '/.well-known/farcaster.json',
        destination: '/api/manifest',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js needs these
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "connect-src 'self' ws: wss: https:",
              "frame-ancestors *", // Required for Farcaster iframe
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
