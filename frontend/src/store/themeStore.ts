import { create } from "zustand";
import { getTheme, setTheme as apiSetTheme } from "@/api/admin";

type Theme = "light" | "dark";

function applyToDom(theme: Theme) {
  const el = document.documentElement;
  if (theme === "dark") el.classList.add("dark");
  else el.classList.remove("dark");
}

interface ThemeState {
  theme: Theme;
  loaded: boolean;
  load: () => Promise<void>;
  change: (theme: Theme) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "light",
  loaded: false,
  load: async () => {
    try {
      const theme = await getTheme();
      applyToDom(theme);
      set({ theme, loaded: true });
    } catch {
      applyToDom("light");
      set({ theme: "light", loaded: true });
    }
  },
  change: async (theme) => {
    applyToDom(theme); // darrov qo'llaymiz (tez his qilinadi)
    set({ theme });
    try {
      await apiSetTheme(theme); // DB'ga saqlaymiz
    } catch {
      // saqlanmasa ham UI o'zgargan holda qoladi
    }
  },
}));
