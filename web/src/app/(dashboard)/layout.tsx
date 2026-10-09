import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

// The Reviewer's dashboard. The phone capture page (/capture) sits outside this shell.
// Suspense: with Cache Components, client components that read the current time (react-query does)
// must sit behind a boundary so Next.js defers them instead of failing the prerender.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="h-[53px] border-b border-line bg-surface" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
