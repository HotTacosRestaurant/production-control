import type { NextConfig } from "next";

const frameAncestors = (
  process.env.NIXINEX_FRAME_ANCESTORS?.trim() || "'self'"
).replace(/[\r\n]+/g, ' ');

const showcaseHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `frame-ancestors ${frameAncestors};`,
  },
  {
    key: 'Referrer-Policy',
    value: 'no-referrer',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/showcase',
        headers: showcaseHeaders,
      },
      {
        source: '/showcase/:path*',
        headers: showcaseHeaders,
      },
    ];
  },
};

export default nextConfig;
