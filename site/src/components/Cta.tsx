"use client";
import { AppleLogoIcon, CaretDownIcon, DownloadSimpleIcon, PlayIcon, WindowsLogoIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { DEMO_POSTER, DEMO_VIDEO_URL, DOWNLOAD_LABEL, DOWNLOAD_MAC_HREF, DOWNLOAD_WINDOWS_HREF } from "@/lib/links";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold " +
  "transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98]";

const TONES = {
  lime: "bg-lime text-lime-ink hover:bg-lime-hover",
  night: "bg-night text-white hover:bg-night-2",
};

/**
 * The page's one action: "Download the desktop app" opens a small chooser of platforms, Mac or Windows. A
 * disclosure (button + panel of links), not an ARIA menu: Escape and a click outside close it, and focus returns to
 * the button. Each item downloads that platform's installer from the GitHub release.
 */
export function DownloadButton({
  className = "",
  compact = false,
  tone = "lime",
  align = "center",
}: {
  className?: string;
  compact?: boolean;
  tone?: keyof typeof TONES;
  align?: "left" | "center" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [animate, setAnimate] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(e: MouseEvent) {
    // A keyboard press (detail 0) opens instantly: keyboard-initiated UI never animates.
    setAnimate(e.detail !== 0);
    setOpen((o) => !o);
  }

  const side = align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={`${base} ${TONES[tone]} ${compact ? "h-11 px-5 text-sm" : "h-12 px-6 text-[0.9375rem]"} w-full`}
      >
        <DownloadSimpleIcon aria-hidden weight="bold" className="size-[1.1em]" />
        {compact ? (
          // Phones only fit the first word in the nav; the full label returns from the sm breakpoint.
          <span>
            Download<span className="hidden sm:inline">{DOWNLOAD_LABEL.slice("Download".length)}</span>
          </span>
        ) : (
          DOWNLOAD_LABEL
        )}
        <CaretDownIcon
          aria-hidden
          weight="bold"
          className={`size-[0.9em] transition-transform duration-150 ease-out ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          id={panelId}
          className={`absolute top-[calc(100%+0.5rem)] z-40 w-72 rounded-2xl bg-white p-1.5 text-left text-[#0f2b26] shadow-[0_18px_48px_rgb(15_43_38/0.18)] ring-1 ring-black/5 ${side} ${
            animate ? "chooser-in" : ""
          }`}
        >
          <a
            href={DOWNLOAD_MAC_HREF}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-[#edf6e8] focus-visible:bg-[#edf6e8]"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#0f2b26] text-white">
              <AppleLogoIcon aria-hidden weight="fill" className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Download for Mac</span>
              <span className="block text-xs text-[#0f2b26]/60">macOS app</span>
            </span>
          </a>
          <a
            href={DOWNLOAD_WINDOWS_HREF}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-[#edf6e8] focus-visible:bg-[#edf6e8]"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#0f2b26] text-white">
              <WindowsLogoIcon aria-hidden weight="fill" className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Download for Windows</span>
              <span className="block text-xs text-[#0f2b26]/60">Windows 11 app</span>
            </span>
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Secondary action: the dark pill beside the download button, as in the reference hero. It plays the demo video in a
 * modal <dialog>, which gives Escape-to-close, a focus trap and focus returning to the button. The video is mounted
 * only while open, so nothing downloads until someone asks for it, and it stops when closed.
 */
export function DemoButton({
  className = "",
  compact = false,
  tone = "night",
}: {
  className?: string;
  compact?: boolean;
  tone?: keyof typeof TONES;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${base} ${TONES[tone]} ${compact ? "h-11 px-5 text-sm" : "h-12 px-6 text-[0.9375rem]"} ${className}`}
      >
        <PlayIcon aria-hidden weight="fill" className="size-4" />
        Watch the demo
      </button>

      {open && (
        <dialog
          ref={dialog}
          aria-label="Tally demo video"
          onClose={() => setOpen(false)}
          // A click on the backdrop lands on the dialog itself, not on its content.
          onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
          className="demo-dialog m-auto w-[min(64rem,calc(100vw-2rem),calc((100dvh-9rem)*1.6))] overflow-visible bg-transparent p-0 backdrop:bg-black/75 backdrop:backdrop-blur-sm"
        >
          <div className="relative">
            <button
              type="button"
              aria-label="Close video"
              onClick={() => dialog.current?.close()}
              className="absolute -top-14 right-0 grid size-11 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-white/25"
            >
              <XIcon aria-hidden weight="bold" className="size-5" />
            </button>
            <video
              src={DEMO_VIDEO_URL}
              poster={DEMO_POSTER}
              controls
              autoPlay
              playsInline
              className="aspect-[1728/1080] w-full rounded-2xl bg-black shadow-[0_24px_80px_rgb(0_0_0/0.5)]"
            />
          </div>
        </dialog>
      )}
    </>
  );
}
