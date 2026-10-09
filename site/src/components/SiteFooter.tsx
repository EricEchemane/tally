import { CONTACT_EMAIL, NAV, REPO_URL } from "@/lib/links";
import { Wordmark } from "./marketing";

export function SiteFooter() {
  return (
    <footer className="px-3 pt-3 pb-3">
      <div className="rounded-[2rem] bg-mint text-muted">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-14 text-sm md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-4 text-ink">
            <Wordmark />
            <p className="max-w-xs text-muted">Every receipt checked against BIR rules, on your own laptop.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-col gap-2.5">
            <p className="mb-1 font-semibold text-ink">Product</p>
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="w-fit hover:text-accent">
                {item.label}
              </a>
            ))}
            <a href="#download" className="w-fit hover:text-accent">Download</a>
          </nav>
          <div className="flex flex-col gap-2.5">
            <p className="mb-1 font-semibold text-ink">Contact</p>
            {CONTACT_EMAIL ? (
              <a href={`mailto:${CONTACT_EMAIL}`} className="w-fit hover:text-accent">{CONTACT_EMAIL}</a>
            ) : (
              <a href={`${REPO_URL}/issues`} className="w-fit hover:text-accent">Contact us on GitHub</a>
            )}
            <a href={REPO_URL} className="w-fit hover:text-accent">Source code</a>
          </div>
        </div>
        <p className="mx-auto max-w-6xl border-t border-line px-5 py-6 text-xs text-faint">Made in the Philippines</p>
      </div>
    </footer>
  );
}
