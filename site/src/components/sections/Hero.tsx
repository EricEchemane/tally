import {
  CheckCircleIcon,
  IdentificationCardIcon,
  ReceiptIcon,
  SealCheckIcon,
  WarningCircleIcon,
  WifiSlashIcon,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { Peso } from "@/components/product";
import heroModel from "../../../public/images/hero-model.png";

const delay = (t: string) => ({ "--at": t }) as CSSProperties;

/* The hero is always light, so these elements use fixed colours rather than theme tokens. */
const card =
  "rounded-2xl bg-white/90 p-3.5 text-left text-[#0f2b26] shadow-[0_12px_32px_rgb(15_43_38/0.14)] ring-1 ring-black/5 backdrop-blur-md";
const chipClass =
  "items-center gap-2 rounded-full bg-white/90 py-1.5 pr-4 pl-1.5 font-semibold text-[#0f2b26] shadow-[0_8px_24px_rgb(15_43_38/0.12)] ring-1 ring-black/5 backdrop-blur-md";

function Status({ tone, children }: { tone: "ok" | "warn"; children: ReactNode }) {
  const Icon = tone === "ok" ? CheckCircleIcon : WarningCircleIcon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        tone === "ok" ? "bg-[#e1f1e7] text-[#1d6f47]" : "bg-[#fbefd5] text-[#8a5a00]"
      }`}
    >
      <Icon aria-hidden weight="fill" className="size-3.5" />
      {children}
    </span>
  );
}

/**
 * Real pieces of Tally's work, held close around her (sample data): the receipt she just snapped, the VAT check,
 * and a Finding left for her to review. Each is anchored a fixed distance from the banner's centre line, so they
 * hug the silhouette symmetrically and leave open space toward both edges. Desktop only; phones get the chip row.
 */
function ModelElements() {
  return (
    <div className="hidden lg:block">
      {/* Left, shoulder height: the receipt. */}
      <div className={`hero-chip absolute w-60 ${card}`} style={{ top: "25%", right: "calc(50% + 7rem)", ...delay("0.6s") }}>
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf6e8] text-[#1d5c43]">
            <ReceiptIcon aria-hidden className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">Juana&apos;s Office Supplies</span>
            <span className="block text-xs text-[#0f2b26]/60">Sales Invoice</span>
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-sm font-semibold">
            <Peso />
            666.00
          </span>
          <Status tone="ok">Accepted</Status>
        </div>
      </div>

      {/* Left, lower: the promise in one tag. */}
      <span className={`hero-chip absolute flex text-sm ${chipClass}`} style={{ top: "47%", right: "calc(50% + 9rem)", ...delay("1.5s") }}>
        <span className="grid size-7 place-items-center rounded-full bg-[#c5f06a]">
          <WifiSlashIcon aria-hidden weight="bold" className="size-4" />
        </span>
        Works offline
      </span>

      {/* Right, shoulder height: the VAT check. */}
      <div className={`hero-chip absolute w-56 ${card}`} style={{ top: "20%", left: "calc(50% + 7rem)", ...delay("0.9s") }}>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[#0f2b26]/60">
          <SealCheckIcon aria-hidden weight="fill" className="size-4 text-[#1d5c43]" />
          VAT check
        </p>
        <p className="mt-2 font-mono text-[0.8125rem]">594.64 × 12% = 71.36</p>
        <div className="mt-2.5">
          <Status tone="ok">VAT adds up</Status>
        </div>
      </div>

      {/* Right, lower: a Finding for her to resolve. */}
      <div className={`hero-chip absolute w-56 ${card}`} style={{ top: "41%", left: "calc(50% + 9rem)", ...delay("1.2s") }}>
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fbefd5] text-[#8a5a00]">
            <IdentificationCardIcon aria-hidden className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Seller TIN not printed</span>
            <span className="mt-1 block">
              <Status tone="warn">Needs review</Status>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Below lg the cards would crowd her, so two of the same results sit in a row above the headline. */
const MOBILE_CHIPS = [
  { label: "Accepted", Icon: CheckCircleIcon, dot: "bg-[#c5f06a] text-[#0f2b26]" },
  { label: "Needs review", Icon: WarningCircleIcon, dot: "bg-[#fbe7b4] text-[#7a5200]" },
];

export function Hero() {
  return (
    <section id="top" className="px-3 pt-3">
      {/* The photo layers clip to the rounded banner on their own, so the download chooser can open past its edge. */}
      {/* Calm ground: white easing into soft mint, a lime glow behind her shoulders, and her forest-green blazer as the
          strongest shape on the page. The model is a cutout, so she sits on this ground with her uniform in full view. */}
      <div
        className="relative isolate rounded-[2rem] text-[#0f2b26]"
        style={{ background: "linear-gradient(180deg, #f3faee 0%, #ffffff 62%)" }}
      >
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden rounded-[2rem]">
        <div
          className="absolute inset-0 -z-30"
          style={{
            background:
              "radial-gradient(30% 36% at 50% 30%, rgb(197 240 106 / 0.55), transparent 72%)," +
              "radial-gradient(60% 50% at 50% 20%, rgb(220 237 211 / 0.7), transparent 75%)",
          }}
        />
        <Image
          src={heroModel}
          alt="A smiling woman in a forest-green blazer with a lime pin and a white top"
          priority
          sizes="(min-width: 768px) 560px, 92vw"
          className="hero-photo hero-model absolute top-[4.75rem] left-1/2 -z-20 h-[42%] w-auto max-w-none -translate-x-1/2 md:top-[5.5rem] md:h-[50%]"
        />

        <ModelElements />
        </div>

        {/* Stack rhythm: tight within the message (headline to subhead), generous before the action. */}
        <div className="relative flex min-h-[min(100svh,58rem)] flex-col items-center justify-end px-5 pt-[50svh] pb-20 text-center md:pt-[60svh] md:pb-16">
          <div aria-hidden className="mb-6 flex gap-2 lg:hidden">
            {MOBILE_CHIPS.map(({ label, Icon, dot }, i) => (
              <span key={label} className={`hero-chip flex text-xs ${chipClass}`} style={delay(`${0.6 + i * 0.3}s`)}>
                <span className={`grid size-6 place-items-center rounded-full ${dot}`}>
                  <Icon aria-hidden weight="fill" className="size-3.5" />
                </span>
                {label}
              </span>
            ))}
          </div>
          <h1 className="max-w-[17ch] text-[2.3rem] leading-[1.04] font-semibold tracking-[-0.04em] sm:max-w-[24ch] sm:text-5xl lg:max-w-[28ch] lg:text-[3.6rem]">
            Every receipt checked against BIR rules,{" "}
            <span className="text-[#1d5c43]">on your own laptop.</span>
          </h1>
          <p className="mt-6 max-w-[33rem] text-lg leading-relaxed text-[#0f2b26]/70">
            Snap the receipts with your phone. Tally checks each one against the BIR rules, and nothing goes to the
            cloud.
          </p>
          {/* The actions live in the nav only (Download the desktop app, Watch the demo). */}
          <p className="mt-6 text-sm text-[#0f2b26]/60">For Mac with Apple Silicon. Windows is planned.</p>
        </div>
      </div>
    </section>
  );
}

const STATS = [
  { value: "6", label: "BIR checks on every receipt" },
  { value: "~15 s", label: "per receipt, measured on an 8 GB M1 MacBook Pro" },
  { value: "0", label: "receipts sent to the cloud" },
  { value: <><Peso />0</>, label: "extra for each receipt you check" },
];

/** The reference kit's stats row, with only figures that are true today. */
export function Stats() {
  return (
    <section aria-label="Tally at a glance" className="mx-auto max-w-6xl px-5 pt-24 pb-8">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="relative flex flex-col border-t border-line pt-5">
            <span aria-hidden className="absolute -top-px left-0 h-[3px] w-10 rounded-full bg-lime" />
            <dt className="order-last mt-2 max-w-[15rem] text-sm text-muted">{s.label}</dt>
            <dd className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
