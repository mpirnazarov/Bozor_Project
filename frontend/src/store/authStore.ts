import { create } from "zustand";
import type { User } from "@/types/api";
import * as authApi from "@/api/auth";
import { setCurrentMarket } from "@/api/client";

// Foydalanuvchi yuklanganda API client'ga bozorini o'rnatadi.
// - market_admin/viewer: o'z bozorini (user.market_slug) o'rnatadi
// - super_admin/owner: sessionStorage ni TEGHMASLIK — u ?market= orqali boshqaradi
// - logout: tozalash logout() da amalga oshiriladi
function applyMarket(user: User | null) {
  if (!user) return;
  if (user.role !== "super_admin" && user.role !== "owner" && user.market_slug) {
    setCurrentMarket(user.market_slug);
  }
  // super_admin va owner uchun sessionStorage ga tegmaymiz:
  // ular SuperDashboardPage dan bozor tanlaganda setCurrentMarket chaqiriladi
}

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  login: async (username, password) => {
    set({ loading: true });
    try {
      const res = await authApi.login(username, password);
      applyMarket(res.user);
      set({ user: res.user });
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      setCurrentMarket(null);
      set({ user: null });
    }
  },

  checkAuth: async () => {
    set({ loading: true });
    try {
      const user = await authApi.getMe();
      applyMarket(user);
      set({ user });
    } catch {
      set({ user: null });
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  clear: () => set({ user: null }),
}));
