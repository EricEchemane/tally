import {
  CalculatorIcon,
  CalendarXIcon,
  CopyIcon,
  IdentificationCardIcon,
  InfoIcon,
  ReceiptIcon,
  SparkleIcon,
  StorefrontIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Fragment } from "react";
import { SectionHeader, SectionShell } from "@/components/marketing";
import { Peso } from "@/components/product";

const CHECKS = [
  { Icon: ReceiptIcon, name: "Right kind of receipt", line: "Spots Official Receipts and receipts that can't be used to claim input VAT." },
  { Icon: IdentificationCardIcon, name: "Your company's name and TIN", line: <>Makes sure the receipt is under your company: on every receipt, or only from <Peso />1,000 up.</> },
  { Icon: StorefrontIcon, name: "Seller's TIN", line: "Checks that the seller's TIN is printed and written correctly." },
  { Icon: CalculatorIcon, name: "VAT that adds up", line: "Checks the VAT is exactly 12% and the totals match. If they don't, the receipt is flagged." },
  { Icon: CopyIcon, name: "No duplicates", line: "Catches the same receipt submitted twice, even in another liquidation." },
  { Icon: CalendarXIcon, name: "Within the dates", line: "Flags receipts dated outside the cash advance period." },
];

/** The reference kit's kinetic word band, carrying the six checks. Decorative: the grid below says the same. */
export function ChecksBand() {
  const row = (
    <span className="flex shrink-0 items-center gap-8 pr-8">
      {CHECKS.map((c) => (
        <Fragment key={c.name}>
          <span className="whitespace-nowrap">{c.name}</span>
          <SparkleIcon weight="fill" className="size-7 shrink-0 text-lime" />
        </Fragment>
      ))}
    </span>
  );
  return (
    <div aria-hidden className="overflow-hidden border-y border-line py-6">
      <div className="marquee flex w-max text-3xl font-semibold tracking-[-0.03em] text-ink/85 sm:text-5xl">
        {row}
        {row}
      </div>
    </div>
  );
}

export function Checks() {
  return (
    <SectionShell tone="panel" labelledBy="checks-title">
      <SectionHeader
        id="checks-title"
        label="What it checks"
        title="The checks you'd do, on every receipt."
        intro="Tally knows the latest BIR rules, including the EOPT change: Official Receipts no longer count for input VAT."
      />
        {/* Equal cards: same padding, same icon-to-title and title-to-text rhythm, and every card in a row as tall
            as the tallest. No hover lift: these are information, not links. */}
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CHECKS.map(({ Icon, name, line }) => (
            <li key={name} className="flex flex-col rounded-3xl bg-surface p-8 shadow-card ring-1 ring-line">
              <span className="grid size-12 place-items-center rounded-full bg-lime text-lime-ink">
                <Icon aria-hidden className="size-6" />
              </span>
              <h3 className="mt-7 text-lg font-semibold">{name}</h3>
              <p className="mt-3 leading-relaxed text-muted">{line}</p>
            </li>
          ))}
        </ul>

        <p className="mt-10 flex max-w-3xl items-center gap-3 rounded-2xl bg-lime/15 px-5 py-3.5 text-ink sm:rounded-full">
          <InfoIcon aria-hidden weight="fill" className="size-5 shrink-0" />
          <span>
            Tally only rejects a receipt for what&apos;s printed on it. If it can&apos;t read something clearly, it asks
            you.
          </span>
        </p>
    </SectionShell>
  );
}
