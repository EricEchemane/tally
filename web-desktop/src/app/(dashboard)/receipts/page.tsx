"use client";
// Receipt detail: the photo, the fields Tally read, and the Findings (SPEC §4 Corrections, §5 Reviewer actions).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  Button, Card, CardHeader, cx, inputClass, Money, Notice, PageHeader, Pill, ReceiptStatusPill, SeverityPill, Skeleton, StatusIcon,
} from "@/components/ui";
import { api, ApiError, errorMessage, peso } from "@/lib/api";
import { CHECK, FIELD_GROUPS, formatDate, formatTin, STAGE, type FieldDef } from "@/lib/labels";
import { useLive } from "@/lib/live";
import { useLiquidation, useReceipt } from "@/lib/queries";
import { liquidationHref } from "@/lib/routes";
import type { Finding, Receipt } from "@/lib/types";

function ReceiptView() {
  const id = Number(useSearchParams().get("id"));
  const receipt = useReceipt(id);
  const r = receipt.data;
  const liq = useLiquidation(r?.liquidation_id ?? 0);
  const live = useLive();

  if (!id) return <Notice tone="bad">Receipt not found.</Notice>;
  if (receipt.isPending) return <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-[70vh]" /><Skeleton className="h-[70vh]" /></div>;
  if (receipt.isError || !r) {
    return <Notice tone="bad">{receipt.error instanceof ApiError && receipt.error.status === 404 ? "This receipt doesn’t exist (it may have been deleted)." : errorMessage(receipt.error)}</Notice>;
  }

  const editable = liq.data?.status === "OPEN" && r.stage === "done";
  const employee = liq.data?.cash_advance.employee.name ?? "Liquidation";
  const name = (r.effective?.seller_name as string | null) ?? `Receipt #${r.id}`;
  const open = r.findings.filter((f) => f.state === "OPEN");
  const settled = r.findings.filter((f) => f.state !== "OPEN");

  return (
    <div className="space-y-8">
      <PageHeader
        crumbs={[{ label: "Cash Advances", href: "/" }, { label: employee, href: liquidationHref(r.liquidation_id) }, { label: name }]}
        title={name}
        badge={<ReceiptStatusPill status={r.status} stage={r.stage} checksPending={r.checks_pending} />}
        actions={
          <>
            <span className="mr-2 text-2xl font-semibold tracking-tight"><Money value={r.effective?.total as number | null} /></span>
            {liq.data?.status === "OPEN" && <DeleteReceipt r={r} />}
          </>
        }
      />
      {liq.data && liq.data.status !== "OPEN" && (
        <Notice tone="info">This Liquidation is {liq.data.status.toLowerCase()}, so the receipt is read-only.</Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <ReceiptImage key={r.rotation} r={r} />
          {r.ocr_text && <OcrText text={r.ocr_text} />}
        </div>

        <div className="space-y-6">
          {r.stage === "failed" && <Notice tone="bad">Tally couldn’t read this photo: {r.error ?? "unknown error"}. Delete it and retake the photo.</Notice>}
          {r.stage !== "done" && r.stage !== "failed" && (
            <Notice tone="info">
              {STAGE[r.stage]}… {live.previews[r.id] && <span className="block truncate font-mono text-xs">{live.previews[r.id]}</span>}
            </Notice>
          )}

          {r.findings.length > 0 || r.stage === "done" ? (
            <Card>
              <CardHeader title="Findings" sub={open.length ? `${open.length} open` : r.checks_pending ? "Checking…" : "Nothing open"} />
              {r.findings.length === 0 ? (
                <p className="flex items-center gap-2 px-6 py-6 text-sm text-ok"><StatusIcon status="ACCEPTED" />Passed every check.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {[...open, ...settled].map((f) => <FindingRow key={f.id} f={f} receiptId={r.id} canAct={editable} />)}
                </ul>
              )}
            </Card>
          ) : null}

          {r.effective && <Fields r={r} editable={editable} />}
        </div>
      </div>
    </div>
  );
}

// ---------- image ----------

function ReceiptImage({ r }: { r: Receipt }) {
  // rotation is what OCR applied (PIL, counter-clockwise) to make the photo upright; CSS rotates clockwise.
  const [turn, setTurn] = useState(-r.rotation);
  const sideways = Math.abs(turn % 180) === 90;
  return (
    <Card className="overflow-hidden">
      <div className="relative grid h-[60vh] place-items-center bg-sunken [container-type:size]">
        {/* eslint-disable-next-line @next/next/no-img-element -- local API image, no optimizer offline */}
        <img
          src={r.image_url}
          alt="Receipt photo"
          className="object-contain transition-transform"
          style={{
            transform: `rotate(${turn}deg)`,
            maxWidth: sideways ? "100cqh" : "100cqw",
            maxHeight: sideways ? "100cqw" : "100cqh",
          }}
        />
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => setTurn((t) => t + 90)}>Rotate ↻</Button>
        <a href={r.image_url} target="_blank" rel="noreferrer" className="text-sm text-muted hover:text-accent">Open full size ↗</a>
      </div>
    </Card>
  );
}

function OcrText({ text }: { text: string }) {
  return (
    <details className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
      <summary className="cursor-pointer px-6 py-4 text-sm font-medium">Text read from the photo</summary>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t border-line px-6 py-4 font-mono text-xs text-muted">{text}</pre>
    </details>
  );
}

// ---------- Findings ----------

function useReceiptAction<T>(receiptId: number, fn: (arg: T) => Promise<Receipt>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.setQueryData(["receipt", receiptId], r);
      qc.invalidateQueries({ queryKey: ["liquidation", r.liquidation_id] });
    },
  });
}

