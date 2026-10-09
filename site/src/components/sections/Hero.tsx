import { CheckCircleIcon, SealCheckIcon, WarningCircleIcon, WifiSlashIcon } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import type { CSSProperties } from "react";
import { DemoButton, DownloadButton } from "@/components/Cta";
import heroPhoto from "../../../public/images/hero-happy-laptop.jpg";

const delay = (t: string) => ({ "--at": t }) as CSSProperties;

/**
 * Tally's results floating around her, in the app's own words (as the Upmind reference floats its tags).
 * The hero is always light, so its colours are fixed rather than theme tokens. Positions are % of the banner,
 * kept to the plain studio space either side of her; `mobile` chips also show on small screens.
 */
const CHIPS = [
  { label: "Accepted", Icon: CheckCircleIcon, dot: "bg-[#c5f06a] text-[#0f2b26]", pos: "left-[15%] top-[27%]", mobile: true },
  { label: "Works offline", Icon: WifiSlashIcon, dot: "bg-[#d4eadb] text-[#1d5c43]", pos: "left-[7%] top-[46%]", mobile: false },
  { label: "VAT adds up", Icon: SealCheckIcon, dot: "bg-[#d6e8f7] text-[#24507a]", pos: "right-[14%] top-[22%]", mobile: false },
  { label: "Needs review", Icon: WarningCircleIcon, dot: "bg-[#fbe7b4] text-[#7a5200]", pos: "right-[8%] top-[42%]", mobile: true },
];

const chipClass =
  "items-center gap-2 rounded-full bg-white/80 py-1.5 pr-4 pl-1.5 text-sm font-semibold text-[#0f2b26] shadow-[0_8px_24px_rgb(15_43_38/0.12)] ring-1 ring-black/5 backdrop-blur-md";

export function Hero() {
  return (
    <section id="top" className="px-3 pt-3">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#e8f0e6] text-[#0f2b26]">
        <Image
          src={heroPhoto}
          alt="A smiling young accountant in glasses waves while holding her laptop"
          priority
          placeholder="blur"
          sizes="100vw"
          className="hero-photo absolute inset-0 -z-20 size-full object-cover object-[46%_22%]"
        />
        {/* A soft green cast over the studio grey, the reference's lime light leak, and a white wash under the type. */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-[#e4f2dc] opacity-60 mix-blend-multiply" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(34% 48% at 6% 22%, rgb(197 240 106 / 0.55), transparent 72%)," +
              "linear-gradient(180deg, rgb(248 251 246 / 0) 0%, rgb(248 251 246 / 0) 40%, rgb(248 251 246 / 0.86) 60%, #f8fbf6 78%)",
          }}
        />

        {/* Desktop: floating around her. Mobile: her face fills the frame, so they sit in a row above the headline. */}
        {CHIPS.map(({ label, Icon, dot, pos }, i) => (
          <span
            key={label}
            aria-hidden
            className={`hero-chip absolute ${pos} hidden md:flex ${chipClass}`}
            style={delay(`${0.6 + i * 0.3}s`)}
          >
            <span className={`grid size-7 place-items-center rounded-full ${dot}`}>
              <Icon aria-hidden weight="fill" className="size-4" />
            </span>
            {label}
          </span>
        ))}

        <div className="relative flex min-h-[min(100svh,58rem)] flex-col items-center justify-end px-5 pt-[46svh] pb-16 text-center sm:pt-[50svh] sm:pb-20">
          <div aria-hidden className="mb-5 flex gap-2 md:hidden">
            {CHIPS.filter((c) => c.mobile).map(({ label, Icon, dot }, i) => (
              <span key={label} className={`hero-chip flex ${chipClass.replace("text-sm", "text-xs")}`} style={delay(`${0.6 + i * 0.3}s`)}>
                <span className={`grid size-6 place-items-center rounded-full ${dot}`}>
                  <Icon aria-hidden weight="fill" className="size-3.5" />
                </span>
                {label}
              </span>
            ))}
          </div>
          <h1 className="max-w-[17ch] text-[2.3rem] leading-[1.04] font-semibold tracking-[-0.04em] sm:max-w-[22ch] sm:text-5xl lg:text-[3.7rem]">
            Every receipt checked against BIR rules,{" "}
            <span className="text-[#1d5c43]">on your own laptop.</span>
          </h1>
          <p className="mt-5 max-w-[33rem] text-lg leading-relaxed text-[#0f2b26]/70">
            Snap the receipts with your phone. Tally checks each one against the BIR rules, and nothing goes to the
            cloud.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <DemoButton />
            <DownloadButton className="order-first shadow-[0_8px_24px_rgb(120_170_40/0.35)] sm:order-none" />
          </div>
          <p className="mt-4 text-sm text-[#0f2b26]/60">For Mac with Apple Silicon. Windows is planned.</p>
        </div>
      </div>
    </section>
  );
}

const STATS = [
  { value: "6", label: "BIR checks on every receipt" },
  { value: "~15 s", label: "per receipt, measured on an 8 GB M1 MacBook Pro" },
  { value: "0", label: "receipts sent to the cloud" },
  { value: "₱0", label: "extra for each receipt you check" },
];

/** The reference kit's stats row, with only figures that are true today. */
export function Stats() {
  return (
    <section aria-label="Tally at a glance" className="mx-auto max-w-6xl px-5 pt-20 pb-6">
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
