import { create } from "zustand";
import type { User } from "@/types/api";
import * as authApi from "@/api/auth";
import { setCurrentMarket } from "@/api/client";

// Foydalanuvchi yuklanganda API client'ga bozorini o'rnatadi.
// super_admin uchun NULL (default orikzor yoki ?market bilan tanlaydi).
function applyMarket(user: User | null) {
  if (user && user.role !== "super_admin" && user.market_slug) {
    setCurrentMarket(user.market_slug);
  } else {
    setCurrentMarket(null);
  }
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
