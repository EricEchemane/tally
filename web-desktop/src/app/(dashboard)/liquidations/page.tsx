"use client";
// The Liquidation screen: totals, live receipts, approve/return (SPEC §5, §7).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { DownloadButton } from "@/components/Downloads";
import { EditCashAdvance } from "@/components/EditCashAdvance";
import { MoveReceipts } from "@/components/MoveReceipts";
import { CapturePanel, UploadDropzone } from "@/components/Upload";
import {
  Button, Card, CardHeader, cx, Empty, LiquidationStatusPill, Money, Notice, PageHeader, ReceiptStatusPill, Skeleton, Stat, textareaClass,
} from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { formatDate, STAGE, STAGE_ORDER } from "@/lib/labels";
import { useLive } from "@/lib/live";
import { useLiquidation } from "@/lib/queries";
import { receiptHref } from "@/lib/routes";
import type { Liquidation, ReceiptSummary } from "@/lib/types";

function LiquidationView() {
  const id = Number(useSearchParams().get("id"));
  const liq = useLiquidation(id);
  const [editing, setEditing] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  if (!id) return <Notice tone="bad">Liquidation not found.</Notice>;

  if (liq.isPending) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-2/3" />
        <div className="grid gap-4 sm:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}</div>
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
    <div className="space-y-8">
      <PageHeader
        crumbs={[{ label: "Cash Advances", href: "/" }, { label: ca.employee.name }]}
        title={ca.employee.name}
        badge={<LiquidationStatusPill status={l.status} />}
        sub={<>{ca.purpose} · Spending Period {formatDate(ca.released_on)} – {formatDate(ca.spending_end_on)}</>}
        actions={<Actions liq={l} onEdit={open && !editing ? () => setEditing(true) : undefined} />}
      />

      {editing && open && <EditCashAdvance liq={l} onDone={() => setEditing(false)} />}

      {l.status === "RETURNED" && (
        <Notice tone="warn">
          Returned to {ca.employee.name}{l.return_note ? `: “${l.return_note}”` : "."} The open Findings below are the reasons.
          Reopen it when replacements arrive.
        </Notice>
      )}
      {l.status === "APPROVED" && <Notice tone="ok">Approved. Totals are frozen.</Notice>}
      {ca.archived && <Notice tone="info">Archived. It’s off the working list but still counts in the Overview and exports.</Notice>}

      <Totals liq={l} />

      <div className={cx("grid gap-6", open && "lg:grid-cols-[1fr_18rem]")}>
        <Card>
          <CardHeader
            title={`Receipts (${l.receipts.length})`}
            sub={l.open_needs_review > 0 ? `${l.open_needs_review} Finding${l.open_needs_review === 1 ? "" : "s"} need${l.open_needs_review === 1 ? "s" : ""} your review` : undefined}
            actions={open && l.receipts.length > 0 && (selecting
              ? <Button size="sm" variant="ghost" onClick={() => { setSelecting(false); setSelected([]); }}>Done</Button>
              : <Button size="sm" variant="ghost" onClick={() => setSelecting(true)}>Select</Button>)}
          />
          {selecting && (
            <BulkBar liq={l} selected={selected} setSelected={setSelected} />
          )}
          {open && !selecting && <div className="border-b border-line p-4"><UploadDropzone liquidationId={id} /></div>}
          {l.receipts.length === 0 ? <Empty>No receipts yet. Scan the QR code with a phone or upload photos.</Empty> : (
            <ReceiptList receipts={l.receipts} selection={selecting ? { selected, toggle: (rid) =>
              setSelected((s) => (s.includes(rid) ? s.filter((x) => x !== rid) : [...s, rid])) } : undefined} />
          )}
        </Card>
        {open && <aside className="space-y-6"><CapturePanel liquidationId={id} /></aside>}
      </div>
    </div>
  );
}

