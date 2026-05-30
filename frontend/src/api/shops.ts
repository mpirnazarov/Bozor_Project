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
  year = 2026,
  month = 5,
): Promise<ShopDetail> {
  const { data } = await apiClient.get<ShopDetail>(
    `/shops/${encodeURIComponent(shopId)}`,
    { params: { year, month } },
  );
  return data;
}
