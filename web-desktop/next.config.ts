import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// The desktop app's copy of web/: a static export served by the bundled backend on one port
// (.wayfinder/desktop-app/research/04-web-static-export.md). Pages read IDs from ?id=, so every
// route is a real file and no Next.js server is needed.
// In `next dev` the API still comes through rewrites: API_URL=http://127.0.0.1:8765 for the desktop backend.
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

export default function config(phase: string): NextConfig {
  return {
    output: "export",
    trailingSlash: true, // each route becomes <route>/index.html, which StaticFiles finds on its own
    skipTrailingSlashRedirect: true, // otherwise next dev redirects /api/x to /api/x/ before the rewrite
    allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
    ...(phase === PHASE_DEVELOPMENT_SERVER && {
      async rewrites() {
        return [
          { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
          { source: "/ws", destination: `${API_URL}/ws` },
        ];
      },
    }),
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
  };
}
