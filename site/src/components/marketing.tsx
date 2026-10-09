import { ImageIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { cx } from "./product";

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5 text-xl font-bold tracking-[-0.03em]">
      <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-lime text-base font-extrabold text-lime-ink">
        T
      </span>
      Tally
    </span>
  );
}

/** The small rounded label above a section heading, as in the reference kit. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-lime/50 px-3 dark:bg-lime py-1 text-xs font-semibold text-lime-ink">
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
