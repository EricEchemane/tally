"use client";
// One hook per REST resource. Query keys match the invalidation table in live.tsx (SPEC §7).
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { CashAdvance, Company, Employee, Health, Liquidation, LiquidationStatus, Receipt } from "./types";

export const useCompany = () => useQuery({ queryKey: ["company"], queryFn: () => api.get<Company>("/api/company") });

export const useHealth = () =>
  useQuery({ queryKey: ["health"], queryFn: () => api.get<Health>("/api/health"), refetchInterval: 10_000 });

export const useEmployees = () => useQuery({ queryKey: ["employees"], queryFn: () => api.get<Employee[]>("/api/employees") });

export const useCashAdvances = (status?: LiquidationStatus) =>
  useQuery({
    queryKey: ["cash-advances", status ?? "ALL"],
    queryFn: () => api.get<CashAdvance[]>(`/api/cash-advances${status ? `?status=${status}` : ""}`),
  });

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
