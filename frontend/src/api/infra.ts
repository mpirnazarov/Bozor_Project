import { apiClient } from "./client";

export interface InfraShop {
  id: number;
  name: string;
  contract_no: string | null;
  contract_date: string | null;
  monthly_rent: number;
  is_active: boolean;
  notes: string | null;
  water_enabled?: boolean;
}

export interface InfraBilling {
  id: number;
  shop_id: number;
  year: number;
  month: number;
  category: string;
  due_amount: number;
  paid_amount: number;
  debt: number;
  notes?: string | null;
}

export interface InfraShopDetail {
  shop: InfraShop;
  billings: InfraBilling[];
}

export interface InfraBillingUpsert {
  year: number;
  month: number;
  rent_due: number;
  rent_paid: number;
  electricity_due: number;
  electricity_paid: number;
  water_due: number;
  water_paid: number;
}

export async function listInfraShops(): Promise<InfraShop[]> {
  const { data } = await apiClient.get<InfraShop[]>("/infra");
  return data;
}

export async function createInfraShop(body: Partial<InfraShop>): Promise<InfraShop> {
  const { data } = await apiClient.post<InfraShop>("/infra", body);
  return data;
}

export async function getInfraShop(id: number): Promise<InfraShopDetail> {
  const { data } = await apiClient.get<InfraShopDetail>(`/infra/${id}`);
  return data;
}

export async function upsertInfraBilling(shopId: number, body: InfraBillingUpsert): Promise<InfraBilling[]> {
  const { data } = await apiClient.put<InfraBilling[]>(`/infra/${shopId}/billing`, body);
  return data;
}

export async function deleteInfraShop(id: number): Promise<void> {
  await apiClient.delete(`/infra/${id}`);
}
