"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { LiveProvider } from "@/lib/live";

export function Providers({ children }: { children: React.ReactNode }) {
  // networkMode "always": the backend runs on this computer, so requests must not pause while the
  // browser reports no internet (React Query's default holds every query and mutation until it's back).
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 5_000, retry: 1, networkMode: "always" }, mutations: { networkMode: "always" } },
  }));
  return (
    <QueryClientProvider client={client}>
      <LiveProvider>{children}</LiveProvider>
    </QueryClientProvider>
  );
}
