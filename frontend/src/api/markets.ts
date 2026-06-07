import { apiClient } from "./client";

export interface Market {
  id: number;
  slug: string;
  name: string;
  map_image: string | null;
  map_view_w: number;
  map_view_h: number;
  dashboard_stats: Record<string, number>;
  is_active: boolean;
  display_order: number;
}

export type MarketAttention = "ok" | "yellow" | "red" | "blocked" | "free";

export interface MarketSummary {
  id: number;
  slug: string;
  name: string;
  total: number;
  paid: number;
  debt: number;
  is_demo?: boolean;
  attention: MarketAttention;
  support_paid: boolean;
  free_period: boolean;
  monthly_fee: number;
  due_day: number;
}

export interface SuperDashboard {
  total: number;
  paid: number;
  debt: number;
  markets: MarketSummary[];
  attention_count: number;
}

export async function getMarkets(): Promise<Market[]> {
  const { data } = await apiClient.get<Market[]>("/markets");
  return Array.isArray(data) ? data : [];
}

export async function getMarket(slug: string): Promise<Market> {
  const { data } = await apiClient.get<Market>(`/markets/${slug}`);
  return data;
}

export async function getSuperDashboard(): Promise<SuperDashboard> {
  const { data } = await apiClient.get<SuperDashboard>("/markets/super/dashboard");
  return data;
}

export interface RailwayDeployment {
  id: string;
  status: string;
  created_at: string | null;
  url: string | null;
}

export interface RailwayOverview {
  configured: boolean;
  metrics?: {
    cpu_vcpu_latest?: number;
    cpu_vcpu_avg?: number;
    ram_gb_latest?: number;
    ram_gb_avg?: number;
  };
  metrics_error?: string;
  deployments?: RailwayDeployment[];
  deployments_error?: string;
}

export async function getRailwayOverview(): Promise<RailwayOverview> {
  const { data } = await apiClient.get<RailwayOverview>("/markets/super/railway");
  return data;
}

export interface MarketUpdatePayload {
  name?: string;
  is_active?: boolean;
  display_order?: number;
}

export async function updateMarket(id: number, payload: MarketUpdatePayload): Promise<Market> {
  const { data } = await apiClient.put<Market>(`/markets/${id}`, payload);
  return data;
}

export async function toggleMarket(id: number): Promise<Market> {
  const { data } = await apiClient.post<Market>(`/markets/${id}/toggle`, {});
  return data;
}
