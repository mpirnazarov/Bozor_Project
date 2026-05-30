import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { searchInn } from "@/api/inn";

interface Props {
  onSelectInn: (inn: string) => void;
}

export function InnSearch({ onSelectInn }: Props) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ["inn-search", q],
    queryFn: () => searchInn(q),
    enabled: q.trim().length >= 2,
  });

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          className="input pl-9"
          placeholder="INN yoki nom bo'yicha qidirish..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setActive(true)}
          onBlur={() => setTimeout(() => setActive(false), 150)}
        />
      </div>

      {active && q.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {isFetching && (
            <div className="px-3 py-3 text-sm text-slate-400">Qidirilmoqda...</div>
          )}
          {!isFetching && data?.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-400">Topilmadi</div>
          )}
          {data?.map((r) => (
            <button
              key={r.inn}
              onMouseDown={() => onSelectInn(r.inn)}
              className="flex w-full items-center justify-between gap-3 border-b border-slate-50 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-700">
                  {r.name}
                </div>
                <div className="font-mono text-xs text-slate-400">INN: {r.inn}</div>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                {r.shop_count} ta
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
