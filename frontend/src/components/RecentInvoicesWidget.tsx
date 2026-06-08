import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Receipt, ChevronRight, CircleCheck, Clock, AlertTriangle, Plus, Coins,
} from "lucide-react";
import { getInvoices } from "@/api/owner";

const STATUS = {
  paid:    { label: "To'langan",      color: "#16a34a", icon: CircleCheck },
  partial: { label: "Qisman",         color: "#0ea5e9", icon: Coins },
  pending: { label: "Kutilmoqda",     color: "#eab308", icon: Clock },
  overdue: { label: "Muddati o'tgan", color: "#dc2626", icon: AlertTriangle },
} as const;

function fmtMoney(n: number, cur = "UZS") {
  return new Intl.NumberFormat("uz-UZ").format(n) + " " + cur;
}

export function RecentInvoicesWidget() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["owner-invoices"],
    queryFn: () => getInvoices(),
    refetchInterval: 60_000,
  });

  const invoices = (data?.invoices || []).slice(0, 5);
  const stats = data?.stats;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          <Receipt size={14} className="text-[#5b9dff]" /> Oxirgi to'lovlar
        </div>
        <button onClick={() => navigate("/owner/invoices")}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#5b9dff] hover:text-[#8bb8ff]">
          Barchasi <ChevronRight size={14} />
        </button>
      </div>

      {stats && stats.counts.overdue > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#dc2626]/30 bg-[#dc2626]/10 px-3 py-2 text-xs font-semibold text-[#f87171]">
          <AlertTriangle size={14} /> {stats.counts.overdue} ta to'lov muddati o'tgan — {fmtMoney(stats.overdue_amount)}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>
      ) : invoices.length === 0 ? (
        <div className="rounded-xl bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500">
          <button onClick={() => navigate("/owner/invoices")} className="inline-flex items-center gap-1.5 text-[#5b9dff] hover:underline">
            <Plus size={14} /> Birinchi to'lovni qo'shish
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {invoices.map((inv) => {
            const meta = STATUS[inv.status];
            const Icon = meta.icon;
            return (
              <button key={inv.id} onClick={() => navigate("/owner/invoices")}
                className="flex w-full items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]">
                <Icon size={16} style={{ color: meta.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{inv.title}</div>
                  <div className="text-xs text-slate-500">{inv.market_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-white">{fmtMoney(inv.amount, inv.currency)}</div>
                  <div className="text-[11px]" style={{ color: meta.color }}>{meta.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
