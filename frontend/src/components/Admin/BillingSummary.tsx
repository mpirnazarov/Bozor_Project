import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBillingSummary, getReportDetail } from "@/api/admin";
import { fmtUZS } from "@/lib/utils";
import { useT } from "@/i18n/useT";
import { MONTHS, PeriodSwitch } from "@/components/ui/PeriodSwitch";

export function BillingSummary() {
  const t = useT();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["billing-summary", year, month],
    queryFn: () => getBillingSummary(year, month),
  });

  // Batafsil taqsimot — admin sozlamasi (default: yoqilgan)
  const { data: reportDetail } = useQuery({
    queryKey: ["report-detail"],
    queryFn: getReportDetail,
  });
  const showDetail = reportDetail ?? true;

  // Umumiy summa BARCHA xizmatlar bo'yicha; eski javobda grand_total
  // bo'lmasa arendaga qaytamiz.
  const overall = data?.grand_total ?? data?.total ?? { total_due: 0, total_paid: 0, total_debt: 0 };

  return (
    <div>
      {/* Davr tanlash — blok/INN modallaridagi bilan bir xil ko'rinish */}
      <div className="mb-5">
        <PeriodSwitch
          year={year}
          month={month}
          busy={isFetching}
          onChange={(y, m) => { setYear(y); setMonth(m); }}
        />
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
          {/* Umumiy summalar — BARCHA xizmatlar bo'yicha (arenda + elektr +
              suv + infra + xojatxona). Avval faqat arenda ko'rsatilardi. */}
          <div className="mb-2 grid grid-cols-3 gap-3">
            <SummaryCard label={t("common.total") || "Jami"} value={overall.total_due} tone="ink" />
            <SummaryCard label={t("common.paid") || "To'langan"} value={overall.total_paid} tone="paid" />
            {overall.total_paid > overall.total_due
              ? <SummaryCard label="Avans" value={overall.total_paid - overall.total_due} tone="avans" />
              : <SummaryCard label={t("common.debt") || "Qarzdorlik"} value={overall.total_debt} tone="debt" />
            }
          </div>
          <div className="mb-6 text-sm text-ink-soft">
            {MONTHS[month - 1]} {year} · {data.total.block_count} blok · {data.total.shop_count} magazin
            {data.services && (
              <> · shundan arenda <b className="text-ink">{fmtUZS(data.total.total_due)}</b></>
            )}
          </div>

          {/* Xizmatlar bo'yicha taqsimot — admin sozlamasidan o'chirsa bo'ladi */}
          {showDetail && data.services && data.services.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-faint">
                Xizmatlar bo'yicha
              </h3>
              <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/70 shadow-soft">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint">
                      <th className="px-4 py-2.5 font-bold">Xizmat</th>
                      <th className="px-4 py-2.5 text-right font-bold">Hisob</th>
                      <th className="px-4 py-2.5 text-right font-bold">To'langan</th>
                      <th className="px-4 py-2.5 text-right font-bold">Qarzdorlik</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.services.map((s) => (
                      <tr key={s.key} className="border-t border-slate-200/60">
                        <td className="px-4 py-2.5 font-semibold text-ink">{s.name}</td>
                        <td className="tabnum px-4 py-2.5 text-right text-ink">{fmtUZS(s.total_due)}</td>
                        <td className="tabnum px-4 py-2.5 text-right font-semibold text-status-paid">
                          {fmtUZS(s.total_paid)}
                        </td>
                        <td className="tabnum px-4 py-2.5 text-right font-semibold text-status-unpaid">
                          {s.total_debt > 0 ? fmtUZS(s.total_debt) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-extrabold text-ink">
                      <td className="px-4 py-2.5">JAMI</td>
                      <td className="tabnum px-4 py-2.5 text-right">{fmtUZS(overall.total_due)}</td>
                      <td className="tabnum px-4 py-2.5 text-right text-status-paid">{fmtUZS(overall.total_paid)}</td>
                      <td className="tabnum px-4 py-2.5 text-right text-status-unpaid">{fmtUZS(overall.total_debt)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-ink-faint">
                Elektr va suv INN darajasida, infra do'konlar va xojatxonalar esa
                xaritadagi bloklarga tegishli emas — shuning uchun ular quyidagi
                bloklar jadvaliga kirmaydi. Xojatxona qatori tushumni bildiradi.
              </p>
            </div>
          )}

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
                        <td className="tabnum p-3 text-right">
                          {l.total_paid > l.total_due
                            ? <span className="text-blue-600">+{fmtUZS(l.total_paid - l.total_due)}</span>
                            : <span className="text-status-unpaid">{fmtUZS(Math.max(0, l.total_due - l.total_paid))}</span>
                          }
                        </td>
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

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "ink" | "paid" | "debt" | "avans" }) {
  const bg = tone === "paid" ? "rgba(22,163,74,0.08)" : tone === "debt" ? "rgba(220,38,38,0.08)" : tone === "avans" ? "rgba(37,99,235,0.08)" : "var(--surface-muted, #f1f5f9)";
  const color = tone === "paid" ? "text-status-paid" : tone === "debt" ? "text-status-unpaid" : tone === "avans" ? "text-blue-600" : "text-ink";
  return (
    <div className="rounded-2xl p-4" style={{ background: bg }}>
      <div className="text-[11px] font-semibold text-ink-faint">{label}</div>
      <div className={`tabnum mt-1 text-lg font-extrabold ${color}`}>{fmtUZS(value)}</div>
    </div>
  );
}
