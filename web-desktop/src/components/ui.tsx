"use client";
// Tally design system primitives. Tokens live in globals.css.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { peso } from "@/lib/api";
import { LIQUIDATION_STATUS, RECEIPT_STATUS, SEVERITY, STAGE } from "@/lib/labels";
import type { LiquidationStatus, ReceiptStatus, Severity, Stage } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ---------- buttons ----------

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover border-transparent",
  secondary: "bg-surface text-ink border-line-strong hover:bg-sunken",
  ghost: "bg-transparent text-muted border-transparent hover:bg-sunken hover:text-ink",
  danger: "bg-surface text-bad border-line-strong hover:bg-bad-soft",
};
const SIZES = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm" };

export function Button({
  variant = "secondary", size = "md", busy, className, children, disabled, ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof SIZES; busy?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md border font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant], SIZES[size], className,
      )}
      {...rest}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "secondary", size = "md", className, ...rest
}: ComponentProps<"a"> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return (
    <a
      className={cx("inline-flex items-center justify-center gap-2 rounded-md border font-medium transition-colors",
        VARIANTS[variant], SIZES[size], className)}
      {...rest}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent", className)}
    />
  );
}

// ---------- surfaces ----------

export function Card({ className, ...rest }: ComponentProps<"section">) {
  return <section className={cx("rounded-lg border border-line bg-surface shadow-card", className)} {...rest} />;
}

export function CardHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cx("rounded-md border px-3 py-2 text-sm", TONES[tone], className)}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-muted">{children}</p>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("pulse rounded-md bg-sunken", className)} />;
}

// ---------- pills ----------

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
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", TONES[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<ReceiptStatus, Tone> = { ACCEPTED: "ok", NO_INPUT_VAT: "info", NEEDS_REVIEW: "warn", REJECT: "bad" };
const STATUS_ICON: Record<ReceiptStatus, string> = { ACCEPTED: "✅", NO_INPUT_VAT: "◐", NEEDS_REVIEW: "⚠️", REJECT: "✕" };

/** Receipt Status. A receipt still processing, or with checks pending, never shows as a pass. */
export function ReceiptStatusPill({ status, stage, checksPending }: { status: ReceiptStatus | null; stage: Stage; checksPending?: boolean }) {
  if (stage === "failed") return <Pill tone="bad">Couldn’t read</Pill>;
  if (stage !== "done") return <Pill tone="accent"><Spinner className="size-3" />{STAGE[stage]}</Pill>;
  if (checksPending || !status) return <Pill tone="neutral"><Spinner className="size-3" />Checking</Pill>;
  return <Pill tone={STATUS_TONE[status]}><span aria-hidden>{STATUS_ICON[status]}</span>{RECEIPT_STATUS[status]}</Pill>;
}

const SEVERITY_TONE: Record<Severity, Tone> = { REJECT: "bad", NEEDS_REVIEW: "warn", NO_INPUT_VAT: "info" };
export function SeverityPill({ severity }: { severity: Severity }) {
  return <Pill tone={SEVERITY_TONE[severity]}>{SEVERITY[severity]}</Pill>;
}

const LIQ_TONE: Record<LiquidationStatus, Tone> = { OPEN: "accent", APPROVED: "ok", RETURNED: "warn" };
export function LiquidationStatusPill({ status }: { status: LiquidationStatus }) {
  return <Pill tone={LIQ_TONE[status]}>{LIQUIDATION_STATUS[status]}</Pill>;
}

// ---------- figures ----------

/** A peso amount from the API. Display only. */
export function Money({ value, className }: { value: number | null | undefined; className?: string }) {
  return <span className={cx("num", value == null && "text-faint", className)}>{peso(value)}</span>;
}

export function Stat({ label, value, tone, hint }: { label: string; value: number | null | undefined; tone?: "bad" | "ok" | "warn"; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3 shadow-card">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className={cx("mt-1 text-xl font-semibold", tone === "bad" && "text-bad", tone === "ok" && "text-ok", tone === "warn" && "text-warn")}>
        <Money value={value} />
      </dd>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

// ---------- forms ----------

export const inputClass =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export function Label({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      {items.map((it, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1.5 text-faint">/</span>}
          {it.href ? <Link href={it.href} className="hover:text-ink hover:underline">{it.label}</Link> : <span className="text-ink">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}
