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

  // A clicked link is "locked" as current while the page scrolls to it. Without the lock, the sections passed on the
  // way (and the layout shifting as lazy sections render) cleared or changed the highlight mid-scroll, and it never
  // came back: the second click only worked because the page was already in place.
  const lock = useRef<string | null>(null);
  const finish = useRef<() => void>(() => {});

  const go = (href: string) => {
    lock.current = href;
    setActive(href);
    // Browsers without "scrollend" (Safari) fall back to a timer.
    window.setTimeout(() => finish.current(), 1500);
  };

  // The link for the section under the reading line (40% down the viewport) shows as current; none when the line
  // is over the hero or a section with no link. Every page section is observed, so the answer is recomputed
  // whenever any section enters or leaves the line, not only for one of them.
  useEffect(() => {
    const targets = NAV.map((n) => document.querySelector<HTMLElement>(n.href)).filter((s): s is HTMLElement => !!s);
    const update = () => {
      if (lock.current) return;
      const line = window.innerHeight * 0.4;
      const current = targets.find((t) => {
        const r = t.getBoundingClientRect();
        return r.top <= line && r.bottom > line;
      });
      setActive(current ? `#${current.id}` : null);
    };
    const observer = new IntersectionObserver(update, {
      rootMargin: "-40% 0px -59% 0px",
      threshold: [0, 1],
    });
    document.querySelectorAll("main section").forEach((s) => observer.observe(s));
    // When the jump ends, lazy sections above the target may have changed height and left it off its mark. Snap it
    // into place (instant, honouring the scroll padding), then hand control back to the reading line.
    finish.current = () => {
      const href = lock.current;
      if (!href) return;
      lock.current = null;
      const target = document.querySelector<HTMLElement>(href);
      if (target && Math.abs(target.getBoundingClientRect().top - 96) > 12) {
        target.scrollIntoView({ behavior: "instant", block: "start" });
      }
      update();
    };
    const onScrollEnd = () => {
      if (lock.current) finish.current();
      else update();
    };
    window.addEventListener("scrollend", onScrollEnd);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("scrollend", onScrollEnd);
      window.removeEventListener("resize", update);
    };
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
                  onClick={() => go(item.href)}
                  className="rounded-full px-4 py-2 text-[0.9375rem] font-medium opacity-80 transition-[background-color,color,opacity] duration-200 ease-out hover:opacity-100 aria-[current]:bg-[#0f2b26] aria-[current]:text-white aria-[current]:opacity-100"
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
                  aria-current={active === item.href ? "location" : undefined}
                  onClick={() => {
                    go(item.href);
                    setOpen(false);
                  }}
                  className="rounded-2xl px-3 py-3 text-lg font-medium transition-colors duration-200 hover:bg-sunken aria-[current]:bg-[#0f2b26] aria-[current]:text-white"
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
