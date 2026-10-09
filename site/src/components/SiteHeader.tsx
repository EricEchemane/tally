"use client";
import { ListIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { NAV } from "@/lib/links";
import { DownloadButton } from "./Cta";
import { Wordmark } from "./marketing";

/**
 * Upmind-style: open over the light hero (logo, small spaced uppercase links, one dark pill), then a white glass
 * pill once the page scrolls. Scroll state comes from an IntersectionObserver on a sentinel, never a scroll
 * listener. Small screens get a menu.
 */
export function SiteHeader() {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const solid = scrolled || open;

  return (
    <>
      <div ref={sentinel} aria-hidden className="pointer-events-none absolute top-0 h-24 w-px" />
      <header className="fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-6 sm:pt-5">
        <div
          className={`mx-auto max-w-6xl rounded-[1.75rem] transition-[background-color,box-shadow,color] duration-300 ease-out ${
            solid
              ? "bg-surface/85 text-ink shadow-pop ring-1 ring-line backdrop-blur-md"
              : "bg-transparent text-[#0f2b26]"
          }`}
        >
          <div className="flex h-14 items-center gap-8 pr-2 pl-4 sm:pl-5">
            <a href="#top" aria-label="Tally, back to top" className="mr-auto md:mr-0">
              <Wordmark />
            </a>
            <nav aria-label="Main" className="mx-auto hidden items-center gap-9 md:flex">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="relative py-1 text-xs font-semibold tracking-[0.14em] uppercase opacity-75 transition-opacity duration-150 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-lime after:transition-transform after:duration-200 hover:opacity-100 hover:after:scale-x-100"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <span className="hidden sm:block">
              <DownloadButton compact tone="night" />
            </span>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
              className="grid size-11 place-items-center rounded-full bg-white/70 text-[#0f2b26] ring-1 ring-black/10 backdrop-blur-md md:hidden"
            >
              {open ? <XIcon aria-hidden className="size-5" /> : <ListIcon aria-hidden className="size-5" />}
            </button>
          </div>

          {open && (
            <nav id="mobile-menu" aria-label="Main" className="panel-in flex flex-col gap-1 px-3 pb-4 md:hidden">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-2xl px-3 py-3 text-lg font-medium hover:bg-sunken"
                >
                  {item.label}
                </a>
              ))}
              <DownloadButton className="mt-2 w-full" />
            </nav>
          )}
        </div>
      </header>
    </>
  );
}
