import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { searchInn } from "@/api/inn";
import { useT } from "@/i18n/useT";

interface Props {
  onSelectInn: (inn: string) => void;
}

// i18n
export function InnSearch({ onSelectInn }: Props) {
  const [q, setQ] = useState("");
  const t = useT();
  const [active, setActive] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ["inn-search", q],
    queryFn: () => searchInn(q),
    enabled: q.trim().length >= 2,
  });

  return (
    <div className={`card relative p-4 ${active ? "z-40" : ""}`}>
      <div className="eyebrow mb-2">{t("inn.title")}</div>
      <div className="relative">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          className="input pl-10"
          placeholder={t("inn.placeholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setActive(true)}
          onBlur={() => setTimeout(() => setActive(false), 150)}
        />
      </div>

      {active && q.trim().length >= 2 && (
        <div className="absolute left-4 right-4 z-50 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-white/60 bg-white/95 shadow-float backdrop-blur-xl animate-scale-in">
          {isFetching && (
            <div className="px-4 py-3.5 text-sm text-ink-faint">{t("inn.searching")}</div>
          )}
          {!isFetching && data?.length === 0 && (
            <div className="px-4 py-3.5 text-sm text-ink-faint">{t("common.notFound")}</div>
          )}
          {data?.map((r) => (
            <button
              key={r.inn}
              onMouseDown={() => onSelectInn(r.inn)}
              className="flex w-full items-center justify-between gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-brand-50"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{r.name}</div>
                <div className="font-mono text-xs text-ink-faint">INN: {r.inn}</div>
              </div>
              <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand">
                {r.shop_count} {t("inn.shops")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
