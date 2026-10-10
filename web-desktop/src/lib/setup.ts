// First-run setup (desktop only): the backend's /api/setup routes (api/desktop_setup.py).
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import type { BuyerDetailsRule } from "./types";

export type JobState = "idle" | "running" | "done" | "failed";

export interface SetupStatus {
  complete: boolean;
  version: string;
  data_dir: string;
  machine: {
    ram_gb: number; ram_ok: boolean; free_gb: number; free_needed_gb: number; disk_ok: boolean; os: string;
    macos: number | null; macos_ok: boolean; windows_build: number | null; windows_ok: boolean;
  };
  company: { name: string; tin: string; buyer_details_rule: BuyerDetailsRule };
  company_ok: boolean;
  ollama: { state: "running" | "stopped" | "missing" | "outdated"; version: string | null; path: string | null; homebrew: boolean };
  model: { name: string; present: boolean };
  install: { state: JobState; step?: string; done?: number; total?: number; error?: string | null };
  pull: { state: JobState; status?: string; done?: number; total?: number; error?: string | null };
}

/** null when the backend has no setup routes (the web dev server): nothing to set up. */
export const useSetupStatus = (fast = false) =>
  useQuery({
    queryKey: ["setup"],
    queryFn: () => api.get<SetupStatus>("/api/setup/status").catch((e) => {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }),
    refetchInterval: (q) => {
      const d = q.state.data;
      return fast || d?.install.state === "running" || d?.pull.state === "running" ? 2000 : 5000; // the bar eases between checks
    },
  });
