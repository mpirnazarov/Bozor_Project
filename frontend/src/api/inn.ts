import { apiClient } from "./client";
import type { InnDetail, InnSearchResult } from "@/types/api";

export async function searchInn(q: string): Promise<InnSearchResult[]> {
  const { data } = await apiClient.get<InnSearchResult[]>("/inn/search", {
    params: { q },
  });
  return Array.isArray(data) ? data : [];
}

export async function getInn(
  inn: string,
  year?: number,
  month?: number,
): Promise<InnDetail> {
  // Davr berilmasa — backend joriy oyni oladi.
  const params: Record<string, number> = {};
  if (year != null) params.year = year;
  if (month != null) params.month = month;
  const { data } = await apiClient.get<InnDetail>(
    `/inn/${encodeURIComponent(inn)}`,
    { params },
  );
  return data;
}
