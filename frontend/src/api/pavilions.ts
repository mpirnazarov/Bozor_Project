import { apiClient } from "./client";
import type { Pavilion, PavilionShops } from "@/types/api";

export async function getPavilions(mapLayerId?: number): Promise<Pavilion[]> {
  const { data } = await apiClient.get<Pavilion[]>("/pavilions", {
    params: mapLayerId != null ? { map_layer_id: mapLayerId } : undefined,
  });
  // Backend xato/HTML qaytarsa, massiv bo'lmasligi mumkin — himoya
  if (!Array.isArray(data)) {
    throw new Error(
      "Pavilions API massiv qaytarmadi. API yo'li (/api) backend'ga to'g'ri ulanmagan bo'lishi mumkin.",
    );
  }
  return data;
}

export async function getPavilionShops(
  id: number,
  year?: number,
  month?: number,
): Promise<PavilionShops> {
  // year/month berilmasa — backend joriy oyni o'zi oladi (date.today()).
  // Shu tarzda yangi oyga o'tilganda avtomatik to'g'ri oy ko'rinadi.
  const params: Record<string, number> = {};
  if (year != null) params.year = year;
  if (month != null) params.month = month;
  const { data } = await apiClient.get<PavilionShops>(`/pavilions/${id}/shops`, { params });
  return data;
}
