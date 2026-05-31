import { apiClient } from "./client";
import type { Dashboard, Pavilion, ServicesBreakdown } from "@/types/api";

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

// === Pavilion (xarita region) boshqaruvi ===

export interface PavilionInput {
  display_name: string;
  display_text?: string | null;
  pavilion_type?: string | null;
  polygon_points: string;
  fill_color?: string;
  fill_opacity?: number;
  stroke_color?: string;
  stroke_width?: number;
  label_x?: number | null;
  label_y?: number | null;
  label_rotation?: number;
  is_active?: boolean;
  display_order?: number;
  meta?: Record<string, unknown>;
}

export async function createPavilion(payload: PavilionInput): Promise<Pavilion> {
  const { data } = await apiClient.post<Pavilion>("/admin/pavilions", payload);
  return data;
}

export async function updatePavilion(
  id: number,
  payload: Partial<PavilionInput>,
): Promise<Pavilion> {
  const { data } = await apiClient.put<Pavilion>(`/admin/pavilions/${id}`, payload);
  return data;
}

export async function deletePavilion(id: number): Promise<void> {
  await apiClient.delete(`/admin/pavilions/${id}`);
}

// === Magazinlar importi (CSV / Google Sheets) ===
export interface ShopImportResult {
  rows_read: number;
  inserted: number;
  updated: number;
  linked: number;
  counterparties_created: number;
  not_found: { row?: number; shop_id?: string; reason: string; name?: string; raw?: string }[];
  not_found_count: number;
  errors: string[];
}

export async function importShopsCsv(file: File): Promise<ShopImportResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<ShopImportResult>("/admin/import/shops/csv", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function importShopsGsheet(url: string): Promise<ShopImportResult> {
  const { data } = await apiClient.post<ShopImportResult>("/admin/import/shops/gsheet", { url });
  return data;
}

// === Mavzu (theme) ===
export async function getTheme(): Promise<"light" | "dark"> {
  const { data } = await apiClient.get<{ theme: "light" | "dark" }>("/settings/theme");
  return data.theme;
}

export async function setTheme(theme: "light" | "dark"): Promise<"light" | "dark"> {
  const { data } = await apiClient.put<{ theme: "light" | "dark" }>("/admin/theme", { theme });
  return data.theme;
}
