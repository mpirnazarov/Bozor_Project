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
  currency: string;
  due_date: string | null;
  is_paid: boolean;
  paid_at: string | null;
  status: "paid" | "pending" | "overdue";
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
    counts: { paid: number; pending: number; overdue: number };
    total_amount: number;
    paid_amount: number;
    pending_amount: number;
    overdue_amount: number;
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
