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

export async function ownerCreateMarket(name: string, slug?: string): Promise<NewMarketResult> {
  const { data } = await apiClient.post<NewMarketResult>("/owner/markets", { name, slug });
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
  usage?: { month_cost_usd?: number };
  domains?: RailwayDomain[];
  env_count?: number;
  project?: { name?: string | null; services?: { id: string; name: string }[] };
}

export async function getOwnerRailway(): Promise<RailwayOverview> {
  const { data } = await apiClient.get<RailwayOverview>("/owner/railway");
  return data;
}
