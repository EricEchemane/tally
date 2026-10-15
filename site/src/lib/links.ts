export const REPO_URL = "https://github.com/EricEchemane/tally";

/**
 * The site's public address, for canonical links, the sitemap and social previews. NEXT_PUBLIC_SITE_URL wins when
 * set (a custom domain); on Vercel it falls back to the project's production domain, locally to the dev server.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3001");

/** Primary CTA: one button that opens a chooser of desktop platforms. */
export const DOWNLOAD_LABEL = "Download the desktop app";
/** Installer assets. Mac: desktop-v0.1.0. Windows: desktop-v0.1.1 (LAN-connect fixes). */
export const MAC_DOWNLOAD_URL = `${REPO_URL}/releases/download/desktop-v0.1.0/Tally-mac-arm64.dmg`;
export const DOWNLOAD_MAC_HREF = MAC_DOWNLOAD_URL;
export const WINDOWS_DOWNLOAD_URL =
  "https://github.com/EricEchemane/tally/releases/download/desktop-v0.1.1/Tally-windows-x64-setup.exe";
export const DOWNLOAD_WINDOWS_HREF = WINDOWS_DOWNLOAD_URL;

/**
 * Secondary CTA: the 83 s promo video. Streamed straight from YouTube (youtube-nocookie.com embed) instead of a
 * file in this repo, so the site stays lightweight.
 */
export const DEMO_VIDEO_ID = "mdrfEu0IcjM";
export const DEMO_VIDEO_WATCH_URL = `https://www.youtube.com/watch?v=${DEMO_VIDEO_ID}`;
export const DEMO_VIDEO_EMBED_URL = `https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}`;
/** A frame at 0:30: Ask Tally answering inside the app. */
export const DEMO_POSTER = "/images/demo-poster.jpg";
export const DEMO_DURATION = "PT1M23S";

/** Team portfolios linked from the footer's Contact section. */
export const CONTACT_LINKS = [
  { href: "https://www.engineex.dev/", label: "Eric’s portfolio" },
  { href: "https://web-portfolio-simone.vercel.app/", label: "Simone’s portfolio" },
] as const;

export const NAV = [
  { href: "#privacy", label: "Privacy" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#assistant", label: "Assistant" },
  { href: "#faq", label: "FAQ" },
] as const;

export const RELEASES_URL = `${REPO_URL}/releases`;
