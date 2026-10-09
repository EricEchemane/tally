"use client";
import { ListIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { NAV } from "@/lib/links";
import { DemoButton, DownloadButton } from "./Cta";
import { Wordmark } from "./marketing";

/**
 * Open over the hero (as in the Upmind reference) and gathered into a frosted pill once the page scrolls; inside,
 * the Paynex layout and sizes. Scroll and current-section state come from IntersectionObservers, never a scroll
 * listener. Small screens get a menu.
 */
export function SiteHeader() {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  // The link for the section in the middle of the viewport shows as current.
  useEffect(() => {
    const sections = NAV.map((n) => document.querySelector(n.href)).filter((s): s is Element => !!s);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(`#${e.target.id}`);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

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
          className={`mx-auto max-w-6xl rounded-[1.75rem] ring-1 transition-[background-color,box-shadow,color,--tw-ring-color] duration-300 ease-out ${
            solid
              ? "bg-surface/80 text-ink shadow-pop ring-line backdrop-blur-xl"
              : "bg-transparent text-[#0f2b26] ring-transparent"
          }`}
        >
          {/* After the Paynex reference: logo at the left edge, readable sentence-case links centred with the current
              section as a filled pill, and the actions as pills on the right. */}
          <div className="flex h-16 items-center gap-6 pr-3 pl-4 sm:pl-5">
            <a href="#top" aria-label="Tally, back to top" className="mr-auto md:mr-0">
              <Wordmark />
            </a>
            <nav aria-label="Main" className="mx-auto hidden items-center gap-1 md:flex">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active === item.href ? "location" : undefined}
                  className="rounded-full px-4 py-2 text-[0.9375rem] font-medium opacity-80 transition-[background-color,color,opacity] duration-200 ease-out hover:bg-black/5 hover:opacity-100 aria-[current]:bg-[#0f2b26] aria-[current]:text-white aria-[current]:opacity-100"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <DownloadButton compact align="right" />
              <span className="hidden lg:block">
                <DemoButton compact />
              </span>
            </div>
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
              {/* Download already sits in the bar on phones; the demo button only fits here. */}
              <DemoButton className="mt-2 w-full" />
            </nav>
          )}
        </div>
      </header>
    </>
  );
}
