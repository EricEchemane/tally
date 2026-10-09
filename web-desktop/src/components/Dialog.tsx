"use client";
// A centred dialog for decisions that need a moment: returning a Liquidation, deleting, restoring.
// Esc or a click outside cancels; focus moves inside and comes back when it closes.
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cx } from "./ui";

export function Dialog({ open, onClose, title, description, children, footer, tone, wide, size }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode;
  footer: ReactNode; tone?: "danger"; wide?: boolean; size?: "sheet"; // sheet: a wide document view
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("textarea, input, select, [data-autofocus]");
    (first ?? panel.current)?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); before?.focus(); };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <div className="dialog-backdrop absolute inset-0 bg-black/25 backdrop-blur-[3px]" onClick={onClose} />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}
        className={cx("dialog-in relative w-full rounded-3xl border border-line bg-surface shadow-pop outline-none",
          size === "sheet" ? "flex max-h-[calc(100vh-3rem)] max-w-6xl flex-col" : wide ? "max-w-xl" : "max-w-md")}>
        <div className="space-y-1.5 px-6 pt-6">
          <h2 className={cx("text-lg font-semibold tracking-tight", tone === "danger" && "text-bad")}>{title}</h2>
          {description && <div className="text-sm text-muted">{description}</div>}
        </div>
        {children && <div className={cx("px-6 pt-4", size === "sheet" && "min-h-0 flex-1 overflow-auto")}>{children}</div>}
        <div className="flex justify-end gap-2 px-6 pb-6 pt-6">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}
