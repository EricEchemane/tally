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
const DATE_COLUMN = 1, STATUS_COLUMN = 9;
// Column widths, in SUMMARY_COLUMNS order: wide enough to read without the rows growing tall.
const WIDTH = ["w-44", "w-28", "w-48", "w-72", "w-36", "w-28", "w-32", "w-24", "w-28", "w-36", "w-80"];

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
      <Dialog open={open} onClose={() => setOpen(false)} size="sheet" title={s?.title ?? "Liquidation summary"}
        description="What the Excel file contains."
        footer={<>
          <Button variant="ghost" disabled={!s} onClick={() => s && copy(s)}>Copy table</Button>
          <DownloadButton href={href}>Download .xlsx</DownloadButton>
          <Button variant="primary" onClick={() => setOpen(false)}>Done</Button>
        </>}>
        {summary.isError ? <Notice tone="bad">{errorMessage(summary.error)}</Notice> : !s ? (
          <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
        ) : (
          <div className="space-y-6">
            <dl className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
              {s.header.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="max-h-[55vh] overflow-auto rounded-2xl border border-line">
              <table className="w-max min-w-full table-fixed text-sm">
                <thead className="sticky top-0 z-10 bg-sunken text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    {s.columns.map((c, i) => (
                      <th key={c} className={cx("whitespace-nowrap px-3 py-2.5 font-medium", WIDTH[i], s.money_columns.includes(i) && "text-right")}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="stagger divide-y divide-line">
                  {s.rows.length === 0 && (
                    <tr><td colSpan={s.columns.length} className="px-3 py-8 text-center text-muted">No receipts yet.</td></tr>
                  )}
                  {s.rows.map((row, r) => (
                    <tr key={r} className="align-top">
                      {row.map((cell, i) => (
                        <td key={i} className={cx("px-3 py-2.5",
                          s.money_columns.includes(i) && "num whitespace-nowrap text-right",
                          i === DATE_COLUMN && "whitespace-nowrap",
                          i === 0 && "num whitespace-nowrap",
                          i === s.columns.length - 1 && "whitespace-pre-line text-xs text-muted")}>
                          {render(cell, i, s)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto grid w-full max-w-sm gap-y-1.5 text-sm">
              {s.totals.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-6 border-b border-line/60 pb-1.5 last:border-0">
                  <dt className="text-muted">{label}</dt>
                  <dd className="num font-medium">{peso(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Dialog>
    </>
  );
}

function render(cell: Cell, col: number, s: Summary) {
  if (cell == null || cell === "") return <span className="text-faint">—</span>;
  if (s.money_columns.includes(col)) return peso(Number(cell));
  if (col === DATE_COLUMN && /^\d{4}-\d{2}-\d{2}$/.test(String(cell))) return formatDate(String(cell));
  if (col === 3) return <span className="line-clamp-2" title={String(cell)}>{String(cell)}</span>; // seller address
  if (col === STATUS_COLUMN) {
    const status = STATUS_BY_LABEL[String(cell)];
    return status ? <Pill tone={TONE[status]}><StatusIcon status={status} />{String(cell)}</Pill> : <Pill>{String(cell)}</Pill>;
  }
  return String(cell);
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
