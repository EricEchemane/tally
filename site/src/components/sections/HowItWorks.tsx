import { CheckIcon, QrCodeIcon } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import { Label } from "@/components/marketing";
import { AppWindow, DEMO, Money, SampleNote, SeverityPill, StatusPill, WorkingPill } from "@/components/product";
import demoInvoice from "../../../public/receipts/demo-invoice.jpg";
import { StepTabs, type Step } from "./StepTabs";

function ScanVisual() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-5">
      <AppWindow title="Tally · Cash Advance">
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <div className="grid size-28 place-items-center rounded-xl border border-line bg-paper">
            <QrCodeIcon aria-hidden className="size-20 text-ink" />
          </div>
          <p className="font-medium">{DEMO.liquidation}</p>
          <p className="max-w-[16rem] text-sm text-muted">Scan with your phone to add receipts to this Liquidation.</p>
        </div>
      </AppWindow>
      <div className="w-36 rounded-[1.75rem] bg-black p-1.5 shadow-pop ring-1 ring-white/15 sm:w-40">
        <div className="relative overflow-hidden rounded-[1.3rem]">
          <Image src={demoInvoice} alt="" sizes="160px" className="aspect-[9/16] w-full object-cover" />
          <span aria-hidden className="absolute bottom-3 left-1/2 size-10 -translate-x-1/2 rounded-full border-4 border-white/90 bg-white/30" />
        </div>
      </div>
    </div>
  );
}

const STAGES = ["Queued", "Reading text", "Extracting fields", "Checking BIR rules"];
function ReadVisual() {
  return (
    <AppWindow title="Tally · Receipt">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="font-medium">Juana&apos;s Office Supplies Inc.</p>
          <p className="text-xs text-muted">Sales Invoice SI-000123</p>
        </div>
        <WorkingPill />
      </div>
      <ol className="space-y-3 px-4 py-5 text-sm">
        {STAGES.map((stage, i) => {
          const done = i < STAGES.length - 1;
          return (
            <li key={stage} className="flex items-center gap-3">
              <span
                aria-hidden
                className={`grid size-5 place-items-center rounded-full ${done ? "bg-ok-soft text-ok" : "border-2 border-accent"}`}
              >
                {done && <CheckIcon weight="bold" className="size-3" />}
              </span>
              <span className={done ? "text-muted" : "font-medium"}>{stage}</span>
            </li>
          );
        })}
      </ol>
      <p className="border-t border-line px-4 py-3 text-xs text-muted">
        About 15 seconds per receipt, measured on an 8 GB M1 MacBook Pro.
      </p>
    </AppWindow>
  );
}

const FINDINGS = [
  { severity: "REJECT", text: "Dated Mar 10, 2022, outside the Spending Period" },
  { severity: "NO_INPUT_VAT", text: "Official Receipt, not an Invoice: no input VAT" },
  { severity: "NEEDS_REVIEW", text: "Seller TIN not printed on the receipt" },
] as const;
function CheckVisual() {
  return (
    <AppWindow title="Tally · Receipt">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="font-medium">Restaurant, Cebu City</p>
          <p className="text-xs text-muted">Official Receipt · <Money value={3113} /></p>
        </div>
        <StatusPill status="REJECT" />
      </div>
      <ul className="divide-y divide-line">
        {FINDINGS.map((f) => (
          <li key={f.text} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-sm">
            <SeverityPill severity={f.severity} />
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-4 py-3 text-sm">
        Disallowed Amount <Money value={3113} className="font-semibold text-bad" />
      </p>
    </AppWindow>
  );
}

function ApproveVisual() {
  return (
    <AppWindow title={`Tally · ${DEMO.liquidation}`}>
      <dl className="grid grid-cols-2 gap-px bg-line text-sm">
        {[
          ["Cash Advance", DEMO.cashAdvance],
          ["Valid Spend", DEMO.validSpend],
          ["Disallowed", DEMO.disallowed],
          ["Amount to Return", DEMO.amountToReturn],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5 text-lg font-semibold"><Money value={value as number} /></dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-4">
        <span className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink">
          Approve Liquidation
        </span>
        <span className="inline-flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-medium">
          Return to Employee
        </span>
        <span className="ml-auto text-xs text-muted">All Findings resolved</span>
      </div>
    </AppWindow>
  );
}

const STEPS: Step[] = [
  {
    title: "Scan",
    body: "Open the Cash Advance and scan its QR code with your phone, then photograph each receipt. Uploading files works too.",
    visual: <ScanVisual />,
  },
  {
    title: "Read",
    body: "Your laptop reads each receipt in about 15 seconds. Receipts appear on the dashboard as they're done.",
    visual: <ReadVisual />,
  },
  {
    title: "Check",
    body: "Each receipt is checked against the BIR rules and marked accepted, or shown with its Findings.",
    visual: <CheckVisual />,
  },
  {
    title: "Approve",
    body: "Correct anything misread, resolve the Findings, approve or return the Liquidation, and export.",
    visual: <ApproveVisual />,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title">
      <div className="mx-auto max-w-6xl px-5 py-24 lg:py-32">
        <Label>How it works</Label>
        <h2 id="how-title" className="mt-4 max-w-[20ch] text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem] sm:leading-[1.08]">
          From a pile of receipts to an approved Liquidation.
        </h2>
        <div className="mt-14 lg:mt-16">
          <StepTabs steps={STEPS} />
        </div>
        <div className="mt-10">
          <SampleNote />
        </div>
      </div>
    </section>
  );
}
