import { ArrowRightIcon, ChatCircleTextIcon } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import type { ReactNode } from "react";
import { Label } from "@/components/marketing";
import { Money, Pill, SampleNote, SeverityPill } from "@/components/product";
import blurryTotals from "../../../public/receipts/blurry-7eleven-totals.jpg";

function Block({ title, body, children, className = "" }: { title: string; body: ReactNode; children: ReactNode; className?: string }) {
  return (
    <article className={`flex flex-col rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8 ${className}`}>
      <h3 className="text-xl font-semibold tracking-[-0.02em]">{title}</h3>
      <div className="mt-2 max-w-prose text-muted">{body}</div>
      <div className="mt-6 flex-1">{children}</div>
    </article>
  );
}

function CorrectionView() {
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <Image
        src={blurryTotals}
        alt="A crumpled, blurry 7-Eleven invoice. The VATable amount is hard to read."
        sizes="(min-width: 640px) 260px, 100vw"
        className="w-full rounded-lg object-cover ring-1 ring-line"
      />
      <dl className="space-y-3 text-sm">
        <div className="rounded-lg border border-line p-3">
          <dt className="text-xs text-muted">VATable sales</dt>
          <dd className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-faint line-through"><Money value={258.57} /></span>
            <ArrowRightIcon aria-hidden className="size-3.5 self-center text-faint" />
            <Money value={253.57} className="font-semibold" />
          </dd>
          <dd className="mt-1 text-xs text-muted">Corrected by you. The original reading is kept.</dd>
        </div>
        <div className="rounded-lg border border-line p-3">
          <dt className="text-xs text-muted">VAT arithmetic</dt>
          <dd className="mt-1 font-mono text-[0.8125rem]">253.57 × 12% = 30.43</dd>
          <dd className="mt-2"><Pill tone="ok">Checks re-ran: passed</Pill></dd>
        </div>
      </dl>
    </div>
  );
}

function DismissalView() {
  return (
    <div className="rounded-lg border border-line">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 text-sm">
        <SeverityPill severity="NEEDS_REVIEW" />
        <span className="text-muted line-through decoration-faint">Seller TIN not found</span>
        <Pill className="ml-auto">Dismissed</Pill>
      </div>
      <div className="space-y-1 px-4 py-3 text-sm">
        <p className="text-xs text-muted">Reason</p>
        <p>The TIN is printed on the back. Checked against the paper copy.</p>
      </div>
    </div>
  );
}

const ANSWER = [
  { employee: "Juan", liquidation: "Store visits, April", amount: 484.05 },
  { employee: "Maria", liquidation: "Pharmacy run, September", amount: 1215.5 },
];
function AskView() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
      <ul className="flex flex-wrap content-start gap-2 text-sm">
        {["How much input VAT did we lose in April?", "Sino pa ang may ibabalik?", "Has any receipt been submitted twice?"].map((q) => (
          <li key={q} className="rounded-full border border-line bg-paper px-3 py-1.5">{q}</li>
        ))}
      </ul>
      <div className="overflow-hidden rounded-lg border border-line">
        <p className="flex items-center gap-2 border-b border-line bg-sunken px-4 py-3 text-sm">
          <ChatCircleTextIcon aria-hidden className="size-4 shrink-0 text-accent" />
          Sino pa ang may ibabalik?
        </p>
        <div className="px-4 py-3 text-sm">
          <p>Two Employees still have an Amount to Return.</p>
          <table className="mt-3 w-full text-left">
            <thead className="text-xs text-muted">
              <tr>
                <th className="pb-1.5 font-medium">Employee</th>
                <th className="pb-1.5 font-medium">Liquidation</th>
                <th className="pb-1.5 text-right font-medium">Amount to Return</th>
              </tr>
            </thead>
            <tbody>
              {ANSWER.map((r) => (
                <tr key={r.employee} className="border-t border-line">
                  <td className="py-2">{r.employee}</td>
                  <td className="py-2 text-muted">{r.liquidation}</td>
                  <td className="py-2 text-right"><Money value={r.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">How I got this: the Cash Advance minus the Valid Spend, for each open Liquidation.</p>
        </div>
      </div>
    </div>
  );
}

export function Review() {
  return (
    <section aria-labelledby="review-title" className="bg-sunken">
      <div className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <Label>You stay in control</Label>
        <h2 id="review-title" className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
          The AI reads. Code checks. You decide.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Block
            className="lg:col-span-7"
            title="Correct a misread."
            body="Change any value Tally read. The checks re-run straight away, and the original reading is kept."
          >
            <CorrectionView />
          </Block>
          <Block
            className="lg:col-span-5"
            title="Dismiss a Finding, with a reason."
            body="The Finding stays visible as dismissed, so there's always a record."
          >
            <DismissalView />
          </Block>
          <Block
            className="lg:col-span-12"
            title="Ask in English or Taglish."
            body="Ask about your Liquidations in plain words. The answers come from your records, not from the AI's guesses, and show how they were worked out."
          >
            <AskView />
          </Block>
        </div>
        <div className="mt-8">
          <SampleNote />
        </div>
      </div>
    </section>
  );
}
