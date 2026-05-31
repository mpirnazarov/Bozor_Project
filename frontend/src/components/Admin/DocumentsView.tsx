import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, FileText } from "lucide-react";
import { getMarketSupportStatus } from "@/api/owner";
import { apiClient } from "@/api/client";
import { fmtUZS } from "@/lib/utils";

const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

interface MyPaymentRow {
  year: number;
  month: number;
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
}

// Bozor admini o'z to'lov tarixini ko'radi (read-only)
async function getMyPayments(): Promise<MyPaymentRow[]> {
  const { data } = await apiClient.get<MyPaymentRow[]>("/settings/my-support-payments");
  return Array.isArray(data) ? data : [];
}

export function DocumentsView() {
  const { data: status } = useQuery({ queryKey: ["support-status"], queryFn: getMarketSupportStatus, retry: false });
  const { data: payments } = useQuery({ queryKey: ["my-payments"], queryFn: getMyPayments, retry: false });

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Tizim texnik qo'llab-quvvatlash (tex-podderjka) to'lovlari tarixi.
      </p>

      {/* Joriy holat */}
      {status && (
        <div className="card flex flex-wrap items-center gap-4 p-4">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
            <FileText size={20} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold uppercase text-ink-faint">Joriy holat</div>
            {status.free_period ? (
              <div className="font-bold text-brand">Bepul davr ({status.free_until} gacha)</div>
            ) : status.paid_this_month ? (
              <div className="font-bold text-status-paid">Bu oy uchun to'langan</div>
            ) : (
              <div className="font-bold text-status-unpaid">Bu oy uchun to'lanmagan</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-faint">Oylik to'lov</div>
            <div className="font-mono font-extrabold text-ink">{fmtUZS(status.monthly_fee)}</div>
          </div>
        </div>
      )}

      {/* To'lovlar jadvali */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold text-ink-faint">
            <tr>
              <th className="px-4 py-2.5">Davr</th>
              <th className="px-4 py-2.5">Summa</th>
              <th className="px-4 py-2.5">Holat</th>
              <th className="px-4 py-2.5">To'langan sana</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {payments && payments.length > 0 ? (
              payments.map((p) => (
                <tr key={`${p.year}-${p.month}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-ink">{MONTHS[p.month - 1]} {p.year}</td>
                  <td className="px-4 py-3 font-mono text-ink-soft">{fmtUZS(p.amount)}</td>
                  <td className="px-4 py-3">
                    {p.is_paid ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-status-paid">
                        <CheckCircle2 size={15} /> To'langan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-status-unpaid">
                        <XCircle size={15} /> To'lanmagan
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-faint">
                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString("uz-UZ") : "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-faint">
                  Hozircha to'lov yozuvlari yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
