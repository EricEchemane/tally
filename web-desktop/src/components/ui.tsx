"use client";
// Tally design system primitives. Tokens live in globals.css.
// Shape: controls (buttons, inputs, tabs, chips, pills) are fully rounded; panels are rounded-3xl;
// anything inside a panel is rounded-2xl. Spacing sits on an 8 px grid: panels pad 24 px (p-6),
// sections stack 32 px apart (space-y-8), grids gap 16–24 px.
// Type: page title 24 px > key figures 24 px > panel title 16 px > body 14 px > labels 12 px.
import Link from "next/link";
import { type ComponentProps, type ReactNode, useRef } from "react";
import { useChangeCount, useDirection, useIndicator } from "@/lib/motion";
import { peso } from "@/lib/api";
import { LIQUIDATION_STATUS, RECEIPT_STATUS, SEVERITY, STAGE } from "@/lib/labels";
import type { LiquidationStatus, ReceiptStatus, Severity, Stage } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ---------- layout ----------

/** The page column. The top bar, the setup banner, the page and the footer all use it, so their edges
 *  line up: full width with 24 px gutters, capped at 1440 px of content on very wide screens (DESIGN.md). */
export const PAGE = "mx-auto w-full max-w-[90rem] px-6";

// ---------- buttons ----------

type Variant = "primary" | "secondary" | "ghost" | "danger";
// Press: a quick shrink. Hover: filled buttons lift 1 px with a soft shadow.
const MOTION = "transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] " +
  "disabled:active:scale-100";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover border-transparent hover:-translate-y-px disabled:hover:translate-y-0",
  secondary: "bg-surface text-ink border-line-strong hover:bg-sunken hover:-translate-y-px disabled:hover:translate-y-0",
  ghost: "bg-transparent text-muted border-transparent hover:bg-sunken hover:text-ink",
  danger: "bg-surface text-bad border-bad/45 hover:bg-bad-soft hover:border-bad/70",
};
const SIZES = { sm: "h-8 px-3.5 text-sm", md: "h-10 px-5 text-sm" };

