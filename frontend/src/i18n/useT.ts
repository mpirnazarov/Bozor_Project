import { create } from "zustand";
import { TRANSLATIONS, type Lang } from "@/i18n/translations";

const COOKIE = "lang";

function readCookieLang(): Lang {
  if (typeof document === "undefined") return "uz";
  const m = document.cookie.match(/(?:^|;\s*)lang=(uz|ru|en)/);
  return (m?.[1] as Lang) ?? "uz";
}

function writeCookieLang(lang: Lang) {
  // 1 yil saqlanadi
  document.cookie = `${COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangState>((set) => ({
  lang: readCookieLang(),
  setLang: (lang) => {
    writeCookieLang(lang);
    set({ lang });
  },
}));

// Tarjima hook — t("key") yoki t("key", { n: 5 }) (joker almashtirish)
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return (key: string, vars?: Record<string, string | number>): string => {
    let s = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.uz[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return s;
  };
}
