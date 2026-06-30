import { apiClient } from "./client";

export interface Manager {
  id: number;
  username: string;
  full_name: string | null;
  is_active: boolean;
  pavilion_count: number;
  created_at: string | null;
  last_login_at: string | null;
}

export interface ManagerCreateResult {
  id: number;
  username: string;
  password: string;
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

export async function createManager(full_name: string): Promise<ManagerCreateResult> {
  const { data } = await apiClient.post<ManagerCreateResult>("/managers", { full_name });
  return data;
}

export async function changeManagerPassword(managerId: number, newPassword: string): Promise<void> {
  await apiClient.put(`/managers/${managerId}/password`, { new_password: newPassword });
}

export async function toggleManagerBlock(managerId: number): Promise<{ ok: boolean; is_active: boolean }> {
  const { data } = await apiClient.put(`/managers/${managerId}/block`);
  return data;
}

export async function deleteManager(managerId: number): Promise<void> {
  await apiClient.delete(`/managers/${managerId}`);
}

export async function getManagerPavilions(managerId: number): Promise<ManagerPavilionMini[]> {
  const { data } = await apiClient.get<ManagerPavilionMini[]>(`/managers/${managerId}/pavilions`);
  return data;
}

export async function assignManagerPavilions(managerId: number, pavilionIds: number[]): Promise<void> {
  await apiClient.put(`/managers/${managerId}/pavilions`, { pavilion_ids: pavilionIds });
}
