"use client";
// The Liquidation screen: totals, live receipts, approve/return (SPEC §5, §7).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CapturePanel, UploadDropzone } from "@/components/Upload";
import {
  Button, ButtonLink, Card, CardHeader, Crumbs, cx, Empty, inputClass, LiquidationStatusPill, Money, Notice, ReceiptStatusPill, Skeleton, Stat,
} from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { formatDate, STAGE, STAGE_ORDER } from "@/lib/labels";
import { useLive } from "@/lib/live";
import { useLiquidation } from "@/lib/queries";
import type { Liquidation, ReceiptSummary } from "@/lib/types";

function LiquidationView() {
  const id = Number(useParams<{ id: string }>().id);
  const liq = useLiquidation(id);

  if (liq.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <div className="grid gap-3 sm:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (liq.isError) {
    return <Notice tone="bad">{liq.error instanceof ApiError && liq.error.status === 404 ? "This Liquidation doesn’t exist." : errorMessage(liq.error)}</Notice>;
  }

  const l = liq.data;
  const ca = l.cash_advance;
  const open = l.status === "OPEN";
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Crumbs items={[{ label: "Cash Advances", href: "/" }, { label: ca.employee.name }]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
              {ca.employee.name}
              <LiquidationStatusPill status={l.status} />
            </h1>
            <p className="text-muted">
              {ca.purpose} · Spending Period {formatDate(ca.released_on)} – {formatDate(ca.spending_end_on)}
            </p>
          </div>
          <Actions liq={l} />
        </div>
      </div>

      {l.status === "RETURNED" && (
        <Notice tone="warn">
          Returned to {ca.employee.name}{l.return_note ? `: “${l.return_note}”` : "."} The open Findings below are the reasons.
          Reopen it when replacements arrive.
        </Notice>
      )}
      {l.status === "APPROVED" && <Notice tone="ok">Approved. Totals are frozen.</Notice>}

      <Totals liq={l} />

      <div className={cx("grid gap-6", open && "lg:grid-cols-[1fr_17rem]")}>
        <Card>
          <CardHeader
            title={`Receipts (${l.receipts.length})`}
            sub={l.open_needs_review > 0 ? `${l.open_needs_review} Finding${l.open_needs_review === 1 ? "" : "s"} need${l.open_needs_review === 1 ? "s" : ""} your review` : undefined}
          />
          {open && <div className="border-b border-line p-4"><UploadDropzone liquidationId={id} /></div>}
          {l.receipts.length === 0 ? <Empty>No receipts yet. Scan the QR code with a phone or upload photos.</Empty> : <ReceiptList receipts={l.receipts} />}
        </Card>
        {open && <aside className="space-y-6"><CapturePanel liquidationId={id} /></aside>}
      </div>
    </div>
  );
}

function Totals({ liq }: { liq: Liquidation }) {
  const t = liq.totals;
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Stat label="Cash Advance" value={t.advance} />
      <Stat label="Valid Spend" value={t.valid_spend} />
      <Stat label="Disallowed Amount" value={t.disallowed} tone={t.disallowed > 0 ? "bad" : undefined} hint="Rejected receipts" />
      {t.excess_spend > 0 ? (
        <Stat label="Excess Spend" value={t.excess_spend} hint="Reimbursable, subject to approval" />
      ) : (
        <Stat label="Amount to Return" value={t.amount_to_return} tone={t.amount_to_return > 0 ? "warn" : "ok"} hint="Employee returns this" />
      )}
      <Stat label="Claimable input VAT" value={t.claimable_input_vat} tone="ok" />
    </dl>
  );
}

