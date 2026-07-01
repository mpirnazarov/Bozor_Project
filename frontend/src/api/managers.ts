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
  map_layer_name: string | null;
  assigned: boolean;
}

export interface PavilionManagerInfo {
  pavilion_id: number;
  pavilion_name: string;
  map_layer_id: number | null;
  map_layer_name: string | null;
  managers: { id: number; username: string; full_name: string | null; is_active: boolean }[];
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

export async function getManagerCredentials(managerId: number): Promise<{
  id: number; username: string; full_name: string | null;
  is_active: boolean; last_login_at: string | null;
}> {
  const { data } = await apiClient.get(`/managers/${managerId}/credentials`);
  return data;
}

export async function getPavilionsWithManagers(): Promise<PavilionManagerInfo[]> {
  const { data } = await apiClient.get<PavilionManagerInfo[]>("/managers/by-pavilion/all");
  return data;
}
