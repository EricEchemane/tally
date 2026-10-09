"use client";
// Download feedback. Inside the Mac app, a download saves straight to ~/Downloads and the shell sends a
// `tally:download` event when the file is written (desktop/src-tauri/src/lib.rs). The button spins until
// then; a toast says where the file went and offers Show in Finder. In a plain browser, downloads behave
// as the browser does and nothing here shows.
import { useEffect, useState } from "react";
import { Button, ButtonLink, cx } from "./ui";

const isDesktop = () => typeof window !== "undefined" && (window as { __TALLY_DESKTOP__?: boolean }).__TALLY_DESKTOP__ === true;

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
