import { apiClient } from "./client";
import type { Dashboard } from "@/types/api";

export async function getDashboard(live = false): Promise<Dashboard> {
  const { data } = await apiClient.get<Dashboard>("/dashboard", {
    params: live ? { live: true } : {},
  });
  return data;
}

// === Market-side invoices (faqat ko'rish) ===
export interface MarketInvoice {
  id: number;
  title: string;
  description: string | null;
  amount: number;
  paid_amount: number;
  remaining: number;
  currency: string;
  kind: "support" | "extra";
  payment_method: "cash" | "contract" | null;
  contract_no: string | null;
  due_date: string | null;
  is_paid: boolean;
  paid_at: string | null;
  status: "paid" | "partial" | "pending" | "overdue";
  days_left: number | null;
  has_doc: boolean;
  doc_name: string | null;
  created_at: string;
}

export interface MarketInvoiceList {
  market_name: string;
  invoices: MarketInvoice[];
  total: number;
  stats: {
    count: number;
    counts: { paid: number; partial: number; pending: number; overdue: number };
    total_amount: number;
    paid_amount: number;
    pending_amount: number;
    overdue_amount: number;
    outstanding_amount: number;
  };
}

export async function getMarketInvoices(market?: string): Promise<MarketInvoiceList> {
  const { data } = await apiClient.get<MarketInvoiceList>("/dashboard/invoices", {
    params: market ? { market } : {},
  });
  return data;
}

export function marketInvoiceDocUrl(id: number): string {
  return `${apiClient.defaults.baseURL}/dashboard/invoices/${id}/doc`;
}

export interface MarketPayment {
  id: number;
  amount: number;
  note: string | null;
  created_at: string;
  edited_at: string | null;
}

export async function getMarketInvoicePayments(invoiceId: number): Promise<MarketPayment[]> {
  const { data } = await apiClient.get<{ payments: MarketPayment[] }>(`/dashboard/invoices/${invoiceId}/payments`);
  return data.payments;
}

export interface MarketDiscipline {
  total_judged: number;
  on_time: number;
  on_time_rate: number;
  rating: "excellent" | "good" | "fair" | "poor" | "none";
}

export async function getMarketDiscipline(): Promise<MarketDiscipline> {
  const { data } = await apiClient.get<MarketDiscipline>("/dashboard/discipline");
  return data;
}
