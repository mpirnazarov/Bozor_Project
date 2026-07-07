import { apiClient } from "./client";

export type MarketAttention = "ok" | "yellow" | "red" | "blocked" | "free";

export interface SupportStatus {
  free_period: boolean;
  free_until: string;
  monthly_fee: number;
  paid_this_month: boolean;
  needs_warning: boolean;
  pending: boolean;
  support_blocked: boolean;
  due_day: number;
  attention: MarketAttention;
}

export interface OwnerMarket {
  id: number;
  slug: string;
  name: string;
  is_active: boolean;
  support_blocked: boolean;
  created_at: string;
  shop_count: number;
  admin_username: string | null;
  support: SupportStatus;
}

export interface NewMarketResult {
  id: number;
  slug: string;
  name: string;
  credentials: { username: string; password: string };
}

export interface SupportPaymentRow {
  year: number;
  month: number;
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
  notes: string | null;
}

export async function ownerListMarkets(): Promise<OwnerMarket[]> {
  const { data } = await apiClient.get<OwnerMarket[]>("/owner/markets");
  return data;
}

export interface MarketContractInput {
  contract_no?: string | null;
  contract_data?: string | null;
  contract_name?: string | null;
  contract_mime?: string | null;
}

export async function ownerCreateMarket(
  name: string, slug?: string, contract?: MarketContractInput,
): Promise<NewMarketResult> {
  const { data } = await apiClient.post<NewMarketResult>("/owner/markets", { name, slug, ...(contract || {}) });
  return data;
}

export async function ownerUpdateMarket(
  id: number,
  payload: { name?: string; is_active?: boolean },
): Promise<void> {
  await apiClient.put(`/owner/markets/${id}`, payload);
}

export async function ownerDeleteMarket(id: number): Promise<void> {
  await apiClient.delete(`/owner/markets/${id}`);
}

export async function ownerChangePassword(id: number, newPassword: string): Promise<{ username: string }> {
  const { data } = await apiClient.put<{ username: string }>(`/owner/markets/${id}/password`, {
    new_password: newPassword,
  });
  return data;
}

export async function ownerMarkPayment(
  id: number, year: number, month: number, isPaid: boolean, notes?: string,
): Promise<void> {
  await apiClient.post(`/owner/markets/${id}/support/payment`, {
    year, month, is_paid: isPaid, notes,
  });
}

export async function ownerListPayments(id: number): Promise<SupportPaymentRow[]> {
  const { data } = await apiClient.get<SupportPaymentRow[]>(`/owner/markets/${id}/support/payments`);
  return data;
}

export async function ownerBlockMarket(id: number, blocked: boolean): Promise<void> {
  await apiClient.post(`/owner/markets/${id}/support/block`, { blocked });
}

// Bozor uchun (public): joriy bozorning tex-podderjka holati
export async function getMarketSupportStatus(): Promise<SupportStatus> {
  const { data } = await apiClient.get<SupportStatus>("/settings/support-status");
  return data;
}

// === Railway server holati (CPU/RAM + deploymentlar) ===
export interface RailwayDeployment {
  id: string;
  status: string;
  created_at: string | null;
  updated_at?: string | null;
  url: string | null;
  can_redeploy?: boolean | null;
  commit_message?: string | null;
  commit_sha?: string | null;
  branch?: string | null;
}

export interface RailwayService {
  name?: string | null;
  created_at?: string | null;
  region?: string | null;
  replicas?: number | null;
  builder?: string | null;
  cpu_limit?: number | null;
  ram_limit_gb?: number | null;
}

export interface RailwayMetricPoint { ts?: number | string; v: number; }

export interface RailwayDomain { domain: string; type: string; status: string; }

export interface RailwayOverview {
  configured: boolean;
  metrics?: {
    cpu_vcpu_latest?: number;
    cpu_vcpu_avg?: number;
    ram_gb_latest?: number;
    ram_gb_avg?: number;
    cpu_series?: RailwayMetricPoint[];
    ram_series?: RailwayMetricPoint[];
    network_gb_total?: number;
    network_gb_latest?: number;
    disk_gb_latest?: number;
  };
  metrics_error?: string;
  deployments?: RailwayDeployment[];
  deployments_error?: string;
  service?: RailwayService;
  service_error?: string;
  limits?: { cpu_vcpu: number; ram_gb: number; source: string; plan: string };
  usage_pct?: { cpu?: number; ram?: number };
  usage?: { month_cost_usd?: number; error?: string };
  domains?: RailwayDomain[];
  env_count?: number;
  project?: { name?: string | null; services?: { id: string; name: string }[] };
}

export async function getOwnerRailway(): Promise<RailwayOverview> {
  const { data } = await apiClient.get<RailwayOverview>("/owner/railway");
  return data;
}

// === Backup ===
export interface BackupLog {
  id: number;
  filename: string;
  trigger: string;       // auto | manual
  category: string;      // daily | weekly | monthly | manual
  status: string;        // success | failed | running
  size_bytes: number;
  size_mb: number;
  duration_ms: number;
  error: string | null;
  s3_uploaded: boolean;
  s3_error: string | null;
  created_at: string;
}

