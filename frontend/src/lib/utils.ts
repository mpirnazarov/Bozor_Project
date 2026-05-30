import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Son formatlash: 11689498000 -> "11 689 498 000"
export function fmtUZS(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!isFinite(n)) return "0";
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export const STATUS_LABELS: Record<string, string> = {
  paid: "Qarzsiz",
  partial: "Qisman",
  unpaid: "To'lamagan",
  no_data: "Ma'lumot yo'q",
};

export const STATUS_COLORS: Record<string, string> = {
  paid: "#16a34a",
  partial: "#eab308",
  unpaid: "#dc2626",
  no_data: "#9ca3af",
};
