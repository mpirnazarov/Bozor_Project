import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { useLangStore } from "@/i18n/useT";
import { LANGS } from "@/i18n/translations";

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost px-3 py-2"
        title="Til / Language / Язык"
        style={dark ? { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)", color: "#e8eef7" } : undefined}
      >
        <Globe size={16} />
        <span className="text-xs font-bold">{current.flag}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-40 overflow-hidden rounded-xl border border-white/60 bg-white/95 shadow-float backdrop-blur-xl animate-scale-in">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false); }}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold text-ink transition-colors hover:bg-brand-50"
            >
              <span className="flex items-center gap-2">
                <span className="w-6 text-xs font-bold text-ink-faint">{l.flag}</span>
                {l.label}
              </span>
              {l.code === lang && <Check size={15} className="text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
