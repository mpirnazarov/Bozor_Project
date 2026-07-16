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
  paid: "To'liq to'lagan",
  partial: "Qisman to'lagan",
  unpaid: "To'lanmagan",
  no_data: "Topilmadi",
};

export const STATUS_COLORS: Record<string, string> = {
  paid: "#16a34a",
  partial: "#eab308",
  unpaid: "#dc2626",
  no_data: "#f97316",   // Ma'lumot yo'q — to'q sariq/to'q to'q
  vacant: "#9ca3af",    // Bo'sh do'kon — kulrang
};

export function isZeroSegmentShop(shopId: string): boolean {
  const parts = shopId.split("-");
  return parts.length >= 3 && parts[2] === "0";
}
