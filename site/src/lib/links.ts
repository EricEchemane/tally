export const REPO_URL = "https://github.com/EricEchemane/local-ai-project";

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
/** Mac installer asset from the desktop-v0.1.0 GitHub release. */
export const MAC_DOWNLOAD_URL = `${REPO_URL}/releases/download/desktop-v0.1.0/Tally-mac-arm64.dmg`;
export const DOWNLOAD_MAC_HREF = MAC_DOWNLOAD_URL;
/** There is no Windows build yet: its chooser item only says so. */
export const WINDOWS_COMING = "Tally for Windows is coming…";

/**
 * Secondary CTA: the 83 s hackathon demo. Served from the R2 bucket's dev URL, which Cloudflare rate-limits; swap in
 * a custom domain on the bucket when there is one.
 */
export const DEMO_VIDEO_URL = "https://pub-9b3c0b9c505b48b290018ee6b84648b8.r2.dev/Tally-AppBuildersPh-Hackathon-2026.mp4";
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
