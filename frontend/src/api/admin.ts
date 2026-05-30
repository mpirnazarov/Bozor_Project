import { apiClient } from "./client";
import type { Dashboard, ServicesBreakdown } from "@/types/api";

export interface DashboardUpdate {
  total: number;
  paid: number;
  services: ServicesBreakdown;
  period?: { year: number; month: number };
}

export async function updateDashboard(payload: DashboardUpdate): Promise<Dashboard> {
  const { data } = await apiClient.put<Dashboard>("/admin/dashboard", payload);
  return data;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
}

export async function getAuditLog(limit = 50): Promise<AuditLog[]> {
  const { data } = await apiClient.get<AuditLog[]>("/admin/audit-log", {
    params: { limit },
  });
  return data;
}

export interface ImportResult {
  rows_read: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function importExcel(
  file: File,
  year = 2026,
  month = 5,
): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<ImportResult>("/admin/import/excel", form, {
    params: { year, month },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
