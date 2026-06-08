import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock, AlertTriangle, Paperclip, Calendar, X,
} from "lucide-react";
import { getMarketInvoices, marketInvoiceDocUrl } from "@/api/dashboard";

const STATUS = {
  paid:    { label: "To'langan",      color: "#16a34a", bg: "#16a34a14", icon: Clock },
  partial: { label: "Qisman to'langan", color: "#0ea5e9", bg: "#0ea5e914", icon: Clock },
  pending: { label: "Kutilmoqda",     color: "#b45309", bg: "#eab30814", icon: Clock },
  overdue: { label: "Muddati o'tgan", color: "#dc2626", bg: "#dc262614", icon: AlertTriangle },
} as const;

function fmtMoney(n: number, cur = "UZS") {
  return new Intl.NumberFormat("uz-UZ").format(n) + " " + cur;
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Bosh sahifada FAQAT 3 kun ichida to'lash kerak bo'lgan (yoki muddati o'tgan)
// to'lanmagan to'lovlar chiqadi. Foydalanuvchi X bilan yopishi mumkin.
export function MarketInvoicesSection() {
  const [closed, setClosed] = useState(false);
  const { data } = useQuery({
    queryKey: ["market-invoices"],
    queryFn: () => getMarketInvoices(),
    refetchInterval: 60_000,
    retry: false,
  });

  const invoices = data?.invoices || [];

  // 3 kun ichida deadline yoki allaqachon muddati o'tgan, va to'lanmagan
  const urgent = invoices.filter((inv) => {
    if (inv.is_paid) return false;
    if (inv.status === "overdue") return true;
    return inv.days_left != null && inv.days_left >= 0 && inv.days_left <= 3;
  });

  if (closed || urgent.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-300/70 bg-amber-50/80 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 border-b border-amber-200/70 bg-amber-100/60 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-amber-800">
          <AlertTriangle size={16} /> Tez orada to'lov kerak ({urgent.length})
        </h2>
        <button onClick={() => setClosed(true)} title="Yopish"
          className="grid h-7 w-7 place-items-center rounded-lg text-amber-700 transition-colors hover:bg-amber-200/70">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2 p-3">
        {urgent.map((inv) => {
          const meta = STATUS[inv.status];
          const Icon = meta.icon;
          return (
            <div key={inv.id} className="rounded-xl border bg-white/70 p-3"
              style={{ borderColor: meta.color + "33" }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: meta.bg, color: meta.color }}>
                    <Icon size={11} /> {meta.label}
                  </span>
                  <h3 className="mt-1 font-semibold text-ink">{inv.title}</h3>
                  {inv.description && <p className="mt-0.5 text-sm text-ink-soft">{inv.description}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} /> Muddat: {fmtDate(inv.due_date)}
                      {inv.status === "overdue" && inv.days_left != null && (
                        <span className="font-bold text-red-600"> ({Math.abs(inv.days_left)} kun o'tdi)</span>
                      )}
                      {(inv.status === "pending" || inv.status === "partial") && inv.days_left != null && inv.days_left >= 0 && (
                        <span className="font-semibold text-amber-700"> ({inv.days_left} kun qoldi)</span>
                      )}
                    </span>
                    {inv.has_doc && (
                      <a href={marketInvoiceDocUrl(inv.id)} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-brand hover:underline">
                        <Paperclip size={12} /> {inv.doc_name || "Hujjat"}
                      </a>
                    )}
                  </div>
                </div>
                <div className="font-display text-lg font-extrabold text-ink">{fmtMoney(inv.amount, inv.currency)}</div>
              </div>
            </div>
          );
        })}
        <p className="px-1 pt-1 text-[11px] text-amber-700/80">
          Barcha to'lovlar ro'yxati «To'lovlar» bo'limida (Admin panel).
        </p>
      </div>
    </section>
  );
}
