import { apiClient } from "./client";
import type { InnDetail, InnSearchResult } from "@/types/api";

export async function searchInn(q: string): Promise<InnSearchResult[]> {
  const { data } = await apiClient.get<InnSearchResult[]>("/inn/search", {
    params: { q },
  });
  return Array.isArray(data) ? data : [];
}

export async function getInn(inn: string): Promise<InnDetail> {
  const { data } = await apiClient.get<InnDetail>(`/inn/${encodeURIComponent(inn)}`);
  return data;
}
