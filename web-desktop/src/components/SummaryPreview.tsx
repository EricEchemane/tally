"use client";
// Preview of the Liquidation summary: the same content as the .xlsx (both come from the backend's
// summary_data), shown before you download or send it. Copy table pastes into Excel, Sheets or an email.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorMessage, peso } from "@/lib/api";
import { formatDate, RECEIPT_STATUS } from "@/lib/labels";
import { toast } from "@/lib/toast";
import type { ReceiptStatus } from "@/lib/types";
import { Dialog } from "./Dialog";
import { DownloadButton } from "./Downloads";
import { Button, cx, Notice, Pill, Skeleton, StatusIcon } from "./ui";

type Cell = string | number | null;
interface Summary {
  title: string; header: [string, string][]; columns: string[]; rows: Cell[][];
  totals: [string, number][]; money_columns: number[];
}

const STATUS_BY_LABEL = Object.fromEntries(Object.entries(RECEIPT_STATUS).map(([k, v]) => [v, k])) as Record<string, ReceiptStatus>;
const TONE: Record<ReceiptStatus, "ok" | "info" | "warn" | "bad"> = { ACCEPTED: "ok", NO_INPUT_VAT: "info", NEEDS_REVIEW: "warn", REJECT: "bad" };

// Column positions in the file's SUMMARY_COLUMNS (api/exports).
const C = { tin: 0, date: 1, seller: 2, address: 3, particulars: 4, amount: 5, withholding: 6, vat: 7, exempt: 8, status: 9, findings: 10 };

const headerValue = (s: Summary, label: string) => s.header.find(([l]) => l === label)?.[1] ?? "";
const total = (s: Summary, label: string) => s.totals.find(([l]) => l === label)?.[1] ?? 0;

export function SummaryPreview({ liquidationId }: { liquidationId: number }) {
  const [open, setOpen] = useState(false);
  const summary = useQuery({
    queryKey: ["summary", liquidationId],
    queryFn: () => api.get<Summary>(`/api/liquidations/${liquidationId}/summary`),
    enabled: open,
  });
  const s = summary.data;
  const href = `/api/liquidations/${liquidationId}/summary.xlsx`;

  return (
    <>
      <Button onClick={() => setOpen(true)}>Summary</Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sheet"
        title={s ? <span className="flex flex-wrap items-center gap-3">Liquidation summary<Pill tone="neutral">{headerValue(s, "Status")}</Pill></span> : "Liquidation summary"}
        description={s && <Subtitle s={s} />}
        footer={<>
          <Button variant="ghost" disabled={!s} onClick={() => s && copy(s)}>Copy table</Button>
          <DownloadButton href={href}>Download .xlsx</DownloadButton>
          <Button variant="primary" onClick={() => setOpen(false)}>Done</Button>
        </>}>
        {summary.isError ? <Notice tone="bad">{errorMessage(summary.error)}</Notice> : !s ? (
          <div className="space-y-3 pb-2"><Skeleton className="h-16" /><Skeleton className="h-72" /></div>
        ) : <Sheet s={s} />}
      </Dialog>
    </>
  );
}

function Subtitle({ s }: { s: Summary }) {
  const [from, to] = headerValue(s, "Spending Period").split(" to ");
  const note = headerValue(s, "Return note");
  return (
    <span className="block space-y-0.5">
      <span className="block text-ink">
        {headerValue(s, "Employee")} · {headerValue(s, "Purpose")} · {formatDate(from)} – {formatDate(to)}
      </span>
      <span className="block">{headerValue(s, "Company")}</span>
      {note && <span className="block">Returned with the note: “{note}”</span>}
    </span>
  );
}

