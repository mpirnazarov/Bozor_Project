import { apiClient } from "./client";

export interface YertolaOverview {
  pavilions: { pavilion_code: string; shop_count: number }[];
  total_shops: number;
  sheets_cache: { cached: boolean; rows: number; age_seconds: number | null };
}

export async function getYertolaOverview(): Promise<YertolaOverview> {
  const { data } = await apiClient.get<YertolaOverview>("/yertola");
  return data;
}

export interface YertolaShop {
  shop_id: string;
  inn: string | null;
  shop_type: string | null;
  monthly_rent: string;
  sheets_data: Record<string, unknown> | null;
}

export async function getYertolaPavilion(code: string): Promise<{
  pavilion_code: string;
  shop_count: number;
  shops: YertolaShop[];
}> {
  const { data } = await apiClient.get(`/yertola/${encodeURIComponent(code)}`);
  return data;
}
