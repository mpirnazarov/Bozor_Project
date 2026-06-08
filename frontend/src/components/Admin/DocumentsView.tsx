import { useQuery } from "@tanstack/react-query";
import {
  Receipt, CircleCheck, Clock, AlertTriangle, Paperclip, Calendar, History, Wallet,
} from "lucide-react";
import { getMarketInvoices, marketInvoiceDocUrl } from "@/api/dashboard";
import { fmtUZS } from "@/lib/utils";

const STATUS = {
  paid:    { label: "To'langan",      color: "#16a34a", bg: "#16a34a14", icon: CircleCheck },
  partial: { label: "Qisman to'langan", color: "#0ea5e9", bg: "#0ea5e914", icon: Clock },
  pending: { label: "Kutilmoqda",     color: "#b45309", bg: "#eab30814", icon: Clock },
  overdue: { label: "Muddati o'tgan", color: "#dc2626", bg: "#dc262614", icon: AlertTriangle },
} as const;

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Bozor admini o'z to'lovlarini ko'radi (read-only)
export function DocumentsView() {
  const { data } = useQuery({
    queryKey: ["market-invoices"],
    queryFn: () => getMarketInvoices(),
    refetchInterval: 60_000,
    retry: false,
  });

  const invoices = data?.invoices || [];
  const stats = data?.stats;
  const toPay = invoices.filter((i) => !i.is_paid);
  const paid = invoices.filter((i) => i.is_paid);

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">
        Tizim egasi tomonidan qo'yilgan to'lovlar. To'lanishi kerak bo'lganlar va to'langan tarix.
      </p>

      {/* Statistika */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatBox label="Jami summa" value={fmtUZS(stats.total_amount)} accent="#0066ff" icon={<Wallet size={16} />} count={stats.count} />
          <StatBox label="To'langan" value={fmtUZS(stats.paid_amount)} accent="#16a34a" icon={<CircleCheck size={16} />} count={stats.counts.paid} />
          <StatBox label="Kutilmoqda" value={fmtUZS(stats.pending_amount)} accent="#b45309" icon={<Clock size={16} />} count={stats.counts.pending} />
          <StatBox label="Muddati o'tgan" value={fmtUZS(stats.overdue_amount)} accent="#dc2626" icon={<AlertTriangle size={16} />} count={stats.counts.overdue} />
        </div>
      )}

      {/* To'lanishi kerak */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
          <Receipt size={16} className="text-brand" /> To'lanishi kerak ({toPay.length})
        </h3>
        {toPay.length === 0 ? (
          <div className="card px-4 py-6 text-center text-sm text-ink-faint">
            To'lanmagan to'lov yo'q — hammasi joyida.
          </div>
        ) : (
          <div className="space-y-2">
            {toPay.map((inv) => {
              const meta = STATUS[inv.status === "paid" ? "pending" : inv.status];
              const Icon = meta.icon;
              const hasPartial = inv.paid_amount > 0;
              const pct = inv.amount > 0 ? Math.min(100, Math.round((inv.paid_amount / inv.amount) * 100)) : 0;
              return (
                <div key={inv.id} className="rounded-xl border p-3" style={{ borderColor: meta.color + "33", background: meta.bg }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold" style={{ color: meta.color }}>
                        <Icon size={11} /> {meta.label}
                      </span>
                      {inv.kind === "support" && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">Tex-podderjka</span>
                      )}
                      {inv.payment_method === "cash" && (
                        <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Naqd</span>
                      )}
                      {inv.payment_method === "contract" && (
                        <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Dogovor{inv.contract_no ? ` #${inv.contract_no}` : ""}</span>
                      )}
                      <h4 className="mt-1 font-semibold text-ink">{inv.title}</h4>
                      {inv.description && <p className="mt-0.5 text-sm text-ink-soft">{inv.description}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} /> Muddat: {fmtDate(inv.due_date)}
                          {inv.status === "overdue" && inv.days_left != null && (
                            <span className="font-bold text-red-600"> ({Math.abs(inv.days_left)} kun o'tdi)</span>
                          )}
                          {(inv.status === "pending" || inv.status === "partial") && inv.days_left != null && inv.days_left >= 0 && (
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
                      {hasPartial && (
                        <div className="mt-2">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-sky-600">To'langan: {fmtUZS(inv.paid_amount)}</span>
                            <span className="text-ink-soft">Qoldi: <b className="text-ink">{fmtUZS(inv.remaining)}</b></span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full rounded-full bg-sky-500" style={{ width: pct + "%" }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="font-display text-lg font-extrabold text-ink">{fmtUZS(inv.amount)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* To'langan tarix */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
          <History size={16} className="text-ink-faint" /> To'langan tarix ({paid.length})
        </h3>
        {paid.length === 0 ? (
          <div className="card px-4 py-6 text-center text-sm text-ink-faint">
            Hali to'langan to'lov yo'q
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold text-ink-faint">
                <tr>
                  <th className="px-4 py-2.5">Nima uchun</th>
                  <th className="px-4 py-2.5">Summa</th>
                  <th className="px-4 py-2.5">To'langan sana</th>
                  <th className="px-4 py-2.5">Hujjat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paid.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-ink">{inv.title}</td>
                    <td className="px-4 py-3 font-mono text-ink-soft">{fmtUZS(inv.amount)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-faint">{fmtDate(inv.paid_at)}</td>
                    <td className="px-4 py-3">
                      {inv.has_doc ? (
                        <a href={marketInvoiceDocUrl(inv.id)} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-brand hover:underline">
                          <Paperclip size={13} /> Ko'rish
                        </a>
                      ) : <span className="text-ink-faint">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, accent, icon, count }: {
  label: string; value: string; accent: string; icon: React.ReactNode; count: number;
}) {
  return (
    <div className="card p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color: accent }}>
        <span className="grid h-6 w-6 place-items-center rounded-lg" style={{ background: accent + "1a" }}>{icon}</span>
        {label}
      </div>
      <div className="font-display text-base font-extrabold text-ink">{value}</div>
      <div className="text-[11px] text-ink-faint">{count} ta</div>
    </div>
  );
}
