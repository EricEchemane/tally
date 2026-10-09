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
import { Label } from "@/components/marketing";

const CHECKS = [
  { Icon: ReceiptIcon, name: "Invoice or Official Receipt", line: "Flags Official Receipts and receipts marked “not valid for claim of input tax”." },
  { Icon: IdentificationCardIcon, name: "Buyer name and TIN", line: "The buyer's TIN must match your Company's, on every receipt or from ₱1,000 up, as you choose." },
  { Icon: StorefrontIcon, name: "Seller TIN", line: "It must be there and in the right format, branch code included." },
  { Icon: CalculatorIcon, name: "VAT arithmetic", line: "VATable × 12% must equal the VAT, and the parts must add up to the total. If they don't, the receipt is flagged." },
  { Icon: CopyIcon, name: "Duplicates", line: "The same receipt submitted twice, even in a different Liquidation." },
  { Icon: CalendarXIcon, name: "Spending Period", line: "Receipts dated outside the Cash Advance's Spending Period." },
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
    <section aria-labelledby="checks-title">
      <div className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <Label>What it checks</Label>
        <h2 id="checks-title" className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem] sm:leading-[1.08]">
          The checks you&apos;d do, on every receipt.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          Under the EOPT Act, Official Receipts no longer support input VAT claims. Tally knows.
        </p>

        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHECKS.map(({ Icon, name, line }) => (
            <li key={name} className="rounded-3xl bg-surface p-7 shadow-card ring-1 ring-line transition-transform duration-200 ease-out hover:-translate-y-1">
              <span className="grid size-12 place-items-center rounded-full bg-mint text-accent">
                <Icon aria-hidden className="size-6" />
              </span>
              <h3 className="mt-6 text-lg font-semibold">{name}</h3>
              <p className="mt-2 leading-relaxed text-muted">{line}</p>
            </li>
          ))}
        </ul>

        <p className="mt-8 flex max-w-3xl gap-3 rounded-2xl bg-lime/40 px-5 py-3 sm:rounded-full text-lime-ink dark:bg-lime/15 dark:text-ink">
          <InfoIcon aria-hidden weight="fill" className="mt-0.5 size-5 shrink-0" />
          <span>
            Tally only rejects a receipt on what&apos;s printed on it. Anything it can&apos;t read clearly goes to you for
            review.
          </span>
        </p>
      </div>
    </section>
  );
}
