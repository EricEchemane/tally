import type { NextConfig } from "next";

// FastAPI stays on localhost; the browser and phone only ever talk to Next.js (SPEC §2, §7).
// Simon on Windows can point this at Eric's Mac during development: API_URL=http://<mac-ip>:8000
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The phone opens the dev server by LAN IP; Next.js blocks unknown dev origins by default.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      { source: "/ws", destination: `${API_URL}/ws` },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
