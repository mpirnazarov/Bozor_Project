/**
 * Kontragent (yuridik shaxs) modali — uning barcha magazinlari jadval
 * ko'rinishida: har magazin uchun hisob / to'langan / qarz.
 *
 * Xizmat turi tanlanadi (arenda — sukut, elektr, suv) va davr almashtiriladi
 * (joriy oy — sukut). Raqamlar blok modali bilan bir manbadan keladi.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getInn } from "@/api/inn";
import { STATUS_COLORS, fmtUZS } from "@/lib/utils";
import { Modal, Spinner } from "@/components/ui/Modal";
import { PeriodSwitch } from "@/components/ui/PeriodSwitch";
import type { ShopStatus } from "@/types/api";

type ServiceKey = "rent" | "electricity" | "water";
const SERVICES: { key: ServiceKey; label: string }[] = [
  { key: "rent", label: "Arenda" },
  { key: "electricity", label: "Elektr" },
  { key: "water", label: "Suv" },
];

const STATUS_LABEL: Record<string, string> = {
  paid: "To'langan",
  partial: "Qisman",
  unpaid: "To'lanmagan",
  no_data: "Ma'lumot yo'q",
  vacant: "Bo'sh",
};

interface Props {
  inn: string | null;
  onClose: () => void;
  /** Magazin modalini AYNAN shu davr uchun ochish. */
  onSelectShop: (shopId: string, year: number, month: number) => void;
}

