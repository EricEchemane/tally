import Link from "next/link";
import { EARLY_ACCESS_HREF, SAMPLE_REVIEW_HREF } from "@/lib/links";

const base =
  "inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition-colors";

export function PrimaryCta({ className = "" }: { className?: string }) {
  return (
    <Link href={EARLY_ACCESS_HREF} className={`${base} bg-accent text-accent-ink hover:bg-accent-hover ${className}`}>
      Request early access
    </Link>
  );
}

export function SecondaryCta({ className = "" }: { className?: string }) {
  return (
    <Link
      href={SAMPLE_REVIEW_HREF}
      className={`${base} border border-line-strong bg-surface text-ink hover:border-accent hover:text-accent ${className}`}
    >
      See it check a receipt
    </Link>
  );
}