function FindingRow({ f, receiptId, canAct }: { f: Finding; receiptId: number; canAct: boolean }) {
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const dismiss = useReceiptAction(receiptId, () => api.post<Receipt>(`/api/findings/${f.id}/dismiss`, { reason: reason.trim() }));
  const confirm = useReceiptAction(receiptId, (as: "REJECT" | "NO_INPUT_VAT") => api.post<Receipt>(`/api/findings/${f.id}/confirm`, { as }));
  const isOpen = f.state === "OPEN";
  const error = dismiss.error ?? confirm.error;

  return (
    <li className={cx("space-y-2 px-6 py-4", !isOpen && "bg-sunken/40")}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityPill severity={f.severity} />
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{CHECK[f.check] ?? f.check}</span>
        {f.state === "DISMISSED" && <Pill>Dismissed</Pill>}
        {f.state === "CONFIRMED" && <Pill tone="neutral">Confirmed by you</Pill>}
        {f.amount_affected != null && <span className="ml-auto text-sm text-muted"><Money value={f.amount_affected} /></span>}
      </div>
      <p className={cx("text-sm", f.state === "DISMISSED" && "text-muted line-through decoration-faint")}>{f.message}</p>
      {f.related && (
        <Link href={liquidationHref(f.related.liquidation_id)} className="text-sm text-accent hover:underline">
          Open Liquidation #{f.related.liquidation_id} →
        </Link>
      )}
      {f.dismissal_reason && <p className="text-sm text-muted">Reason: “{f.dismissal_reason}”</p>}

      {isOpen && canAct && !dismissing && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={() => setDismissing(true)}>Dismiss…</Button>
          {f.severity === "NEEDS_REVIEW" && (
            <>
              <Button size="sm" variant="danger" busy={confirm.isPending && confirm.variables === "REJECT"} onClick={() => confirm.mutate("REJECT")}>
                Confirm as Reject
              </Button>
              {f.check === "VAT_ARITHMETIC" && (
                <Button size="sm" busy={confirm.isPending && confirm.variables === "NO_INPUT_VAT"} onClick={() => confirm.mutate("NO_INPUT_VAT")}>
                  Accept without input VAT
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {dismissing && (
        <form
          className="enter flex flex-wrap gap-2 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim()) dismiss.mutate(undefined, { onSuccess: () => setDismissing(false) });
          }}
        >
          <input className={cx(inputClass, "h-8 min-w-0 flex-1")} autoFocus placeholder="Why is this fine? (required)"
            value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" size="sm" variant="primary" disabled={!reason.trim()} busy={dismiss.isPending}>Dismiss</Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissing(false)}>Cancel</Button>
        </form>
      )}
      {error && <Notice tone="bad">{errorMessage(error)}</Notice>}
    </li>
  );
}

// ---------- fields and corrections ----------

function Fields({ r, editable }: { r: Receipt; editable: boolean }) {
  const corrected = new Map(r.corrections.map((c) => [c.field, c]));
  return (
    <Card>
      <CardHeader
        title="What Tally read"
        sub={editable ? "Fix a misread value; the checks re-run right away. The original reading is kept." : undefined}
        actions={r.derived?.amounts_repaired ? <Pill tone="info">Amounts auto-corrected</Pill> : undefined}
      />
      <div className="divide-y divide-line">
        {FIELD_GROUPS.map((g) => (
          <section key={g.title} className="px-6 py-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{g.title}</h3>
            <dl className="divide-y divide-line/60">
              {g.fields.map((def) => (
                <FieldRow key={def.key} r={r} def={def} correction={corrected.get(def.key)} editable={editable && def.editable !== false} />
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Card>
  );
}

function display(def: FieldDef, v: unknown): string {
  if (v == null || v === "") return "—";
  switch (def.kind) {
    case "amount": return peso(v as number);
    case "date": return formatDate(String(v));
    case "tin": return formatTin(v);
    case "bool": return v ? "Yes" : "No";
    case "enum": return def.options?.[String(v)] ?? String(v);
    default: return String(v);
  }
}

function FieldRow({ r, def, correction, editable }: {
  r: Receipt; def: FieldDef; correction?: Receipt["corrections"][number]; editable: boolean;
}) {
  const value = r.effective?.[def.key];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const save = useReceiptAction(r.id, (v: unknown) => api.post<Receipt>(`/api/receipts/${r.id}/corrections`, { field: def.key, value: v }));
  const revert = useReceiptAction(r.id, () => api.delete<Receipt>(`/api/receipts/${r.id}/corrections/${def.key}`));

  const start = () => {
    setDraft(value == null ? "" : def.kind === "bool" ? String(Boolean(value)) : String(value));
    setEditing(true);
    save.reset();
  };
  const submit = () => {
    // Values go to the API as typed; it validates and normalizes them (amounts to centavos, TINs to digits).
    const v = def.kind === "bool" ? (draft === "" ? null : draft === "true") : draft.trim() === "" ? null : draft.trim();
    save.mutate(v, { onSuccess: () => setEditing(false) });
  };

  return (
    <div className="grid grid-cols-[9.5rem_1fr] items-start gap-3 py-2 text-sm">
      <dt className="pt-1.5 text-muted">{def.label}</dt>
      <dd className="min-w-0">
        {editing ? (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <FieldInput def={def} value={draft} onChange={setDraft} label={groupLabel(def)} />
            <Button type="submit" size="sm" variant="primary" busy={save.isPending}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            {save.isError && <p className="w-full text-xs text-bad">{errorMessage(save.error)}</p>}
          </form>
        ) : (
          <div className="flex min-h-8 flex-wrap items-center gap-2">
            <span className={cx(def.kind === "amount" && "num", value == null && "text-faint")}>{display(def, value)}</span>
            {correction && (
              <Pill tone="accent" className="font-normal">
                corrected · was {display(def, correction.previous)}
              </Pill>
            )}
            {editable && (
              <span className="ml-auto flex gap-1">
                {correction && (
                  <Button size="sm" variant="ghost" busy={revert.isPending} onClick={() => revert.mutate(undefined)} title="Use what Tally read" aria-label={`Revert ${def.label}`}>
                    Revert
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={start} aria-label={`Edit ${groupLabel(def)}`}>Edit</Button>
              </span>
            )}
            {revert.isError && <p className="w-full text-xs text-bad">{errorMessage(revert.error)}</p>}
          </div>
        )}
      </dd>
    </div>
  );
}

// "Seller TIN" vs "Buyer TIN": the row label alone is ambiguous for screen readers.
function groupLabel(def: FieldDef): string {
  const group = FIELD_GROUPS.find((g) => g.fields.includes(def))?.title;
  return group === "Seller" || group === "Buyer" ? `${group} ${def.label}` : def.label;
}

function FieldInput({ def, value, onChange, label }: { def: FieldDef; value: string; onChange: (v: string) => void; label: string }) {
  const cls = cx(inputClass, "h-8 min-w-0 flex-1");
  if (def.kind === "enum") {
    return (
      <select className={cx(cls, "appearance-none pr-9 select-chevron")} value={value} onChange={(e) => onChange(e.target.value)} autoFocus aria-label={label}>
        <option value="">— none —</option>
        {Object.entries(def.options ?? {}).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
    );
  }
  if (def.kind === "bool") {
    return (
      <select className={cx(cls, "appearance-none pr-9 select-chevron")} value={value} onChange={(e) => onChange(e.target.value)} autoFocus aria-label={label}>
        <option value="">Unknown</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  return (
    <input
      className={cx(cls, def.kind === "amount" && "num")}
      aria-label={label}
      autoFocus
      type={def.kind === "date" ? "date" : "text"}
      inputMode={def.kind === "amount" ? "decimal" : def.kind === "tin" ? "numeric" : undefined}
      placeholder={def.kind === "tin" ? "123-456-789-00000" : def.kind === "amount" ? "0.00" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function DeleteReceipt({ r }: { r: Receipt }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const del = useMutation({
    mutationFn: () => api.delete(`/api/receipts/${r.id}`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["receipt", r.id] });
      qc.invalidateQueries({ queryKey: ["liquidation", r.liquidation_id] });
      router.push(liquidationHref(r.liquidation_id));
    },
  });
  if (!sure) return <Button variant="ghost" size="sm" onClick={() => setSure(true)}>Delete</Button>;
  return (
    <span className="flex items-center gap-2">
      <Button variant="danger" size="sm" busy={del.isPending} onClick={() => del.mutate()}>Delete receipt</Button>
      <Button variant="ghost" size="sm" onClick={() => setSure(false)}>Keep</Button>
      {del.isError && <span className="text-xs text-bad">{errorMessage(del.error)}</span>}
    </span>
  );
}

export default function ReceiptPage() {
  return <Suspense><ReceiptView /></Suspense>;
}
