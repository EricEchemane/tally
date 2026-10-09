import Link from "next/link";
import { NAV, REPO_URL } from "@/lib/links";
import { PrimaryCta, SecondaryCta } from "./Cta";

/** Every page ends here: the closing banner, then the footer links. */
export function SiteFooter() {
  return (
    <>
      <section aria-labelledby="closing" className="border-t border-line bg-accent-soft">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-14 sm:items-center sm:text-center">
          <h2 id="closing" className="text-3xl font-semibold tracking-tight sm:text-4xl">Every peso, proven.</h2>
          <div className="flex flex-wrap gap-3">
            <PrimaryCta />
            <SecondaryCta />
          </div>
        </div>
      </section>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-6 text-sm text-muted">
          <span>Tally PH · liquidation review that never leaves your laptop</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 sm:ml-auto">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-ink">{item.label}</Link>
            ))}
            <Link href="/privacy-notice" className="hover:text-ink">Privacy notice</Link>
            <a href={REPO_URL} className="hover:text-ink">GitHub</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
