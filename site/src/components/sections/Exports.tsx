import { FileCsvIcon, FileXlsIcon } from "@phosphor-icons/react/dist/ssr";
import { Label } from "@/components/marketing";
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
        Cash Advance <Money value={DEMO.cashAdvance} /> minus Valid Spend <Money value={DEMO.validSpend} />:{" "}
        <span className="font-semibold">Amount to Return <Money value={DEMO.amountToReturn} /></span>
      </p>
    </div>
  );
}

const CSV = `month_end,seller_tin,seller_branch_code,registered_name,…,taxable_net_of_vat,input_tax,gross_purchases
2026-04-30,240727673,00006,"BF Sinangag Express Food Corp",…,316.96,38.04,355.00
2026-04-30,987654321,00000,"Juana's Office Supplies Inc.",…,594.64,71.36,666.00`;

export function Exports() {
  return (
    <section aria-labelledby="exports-title">
      <div className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <Label>Exports</Label>
        <h2 id="exports-title" className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem] sm:leading-[1.08]">
          Ready for your files and the BIR.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
          <div>
            <h3 className="flex items-center gap-2.5 text-lg font-semibold">
              <FileXlsIcon aria-hidden className="size-6 text-ok" />
              The Liquidation summary (Excel)
            </h3>
            <p className="mt-1.5 max-w-prose text-muted">
              Valid Spend, Disallowed Amount and the Amount to Return, receipt by receipt.
            </p>
            <div className="mt-6">
              <Spreadsheet />
            </div>
          </div>
          <div>
            <h3 className="flex items-center gap-2.5 text-lg font-semibold">
              <FileCsvIcon aria-hidden className="size-6 text-accent" />
              The SLSP-ready purchases CSV
            </h3>
            <p className="mt-1.5 max-w-prose text-muted">The purchases, ready for your SLSP.</p>
            <pre className="mt-6 overflow-x-auto rounded-lg border border-line bg-sunken p-4 font-mono text-xs leading-relaxed text-ink">
              <code>{CSV}</code>
            </pre>
            <p className="mt-2 text-xs text-muted">Some columns hidden here for width.</p>
          </div>
        </div>
        <div className="mt-8">
          <SampleNote />
        </div>
      </div>
    </section>
  );
}
