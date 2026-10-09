"use client";
// One hook per REST resource. Query keys match the invalidation table in live.tsx (SPEC §7).
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { CashAdvance, Company, Employee, Health, Liquidation, LiquidationStatus, Overview, OverviewPeriod, Question, Receipt } from "./types";

export const useCompany = () => useQuery({ queryKey: ["company"], queryFn: () => api.get<Company>("/api/company") });

export const useHealth = () =>
  useQuery({ queryKey: ["health"], queryFn: () => api.get<Health>("/api/health"), refetchInterval: 10_000 });

export const useEmployees = () => useQuery({ queryKey: ["employees"], queryFn: () => api.get<Employee[]>("/api/employees") });

export const useCashAdvances = (status?: LiquidationStatus, archived = false) =>
  useQuery({
    queryKey: ["cash-advances", status ?? "ALL", archived ? "archived" : "working"],
    queryFn: () => {
      const q = new URLSearchParams();
      if (status) q.set("status", status);
      if (archived) q.set("archived", "true");
      return api.get<CashAdvance[]>(`/api/cash-advances${q.size ? `?${q}` : ""}`);
    },
    placeholderData: keepPreviousData, // switching filters keeps the rows on screen instead of flashing a skeleton
  });

export const useOverview = (period: OverviewPeriod) =>
  useQuery({ queryKey: ["overview", period], queryFn: () => api.get<Overview>(`/api/overview?period=${period}`),
    placeholderData: keepPreviousData });

export const useLiquidation = (id: number) =>
  useQuery({ queryKey: ["liquidation", id], queryFn: () => api.get<Liquidation>(`/api/liquidations/${id}`), enabled: id > 0 });

export const useReceipt = (id: number) =>
  useQuery({ queryKey: ["receipt", id], queryFn: () => api.get<Receipt>(`/api/receipts/${id}`) });

export const useCaptureLink = (id: number) =>
  useQuery({
    queryKey: ["capture-link", id],
    queryFn: () => api.get<{ url: string; qr_svg: string }>(`/api/liquidations/${id}/capture-link`),
    staleTime: Infinity,
  });

export const useQuestions = () => useQuery({ queryKey: ["questions"], queryFn: () => api.get<Question[]>("/api/questions") });
