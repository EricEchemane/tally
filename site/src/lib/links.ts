export const REPO_URL = "https://github.com/EricEchemane/local-ai-project";

/** Primary CTA: one button that opens a chooser of desktop platforms. */
export const DOWNLOAD_LABEL = "Download the desktop app";
/** The installers. Both point at the latest GitHub release until each platform has its own direct download link. */
export const DOWNLOAD_MAC_HREF = `${REPO_URL}/releases/latest`;
export const DOWNLOAD_WINDOWS_HREF = `${REPO_URL}/releases/latest`;

/** Secondary CTA: the 60-90 s demo video. Until it exists, How it works stands in for it. */
export const DEMO_HREF = "#how-it-works";

/** Contact address for the footer. Empty until the team picks a public one; the footer then links to GitHub. */
export const CONTACT_EMAIL = "";

export const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#privacy", label: "Privacy" },
  { href: "#assistant", label: "Assistant" },
  { href: "#faq", label: "FAQ" },
] as const;

/** The Mac installer: always the newest GitHub Release's asset of this name (attach it under the same name each
 *  release). Works for the public only once the repo is public; a private repo answers 404 to signed-out visitors. */
export const MAC_DOWNLOAD_URL = `${REPO_URL}/releases/latest/download/Tally-mac-arm64.dmg`;
export const RELEASES_URL = `${REPO_URL}/releases`;
