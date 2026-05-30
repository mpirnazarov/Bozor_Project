import { apiClient } from "./client";
import type { Pavilion, PavilionShops } from "@/types/api";

export async function getPavilions(): Promise<Pavilion[]> {
  const { data } = await apiClient.get<Pavilion[]>("/pavilions");
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
  year = 2026,
  month = 5,
): Promise<PavilionShops> {
  const { data } = await apiClient.get<PavilionShops>(`/pavilions/${id}/shops`, {
    params: { year, month },
  });
  return data;
}
