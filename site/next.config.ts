import type { NextConfig } from "next";

// The public marketing site for Tally. It only promotes the desktop app: no accounts, and it never talks to the
// app's API. Registration and all the real work happen in the installed app. The one form is Contact, which emails
// us over SMTP (src/app/actions/contact.ts).
const nextConfig: NextConfig = {
  // The contact form is the only server action; a message is at most a few KB, so refuse anything near the
  // default 1 MB.
  experimental: {
    serverActions: { bodySizeLimit: "64kb" },
  },
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
      { source: "/try", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
