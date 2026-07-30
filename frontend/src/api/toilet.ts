import { apiClient } from "./client";

export interface ToiletItem {
  id: number;
  name: string;
  is_active: boolean;
  notes: string | null;
}

export interface ToiletRevenueItem {
  id: number;
  toilet_id: number;
  revenue_date: string;
  amount: number;
  notes: string | null;
}

export interface ToiletMonthSummary {
  toilet: ToiletItem;
  year: number;
  month: number;
  total: number;
  revenues: ToiletRevenueItem[];
}

export async function listToilets(): Promise<ToiletItem[]> {
  const { data } = await apiClient.get<ToiletItem[]>("/toilet");
  return data;
}

export async function getToiletMonth(id: number, year: number, month: number): Promise<ToiletMonthSummary> {
  const { data } = await apiClient.get<ToiletMonthSummary>(`/toilet/${id}/month`, { params: { year, month } });
  return data;
}

export async function upsertToiletRevenue(id: number, body: { revenue_date: string; amount: number; notes?: string }): Promise<ToiletRevenueItem> {
  const { data } = await apiClient.put<ToiletRevenueItem>(`/toilet/${id}/revenue`, body);
  return data;
}

export async function deleteToiletRevenue(toiletId: number, revenueId: number): Promise<void> {
  await apiClient.delete(`/toilet/${toiletId}/revenue/${revenueId}`);
}
