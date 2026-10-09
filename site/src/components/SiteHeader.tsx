import Link from "next/link";
import { NAV } from "@/lib/links";
import { PrimaryCta } from "./Cta";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="grid size-7 place-items-center rounded-md bg-accent text-sm font-bold text-accent-ink">T</span>
          Tally PH
        </Link>
        <nav aria-label="Main" className="order-last flex w-full gap-5 overflow-x-auto text-sm text-muted md:order-none md:w-auto">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
        <PrimaryCta className="ml-auto py-2" />
      </div>
    </header>
  );
}
