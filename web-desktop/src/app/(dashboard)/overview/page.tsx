"use client";
// Overview: a period at a glance. Every number is computed by the server (api/overview.py) from the
// same records as Ask Tally, and each list links to the Liquidations and receipts behind it.
import Link from "next/link";
import { useState } from "react";
import { Card, CardHeader, cx, Empty, Money, Notice, PageHeader, Segmented, Skeleton, Stat } from "@/components/ui";
import { errorMessage, peso } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import { useOverview } from "@/lib/queries";
import { liquidationHref, receiptHref } from "@/lib/routes";
import type { Overview, OverviewPeriod } from "@/lib/types";

const PERIODS: { key: OverviewPeriod; label: string }[] = [
  { key: "THIS_MONTH", label: "This month" },
  { key: "LAST_MONTH", label: "Last month" },
  { key: "THIS_QUARTER", label: "This quarter" },
  { key: "THIS_YEAR", label: "This year" },
  { key: "ALL", label: "All time" },
];

export default function OverviewPage() {
  const [period, setPeriod] = useState<OverviewPeriod>("THIS_YEAR");
  const ov = useOverview(period);
  const d = ov.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        sub={d ? `Receipts dated ${d.period_label === "all time" ? "at any time" : `in ${d.period_label}`} · ${d.receipts} receipt${d.receipts === 1 ? "" : "s"}${d.needs_review ? ` · ${d.needs_review} need${d.needs_review === 1 ? "s" : ""} review` : ""}` : " "}
        actions={
          <Segmented label="Period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />
        }
      />

      {ov.isError ? (
        <Notice tone="bad">Couldn’t load the Overview: {errorMessage(ov.error)}</Notice>
      ) : !d ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
        </div>
      ) : (
        <div key={d.period} className={cx("space-y-6 transition-opacity duration-150", ov.isPlaceholderData && "opacity-60")}>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Total spend" value={d.spend} hint="Every checked receipt" />
            <Stat better="up" label="Valid Spend" value={d.valid_spend} tone={d.valid_spend > 0 ? "ok" : undefined} hint="Not rejected" />
            <Stat better="down" label="Disallowed Amount" value={d.disallowed} tone={d.disallowed > 0 ? "bad" : undefined} hint="Rejected receipts" />
            <Stat better="down" label="Input VAT lost" value={d.input_vat_lost} tone={d.input_vat_lost > 0 ? "warn" : undefined} hint="Rejected or not claimable" />
          </dl>

          <div className="grid gap-6 lg:grid-cols-2">
            <Outstanding d={d} />
            <Reasons d={d} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Valid Spend by Expense Category" />
              {d.by_category.length === 0 ? <Empty>No valid spend in this period.</Empty> : (
                <ul className="stagger space-y-4 p-6">
                  {d.by_category.map((c) => (
                    <Bar key={c.category} label={c.category} value={c.amount} max={d.by_category[0].amount} />
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="By Employee" sub="Valid spend and Disallowed Amount" />
              {d.by_employee.length === 0 ? <Empty>No receipts in this period.</Empty> : (
                <ul className="stagger space-y-4 p-6">
                  {d.by_employee.map((e) => {
                    const max = Math.max(...d.by_employee.map((x) => x.valid_spend + x.disallowed));
                    return (
                      <li key={e.employee} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="truncate font-medium">{e.employee}</span>
                          <span className="num shrink-0 text-muted">
                            <Money value={e.valid_spend} className="text-ink" />
                            {e.disallowed > 0 && <> · <span className="text-bad">{peso(e.disallowed)} disallowed</span></>}
                          </span>
                        </div>
                        <div className="flex h-2.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
                          <div className="bar-grow h-full bg-ok" style={{ width: `${pct(e.valid_spend, max)}%` }} />
                          <div className="bar-grow h-full bg-bad/70" style={{ width: `${pct(e.disallowed, max)}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

const pct = (v: number, max: number) => (max > 0 ? Math.max(v > 0 ? 2 : 0, (v / max) * 100) : 0);

function Bar({ label, value, max, tone = "ok", extra }: { label: string; value: number; max: number; tone?: "ok" | "bad"; extra?: React.ReactNode }) {
  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="num shrink-0 text-muted">{extra}<Money value={value} className="text-ink" /></span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
        <div className={cx("bar-grow h-full rounded-full", tone === "ok" ? "bg-ok" : "bg-bad/70")} style={{ width: `${pct(value, max)}%` }} />
      </div>
    </li>
  );
}

function Outstanding({ d }: { d: Overview }) {
  const o = d.outstanding;
  return (
    <Card>
      <CardHeader
        title="Outstanding Cash Advances"
        sub={o.open ? `${o.open} open, ${peso(o.amount)} released` : "Nothing open"}
      />
      {o.overdue.length === 0 ? (
        <Empty>No Cash Advance has gone unliquidated for more than {o.overdue_days} days.</Empty>
      ) : (
        <>
          <p className="px-6 pt-4 text-xs font-medium uppercase tracking-wide text-muted">Not yet liquidated after {o.overdue_days} days</p>
          <ul className="stagger space-y-1 p-2">
            {o.overdue.map((r) => (
              <li key={r.liquidation_id}>
                <Link href={liquidationHref(r.liquidation_id)} className="flex items-center gap-4 rounded-2xl px-4 py-3 hover:bg-sunken/60">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.employee}</span>
                    <span className="block truncate text-xs text-muted">{r.purpose} · released {formatDate(r.released_on)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Money value={r.amount} className="block text-sm font-medium" />
                    <span className="text-xs text-warn">{r.days} days</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function Reasons({ d }: { d: Overview }) {
  const max = d.disallowed_reasons[0]?.amount ?? 0;
  return (
    <Card>
      <CardHeader title="Why receipts were disallowed" sub="By the check that rejected them" />
      {d.disallowed_reasons.length === 0 ? (
        <Empty>No receipt was rejected in this period.</Empty>
      ) : (
        <ul className="stagger space-y-4 p-6">
          {d.disallowed_reasons.map((r) => (
            <li key={r.reason} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{r.reason}</span>
                <Money value={r.amount} className="shrink-0" />
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
                <div className="bar-grow h-full rounded-full bg-bad/70" style={{ width: `${pct(r.amount, max)}%` }} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                {r.receipts} receipt{r.receipts === 1 ? "" : "s"}:
                {r.receipt_ids.slice(0, 8).map((id) => (
                  <Link key={id} href={receiptHref(id)} className="rounded-full border border-line px-2 py-0.5 hover:border-accent hover:text-ink">#{id}</Link>
                ))}
                {r.receipt_ids.length > 8 && <span>+{r.receipt_ids.length - 8} more</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
