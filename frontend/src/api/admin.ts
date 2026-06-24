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
  action_label: string;
  resource_label: string;
  user_label: string;
  user_role: string | null;
  summary: string;
  snapshot_id: number | null;
  revertable: boolean;
  reverted: boolean;
  import_log_id: number | null;
  import_failed: boolean;
  error_count: number;
}

export async function getAuditLog(limit = 50): Promise<AuditLog[]> {
  const { data } = await apiClient.get<AuditLog[]>("/admin/audit-log", {
    params: { limit },
  });
  return data;
}

export interface BillingImportResult {
  ok: boolean;
  rows_read: number;
  counterparties: number;
  records: number;
  skipped: number;
  errors: string[];
  snapshot_id: number | null;
  log_id: number | null;
}

export async function importBilling(
  file: File,
  year: number,
  month: number,
): Promise<BillingImportResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<BillingImportResult>("/admin/import/billing", form, {
    params: { year, month },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function revertAction(snapshotId: number): Promise<{ ok: boolean; message: string }> {
  const { data } = await apiClient.post<{ ok: boolean; message: string }>(
    `/admin/revert/${snapshotId}`,
  );
  return data;
}

export function importLogFileUrl(logId: number): string {
  return `${apiClient.defaults.baseURL}/admin/import/logs/${logId}/file`;
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
  year = new Date().getFullYear(),
  month = new Date().getMonth() + 1,
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

// === Topilmagan magazinlarni berkitish ===
export async function getHideUnmatched(): Promise<boolean> {
  const { data } = await apiClient.get<{ hidden: boolean }>("/settings/hide-unmatched");
  return data.hidden;
}

export async function setHideUnmatched(hidden: boolean): Promise<boolean> {
  const { data } = await apiClient.put<{ hidden: boolean }>("/admin/hide-unmatched", { hidden });
  return data.hidden;
}

// === Billing summary (oy/yil bo'yicha bloklar/layoutlar hisoboti) ===
export interface BillingSummaryBlock {
  pavilion_id: number;
  name: string;
  layer_id: number | null;
  layer_name: string | null;
  prefix: string;
  shop_count: number;
  total_due: number;
  total_paid: number;
  total_debt: number;
}
export interface BillingSummaryLayer {
  layer_id: number | null;
  name: string;
  block_count: number;
  shop_count: number;
  total_due: number;
  total_paid: number;
  total_debt: number;
}
export interface BillingSummary {
  year: number;
  month: number;
  has_data: boolean;
  total: {
    total_due: number;
    total_paid: number;
    total_debt: number;
    shop_count: number;
    block_count: number;
  };
  layers: BillingSummaryLayer[];
  blocks: BillingSummaryBlock[];
}

export async function getBillingSummary(year: number, month: number): Promise<BillingSummary> {
  const { data } = await apiClient.get<BillingSummary>("/admin/billing-summary", {
    params: { year, month },
  });
  return data;
}

// === Magazin egalari/ro'yxatini Excel'dan yangilash (rollback bilan) ===
export interface ShopOwnerImportResult {
  ok: boolean;
  rows_read: number;
  updated: number;
  inserted: number;
  counterparties_updated: number;
  counterparties_created: number;
  errors: string[];
  skipped: { row: number; shop_id: string; reason: string }[];
  skipped_count: number;
  detected_columns: Record<string, number>;
  snapshot_id: number | null;
}

export async function importShopOwners(file: File): Promise<ShopOwnerImportResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<ShopOwnerImportResult>(
    "/admin/import/shop-owners", form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

// === Sana bo'yicha arenda billing import ===
export interface RentBillingImportResult {
  ok: boolean;
  rows_read: number;
  upserted: number;
  with_debt: number;
  no_debt: number;
  bill_date: string;
  errors: string[];
  skipped: { row: number; shop_id: string; reason: string }[];
  skipped_count: number;
  detected_columns: Record<string, number>;
  snapshot_id: number | null;
}

export async function importRentBilling(file: File, billDate: string): Promise<RentBillingImportResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<RentBillingImportResult>(
    "/admin/import/rent-billing", form,
    { params: { bill_date: billDate }, headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

// === Usul 2: INN bo'yicha to'lov import ===
export interface InnPaymentImportResult {
  ok: boolean;
  rows_read: number;
  payments_total: number;
  inns_matched: number;
  inns_unmatched: number;
  shops_updated: number;
  bill_date: string;
  errors: string[];
  skipped: { row: number; shop_id: string; reason: string }[];
  skipped_count: number;
  detected_columns: Record<string, number>;
  snapshot_id: number | null;
}

export async function importInnPayments(file: File, billDate: string): Promise<InnPaymentImportResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<InnPaymentImportResult>(
    "/admin/import/inn-payments", form,
    { params: { bill_date: billDate }, headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

// === Elektr to'lovlari import ===
export interface ElectricityImportResult {
  ok: boolean;
  rows_read: number;
  inns: number;
  with_debt: number;
  with_prepaid: number;
  total_debt: number;
  total_prepaid: number;
  year: number;
  month: number;
  errors: string[];
  skipped: { row: number; shop_id: string; reason: string }[];
  skipped_count: number;
  detected_columns: Record<string, number>;
  snapshot_id: number | null;
}

export async function importElectricity(file: File, year: number, month: number): Promise<ElectricityImportResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<ElectricityImportResult>(
    "/admin/import/electricity", form,
    { params: { year, month }, headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

// === INN va dogovor import ===
export interface WaterImportResult {
  ok: boolean;
  rows_read: number;
  inns: number;
  with_debt: number;
  with_prepaid: number;
  total_debt: number;
  total_prepaid: number;
  year: number;
  month: number;
  errors: string[];
  skipped: { row: number; shop_id: string; reason: string }[];
  skipped_count: number;
  detected_columns: Record<string, number>;
  snapshot_id: number | null;
}

export async function importWater(file: File, year: number, month: number): Promise<WaterImportResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<WaterImportResult>(
    "/admin/import/water", form,
    { params: { year, month }, headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export interface InnContractImportResult {
  ok: boolean;
  rows_read: number;
  shops_updated: number;
  shops_created: number;
  counterparties_created: number;
  counterparties_updated: number;
  skipped: number;
  not_found: string[];
  errors: string[];
}

export async function importInnContract(file: File): Promise<InnContractImportResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<InnContractImportResult>(
    "/admin/import/inn-contract",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}