function Sheet({ s }: { s: Summary }) {
  const withholding = s.rows.some((r) => r[C.withholding] != null && Number(r[C.withholding]) !== 0);
  const excess = total(s, "Excess Spend") > 0;
  const figures: [string, number, string?][] = [
    ["Cash Advance", total(s, "Cash Advance")],
    ["Valid Spend", total(s, "Valid Spend")],
    ["Disallowed Amount", total(s, "Disallowed Amount"), total(s, "Disallowed Amount") > 0 ? "text-bad" : undefined],
    excess ? ["Excess Spend", total(s, "Excess Spend")] : ["Amount to Return", total(s, "Amount to Return"), total(s, "Amount to Return") > 0 ? "text-warn" : undefined],
    ["Claimable input VAT", total(s, "Claimable input VAT")],
  ];
  const money = "num whitespace-nowrap px-3 py-3 text-right";
  return (
    <div className="space-y-6 pb-2">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl border border-line px-5 py-4 sm:grid-cols-5">
        {figures.map(([label, value, tone]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className={cx("num mt-0.5 text-lg font-semibold tracking-tight", tone)}>{peso(value)}</dd>
          </div>
        ))}
      </dl>

      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-surface text-left text-xs uppercase tracking-wide text-muted shadow-[0_1px_0_var(--line)]">
          <tr>
            <th className="w-28 px-3 py-2.5 font-medium">Date</th>
            <th className="px-3 py-2.5 font-medium">Seller</th>
            <th className="w-40 px-3 py-2.5 font-medium">Particulars</th>
            <th className="w-28 px-3 py-2.5 text-right font-medium">Amount</th>
            {withholding && <th className="w-28 px-3 py-2.5 text-right font-medium">Withholding</th>}
            <th className="w-24 px-3 py-2.5 text-right font-medium">VAT</th>
            <th className="w-28 px-3 py-2.5 text-right font-medium">VAT-exempt</th>
            <th className="w-64 px-3 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="stagger divide-y divide-line">
          {s.rows.length === 0 && (
            <tr><td colSpan={8} className="px-3 py-10 text-center text-muted">No receipts yet.</td></tr>
          )}
          {s.rows.map((row, i) => (
            <tr key={i} className="align-top">
              <td className="whitespace-nowrap px-3 py-3 text-muted">{dateText(row[C.date])}</td>
              <td className="px-3 py-3" title={row[C.address] ? String(row[C.address]) : undefined}>
                <span className="block font-medium">{text(row[C.seller])}</span>
                <span className="num block text-xs text-muted">{row[C.tin] ? `TIN ${row[C.tin]}` : "No TIN"}</span>
              </td>
              <td className="px-3 py-3 text-muted">{text(row[C.particulars])}</td>
              <td className={cx(money, "font-medium")}>{amount(row[C.amount])}</td>
              {withholding && <td className={money}>{amount(row[C.withholding])}</td>}
              <td className={money}>{amount(row[C.vat])}</td>
              <td className={money}>{amount(row[C.exempt])}</td>
              <td className="px-3 py-3"><StatusCell status={row[C.status]} findings={row[C.findings]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-faint">Seller addresses and every Finding in full are in the Excel file and in Copy table. Hover a seller for its address.</p>
    </div>
  );
}

const text = (v: Cell) => (v == null || v === "" ? <span className="text-faint">—</span> : String(v));
const amount = (v: Cell) => (v == null ? <span className="text-faint">—</span> : peso(Number(v)));
const dateText = (v: Cell) => (v == null || v === "" ? <span className="text-faint">—</span> : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? formatDate(String(v)) : String(v));

/** The verdict, with its deciding reason underneath (the rest on hover). */
function StatusCell({ status, findings }: { status: Cell; findings: Cell }) {
  const label = String(status ?? "");
  const code = STATUS_BY_LABEL[label];
  const reasons = String(findings ?? "").split("\n").map((l) => l.replace(/^[^:]+:\s*/, "").trim()).filter(Boolean);
  return (
    <span className="block space-y-1" title={reasons.length > 1 ? reasons.join("\n") : undefined}>
      {code ? <Pill tone={TONE[code]}><StatusIcon status={code} />{label}</Pill> : <Pill>{label}</Pill>}
      {reasons[0] && (
        <span className="block text-xs text-muted">
          {reasons[0]}{reasons.length > 1 && <span className="text-faint"> · +{reasons.length - 1} more</span>}
        </span>
      )}
    </span>
  );
}

/** Tab-separated plain text (for Excel and Sheets) plus an HTML table (for email and docs). */
async function copy(s: Summary) {
  const plain = (v: Cell, i: number) => (v == null ? "" : s.money_columns.includes(i) ? Number(v).toFixed(2) : String(v).replace(/\s+/g, " "));
  const tsv = [s.columns.join("\t"), ...s.rows.map((r) => r.map(plain).join("\t")), "", ...s.totals.map(([l, v]) => `${l}\t${v.toFixed(2)}`)].join("\n");
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = `<table><thead><tr>${s.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${
    s.rows.map((r) => `<tr>${r.map((v, i) => `<td>${esc(plain(v, i))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  try {
    await navigator.clipboard.write([new ClipboardItem({
      "text/plain": new Blob([tsv], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    })]);
  } catch {
    await navigator.clipboard.writeText(tsv);
  }
  toast("Table copied", { body: "Paste it into Excel, Sheets or an email." });
}
