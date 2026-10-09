import { FileCsvIcon, FileXlsIcon } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SectionShell } from "@/components/marketing";
import { DEMO, Money, SampleNote } from "@/components/product";

function Spreadsheet() {
  const cols = ["", "A", "B", "C", "D"];
  return (
    <div className="overflow-x-auto rounded-lg border border-line text-[0.8125rem]">
      <table className="w-full min-w-[30rem] border-collapse text-left">
        <thead>
          <tr className="bg-sunken text-xs text-faint">
            {cols.map((c) => (
              <th key={c} scope="col" className="border-r border-line px-2 py-1 font-normal last:border-r-0">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-line bg-sunken/60 font-medium">
            <td className="w-8 border-r border-line px-2 py-1.5 text-xs text-faint">1</td>
            <td className="border-r border-line px-2 py-1.5">Seller</td>
            <td className="border-r border-line px-2 py-1.5 text-right">Total</td>
            <td className="border-r border-line px-2 py-1.5 text-right">Valid Spend</td>
            <td className="px-2 py-1.5 text-right">Disallowed</td>
          </tr>
          {DEMO.receipts.map((r, i) => {
            const rejected = r.status === "REJECT";
            return (
              <tr key={r.seller + r.status} className="border-t border-line">
                <td className="border-r border-line px-2 py-1.5 text-xs text-faint">{i + 2}</td>
                <td className="max-w-[12rem] truncate border-r border-line px-2 py-1.5">{r.seller}</td>
                <td className="border-r border-line px-2 py-1.5 text-right"><Money value={r.amount} /></td>
                <td className="border-r border-line px-2 py-1.5 text-right"><Money value={rejected ? 0 : r.amount} /></td>
                <td className="px-2 py-1.5 text-right"><Money value={rejected ? r.amount : 0} className={rejected ? "text-bad" : ""} /></td>
              </tr>
            );
          })}
          <tr className="border-t border-line-strong font-semibold">
            <td className="border-r border-line px-2 py-1.5 text-xs font-normal text-faint">{DEMO.receipts.length + 2}</td>
            <td className="border-r border-line px-2 py-1.5">Totals</td>
            <td className="border-r border-line px-2 py-1.5 text-right"><Money value={DEMO.validSpend + DEMO.disallowed} /></td>
            <td className="border-r border-line px-2 py-1.5 text-right"><Money value={DEMO.validSpend} /></td>
            <td className="px-2 py-1.5 text-right"><Money value={DEMO.disallowed} className="text-bad" /></td>
          </tr>
        </tbody>
      </table>
      <p className="border-t border-line-strong bg-sunken/60 px-3 py-2">
        Cash advance <Money value={DEMO.cashAdvance} /> minus what was spent <Money value={DEMO.validSpend} /> ={" "}
        <span className="font-semibold"><Money value={DEMO.amountToReturn} /> to return</span>
      </p>
    </div>
  );
}

/** A friendly preview of the purchases file: who you bought from, their TIN, what you paid and the VAT you can claim. */
const PURCHASES = [
  { supplier: "Juana's Office Supplies", tin: "987-654-321", amount: 666, vat: 71.36 },
  { supplier: "BF Sinangag Express", tin: "240-727-673", amount: 355, vat: 38.04 },
  { supplier: "Primera Clase Gas Station", tin: "007-851-409", amount: 282.95, vat: 30.32 },
];

function PurchasesFile() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <p className="flex items-center gap-2 border-b border-line bg-sunken px-4 py-2.5 text-xs text-muted">
        <FileCsvIcon aria-hidden className="size-4 text-accent" />
        purchases-april-2026.csv
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left text-[0.8125rem]">
          <thead className="text-xs text-muted">
            <tr>
              <th scope="col" className="px-4 pt-3 pb-2 font-medium">Supplier</th>
              <th scope="col" className="px-2 pt-3 pb-2 font-medium">TIN</th>
              <th scope="col" className="px-2 pt-3 pb-2 text-right font-medium">Paid</th>
              <th scope="col" className="px-4 pt-3 pb-2 text-right font-medium">Input VAT</th>
            </tr>
          </thead>
          <tbody>
            {PURCHASES.map((p) => (
              <tr key={p.supplier} className="border-t border-line">
                <td className="max-w-[10rem] truncate px-4 py-2.5">{p.supplier}</td>
                <td className="px-2 py-2.5 font-mono text-xs text-muted">{p.tin}</td>
                <td className="px-2 py-2.5 text-right"><Money value={p.amount} /></td>
                <td className="px-4 py-2.5 text-right"><Money value={p.vat} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Exports() {
  return (
    <SectionShell tone="plain" labelledBy="exports-title">
      <SectionHeader id="exports-title" label="Exports" title="Done checking? Export your files." />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line sm:p-8">
            <h3 className="flex items-center gap-2.5 text-lg font-semibold">
              <FileXlsIcon aria-hidden className="size-6 text-ok" />
              Liquidation summary (Excel)
            </h3>
            <p className="mt-2 max-w-prose text-muted">
              Every receipt in one sheet: what counts, what doesn&apos;t, and how much the employee needs to return.
            </p>
            <div className="mt-6">
              <Spreadsheet />
            </div>
          </div>
          <div className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line sm:p-8">
            <h3 className="flex items-center gap-2.5 text-lg font-semibold">
              <FileCsvIcon aria-hidden className="size-6 text-accent" />
              Purchases list for the BIR
            </h3>
            <p className="mt-2 max-w-prose text-muted">
              Your purchases, already laid out for the SLSP: the purchases report you file with the BIR every
              quarter. No retyping.
            </p>
            <div className="mt-6">
              <PurchasesFile />
            </div>
          </div>
        </div>
        <div className="mt-10">
          <SampleNote />
        </div>
    </SectionShell>
  );
}
