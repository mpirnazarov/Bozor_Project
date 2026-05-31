import { apiClient } from "./client";

export interface SupportStatus {
  free_period: boolean;
  free_until: string;
  monthly_fee: number;
  paid_this_month: boolean;
  needs_warning: boolean;
  pending: boolean;
  support_blocked: boolean;
  due_day: number;
}

export interface OwnerMarket {
  id: number;
  slug: string;
  name: string;
  is_active: boolean;
  support_blocked: boolean;
  created_at: string;
  shop_count: number;
  admin_username: string | null;
  support: SupportStatus;
}

export interface NewMarketResult {
  id: number;
  slug: string;
  name: string;
  credentials: { username: string; password: string };
}

export interface SupportPaymentRow {
  year: number;
  month: number;
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
  notes: string | null;
}

export async function ownerListMarkets(): Promise<OwnerMarket[]> {
  const { data } = await apiClient.get<OwnerMarket[]>("/owner/markets");
  return data;
}

export async function ownerCreateMarket(name: string, slug?: string): Promise<NewMarketResult> {
  const { data } = await apiClient.post<NewMarketResult>("/owner/markets", { name, slug });
  return data;
}

export async function ownerUpdateMarket(
  id: number,
  payload: { name?: string; is_active?: boolean },
): Promise<void> {
  await apiClient.put(`/owner/markets/${id}`, payload);
}

export async function ownerDeleteMarket(id: number): Promise<void> {
  await apiClient.delete(`/owner/markets/${id}`);
}

export async function ownerChangePassword(id: number, newPassword: string): Promise<{ username: string }> {
  const { data } = await apiClient.put<{ username: string }>(`/owner/markets/${id}/password`, {
    new_password: newPassword,
  });
  return data;
}

export async function ownerMarkPayment(
  id: number, year: number, month: number, isPaid: boolean, notes?: string,
): Promise<void> {
  await apiClient.post(`/owner/markets/${id}/support/payment`, {
    year, month, is_paid: isPaid, notes,
  });
}

export async function ownerListPayments(id: number): Promise<SupportPaymentRow[]> {
  const { data } = await apiClient.get<SupportPaymentRow[]>(`/owner/markets/${id}/support/payments`);
  return data;
}

export async function ownerBlockMarket(id: number, blocked: boolean): Promise<void> {
  await apiClient.post(`/owner/markets/${id}/support/block`, { blocked });
}

// Bozor uchun (public): joriy bozorning tex-podderjka holati
export async function getMarketSupportStatus(): Promise<SupportStatus> {
  const { data } = await apiClient.get<SupportStatus>("/settings/support-status");
  return data;
}
