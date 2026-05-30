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

export interface MarketSummary {
  id: number;
  slug: string;
  name: string;
  total: number;
  paid: number;
  debt: number;
}

export interface SuperDashboard {
  total: number;
  paid: number;
  debt: number;
  markets: MarketSummary[];
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