export function Button({
  variant = "secondary", size = "md", busy, className, children, disabled, ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof SIZES; busy?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border font-medium", MOTION,
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
      className={cx("inline-flex shrink-0 items-center justify-center gap-2 rounded-full border font-medium", MOTION,
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
  return <section className={cx("overflow-hidden rounded-3xl border border-line bg-surface", className)} {...rest} />;
}

export function CardHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** The top of every dashboard page: breadcrumbs, title (+ status), one line of context, actions. */
export function PageHeader({ crumbs, title, badge, sub, actions }: {
  crumbs?: { label: string; href?: string }[]; title: ReactNode; badge?: ReactNode; sub?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="h-5">{crumbs && <Crumbs items={crumbs} />}</div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">{title}{badge}</h1>
          {sub && <div className="text-sm text-muted">{sub}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Card content at the card's one inset: text lines up with the card title, 24 px in. */
export function CardBody({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cx("px-6 py-4", className)} {...rest} />;
}

/** A list of rows inside a card. The list insets 8 px (so hover highlights don't touch the card edge) and
 *  each row adds 16 px, putting row text at the same 24 px as the card title. Use with ROW. */
export function CardList({ className, ...rest }: ComponentProps<"ul">) {
  return <ul className={cx("space-y-1 p-2", className)} {...rest} />;
}
export const ROW = "rounded-2xl px-4 py-3";

export function Notice({ tone = "info", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cx("rounded-2xl border px-4 py-3 text-sm", TONES[tone], className)}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-6 py-12 text-center text-sm text-muted">{children}</p>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("shimmer rounded-2xl", className)} />;
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
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", TONES[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<ReceiptStatus, Tone> = { ACCEPTED: "ok", NO_INPUT_VAT: "info", NEEDS_REVIEW: "warn", REJECT: "bad" };
// SVG, not emoji: emoji render differently per OS and fight the pill colours.
const ICON_PATHS: Record<ReceiptStatus, string> = {
  ACCEPTED: "M3.5 8.5l3 3 6-7",
  NO_INPUT_VAT: "M8 3a5 5 0 1 0 0 10V3z",
  NEEDS_REVIEW: "M8 4.5v4.5M8 11.5v.01",
  REJECT: "M4.5 4.5l7 7M11.5 4.5l-7 7",
};
export function StatusIcon({ status, className }: { status: ReceiptStatus; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cx("size-3.5 shrink-0", className)} fill={status === "NO_INPUT_VAT" ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[status]} />
    </svg>
  );
}

/** Receipt Status. A receipt still processing, or with checks pending, never shows as a pass. */
export function ReceiptStatusPill({ status, stage, checksPending }: { status: ReceiptStatus | null; stage: Stage; checksPending?: boolean }) {
  if (stage === "failed") return <Pill tone="bad">Couldn’t read</Pill>;
  if (stage !== "done") return <Pill tone="accent"><Spinner className="size-3" />{STAGE[stage]}</Pill>;
  if (checksPending || !status) return <Pill tone="neutral"><Spinner className="size-3" />Checking</Pill>;
  return <LandedStatus status={status} />;
}

/** The verdict pops once when it lands or changes, not when a page first shows it. */
function LandedStatus({ status }: { status: ReceiptStatus }) {
  const changes = useChangeCount(status);
  return (
    <span key={changes} className={cx("inline-flex", changes > 0 && "pop")}>
      <Pill tone={STATUS_TONE[status]}><StatusIcon status={status} />{RECEIPT_STATUS[status]}</Pill>
    </span>
  );
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

/** A key figure. When it changes it flashes once: green if the change is good news, red if bad
 *  (`better` says which direction is good), neutral if neither. The number itself never animates. */
export function Stat({ label, value, tone, hint, better }: {
  label: string; value: number | null | undefined; tone?: "bad" | "ok" | "warn"; hint?: string; better?: "up" | "down";
}) {
  const dir = useDirection(value);
  const flash = !dir ? undefined : !better ? "flash" : dir === better ? "flash-up" : "flash-down";
  return (
    <div key={flash ? `${value}` : "still"} className={cx("rounded-3xl border border-line bg-surface px-5 py-4", flash)}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className={cx("mt-2 text-2xl font-semibold tracking-tight", tone === "bad" && "text-bad", tone === "ok" && "text-ok", tone === "warn" && "text-warn")}>
        <Money value={value} />
      </dd>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

// ---------- forms ----------

export const inputClass =
  "h-10 w-full rounded-full border border-line-strong bg-surface px-4 text-sm text-ink placeholder:text-faint " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export const selectClass = inputClass + " appearance-none pr-10 select-chevron";

/** Multi-line fields can't be pills: same look, panel-inner radius. */
export const textareaClass = inputClass.replace("h-10 ", "").replace("rounded-full", "rounded-2xl") + " min-h-20 py-2.5";

export function Label({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-2">
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

/** Segmented control / tabs with a highlight that slides to the chosen option. */
export function Segmented<T extends string | undefined>({ options, value, onChange, label, role = "radiogroup", size = "md", disabled }: {
  options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string;
  role?: "radiogroup" | "tablist"; size?: "sm" | "md"; disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const box = useIndicator(ref, value);
  const item = role === "tablist" ? "tab" : "radio";
  return (
    <div ref={ref} role={role} aria-label={label} className="relative inline-flex w-fit max-w-full flex-wrap rounded-full border border-line bg-sunken p-0.5">
      {box && (
        <span aria-hidden className="absolute rounded-full border border-line-strong/70 bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.08)] transition-all duration-200 ease-out"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }} />
      )}
      {options.map((o) => (
        <button key={String(o.value ?? "all")} type="button" role={item} data-active={value === o.value}
          aria-checked={item === "radio" ? value === o.value : undefined} aria-selected={item === "tab" ? value === o.value : undefined}
          disabled={disabled} onClick={() => value !== o.value && onChange(o.value)}
          className={cx("relative rounded-full transition-colors duration-150", size === "sm" ? "px-3 py-1 text-xs font-medium" : "px-3.5 py-1.5 text-sm",
            value === o.value ? "font-semibold text-ink" : "text-muted hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M11 1.5l2.4 6.6 6.6 2.4-6.6 2.4L11 19.5l-2.4-6.6L2 10.5l6.6-2.4z" />
      <path d="M19 14.5l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9-2.9-1.1 2.9-1.1z" opacity=".8" />
    </svg>
  );
}
