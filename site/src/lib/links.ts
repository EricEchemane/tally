export const REPO_URL = "https://github.com/EricEchemane/local-ai-project";

/** Primary CTA: one button that opens a chooser of desktop platforms. */
export const DOWNLOAD_LABEL = "Download the desktop app";
/** The Mac installer. Points at the latest GitHub release until there is a download host. */
export const DOWNLOAD_MAC_HREF = `${REPO_URL}/releases/latest`;
/** Windows is planned (never "coming soon"); until then the chooser asks people to say they need it. */
export const WINDOWS_REQUEST_HREF = `${REPO_URL}/issues`;

/** Secondary CTA: the 60-90 s demo video. Until it exists, How it works stands in for it. */
export const DEMO_HREF = "#how-it-works";

/** Contact address for the footer. Empty until the team picks a public one; the footer then links to GitHub. */
export const CONTACT_EMAIL = "";

export const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#privacy", label: "Privacy" },
  { href: "#faq", label: "FAQ" },
] as const;
