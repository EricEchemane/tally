"use client";
// Bottom-right confirmations: actions (toast() in lib/toast.ts) and finished downloads (the Mac app's
// `tally:download` event, with a link to the saved file). Each slides up, its icon draws in, and it slides away.
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ToastDetail, ToastTone } from "@/lib/toast";
import { cx } from "./ui";

type Item = { id: number; title: string; body?: string; tone: ToastTone; reveal?: string; leaving?: boolean };

const ICON: Record<ToastTone, string> = {
  ok: "M3.5 8.5l3 3 6-7",
  bad: "M4.5 4.5l7 7M11.5 4.5l-7 7",
  info: "M8 7.5v4M8 4.5v.01",
};
const fileName = (path: string) => path.split(/[\\/]/).pop() || path;

export function Toasts() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let n = 0;
    const dismiss = (id: number) => {
      setItems((list) => list.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), 220);
    };
    const add = (t: Omit<Item, "id">) => {
      const id = ++n;
      setItems((list) => [...list.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.reveal ? 7000 : 4000);
    };
    const onToast = (e: Event) => {
      const d = (e as CustomEvent<ToastDetail>).detail;
      add({ title: d.title, body: d.body, tone: d.tone ?? "ok" });
    };
    const onDownload = (e: Event) => {
      const d = (e as CustomEvent<{ path: string; success: boolean }>).detail;
      add(d.success
        ? { title: "Saved to Downloads", body: d.path ? fileName(d.path) : undefined, tone: "ok", reveal: d.path || undefined }
        : { title: "Download failed", body: "The file couldn’t be saved.", tone: "bad" });
    };
    window.addEventListener("tally:toast", onToast);
    window.addEventListener("tally:download", onDownload);
    (window as { __tallyDismiss?: (id: number) => void }).__tallyDismiss = dismiss;
    return () => { window.removeEventListener("tally:toast", onToast); window.removeEventListener("tally:download", onDownload); };
  }, []);
  if (!items.length) return null;
  const dismiss = (id: number) => (window as { __tallyDismiss?: (id: number) => void }).__tallyDismiss?.(id);
  return (
    <div aria-live="polite" className="fixed bottom-6 right-6 z-50 flex w-[22rem] max-w-[calc(100vw-3rem)] flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} role="status"
          className={cx("flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-pop", t.leaving ? "toast-out" : "toast-in")}>
          <span className={cx("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
            t.tone === "ok" ? "bg-ok-soft text-ok" : t.tone === "bad" ? "bg-bad-soft text-bad" : "bg-info-soft text-info")}>
            <svg viewBox="0 0 16 16" aria-hidden className="draw size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICON[t.tone]} pathLength={1} />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t.title}</p>
            {t.body && <p className="truncate text-sm text-muted" title={t.body}>{t.body}</p>}
            {t.reveal && (
              <button type="button" className="mt-2 text-sm font-medium text-accent hover:underline"
                onClick={() => api.post("/api/setup/reveal", { path: t.reveal }).catch(() => undefined)}>
                Show location
              </button>
            )}
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)}
            className="grid size-6 shrink-0 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink">
            <svg viewBox="0 0 16 16" aria-hidden className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