export function InnDetailModal({ inn, onClose, onSelectShop }: Props) {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [service, setService] = useState<ServiceKey>("rent");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["inn-detail", inn, year, month],
    queryFn: () => getInn(inn!, year, month),
    enabled: !!inn,
  });

  // DIQQAT: elektr va suv monthly_balances'da INN DARAJASIDA saqlanadi —
  // magazinlarga bo'linmaydi. Backend o'sha bitta qiymatni INN ning HAR
  // magaziniga biriktiradi, shuning uchun ularni qo'shib bo'lmaydi
  // (4 magazinli INN da summa 4 barobar ko'p chiqardi). Bu xizmatlar uchun
  // bitta umumiy qator ko'rsatamiz.
  const innLevel = service !== "rent";

  const statusOf = (paid: number, debt: number): ShopStatus =>
    debt <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid";

  const rows = useMemo(() => {
    if (!data) return [];

    if (innLevel) {
      const cat = data.shops
        .map((s) => data.billing[s.shop_id]?.categories.find((c) => c.category === service))
        .find(Boolean);
      if (!cat) return [];
      const due = Number(cat.due);
      const paid = Number(cat.paid);
      const debt = Math.max(0, due - paid);
      return [{
        key: "inn-level",
        label: `Barcha magazinlar (${data.shops.length}) — INN bo'yicha`,
        shopId: null as string | null,
        due, paid, debt, present: true, status: statusOf(paid, debt),
      }];
    }

    return data.shops.map((s) => {
      const cat = data.billing[s.shop_id]?.categories.find((c) => c.category === "rent");
      // Kategoriya bo'lmasa magazinning belgilangan summasi ko'rsatiladi,
      // lekin holat "ma'lumot yo'q" bo'ladi — to'lov ma'lumoti yo'q.
      const present = !!cat;
      const due = cat ? Number(cat.due) : Number(s.monthly_rent ?? 0);
      const paid = cat ? Number(cat.paid) : 0;
      const debt = Math.max(0, due - paid);
      return {
        key: s.shop_id,
        label: s.shop_id,
        shopId: s.shop_id as string | null,
        due, paid, debt, present,
        status: present ? statusOf(paid, debt) : ("no_data" as ShopStatus),
      };
    });
  }, [data, service, innLevel]);

  const totals = useMemo(() => {
    const acc = { due: 0, paid: 0 };
    for (const r of rows) { acc.due += r.due; acc.paid += r.paid; }
    // Qarzdorlik = Jami − To'langan (blok modali va adminka hisoboti bilan bir xil)
    return { ...acc, debt: Math.max(0, acc.due - acc.paid) };
  }, [rows]);

  return (
    <Modal
      open={!!inn}
      onClose={onClose}
      title={data?.counterparty.name ?? "Yuklanmoqda..."}
      maxWidth="max-w-3xl"
    >
      {isLoading && <Spinner label="Ma'lumot yuklanmoqda..." />}

      {data && (
        <div className="space-y-3.5">
          {/* Kontragent ma'lumoti */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl bg-surface-muted px-3.5 py-2.5 text-xs">
            <span className="text-ink-faint">
              INN <b className="ml-1 font-mono text-ink">{data.counterparty.inn}</b>
            </span>
            <span className="text-ink-faint">
              Shartnoma <b className="ml-1 text-ink">{data.counterparty.contract_no ?? "—"}</b>
            </span>
            <span className="text-ink-faint">
              Magazinlar <b className="ml-1 text-ink">{data.shops.length}</b>
            </span>
          </div>

          <PeriodSwitch
            year={year} month={month} busy={isFetching}
            onChange={(y, m) => { setYear(y); setMonth(m); }}
          />

          {/* Xizmat turi */}
          <div className="flex flex-wrap items-center gap-1.5">
            {SERVICES.map((s) => (
              <button
                key={s.key}
                onClick={() => setService(s.key)}
                className="chip"
                style={service === s.key
                  ? { background: "#0066ff", color: "#fff" }
                  : { background: "#f1f5f9", color: "#475569" }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Umumiy summalar */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-surface-muted p-3">
              <div className="text-[11px] font-semibold text-ink-faint">Jami</div>
              <div className="tabnum text-base font-extrabold text-ink">{fmtUZS(totals.due)}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: "rgba(22,163,74,0.08)" }}>
              <div className="text-[11px] font-semibold text-ink-faint">To'langan</div>
              <div className="tabnum text-base font-extrabold text-status-paid">{fmtUZS(totals.paid)}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: "rgba(220,38,38,0.08)" }}>
              <div className="text-[11px] font-semibold text-ink-faint">Qarzdor</div>
              <div className="tabnum text-base font-extrabold text-status-unpaid">{fmtUZS(totals.debt)}</div>
            </div>
          </div>

          {/* Magazinlar jadvali */}
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="bg-surface-muted text-left text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-3 py-2 font-bold">Magazin</th>
                  <th className="px-3 py-2 text-right font-bold">Hisob</th>
                  <th className="px-3 py-2 text-right font-bold">To'langan</th>
                  <th className="px-3 py-2 text-right font-bold">Qarz</th>
                  <th className="px-3 py-2 font-bold">Holat</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr className="border-t border-slate-200/70">
                    <td colSpan={5} className="px-3 py-4 text-center text-ink-faint">
                      Bu davr uchun ma'lumot yo'q
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    onClick={() => r.shopId && onSelectShop(r.shopId, year, month)}
                    className={
                      "border-t border-slate-200/70 transition " +
                      (r.shopId ? "cursor-pointer hover:bg-brand/[0.04]" : "")
                    }
                  >
                    <td className={"px-3 py-2 font-semibold text-ink " + (r.shopId ? "font-mono" : "")}>
                      {r.label}
                    </td>
                    <td className="tabnum px-3 py-2 text-right text-ink">
                      {r.present || r.due > 0 ? fmtUZS(r.due) : "—"}
                    </td>
                    <td className="tabnum px-3 py-2 text-right font-semibold text-status-paid">
                      {r.present ? fmtUZS(r.paid) : "—"}
                    </td>
                    <td className="tabnum px-3 py-2 text-right font-semibold"
                        style={{ color: r.debt > 0 ? STATUS_COLORS.unpaid : STATUS_COLORS.paid }}>
                      {r.present ? (r.debt > 0 ? fmtUZS(r.debt) : "Qarzsiz") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{
                          background: `${STATUS_COLORS[r.status] ?? "#94a3b8"}1f`,
                          color: STATUS_COLORS[r.status] ?? "#94a3b8",
                        }}
                      >
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-surface-muted font-bold text-ink">
                  <td className="px-3 py-2">
                    {innLevel ? "Jami" : `Jami (${rows.length})`}
                  </td>
                  <td className="tabnum px-3 py-2 text-right">{fmtUZS(totals.due)}</td>
                  <td className="tabnum px-3 py-2 text-right text-status-paid">{fmtUZS(totals.paid)}</td>
                  <td className="tabnum px-3 py-2 text-right text-status-unpaid">{fmtUZS(totals.debt)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-[11px] text-ink-faint">
            {innLevel
              ? "Elektr va suv hisobi INN darajasida yuritiladi — magazinlar bo'yicha bo'linmaydi, shuning uchun bitta umumiy qator ko'rsatiladi."
              : "Magazin qatorini bosing — batafsil ma'lumot shu davr uchun ochiladi."}
          </p>
        </div>
      )}
    </Modal>
  );
}
