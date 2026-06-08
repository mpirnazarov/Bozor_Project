import { useQuery } from "@tanstack/react-query";
import {
  Receipt, CircleCheck, Clock, AlertTriangle, Paperclip, Calendar,
} from "lucide-react";
import { getMarketInvoices, marketInvoiceDocUrl } from "@/api/dashboard";

const STATUS = {
  paid:    { label: "To'langan",      color: "#16a34a", bg: "#16a34a14", icon: CircleCheck },
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

export function MarketInvoicesSection() {
  const { data } = useQuery({
    queryKey: ["market-invoices"],
    queryFn: () => getMarketInvoices(),
    refetchInterval: 60_000,
  });

  const invoices = data?.invoices || [];
  if (invoices.length === 0) return null;

  const unpaid = invoices.filter((i) => i.status !== "paid");
  const overdue = invoices.filter((i) => i.status === "overdue");

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-base font-extrabold text-ink">
          <Receipt size={18} className="text-brand" /> To'lovlar
        </h2>
        {unpaid.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
            {unpaid.length} ta to'lanmagan
          </span>
        )}
      </div>

      {overdue.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          <AlertTriangle size={16} className="shrink-0" />
          {overdue.length} ta to'lov muddati o'tgan! Iltimos, tezroq to'lang.
        </div>
      )}

      <div className="space-y-2">
        {invoices.map((inv) => {
          const meta = STATUS[inv.status];
          const Icon = meta.icon;
          return (
            <div key={inv.id} className="rounded-xl border p-3"
              style={{ borderColor: `${meta.color}33`, background: meta.bg }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: "#fff", color: meta.color }}>
                      <Icon size={11} /> {meta.label}
                    </span>
                  </div>
                  <h3 className="mt-1 font-semibold text-ink">{inv.title}</h3>
                  {inv.description && <p className="mt-0.5 text-sm text-ink-soft">{inv.description}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} /> Muddat: {fmtDate(inv.due_date)}
                      {inv.status === "overdue" && inv.days_left != null && (
                        <span className="font-bold text-red-600"> ({Math.abs(inv.days_left)} kun o'tdi)</span>
                      )}
                      {inv.status === "pending" && inv.days_left != null && inv.days_left >= 0 && (
                        <span className="text-amber-600"> ({inv.days_left} kun qoldi)</span>
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
                <div className="text-right">
                  <div className="font-display text-lg font-extrabold text-ink">{fmtMoney(inv.amount, inv.currency)}</div>
                  {inv.is_paid && inv.paid_at && <div className="text-[11px] text-green-600">{fmtDate(inv.paid_at)} da to'landi</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
