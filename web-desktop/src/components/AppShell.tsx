"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, ViewTransition } from "react";
import { api, errorMessage } from "@/lib/api";
import { BUYER_RULE } from "@/lib/labels";
import { useLive } from "@/lib/live";
import { useCompany, useHealth } from "@/lib/queries";
import type { BuyerDetailsRule, Company } from "@/lib/types";
import { Toasts } from "./Toasts";
import { QuitGuard } from "./QuitGuard";
import { QuestionsPanel } from "./QuestionsPanel";
import { SetupGate } from "./SetupGate";
import { useIndicator } from "@/lib/motion";
import { CONTENT, cx, PAGE, Segmented, Sparkle } from "./ui";

const NAV = [
  { href: "/", label: "Cash Advances", match: (p: string) => p === "/" || p.startsWith("/liquidations") || p.startsWith("/receipts") },
  { href: "/overview/", label: "Overview", match: (p: string) => p.startsWith("/overview") },
  { href: "/employees/", label: "Employees", match: (p: string) => p.startsWith("/employees") },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [asking, setAsking] = useState(false);
  const path = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const active = NAV.find((n) => n.match(path))?.href;
  const pill = useIndicator(navRef, active);
  const [vtSupported, setVtSupported] = useState(true);
  useEffect(() => setVtSupported("startViewTransition" in document), []);
  // ⌘K opens Ask Tally from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); setAsking((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      {/* Same width and side padding as <main>, so the bar's edges line up with the page content. */}
      <header className="sticky top-0 z-30 bg-linear-to-b from-paper from-70% to-transparent pb-2 pt-3">
        <div className={PAGE}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface/90 py-2 pl-3 pr-2 shadow-card backdrop-blur">
            <HistoryShortcuts />
            <Link href="/" aria-label="Tally home" title="Tally" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimizer */}
              <img src="/logo.png" alt="" className="size-9" />
            </Link>
            <nav ref={navRef} aria-label="Main" className="relative flex items-center gap-0.5 rounded-full border border-line bg-sunken p-0.5">
              {pill && (
                <span aria-hidden className="absolute rounded-full border border-line-strong/70 bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.08)] transition-all duration-200 ease-out"
                  style={{ left: pill.left, top: pill.top, width: pill.width, height: pill.height }} />
              )}
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} aria-current={n.match(path) ? "page" : undefined} data-active={n.href === active}
                  className={cx("relative rounded-full px-3.5 py-1.5 text-sm transition-colors duration-150",
                    n.match(path) ? "font-semibold text-ink" : "text-muted hover:text-ink")}>
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <BuyerRuleToggle />
              <SystemStatus />
              <AskButton onClick={() => setAsking(true)} />
              <Link href="/settings/" aria-label="Settings" title="Settings"
                className={cx("grid size-8 place-items-center rounded-full transition-colors",
                  path.startsWith("/settings") ? "bg-accent-soft text-accent" : "text-muted hover:bg-sunken hover:text-ink")}>
                <svg viewBox="0 0 24 24" aria-hidden className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </header>
      <SetupGate />
      {/* Page changes crossfade (the browser's View Transitions; navigations are React transitions, so
          <ViewTransition> animates them). The top bar sits outside it and stays still. Where WebKit has
          no View Transitions, each page fades in on its own instead. */}
      <ViewTransition default="page-fade">
        <main key={vtSupported ? undefined : path} className={cx(CONTENT, "flex-1 py-8", !vtSupported && "page-enter")}>
          {children}
        </main>
      </ViewTransition>
      <footer className={cx(CONTENT, "pb-8 text-xs text-faint")}>
        Every receipt is read and checked on this computer. No request leaves the machine.
      </footer>
      <QuestionsPanel open={asking} onClose={() => setAsking(false)} />
      <Toasts />
      <QuitGuard />
    </>
  );
}

function AskButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="Ask Tally (⌘K)"
      className="ask-button inline-flex h-8 shrink-0 items-center gap-2 rounded-full pl-3 pr-2 text-sm font-medium text-white transition-transform duration-150 hover:-translate-y-px active:scale-[0.97]">
      <Sparkle className="twinkle size-4" />
      Ask Tally
      <kbd className="rounded-full bg-white/20 px-1.5 py-px font-sans text-[11px] leading-4">⌘K</kbd>
    </button>
  );
}

/** No back/forward buttons (tabs and breadcrumbs cover navigation), but the Mac shortcuts still work:
 *  ⌘[ ⌘] anywhere, ⌘← ⌘→ when not typing. Renders nothing. */
function HistoryShortcuts() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey || e.altKey || e.shiftKey) return;
      const typing = (e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable=true]");
      if (e.key === "[" || (!typing && e.key === "ArrowLeft")) { e.preventDefault(); router.back(); }
      if (e.key === "]" || (!typing && e.key === "ArrowRight")) { e.preventDefault(); router.forward(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}

/** The live-toggle demo moment: every OPEN Liquidation re-checks when this changes (SPEC §5). */
function BuyerRuleToggle() {
  const qc = useQueryClient();
  const company = useCompany();
  const set = useMutation({
    mutationFn: (rule: BuyerDetailsRule) => api.patch<Company>("/api/company", { buyer_details_rule: rule }),
    onSuccess: (c) => qc.setQueryData(["company"], c),
  });
  const current = set.isPending ? set.variables : company.data?.buyer_details_rule;
  return (
    <div className="flex items-center gap-2 text-sm" title={set.error ? errorMessage(set.error) : undefined}>
      <span className="hidden text-muted xl:inline">Buyer details on</span>
      <Segmented label="Buyer Details Rule" size="sm" value={current} disabled={!company.data || set.isPending}
        onChange={(rule) => rule && set.mutate(rule)}
        options={(Object.keys(BUYER_RULE) as BuyerDetailsRule[]).map((r) => ({ value: r, label: BUYER_RULE[r] }))} />
    </div>
  );
}

function SystemStatus() {
  const { connected, queue } = useLive();
  const health = useHealth();
  const h = health.data;
  const q = queue ?? h?.queue;
  // Plain words: the Reviewer needs "can Tally read receipts right now", not model names.
  const aiOk = !!h && (h.ollama === "fake" || h.ollama === "up");
  const label = !connected ? "Reconnecting…" : !h ? "…" : h.ollama === "down" ? "AI not running" : "AI ready";
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <span className="flex items-center gap-1.5" title={h ? `Local AI: ${h.model}${h.model_loaded ? " (loaded)" : ""}` : undefined}>
        <span className={cx("size-2 rounded-full", !connected ? "pulse bg-warn" : aiOk ? "bg-ok" : "bg-bad")} />
        {label}
      </span>
      {q && q.length > 0 && <span className="num" title="Receipts and questions waiting for the AI">{q.length} waiting</span>}
    </div>
  );
}
