export const REPO_URL = "https://github.com/EricEchemane/local-ai-project";

/** Primary CTA: creates an Early Access Request (the form lands in ticket: Early Access Request form). */
export const EARLY_ACCESS_HREF = "/#early-access";
/** Secondary CTA: the interactive sample review on Home. */
export const SAMPLE_REVIEW_HREF = "/#sample-review";

export const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/privacy", label: "Privacy & security" },
  { href: "/faq", label: "FAQ" },
  { href: "/try", label: "Try Tally" },
] as const;

/** The Mac installer: always the newest GitHub Release's asset of this name (attach it under the same name each
 *  release). Works for the public only once the repo is public; a private repo answers 404 to signed-out visitors. */
export const MAC_DOWNLOAD_URL = `${REPO_URL}/releases/latest/download/Tally-mac-arm64.dmg`;
export const RELEASES_URL = `${REPO_URL}/releases`;
