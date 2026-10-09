import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

// The Reviewer's dashboard. The phone capture page (/capture) sits outside this shell.
// Suspense: the pages read their ?id= with useSearchParams, which needs a boundary in a static export.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="px-3 pt-3"><div className="mx-auto h-[54px] max-w-6xl rounded-full border border-line bg-surface" /></div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
