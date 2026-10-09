import type { NextConfig } from "next";

// The public marketing site for Tally PH. It never talks to the app's API: the interactive sample
// review uses bundled data, and forms post to a hosted store (see .wayfinder/market-site).
const nextConfig: NextConfig = {
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
