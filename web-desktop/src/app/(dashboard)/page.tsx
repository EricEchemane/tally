"use client";
// Cash Advances: the Reviewer's starting point (SPEC §9, hours 3–8).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Card, CardHeader, cx, Empty, inputClass, Label, LiquidationStatusPill, Money, Notice, PageHeader, selectClass, Skeleton } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDate, LIQUIDATION_STATUS } from "@/lib/labels";
import { useCashAdvances, useEmployees } from "@/lib/queries";
import { liquidationHref } from "@/lib/routes";
import type { CashAdvance, Employee, LiquidationStatus } from "@/lib/types";

type Filter = LiquidationStatus | undefined;

export default function Home() {
  const [filter, setFilter] = useState<Filter>(undefined);
  const [creating, setCreating] = useState(false);
  const advances = useCashAdvances(filter);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cash Advances"
        sub="Open one to review its Liquidation and scan receipts."
        actions={!creating && <Button variant="primary" onClick={() => setCreating(true)}>New Cash Advance</Button>}
      />

      {creating && <NewCashAdvance onDone={() => setCreating(false)} />}

      <Card>
        <div className="flex flex-wrap gap-1 border-b border-line px-4 py-3" role="tablist" aria-label="Filter by status">
          {([undefined, "OPEN", "RETURNED", "APPROVED"] as Filter[]).map((f) => (
            <button
              key={f ?? "ALL"}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cx("rounded-full px-4 py-1.5 text-sm", filter === f ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-sunken hover:text-ink")}
            >
              {f ? LIQUIDATION_STATUS[f] : "All"}
            </button>
          ))}
        </div>
        {advances.isPending ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : advances.isError ? (
          <div className="p-4"><Notice tone="bad">Couldn’t load Cash Advances: {errorMessage(advances.error)}</Notice></div>
        ) : advances.data.length === 0 ? (
          <Empty>No Cash Advances{filter ? ` with status ${LIQUIDATION_STATUS[filter].toLowerCase()}` : " yet"}.</Empty>
        ) : (
          <AdvanceTable rows={advances.data} />
        )}
      </Card>

      <SlspExport />
    </div>
  );
}

function AdvanceTable({ rows }: { rows: CashAdvance[] }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto px-2 pb-2">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted">
          <tr className="border-b border-line">
            <th className="px-4 py-3 font-medium">Employee</th>
            <th className="px-4 py-3 font-medium">Spending Period</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-2 text-right font-medium">Cash Advance</th>
            <th className="px-4 py-2 text-right font-medium">Valid Spend</th>
            <th className="px-4 py-2 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((ca) => {
            const t = ca.liquidation.totals;
            return (
              // The whole row opens the Liquidation. Not a stretched link: WebKit (the macOS app window) ignores
              // position: relative on <tr>, so the link's overlay would cover the whole page.
              <tr key={ca.id} onClick={() => router.push(liquidationHref(ca.liquidation.id))} className="group cursor-pointer hover:bg-sunken/60 [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg">
                <td className="px-4 py-3">
                  <Link href={liquidationHref(ca.liquidation.id)} className="font-medium group-hover:text-accent">
                    {ca.employee.name}
                  </Link>
                  <span className="block text-muted">{ca.purpose}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(ca.released_on)} – {formatDate(ca.spending_end_on)}</td>
                <td className="px-4 py-3"><LiquidationStatusPill status={ca.liquidation.status} /></td>
                <td className="px-4 py-3 text-right"><Money value={ca.amount} /></td>
                <td className="px-4 py-3 text-right"><Money value={t.valid_spend} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {t.excess_spend > 0 ? (
                    <span className="text-info">Excess <Money value={t.excess_spend} /></span>
                  ) : t.amount_to_return > 0 ? (
                    <span className="text-warn">Return <Money value={t.amount_to_return} /></span>
                  ) : (
                    <span className="text-ok">Settled</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const NEW_EMPLOYEE = "new";
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

function NewCashAdvance({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const employees = useEmployees();
  const [employee, setEmployee] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [released, setReleased] = useState(today());
  const [end, setEnd] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      let employeeId = Number(employee);
      if (employee === NEW_EMPLOYEE) {
        employeeId = (await api.post<Employee>("/api/employees", { name: newName.trim() })).id;
      }
      return api.post<CashAdvance>("/api/cash-advances", {
        employee_id: employeeId, amount, purpose: purpose.trim(), released_on: released, spending_end_on: end,
      });
    },
    onSuccess: (ca) => {
      qc.invalidateQueries({ queryKey: ["cash-advances"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      router.push(liquidationHref(ca.liquidation.id));
    },
  });

  const ready = (employee && (employee !== NEW_EMPLOYEE || newName.trim())) && Number(amount) > 0 && purpose.trim() && released && end && end >= released;

  return (
    <Card className="enter">
      <CardHeader title="New Cash Advance" sub="Its Liquidation opens with it." />
      <form
        className="grid gap-4 p-6 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) create.mutate();
        }}
      >
        <Label label="Employee">
          <select className={selectClass} value={employee} onChange={(e) => setEmployee(e.target.value)} required>
            <option value="" disabled>Choose…</option>
            {employees.data?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            <option value={NEW_EMPLOYEE}>+ New Employee…</option>
          </select>
        </Label>
        {employee === NEW_EMPLOYEE ? (
          <Label label="New Employee’s name">
            <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus required />
          </Label>
        ) : <div className="hidden sm:block" />}
        <Label label="Amount (₱)">
          <input className={cx(inputClass, "num")} inputMode="decimal" type="number" min="0.01" step="0.01"
            value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="15000.00" required />
        </Label>
        <Label label="Purpose">
          <input className={inputClass} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Field sales trip, South Luzon" required />
        </Label>
        <Label label="Released on">
          <input className={inputClass} type="date" value={released} onChange={(e) => setReleased(e.target.value)} required />
        </Label>
        <Label label="Spending ends on" hint="Receipts dated outside this Spending Period are rejected.">
          <input className={inputClass} type="date" value={end} min={released} onChange={(e) => setEnd(e.target.value)} required />
        </Label>
        {create.isError && <Notice tone="bad" className="sm:col-span-2">{errorMessage(create.error)}</Notice>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" variant="primary" busy={create.isPending} disabled={!ready}>Create</Button>
          <Button variant="ghost" onClick={onDone}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

function SlspExport() {
  // Set after mount: the static export would otherwise freeze the build month into the HTML.
  const [month, setMonth] = useState("");
  useEffect(() => setMonth(today().slice(0, 7)), []);
  return (
    <Card>
      <CardHeader
        title="SLSP purchases"
        sub="Non-rejected receipts for one month, ready for your RELIEF converter. Receipts without input VAT go in the non-creditable column."
      />
      <div className="flex flex-wrap items-center gap-3 px-6 py-4">
        <input type="month" className={cx(inputClass, "w-48!")} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />
        <ButtonLink href={month ? `/api/exports/slsp.csv?month=${month}` : undefined} aria-disabled={!month} download>
          Download CSV
        </ButtonLink>
      </div>
    </Card>
  );
}
