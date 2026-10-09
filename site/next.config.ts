import type { NextConfig } from "next";

// The public marketing site for Tally. It only promotes the desktop app: no forms, no accounts, and it never
// talks to the app's API. Registration and all the real work happen in the installed app.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The site is one page now; old section URLs land on the matching part of it.
  async redirects() {
    return [
      { source: "/how-it-works", destination: "/#how-it-works", permanent: true },
      { source: "/privacy", destination: "/#privacy", permanent: true },
      { source: "/faq", destination: "/#faq", permanent: true },
      { source: "/try", destination: "/#download", permanent: true },
    ];
  },
};

export default nextConfig;
