import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // httpOnly cookie uchun
  headers: { "Content-Type": "application/json" },
});

// 401 bo'lsa login sahifasiga yo'naltirish
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

// === Multi-bozor: joriy bozor slug'i ===
// O'rnatilsa, har bir so'rovga ?market=<slug> qo'shiladi. O'rnatilmasa
// backend default 'orikzor' ishlatadi — shu sababli bitta bozorli holat
// o'zgarishsiz ishlaydi.
let currentMarket: string | null = null;

export function setCurrentMarket(slug: string | null) {
  currentMarket = slug;
}

export function getCurrentMarket(): string | null {
  return currentMarket;
}

apiClient.interceptors.request.use((config) => {
  if (currentMarket) {
    config.params = { ...(config.params || {}), market: currentMarket };
  }
  return config;
});
