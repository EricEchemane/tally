import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

// The Reviewer's dashboard. The phone capture page (/capture) sits outside this shell.
// Suspense: the pages read their ?id= with useSearchParams, which needs a boundary in a static export.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="h-[53px] border-b border-line bg-surface" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
