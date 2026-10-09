import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import type { ReactNode } from "react";
import { SectionHeader, SectionShell } from "@/components/marketing";
import { Money, Pill, SampleNote, SeverityPill } from "@/components/product";
import blurryTotals from "../../../public/receipts/blurry-7eleven-totals.jpg";

function Block({ title, body, children, className = "" }: { title: string; body: ReactNode; children: ReactNode; className?: string }) {
  return (
    <article className={`flex flex-col rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8 ${className}`}>
      <h3 className="text-xl font-semibold tracking-[-0.02em]">{title}</h3>
      <div className="mt-2 max-w-prose text-muted">{body}</div>
      <div className="mt-8 flex-1">{children}</div>
    </article>
  );
}

function CorrectionView() {
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <Image
        src={blurryTotals}
        alt="A crumpled, blurry 7-Eleven invoice. The VATable amount is hard to read."
        loading="lazy"
        placeholder="blur"
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
          <dd className="mt-1 text-xs text-muted">You fixed it. Tally keeps the original too.</dd>
        </div>
        <div className="rounded-lg border border-line p-3">
          <dt className="text-xs text-muted">VAT check</dt>
          <dd className="mt-1 font-mono text-[0.8125rem]">253.57 × 12% = 30.43</dd>
          <dd className="mt-2"><Pill tone="ok">Re-checked: all good</Pill></dd>
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

export function Review() {
  return (
    <SectionShell tone="plain" labelledBy="review-title">
      <SectionHeader id="review-title" label="You stay in control" title="The AI reads. Code checks. You decide." />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Block
            className="lg:col-span-7"
            title="Fix a misread in seconds."
            body="If Tally reads a number wrong, just correct it. It re-checks the receipt right away."
          >
            <CorrectionView />
          </Block>
          <Block
            className="lg:col-span-5"
            title="Disagree? Dismiss it."
            body="Dismiss a flag and say why. It stays on record as dismissed, so there's always a trail."
          >
            <DismissalView />
          </Block>
        </div>
        <div className="mt-10">
          <SampleNote />
        </div>
    </SectionShell>
  );
}
