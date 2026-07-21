import { apiClient } from "./client";

export interface Manager {
  id: number;
  username: string;
  full_name: string | null;
  is_active: boolean;
  pavilion_count: number;
  created_at: string | null;
}

export interface ManagerPavilionMini {
  id: number;
  display_name: string;
  pavilion_type: string | null;
  map_layer_id: number | null;
  assigned: boolean;
}

export async function listManagers(): Promise<Manager[]> {
  const { data } = await apiClient.get<Manager[]>("/managers");
  return data;
}

export async function createManager(full_name: string): Promise<{ id: number; username: string; password: string }> {
  const { data } = await apiClient.post("/managers", { full_name });
  return data;
}

export async function changeManagerPassword(id: number, new_password: string): Promise<void> {
  await apiClient.put(`/managers/${id}/password`, { new_password });
}

export async function toggleManagerBlock(id: number): Promise<void> {
  await apiClient.put(`/managers/${id}/block`);
}

export async function deleteManager(id: number): Promise<void> {
  await apiClient.delete(`/managers/${id}`);
}

export async function getManagerPavilions(id: number): Promise<ManagerPavilionMini[]> {
  const { data } = await apiClient.get<ManagerPavilionMini[]>(`/managers/${id}/pavilions`);
  return data;
}

export async function assignManagerPavilions(id: number, pavilion_ids: number[]): Promise<void> {
  await apiClient.put(`/managers/${id}/pavilions`, { pavilion_ids });
}
