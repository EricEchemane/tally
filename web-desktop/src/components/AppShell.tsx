"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { BUYER_RULE } from "@/lib/labels";
import { useLive } from "@/lib/live";
import { useCompany, useHealth } from "@/lib/queries";
import type { BuyerDetailsRule, Company } from "@/lib/types";
import { QuestionsPanel } from "./QuestionsPanel";
import { SetupGate } from "./SetupGate";
import { Button, cx } from "./ui";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <SetupGate />
      <header className="sticky top-0 z-30 bg-linear-to-b from-paper from-70% to-transparent px-3 pb-2 pt-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 rounded-full border border-line bg-surface/90 py-2 pl-3 pr-2 shadow-card backdrop-blur">
          <HistoryButtons />
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span aria-hidden className="grid size-8 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">T</span>
            Tally
          </Link>
          <CompanyName />
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <BuyerRuleToggle />
            <SystemStatus />
            <Button variant="primary" size="sm" onClick={() => setAsking(true)}>Ask Tally</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-6 pb-8 text-xs text-faint">
        Every receipt is read and checked on this computer. No request leaves the machine.
      </footer>
      <QuestionsPanel open={asking} onClose={() => setAsking(false)} />
    </>
  );
}

/** The app window has no browser toolbar: Back/Forward live here, plus ⌘[ ⌘] and ⌘← ⌘→. */
function HistoryButtons() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, [contenteditable=true]");
      if (e.key === "[" || (!typing && e.key === "ArrowLeft")) { e.preventDefault(); router.back(); }
      if (e.key === "]" || (!typing && e.key === "ArrowRight")) { e.preventDefault(); router.forward(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  const btn = "grid size-8 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink";
  return (
    <div className="-mr-3 flex items-center">
      <button type="button" className={btn} onClick={() => router.back()} title="Back (⌘[)" aria-label="Back">
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12.5 4.5 7 10l5.5 5.5" /></svg>
      </button>
      <button type="button" className={btn} onClick={() => router.forward()} title="Forward (⌘])" aria-label="Forward">
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M7.5 4.5 13 10l-5.5 5.5" /></svg>
      </button>
    </div>
  );
}

function CompanyName() {
  const company = useCompany();
  if (!company.data) return null;
  return (
    <span className="hidden text-sm text-muted sm:inline">
      {company.data.name}
    </span>
  );
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
      <span className="text-muted">Buyer details on</span>
      <div role="radiogroup" aria-label="Buyer Details Rule" className="flex rounded-full border border-line-strong bg-sunken p-0.5">
        {(Object.keys(BUYER_RULE) as BuyerDetailsRule[]).map((rule) => (
          <button
            key={rule}
            type="button"
            role="radio"
            aria-checked={current === rule}
            disabled={!company.data || set.isPending}
            onClick={() => current !== rule && set.mutate(rule)}
            className={cx(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              current === rule ? "bg-surface text-accent shadow-card ring-1 ring-accent/30" : "text-muted hover:text-ink",
            )}
          >
            {BUYER_RULE[rule]}
          </button>
        ))}
      </div>
    </div>
  );
}

function SystemStatus() {
  const { connected, queue } = useLive();
  const health = useHealth();
  const h = health.data;
  const q = queue ?? h?.queue;
  const model = !h ? "…" : h.ollama === "fake" ? "fake pipeline" : h.ollama === "down" ? "model offline" : h.model_loaded ? h.model : `${h.model} (not loaded)`;
  const modelOk = h && (h.ollama === "fake" || (h.ollama === "up" && h.model_loaded));
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <span className="flex items-center gap-1.5" title={connected ? "Live updates connected" : "Reconnecting…"}>
        <span className={cx("size-2 rounded-full", connected ? "bg-ok" : "pulse bg-warn")} />
        {connected ? "Live" : "Offline"}
      </span>
      <span className="flex items-center gap-1.5" title="Local model (Ollama)">
        <span className={cx("size-2 rounded-full", modelOk ? "bg-ok" : "bg-bad")} />
        {model}
      </span>
      {q && q.length > 0 && <span className="num" title="Waiting for the local model">{q.length} in queue</span>}
    </div>
  );
}
