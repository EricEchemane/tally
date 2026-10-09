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

/* The hero is always light, so its elements use fixed colours rather than theme tokens. */
const lightCard =
  "rounded-3xl bg-white/90 p-4 text-left text-[#0f2b26] shadow-[0_16px_40px_rgb(15_43_38/0.14)] ring-1 ring-black/5 backdrop-blur-md";
const chipClass =
  "items-center gap-2 rounded-full bg-white/90 py-1.5 pr-4 pl-1.5 font-semibold text-[#0f2b26] shadow-[0_8px_24px_rgb(15_43_38/0.12)] ring-1 ring-black/5 backdrop-blur-md";

function Status({ tone, children }: { tone: "ok" | "warn" | "lime"; children: ReactNode }) {
  const Icon = tone === "warn" ? WarningCircleIcon : CheckCircleIcon;
  const colors = {
    ok: "bg-[#e1f1e7] text-[#1d6f47]",
    warn: "bg-[#fbefd5] text-[#8a5a00]",
    lime: "bg-[#c5f06a] text-[#0f2b26]",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${colors}`}>
      <Icon aria-hidden weight="fill" className="size-3.5" />
      {children}
    </span>
  );
}

/**
 * Real pieces of Tally's work around her (sample data): the receipt she just snapped, the VAT check, and a Finding
 * left for her. Anchored a fixed distance from the centre line, so the group hugs her symmetrically and reaches into
 * the side space while leaving a margin to both edges. The dark card echoes her blazer. Desktop only.
 */
function ModelElements() {
  return (
    <div className="hidden lg:block">
      {/* Left, shoulder height: the receipt. */}
      <div className={`hero-chip absolute w-[19rem] ${lightCard}`} style={{ top: "21%", right: "calc(50% + 8.5rem)", ...delay("0.6s") }}>
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#edf6e8] text-[#1d5c43]">
            <ReceiptIcon aria-hidden className="size-6" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">Juana&apos;s Office Supplies</span>
            <span className="block text-sm text-[#0f2b26]/60">Sales Invoice SI-000123</span>
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3">
          <span className="font-mono text-xl font-semibold tracking-tight">
            <Peso />
            666.00
          </span>
          <Status tone="ok">Accepted</Status>
        </div>
      </div>

      {/* Left, lower: the promise in one tag. */}
      <span
        className={`hero-chip absolute flex text-base ${chipClass}`}
        style={{ top: "49%", right: "calc(50% + 11rem)", ...delay("1.5s") }}
      >
        <span className="grid size-8 place-items-center rounded-full bg-[#c5f06a]">
          <WifiSlashIcon aria-hidden weight="bold" className="size-4" />
        </span>
        Works offline
      </span>

      {/* Right, shoulder height: the VAT check, in her blazer's green. */}
      <div
        className="hero-chip absolute w-[17rem] rounded-3xl bg-[#0f2b26] p-4 text-left text-white shadow-[0_16px_40px_rgb(15_43_38/0.28)]"
        style={{ top: "16%", left: "calc(50% + 8.5rem)", ...delay("0.9s") }}
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-white/70">
          <SealCheckIcon aria-hidden weight="fill" className="size-5 text-[#c5f06a]" />
          VAT check
        </p>
        <p className="mt-3 font-mono text-base text-[#c5f06a]">594.64 × 12% = 71.36</p>
        <div className="mt-3">
          <Status tone="lime">VAT adds up</Status>
        </div>
      </div>

      {/* Right, lower: a Finding for her to resolve. */}
      <div className={`hero-chip absolute w-[18rem] ${lightCard}`} style={{ top: "40%", left: "calc(50% + 11rem)", ...delay("1.2s") }}>
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fbefd5] text-[#8a5a00]">
            <IdentificationCardIcon aria-hidden className="size-6" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">Seller TIN not printed</span>
            <span className="mt-1.5 block">
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
      {/* Calm ground: white easing into soft mint, a lime glow behind her, and her forest-green blazer as the strongest
          shape. She is a cutout whose lower half dissolves into a white glow, and the headline rises out of that glow,
          so model, elements and type read as one picture. The photo layers clip to the rounded banner on their own,
          so the nav's download chooser can open past its edge. */}
      <div
        className="relative isolate rounded-[2rem] text-[#0f2b26]"
        style={{ background: "linear-gradient(180deg, #f3faee 0%, #ffffff 62%)" }}
      >
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden rounded-[2rem]">
          <div
            className="absolute inset-0 -z-30"
            style={{
              background:
                "radial-gradient(28% 34% at 50% 30%, rgb(197 240 106 / 0.6), transparent 72%)," +
                "radial-gradient(60% 50% at 50% 20%, rgb(220 237 211 / 0.7), transparent 75%)",
            }}
          />
          <Image
            src={heroModel}
            alt="A smiling woman in a forest-green blazer with a lime pin and a white top"
            priority
            sizes="(min-width: 768px) 640px, 92vw"
            className="hero-photo hero-model absolute top-[4.5rem] left-1/2 -z-20 h-[46%] w-auto max-w-none -translate-x-1/2 md:top-[5rem] md:h-[62%]"
          />
          {/* The white glow the headline sits in: it takes over her lower blazer, so there is no edge between them. */}
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(70% 34% at 50% 82%, #ffffff 48%, rgb(255 255 255 / 0.85) 62%, rgb(255 255 255 / 0) 100%)",
            }}
          />
          <ModelElements />
        </div>

        <div className="relative flex min-h-[min(100svh,58rem)] flex-col items-center justify-end px-5 pt-[50svh] pb-16 text-center md:pt-[58svh]">
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
          <h1 className="max-w-[16ch] text-[2.05rem] leading-[0.98] font-extrabold tracking-[-0.025em] uppercase sm:max-w-[20ch] sm:text-5xl lg:max-w-[23ch] lg:text-[3.9rem]">
            Every receipt checked against BIR rules,{" "}
            <span className="text-[#1d5c43]">on your own laptop.</span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-[#0f2b26]/70">
            Snap your receipts with your phone. Tally checks each one and shows you what needs a second look. Nothing
            leaves your laptop.
          </p>
          {/* The actions live in the nav (Download the desktop app, Watch the demo). */}
          <p className="mt-5 text-sm text-[#0f2b26]/60">Available for Mac and Windows.</p>
        </div>
      </div>
    </section>
  );
}
