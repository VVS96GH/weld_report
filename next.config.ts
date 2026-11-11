import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // no search engines, no framing by other sites, no referrer to other sites (owner, 2026-11-11)
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  // the browser keeps the pages it has shown for 3 minutes (owner, 2026-11-03): Prev / Next and
  // back to a page already seen open at once; a new data load refreshes (components/DataVersionWatch)
  experimental: {
    staleTimes: { dynamic: 180, static: 300 },
  },
};

export default nextConfig;
