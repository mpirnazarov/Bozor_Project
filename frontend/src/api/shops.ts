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
