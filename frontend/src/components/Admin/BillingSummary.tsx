import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBillingSummary } from "@/api/admin";
import { fmtUZS } from "@/lib/utils";
import { useT } from "@/i18n/useT";

const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

export function BillingSummary() {
  const t = useT();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["billing-summary", year, month],
    queryFn: () => getBillingSummary(year, month),
  });

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  return (
    <div>
      {/* Oy/yil tanlash */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t("summary.year") || "Yil"}
          </label>
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t("summary.month") || "Oy"}
          </label>
          <select className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {isLoading && <div className="py-10 text-center text-ink-soft">Yuklanmoqda...</div>}
      {isError && <div className="py-10 text-center text-status-unpaid">Xatolik yuz berdi</div>}

      {data && !data.has_data && (
        <div className="rounded-2xl border border-white/60 bg-white/70 py-12 text-center shadow-soft">
          <div className="text-base font-bold text-ink">
            {MONTHS[month - 1]} {year} — {t("summary.noData") || "ma'lumot yo'q"}
          </div>
          <div className="mt-1 text-sm text-ink-soft">
            {t("summary.noDataHint") || "Bu oy uchun billing ma'lumoti yuklanmagan"}
          </div>
        </div>
      )}

      {data && data.has_data && (
        <>
          {/* Umumiy summalar */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <SummaryCard label={t("common.total") || "Jami"} value={data.total.total_due} tone="ink" />
            <SummaryCard label={t("common.paid") || "To'langan"} value={data.total.total_paid} tone="paid" />
            <SummaryCard label={t("common.debt") || "Qarzdorlik"} value={data.total.total_debt} tone="debt" />
          </div>
          <div className="mb-6 text-sm text-ink-soft">
            {MONTHS[month - 1]} {year} · {data.total.block_count} blok · {data.total.shop_count} magazin
          </div>

          {/* Layoutlar (qavatlar) bo'yicha */}
          {data.layers.length > 1 && (
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-faint">
                {t("summary.byLayer") || "Qavatlar bo'yicha"}
              </h3>
              <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/70 shadow-soft">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-ink-faint">
                      <th className="p-3 font-semibold">{t("summary.layer") || "Qavat"}</th>
                      <th className="p-3 text-right font-semibold">Bloklar</th>
                      <th className="p-3 text-right font-semibold">{t("common.total") || "Jami"}</th>
                      <th className="p-3 text-right font-semibold">{t("common.paid") || "To'langan"}</th>
                      <th className="p-3 text-right font-semibold">{t("common.debt") || "Qarz"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.layers.map((l) => (
                      <tr key={String(l.layer_id)} className="border-b border-ink/5 last:border-0">
                        <td className="p-3 font-semibold text-ink">{l.name}</td>
                        <td className="tabnum p-3 text-right text-ink-soft">{l.block_count}</td>
                        <td className="tabnum p-3 text-right font-semibold text-ink">{fmtUZS(l.total_due)}</td>
                        <td className="tabnum p-3 text-right text-status-paid">{fmtUZS(l.total_paid)}</td>
                        <td className="tabnum p-3 text-right text-status-unpaid">{fmtUZS(l.total_debt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "ink" | "paid" | "debt" }) {
  const bg = tone === "paid" ? "rgba(22,163,74,0.08)" : tone === "debt" ? "rgba(220,38,38,0.08)" : "var(--surface-muted, #f1f5f9)";
  const color = tone === "paid" ? "text-status-paid" : tone === "debt" ? "text-status-unpaid" : "text-ink";
  return (
    <div className="rounded-2xl p-4" style={{ background: bg }}>
      <div className="text-[11px] font-semibold text-ink-faint">{label}</div>
      <div className={`tabnum mt-1 text-lg font-extrabold ${color}`}>{fmtUZS(value)}</div>
    </div>
  );
}
