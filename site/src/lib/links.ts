export const REPO_URL = "https://github.com/EricEchemane/local-ai-project";

/** Primary CTA: one button that opens a chooser of desktop platforms. */
export const DOWNLOAD_LABEL = "Download the desktop app";
/** Mac installer asset from the desktop-v0.1.0 GitHub release. */
export const MAC_DOWNLOAD_URL = `${REPO_URL}/releases/download/desktop-v0.1.0/Tally-mac-arm64.dmg`;
export const DOWNLOAD_MAC_HREF = MAC_DOWNLOAD_URL;
/** Windows download currently opens the latest GitHub release. */
export const DOWNLOAD_WINDOWS_HREF = `${REPO_URL}/releases/latest`;

/** Secondary CTA: the 60-90 s demo video. Until it exists, How it works stands in for it. */
export const DEMO_HREF = "#how-it-works";

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
