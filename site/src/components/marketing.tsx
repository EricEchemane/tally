import { ImageIcon } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import type { ReactNode } from "react";
import { cx } from "./product";

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5 text-xl font-bold tracking-[-0.03em]">
      {/* The Tally mark (public/logo.png): a rounded square, so it needs no frame of its own. */}
      <Image src="/logo.png" alt="" width={72} height={72} priority className="size-9 shrink-0 rounded-[0.6rem] shadow-[0_1px_3px_rgb(15_43_38/0.25)]" />
      Tally
    </span>
  );
}

/** Renders text, keeping hyphenated terms like "Wi-Fi" on one line (browsers otherwise break at the hyphen). */
export function KeepTogether({ text }: { text: string }) {
  return text.split(/(Wi-Fi)/).map((part, i) =>
    part === "Wi-Fi" ? (
      <span key={i} className="whitespace-nowrap">
        Wi-Fi
      </span>
    ) : (
      part
    ),
  );
}

/**
 * Every section's frame. Sections alternate between two tones so the page has a steady rhythm: "plain" sits on the
 * page colour; "panel" is the rounded green block (mint in light mode, deep green in dark), as in the Privacy section.
 */
export function SectionShell({
  tone,
  id,
  labelledBy,
  children,
}: {
  tone: "plain" | "panel";
  id?: string;
  labelledBy: string;
  children: ReactNode;
}) {
  const inner = <div className="mx-auto max-w-6xl px-5 py-24 lg:py-32">{children}</div>;
  return (
    <section id={id} aria-labelledby={labelledBy} className={tone === "panel" ? "px-3" : undefined}>
      {tone === "panel" ? <div className="rounded-[2rem] bg-mint">{inner}</div> : inner}
    </section>
  );
}

/** Every section's header, identical everywhere: label, heading, optional intro, then the content below it. */
export function SectionHeader({
  id,
  label,
  title,
  intro,
}: {
  id: string;
  label: string;
  title: ReactNode;
  intro?: ReactNode;
}) {
  return (
    <header className="mb-14 max-w-3xl lg:mb-16">
      <Label>{label}</Label>
      <h2 id={id} className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem] sm:leading-[1.08]">
        {title}
      </h2>
      {intro && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{intro}</p>}
    </header>
  );
}

/** The small rounded label above a section heading, as in the reference kit. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-lime px-3 py-1 text-xs font-semibold text-lime-ink">
      {children}
    </span>
  );
}

/**
 * A photo the page still needs. It shows what belongs here and where to save the file, so nobody ships it by
 * accident. The prompts for every slot are listed in public/images/README.md.
 */
export function ImageSlot({ file, what, className }: { file: string; what: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={`Placeholder: ${what}`}
      className={cx(
        "flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line-strong bg-sunken p-6 text-center",
        className,
      )}
    >
      <ImageIcon aria-hidden className="size-8 text-faint" />
      <p className="max-w-[18rem] text-sm font-medium text-muted">{what}</p>
      <code className="text-xs text-faint">public/images/{file}</code>
    </div>
  );
}