function Actions({ liq }: { liq: Liquidation }) {
  const qc = useQueryClient();
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState("");
  const done = (l: Liquidation) => {
    qc.setQueryData(["liquidation", liq.id], l);
    qc.invalidateQueries({ queryKey: ["cash-advances"] });
  };
  const approve = useMutation({ mutationFn: () => api.post<Liquidation>(`/api/liquidations/${liq.id}/approve`), onSuccess: done });
  const ret = useMutation({
    mutationFn: () => api.post<Liquidation>(`/api/liquidations/${liq.id}/return`, { note: note.trim() || null }),
    onSuccess: (l) => {
      done(l);
      setReturning(false);
      setNote("");
    },
  });
  const reopen = useMutation({ mutationFn: () => api.post<Liquidation>(`/api/liquidations/${liq.id}/reopen`), onSuccess: done });
  // A blocked-approval message goes stale as soon as the Findings change.
  const { reset } = approve;
  useEffect(() => reset(), [liq.open_needs_review, liq.receipts.length, reset]);

  const blocked = approve.error instanceof ApiError && approve.error.status === 409
    ? (approve.error.body as { error?: string; receipt_ids?: number[] } | null) : null;

  return (
    <div className="flex max-w-md flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href={`/api/liquidations/${liq.id}/summary.xlsx`} download>Summary (.xlsx)</ButtonLink>
        {liq.status === "OPEN" && (
          <>
            <Button onClick={() => setReturning((v) => !v)}>Return…</Button>
            <Button variant="primary" busy={approve.isPending} onClick={() => approve.mutate()}>Approve</Button>
          </>
        )}
        {liq.status === "RETURNED" && <Button variant="primary" busy={reopen.isPending} onClick={() => reopen.mutate()}>Reopen</Button>}
      </div>

      {blocked && liq.status === "OPEN" && (
        <Notice tone="bad" className="enter w-full">
          {blocked.error === "receipts_processing" ? (
            "Some receipts are still being read. Approve once they’re done."
          ) : (
            <>
              <strong>Can’t approve yet:</strong> resolve the Findings that need review on{" "}
              {blocked.receipt_ids?.map((rid, i) => (
                <span key={rid}>
                  {i > 0 && ", "}
                  <Link href={`/receipts/${rid}`} className="font-medium underline">receipt #{rid}</Link>
                </span>
              ))}
              .
            </>
          )}
        </Notice>
      )}
      {(approve.isError && !blocked) || ret.isError || reopen.isError ? (
        <Notice tone="bad" className="w-full">{errorMessage(approve.error ?? ret.error ?? reopen.error)}</Notice>
      ) : null}

      {returning && liq.status === "OPEN" && (
        <form
          className="enter w-full space-y-2 rounded-lg border border-line bg-surface p-3 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            ret.mutate();
          }}
        >
          <label className="block text-sm font-medium" htmlFor="return-note">Return to the Employee</label>
          <textarea id="return-note" className={cx(inputClass, "h-20 py-2")} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note, e.g. Please bring an Invoice for the hotel stay." />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReturning(false)}>Cancel</Button>
            <Button type="submit" size="sm" variant="primary" busy={ret.isPending}>Return Liquidation</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function ReceiptList({ receipts }: { receipts: ReceiptSummary[] }) {
  return (
    <ul className="divide-y divide-line">
      {receipts.map((r) => <ReceiptRow key={r.id} r={r} />)}
    </ul>
  );
}

function ReceiptRow({ r }: { r: ReceiptSummary }) {
  const live = useLive();
  const preview = live.previews[r.id];
  const queuePos = live.stages[r.id]?.queue_position;
  const processing = r.stage !== "done" && r.stage !== "failed";
  return (
    <li className="enter group relative flex items-center gap-4 px-4 py-3 hover:bg-sunken/60">
      {/* eslint-disable-next-line @next/next/no-img-element -- local API image, no optimizer offline */}
      <img src={r.thumbnail_url} alt="" loading="lazy" className="size-14 shrink-0 rounded-md border border-line bg-sunken object-cover" />
      <div className="min-w-0 flex-1">
        <Link href={`/receipts/${r.id}`} className="font-medium after:absolute after:inset-0 group-hover:text-accent">
          {r.seller_name ?? (processing ? "Reading receipt…" : r.stage === "failed" ? "Couldn’t read this photo" : `Receipt #${r.id}`)}
        </Link>
        {processing ? (
          <div className="mt-1 space-y-1">
            <StageTrack stage={r.stage} />
            <p className="truncate font-mono text-xs text-muted">
              {preview ?? (r.stage === "queued" && queuePos ? `Waiting for the local model (#${queuePos} in queue)` : STAGE[r.stage] + "…")}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {formatDate(r.date)}
            {r.open_findings > 0 && <> · {r.open_findings} open Finding{r.open_findings === 1 ? "" : "s"}</>}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <Money value={r.total} className="font-medium" />
        <ReceiptStatusPill status={r.status} stage={r.stage} checksPending={r.checks_pending} />
      </div>
    </li>
  );
}

function StageTrack({ stage }: { stage: ReceiptSummary["stage"] }) {
  const at = STAGE_ORDER.indexOf(stage);
  return (
    <div className="flex items-center gap-1" aria-label={`Stage: ${STAGE[stage]}`}>
      {STAGE_ORDER.slice(0, 4).map((s, i) => (
        <span key={s} title={STAGE[s]} className={cx("h-1 w-8 rounded-full", i < at ? "bg-accent" : i === at ? "pulse bg-accent" : "bg-line-strong")} />
      ))}
    </div>
  );
}

export default function LiquidationPage() {
  return <Suspense><LiquidationView /></Suspense>;
}
