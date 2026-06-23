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
// sessionStorage da saqlanadi — sahifa yangilanganida ham qoladi.
// O'rnatilmasa backend default 'orikzor' ishlatadi.
const MARKET_KEY = "currentMarket";

export function setCurrentMarket(slug: string | null) {
  if (slug) {
    sessionStorage.setItem(MARKET_KEY, slug);
  } else {
    sessionStorage.removeItem(MARKET_KEY);
  }
}

export function getCurrentMarket(): string | null {
  return sessionStorage.getItem(MARKET_KEY);
}

apiClient.interceptors.request.use((config) => {
  const market = getCurrentMarket();
  if (market) {
    config.params = { ...(config.params || {}), market };
  }
  return config;
});
