import { apiClient } from "./client";
import type { PaginatedShops, ShopDetail } from "@/types/api";

export async function listShops(params: {
  inn?: string;
  pavilion?: string;
  q?: string;
  page?: number;
  per_page?: number;
}): Promise<PaginatedShops> {
  const { data } = await apiClient.get<PaginatedShops>("/shops", { params });
  return data;
}

export async function getShop(
  shopId: string,
  year?: number,
  month?: number,
): Promise<ShopDetail> {
  // shop_id query parametr orqali yuboriladi — "/" yoki maxsus belgilar
  // (masalan "01-1-1-026А/012") path'ni buzmasligi uchun.
  const params: Record<string, string | number> = { shop_id: shopId };
  if (year != null) params.year = year;
  if (month != null) params.month = month;
  const { data } = await apiClient.get<ShopDetail>(`/shops/by-id`, { params });
  return data;
}

export interface ShopHistoryEntry {
  id: number;
  old_inn: string | null;
  old_name: string | null;
  new_inn: string | null;
  new_name: string | null;
  changed_by: string | null;
  reason: string | null;
  changed_at: string;
}

export async function getShopHistory(shopId: string): Promise<ShopHistoryEntry[]> {
  const { data } = await apiClient.get<ShopHistoryEntry[]>("/shops/history-by-id", {
    params: { shop_id: shopId },
  });
  return data;
}
