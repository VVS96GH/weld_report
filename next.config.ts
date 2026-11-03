import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the browser keeps the pages it has shown for 3 minutes (owner, 2026-11-03): Prev / Next and
  // back to a page already seen open at once; a new data load refreshes (components/DataVersionWatch)
  experimental: {
    staleTimes: { dynamic: 180, static: 300 },
  },
};

export default nextConfig;
