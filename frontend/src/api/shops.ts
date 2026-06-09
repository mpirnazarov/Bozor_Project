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
  // year/month berilmasa — backend joriy oyni o'zi oladi.
  const params: Record<string, number> = {};
  if (year != null) params.year = year;
  if (month != null) params.month = month;
  const { data } = await apiClient.get<ShopDetail>(
    `/shops/${encodeURIComponent(shopId)}`,
    { params },
  );
  return data;
}