function Totals({ liq }: { liq: Liquidation }) {
  const t = liq.totals;
  return (
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <Stat label="Cash Advance" value={t.advance} />
      <Stat label="Valid Spend" value={t.valid_spend} better="up" />
      <Stat label="Disallowed Amount" value={t.disallowed} tone={t.disallowed > 0 ? "bad" : undefined} hint="Rejected receipts" better="down" />
      {t.excess_spend > 0 ? (
        <Stat label="Excess Spend" value={t.excess_spend} hint="Reimbursable, subject to approval" />
      ) : (
        <Stat label="Amount to Return" value={t.amount_to_return} tone={t.amount_to_return > 0 ? "warn" : "ok"} hint="Employee returns this" better="down" />
      )}
      <Stat label="Claimable input VAT" value={t.claimable_input_vat} tone="ok" better="up" />
    </dl>
  );
}

function Actions({ liq, onEdit }: { liq: Liquidation; onEdit?: () => void }) {
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
  const router = useRouter();
  const ca = liq.cash_advance;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["liquidation", liq.id] });
    qc.invalidateQueries({ queryKey: ["cash-advances"] });
  };
  const archive = useMutation({ mutationFn: () => api.post(`/api/cash-advances/${ca.id}/${ca.archived ? "unarchive" : "archive"}`), onSuccess: refresh });
  const [deleting, setDeleting] = useState(false);
  const del = useMutation({
    mutationFn: () => api.delete(`/api/cash-advances/${ca.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cash-advances"] }); router.push("/"); },
  });
  // A blocked-approval message goes stale as soon as the Findings change.
  const { reset } = approve;
  useEffect(() => reset(), [liq.open_needs_review, liq.receipts.length, reset]);

  const blocked = approve.error instanceof ApiError && approve.error.status === 409
    ? (approve.error.body as { error?: string; receipt_ids?: number[] } | null) : null;

  return (
    // Buttons stay on one row; only the messages below them are width-limited.
    <div className="flex flex-col items-end gap-2 [&>*:not(:first-child)]:max-w-md">
      <div className="flex flex-wrap items-center justify-end gap-2 lg:flex-nowrap">
        {onEdit && <Button variant="ghost" onClick={onEdit}>Edit details</Button>}
        <DownloadButton href={`/api/liquidations/${liq.id}/summary.xlsx`}>Summary (.xlsx)</DownloadButton>
        {liq.status === "OPEN" && (
          <>
            <Button onClick={() => setReturning((v) => !v)}>Return…</Button>
            <Button variant="primary" busy={approve.isPending} onClick={() => approve.mutate()}>Approve</Button>
          </>
        )}
        {liq.status !== "OPEN" && (
          <Button variant="ghost" busy={archive.isPending} onClick={() => archive.mutate()}>{ca.archived ? "Unarchive" : "Archive"}</Button>
        )}
        {liq.receipts.length === 0 && !deleting && <Button variant="ghost" onClick={() => setDeleting(true)}>Delete</Button>}
        {liq.status === "RETURNED" && <Button variant="primary" busy={reopen.isPending} onClick={() => reopen.mutate()}>Reopen</Button>}
      </div>
      {deleting && (
        <Notice tone="warn" className="enter w-full">
          <p>Delete this Cash Advance for {ca.employee.name}? It has no receipts, so nothing else is lost.</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDeleting(false)}>Keep</Button>
            <Button size="sm" variant="danger" busy={del.isPending} onClick={() => del.mutate()}>Delete Cash Advance</Button>
          </div>
        </Notice>
      )}
      {(archive.isError || del.isError) && <Notice tone="bad" className="w-full">{errorMessage(archive.error ?? del.error)}</Notice>}

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
                  <Link href={receiptHref(rid)} className="font-medium underline">receipt #{rid}</Link>
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
          className="enter w-full space-y-3 rounded-3xl border border-line bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            ret.mutate();
          }}
        >
          <label className="block text-sm font-medium" htmlFor="return-note">Return to the Employee</label>
          <textarea id="return-note" className={textareaClass} value={note} onChange={(e) => setNote(e.target.value)}
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

type Selection = { selected: number[]; toggle: (id: number) => void };

function BulkBar({ liq, selected, setSelected }: { liq: Liquidation; selected: number[]; setSelected: (ids: number[]) => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"idle" | "move" | "delete">("idle");
  const del = useMutation({
    mutationFn: async () => { for (const rid of selected) await api.delete(`/api/receipts/${rid}`); },
    onSuccess: () => { setSelected([]); setMode("idle"); qc.invalidateQueries({ queryKey: ["liquidation", liq.id] }); qc.invalidateQueries({ queryKey: ["cash-advances"] }); },
  });
  const all = liq.receipts.map((r) => r.id);
  const n = selected.length;
  return (
    <div className="enter flex flex-wrap items-center gap-3 border-b border-line bg-sunken/50 px-6 py-3 text-sm">
      <span className="font-medium">{n ? `${n} selected` : "Select receipts"}</span>
      <Button size="sm" variant="ghost" onClick={() => setSelected(n === all.length ? [] : all)}>{n === all.length ? "Clear" : "Select all"}</Button>
      <span className="ml-auto flex flex-wrap items-center gap-2">
        {mode === "move" ? (
          <MoveReceipts receiptIds={selected} employeeId={liq.cash_advance.employee.id} fromLiquidationId={liq.id}
            onDone={() => { setSelected([]); setMode("idle"); }} onCancel={() => setMode("idle")} />
        ) : mode === "delete" ? (
          <>
            <span>Delete {n} receipt{n === 1 ? "" : "s"} and their photos?</span>
            <Button size="sm" variant="danger" busy={del.isPending} onClick={() => del.mutate()}>Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>Keep</Button>
          </>
        ) : (
          <>
            <Button size="sm" disabled={!n} onClick={() => setMode("move")}>Move to…</Button>
            <Button size="sm" variant="danger" disabled={!n} onClick={() => setMode("delete")}>Delete</Button>
          </>
        )}
      </span>
      {del.isError && <span className="w-full text-xs text-bad">{errorMessage(del.error)}</span>}
    </div>
  );
}

function ReceiptList({ receipts, selection }: { receipts: ReceiptSummary[]; selection?: Selection }) {
  return (
    <ul className="stagger space-y-1 p-2">
      {receipts.map((r) => <ReceiptRow key={r.id} r={r} selection={selection} />)}
    </ul>
  );
}

function ReceiptRow({ r, selection }: { r: ReceiptSummary; selection?: Selection }) {
  const live = useLive();
  const preview = live.previews[r.id];
  const queuePos = live.stages[r.id]?.queue_position;
  const processing = r.stage !== "done" && r.stage !== "failed";
  return (
    <li className={cx("group relative flex items-center gap-4 rounded-2xl p-3 transition-colors duration-150 hover:bg-sunken/60",
      selection?.selected.includes(r.id) && "bg-accent-soft/60 hover:bg-accent-soft")}>
      {selection && (
        // In select mode the whole row toggles the checkbox instead of opening the receipt.
        <label className="absolute inset-0 z-10 cursor-pointer rounded-2xl">
          <input type="checkbox" className="sr-only" checked={selection.selected.includes(r.id)} onChange={() => selection.toggle(r.id)}
            aria-label={`Select ${r.seller_name ?? `receipt #${r.id}`}`} />
        </label>
      )}
      {selection && (
        <span key={String(selection.selected.includes(r.id))} aria-hidden className={cx("grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150",
          selection.selected.includes(r.id) && "pop",
          selection.selected.includes(r.id) ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-surface")}>
          {selection.selected.includes(r.id) && <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>}
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- local API image, no optimizer offline */}
      <img src={r.thumbnail_url} alt="" loading="lazy" className="size-14 shrink-0 rounded-2xl border border-line bg-sunken object-cover" />
      <div className="min-w-0 flex-1">
        <Link href={receiptHref(r.id)} className="font-medium after:absolute after:inset-0 group-hover:text-accent">
          {r.seller_name ?? (processing ? "Reading receipt…" : r.stage === "failed" ? "Couldn’t read this photo" : `Receipt #${r.id}`)}
        </Link>
        {processing ? (
          <div className="mt-1 space-y-1">
            <StageTrack stage={r.stage} />
            <p className="truncate font-mono text-xs text-muted">
              {preview ?? (r.stage === "queued" && queuePos ? `Waiting for the AI (#${queuePos} in line)` : STAGE[r.stage] + "…")}
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
