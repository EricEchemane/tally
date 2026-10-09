"use client";
// Download feedback. Inside the Mac app, a download saves straight to ~/Downloads and the shell sends a
// `tally:download` event when the file is written (desktop/src-tauri/src/lib.rs). The button spins until
// then; a toast says where the file went and offers Show in Finder. In a plain browser, downloads behave
// as the browser does and nothing here shows.
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, ButtonLink, cx } from "./ui";

type DownloadDetail = { path: string; success: boolean };
type Toast = DownloadDetail & { id: number };

const isDesktop = () => typeof window !== "undefined" && (window as { __TALLY_DESKTOP__?: boolean }).__TALLY_DESKTOP__ === true;
const fileName = (path: string) => path.split(/[\\/]/).pop() || path;

/** A download link that shows a spinner until the file is saved (desktop app only). */
export function DownloadButton({ href, children, variant, size, className, disabled }: {
  href?: string; children: React.ReactNode; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md";
  className?: string; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const done = () => setBusy(false);
    window.addEventListener("tally:download", done);
    const t = setTimeout(done, 20_000); // never spin forever
    return () => { window.removeEventListener("tally:download", done); clearTimeout(t); };
  }, [busy]);
  if (busy) return <Button variant={variant} size={size} className={className} busy>{children}</Button>;
  return (
    <ButtonLink href={disabled ? undefined : href} aria-disabled={disabled} download variant={variant} size={size}
      className={cx(disabled && "pointer-events-none opacity-50", className)}
      onClick={() => { if (isDesktop() && href) setBusy(true); }}>
      {children}
    </ButtonLink>
  );
}

/** Bottom-right toasts for finished downloads. Mounted once, in the app shell. */
export function DownloadToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    let n = 0;
    const onDone = (e: Event) => {
      const t = { ...(e as CustomEvent<DownloadDetail>).detail, id: ++n };
      setToasts((list) => [...list.slice(-2), t]);
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), 7000);
    };
    window.addEventListener("tally:download", onDone);
    return () => window.removeEventListener("tally:download", onDone);
  }, []);
  if (!toasts.length) return null;
  return (
    <div aria-live="polite" className="fixed bottom-6 right-6 z-50 flex w-[22rem] max-w-[calc(100vw-3rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} role="status" className="toast-in flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-pop">
          <span className={cx("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", t.success ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>
            <svg viewBox="0 0 16 16" aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d={t.success ? "M3.5 8.5l3 3 6-7" : "M4.5 4.5l7 7M11.5 4.5l-7 7"} />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t.success ? "Saved to Downloads" : "Download failed"}</p>
            <p className="truncate text-sm text-muted" title={t.path}>{t.path ? fileName(t.path) : "The file couldn’t be saved."}</p>
            {t.success && t.path && (
              <button type="button" className="mt-2 text-sm font-medium text-accent hover:underline"
                onClick={() => api.post("/api/setup/reveal", { path: t.path }).catch(() => undefined)}>
                Show in Finder
              </button>
            )}
          </div>
          <button type="button" aria-label="Dismiss" className="grid size-6 shrink-0 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink"
            onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}>
            <svg viewBox="0 0 16 16" aria-hidden className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
