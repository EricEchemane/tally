// Small, real pieces of the Tally app's UI, drawn with the same tokens and labels as web/src/components/ui.tsx,
// so the page shows the product instead of describing it. Every figure in them is sample data.
import {
  CheckCircleIcon,
  CircleNotchIcon,
  InfoIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "accent";
const TONES: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok border-ok/25",
  warn: "bg-warn-soft text-warn border-warn/25",
  bad: "bg-bad-soft text-bad border-bad/25",
  info: "bg-info-soft text-info border-info/25",
  neutral: "bg-sunken text-muted border-line",
  accent: "bg-accent-soft text-accent border-accent/25",
};

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type Status = "ACCEPTED" | "NO_INPUT_VAT" | "NEEDS_REVIEW" | "REJECT";
const STATUS: Record<Status, { label: string; tone: Tone; Icon: typeof CheckCircleIcon }> = {
  ACCEPTED: { label: "Accepted", tone: "ok", Icon: CheckCircleIcon },
  NO_INPUT_VAT: { label: "No input VAT", tone: "info", Icon: InfoIcon },
  NEEDS_REVIEW: { label: "Needs review", tone: "warn", Icon: WarningCircleIcon },
  REJECT: { label: "Rejected", tone: "bad", Icon: XCircleIcon },
};

/** Receipt Status, as the app shows it. */
export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const { label, tone, Icon } = STATUS[status];
  return (
    <Pill tone={tone} className={className}>
      <Icon aria-hidden weight="fill" className="size-3.5" />
      {label}
    </Pill>
  );
}

export type Severity = "REJECT" | "NEEDS_REVIEW" | "NO_INPUT_VAT";
const SEVERITY: Record<Severity, { label: string; tone: Tone }> = {
  REJECT: { label: "Reject", tone: "bad" },
  NEEDS_REVIEW: { label: "Needs review", tone: "warn" },
  NO_INPUT_VAT: { label: "No input VAT", tone: "info" },
};
export function SeverityPill({ severity }: { severity: Severity }) {
  return <Pill tone={SEVERITY[severity].tone}>{SEVERITY[severity].label}</Pill>;
}

/** The in-progress state a receipt shows while the laptop works on it. */
export function WorkingPill({ label = "Checking BIR rules" }: { label?: string }) {
  return (
    <Pill tone="accent">
      <CircleNotchIcon aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
      {label}
    </Pill>
  );
}

const pesoFormat = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function peso(value: number) {
  return `₱${pesoFormat.format(value)}`;
}

/** The peso sign in running text. The text face (Hanken Grotesk) has no ₱, so it borrows Geist Mono's. */
export function Peso() {
  return <span className="font-mono font-medium">₱</span>;
}

/** A peso amount, with figures that line up in columns. */
export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cx("num font-mono tracking-tight", className)}>{peso(value)}</span>;
}

/** The window an app view sits in: a quiet title bar over the app's own surface. */
export function AppWindow({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-hidden rounded-xl border border-line bg-surface shadow-pop", className)}>
      <div className="flex items-center gap-3 border-b border-line bg-sunken px-3.5 py-2.5">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
        </span>
        <span className="truncate text-xs font-medium text-muted">{title}</span>
      </div>
      {children}
    </div>
  );
}

/** Says, once per view, that the figures are made up. */
export function SampleNote({ children = "Sample data: Bayanihan Demo Corp is a fictional Company." }: { children?: ReactNode }) {
  return <p className="text-xs text-muted">{children}</p>;
}

/** The demo Liquidation the page follows from hero to export, so every figure agrees. */
export const DEMO = {
  liquidation: "Store visits, April",
  employee: "Juan",
  cashAdvance: 3000,
  validSpend: 2515.95,
  disallowed: 284,
  amountToReturn: 484.05,
  receipts: [
    { seller: "Juana's Office Supplies Inc.", doc: "Sales Invoice", amount: 666, status: "ACCEPTED" },
    { seller: "BF Sinangag Express Food Corp", doc: "Sales Invoice", amount: 355, status: "ACCEPTED" },
    { seller: "Primera Clase Gas Station Inc", doc: "Sales Invoice", amount: 282.95, status: "ACCEPTED" },
    { seller: "Mouthfeel Company", doc: "Non-VAT seller", amount: 260, status: "NO_INPUT_VAT" },
    { seller: "PerPet Pilipinas Corp", doc: "Duplicate of a receipt in March", amount: 284, status: "REJECT" },
    { seller: "Goldilocks Bakeshop", doc: "VAT doesn't add up", amount: 952, status: "NEEDS_REVIEW" },
  ] satisfies { seller: string; doc: string; amount: number; status: Status }[],
};