export interface BackupList {
  available: boolean;
  s3_enabled: boolean;
  backups: BackupLog[];
}

export async function getBackups(): Promise<BackupList> {
  const { data } = await apiClient.get<BackupList>("/owner/backups");
  return data;
}

export async function createBackup(): Promise<BackupLog> {
  const { data } = await apiClient.post<BackupLog>("/owner/backups");
  return data;
}

export function backupDownloadUrl(id: number): string {
  return `${apiClient.defaults.baseURL}/owner/backups/${id}/download`;
}

export async function restoreBackup(id: number, password: string): Promise<{ ok: boolean; message: string }> {
  const { data } = await apiClient.post<{ ok: boolean; message: string }>(
    `/owner/backups/${id}/restore`, { password },
  );
  return data;
}

// === Invoices (qo'shimcha to'lovlar / schyot) ===
export interface Invoice {
  id: number;
  market_id: number;
  market_name: string | null;
  title: string;
  description: string | null;
  amount: number;
  paid_amount: number;
  remaining: number;
  currency: string;
  kind: "support" | "extra";
  payment_method: "cash" | "contract" | null;
  contract_no: string | null;
  due_date: string | null;
  is_paid: boolean;
  paid_at: string | null;
  paid_note: string | null;
  status: "paid" | "partial" | "pending" | "overdue";
  days_left: number | null;
  has_doc: boolean;
  doc_name: string | null;
  created_at: string;
}

export interface InvoiceStats {
  count: number;
  counts: { paid: number; partial: number; pending: number; overdue: number };
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  overdue_amount: number;
  outstanding_amount: number;
}

export interface InvoiceList {
  invoices: Invoice[];
  total: number;
  stats: InvoiceStats;
}

export interface InvoiceCreateInput {
  market_id: number;
  title: string;
  amount: number;
  description?: string | null;
  currency?: string;
  due_date?: string | null;
  payment_method?: "cash" | "contract" | null;
  contract_no?: string | null;
  doc_data?: string | null;
  doc_name?: string | null;
  doc_mime?: string | null;
}

export async function getInvoices(params: {
  market_id?: number; invoice_status?: string; search?: string;
} = {}): Promise<InvoiceList> {
  const { data } = await apiClient.get<InvoiceList>("/owner/invoices", { params });
  return data;
}

export async function createInvoice(input: InvoiceCreateInput): Promise<Invoice> {
  const { data } = await apiClient.post<Invoice>("/owner/invoices", input);
  return data;
}

export async function setInvoicePaid(id: number, is_paid: boolean, note?: string): Promise<Invoice> {
  const { data } = await apiClient.post<Invoice>(`/owner/invoices/${id}/paid`, { is_paid, note });
  return data;
}

export async function setInvoicePaidAmount(
  id: number, paid_amount: number, note?: string, mode: "add" | "set" = "add",
): Promise<Invoice> {
  const { data } = await apiClient.post<Invoice>(`/owner/invoices/${id}/pay-amount`, { paid_amount, note, mode });
  return data;
}

export interface InvoicePayment {
  id: number;
  amount: number;
  note: string | null;
  created_at: string;
  edited_at: string | null;
  editable: boolean;
}

export async function getInvoicePayments(id: number): Promise<InvoicePayment[]> {
  const { data } = await apiClient.get<{ payments: InvoicePayment[] }>(`/owner/invoices/${id}/payments`);
  return data.payments;
}

export async function editInvoicePayment(paymentId: number, amount?: number, note?: string) {
  const { data } = await apiClient.patch(`/owner/invoices/payments/${paymentId}`, { amount, note });
  return data;
}

export async function deleteInvoicePayment(paymentId: number) {
  const { data } = await apiClient.delete(`/owner/invoices/payments/${paymentId}`);
  return data;
}

export interface DisciplineRow {
  market_id: number;
  market_name: string;
  on_time: number;
  late: number;
  pending_overdue: number;
  on_time_rate: number;
  avg_late_days: number;
  rating: "excellent" | "good" | "fair" | "poor" | "none";
}

export async function getAllDiscipline(): Promise<DisciplineRow[]> {
  const { data } = await apiClient.get<DisciplineRow[]>("/owner/discipline");
  return data;
}

export interface DisciplineDetail extends DisciplineRow {
  late_days_total: number;
  total_judged: number;
  details: {
    id: number; title: string; due_date: string;
    paid_date: string | null; late_days: number; status: string;
  }[];
}

export async function getMarketDisciplineDetail(marketId: number): Promise<DisciplineDetail> {
  const { data } = await apiClient.get<DisciplineDetail>(`/owner/markets/${marketId}/discipline`);
  return data;
}

export async function updateInvoice(id: number, input: Partial<InvoiceCreateInput>): Promise<Invoice> {
  const { data } = await apiClient.patch<Invoice>(`/owner/invoices/${id}`, input);
  return data;
}

export async function deleteInvoice(id: number): Promise<void> {
  await apiClient.delete(`/owner/invoices/${id}`);
}

export function invoiceDocUrl(id: number): string {
  return `${apiClient.defaults.baseURL}/owner/invoices/${id}/doc`;
}
