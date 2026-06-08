import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock, ChevronDown, ChevronUp, TrendingUp, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { getAllDiscipline, getMarketDisciplineDetail } from "@/api/owner";

const RATING = {
  excellent: { label: "A'lo", color: "#16a34a" },
  good:      { label: "Yaxshi", color: "#0ea5e9" },
  fair:      { label: "O'rtacha", color: "#eab308" },
  poor:      { label: "Yomon", color: "#dc2626" },
  none:      { label: "—", color: "#64748b" },
} as const;

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Owner uchun: bozorlarning to'lov intizomi — o'z vaqtida/kechikish bilan
export function PaymentDisciplinePanel({ onMarket }: { onMarket: (id: number) => void }) {
  const { data: rows } = useQuery({
    queryKey: ["owner-discipline"],
    queryFn: getAllDiscipline,
    retry: false,
  });
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-2 font-display text-base font-bold text-white">
          <CalendarClock size={18} className="text-[#5b9dff]" /> To'lov intizomi
        </div>
        <p className="mt-2 text-sm text-slate-400">Hali baholanadigan muddatli to'lovlar yo'q.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-1 flex items-center gap-2 font-display text-base font-bold text-white">
        <CalendarClock size={18} className="text-[#5b9dff]" /> Bozorlar to'lov intizomi
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Bozorlar to'lovlarni o'z vaqtida to'laydimi yoki kechikadimi (eng muammoli birinchi)
      </p>

      <div className="space-y-2">
        {rows.map((r) => {
          const rt = RATING[r.rating];
          const open = expanded === r.market_id;
          return (
            <div key={r.market_id} className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <button onClick={() => setExpanded(open ? null : r.market_id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]">
                {/* Rate halqa */}
                <div className="relative grid h-12 w-12 shrink-0 place-items-center">
                  <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke={rt.color} strokeWidth="3"
                      strokeDasharray={`${(r.on_time_rate / 100) * 97.4} 97.4`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute text-[11px] font-bold text-white">{r.on_time_rate}%</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-white">{r.market_name}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: rt.color + "22", color: rt.color }}>{rt.label}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1 text-[#4ade80]"><CheckCircle2 size={11} /> {r.on_time} o'z vaqtida</span>
                    {r.late > 0 && <span className="inline-flex items-center gap-1 text-[#f87171]"><AlertTriangle size={11} /> {r.late} kechikkan</span>}
                    {r.avg_late_days > 0 && <span className="inline-flex items-center gap-1 text-amber-400"><Clock size={11} /> o'rtacha {r.avg_late_days} kun kech</span>}
                  </div>
                </div>
                {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
              </button>
              {open && <DisciplineDetailRows marketId={r.market_id} onMarket={onMarket} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DisciplineDetailRows({ marketId, onMarket }: { marketId: number; onMarket: (id: number) => void }) {
  const { data } = useQuery({
    queryKey: ["owner-discipline-detail", marketId],
    queryFn: () => getMarketDisciplineDetail(marketId),
    retry: false,
  });

  if (!data) return <div className="px-4 pb-3 text-xs text-slate-500">Yuklanmoqda...</div>;

  const STATUS_LABEL: Record<string, { t: string; c: string }> = {
    on_time: { t: "O'z vaqtida", c: "#4ade80" },
    late: { t: "Kechikib to'langan", c: "#f87171" },
    overdue_unpaid: { t: "Muddati o'tgan, to'lanmagan", c: "#dc2626" },
  };

  return (
    <div className="border-t border-white/[0.06] px-4 py-3">
      {data.details.length === 0 ? (
        <div className="text-xs text-slate-500">Tafsilot yo'q</div>
      ) : (
        <div className="space-y-1.5">
          {data.details.map((d) => {
            const sl = STATUS_LABEL[d.status] || { t: d.status, c: "#94a3b8" };
            return (
              <div key={d.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-white">{d.title}</div>
                  <div className="text-[11px] text-slate-500">
                    Muddat: {fmtDate(d.due_date)}
                    {d.paid_date && <> · To'landi: {fmtDate(d.paid_date)}</>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] font-bold" style={{ color: sl.c }}>{sl.t}</div>
                  {d.late_days > 0 && <div className="text-[11px] text-[#f87171]">{d.late_days} kun kech</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button onClick={() => onMarket(marketId)}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#5b9dff] hover:underline">
        <TrendingUp size={12} /> Bu bozor to'lovlarini ko'rish
      </button>
    </div>
  );
}
