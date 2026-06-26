import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getShop } from "@/api/shops";
import { getShopHistory, type ShopHistoryEntry } from "@/api/shops";
import { fmtUZS, STATUS_COLORS } from "@/lib/utils";
import { useT } from "@/i18n/useT";
import { Modal, Spinner } from "@/components/ui/Modal";
import { ChevronDown, ChevronUp, History, UserCheck, UserX } from "lucide-react";

const CATEGORY_TKEY: Record<string, string> = {
  rent: "pav.service.rent",
  electricity: "pav.service.electricity",
  water: "pav.service.water",
};
const CATEGORY_ICON: Record<string, string> = { rent: "🏠", electricity: "⚡", water: "💧" };

interface Props {
  shopId: string | null;
  onClose: () => void;
}

export function ShopDetailModal({ shopId, onClose }: Props) {
  const t = useT();
  const [showHistory, setShowHistory] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["shop", shopId],
    queryFn: () => getShop(shopId!),
    enabled: !!shopId,
  });

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ["shop-history", shopId],
    queryFn: () => getShopHistory(shopId!),
    enabled: !!shopId && showHistory,
  });

  const isVacant = !data?.counterparty;

  return (
    <Modal open={!!shopId} onClose={onClose} title={shopId ?? ""} maxWidth="max-w-lg" zClass="z-[60]">
      {isLoading && <Spinner label="Yuklanmoqda..." />}
      {data && (
        <div className="space-y-4">
          {/* Egasi holati */}
          {isVacant ? (
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500">
              <UserX size={16} />
              Bo'sh do'kon — egasi yo'q
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-status-paid/10 px-4 py-3 text-sm font-semibold text-status-paid">
              <UserCheck size={16} />
              {data.counterparty!.name}
            </div>
          )}

          {/* Qarz holati */}
          {data.billing && Number(data.billing.total_debt) > 0 && (
            <div
              className="rounded-lg px-4 py-2.5 text-sm font-bold text-white"
              style={{
                background: data.billing.status === "partial"
                  ? STATUS_COLORS.partial
                  : STATUS_COLORS.unpaid,
              }}
            >
              {data.billing.status === "partial" ? "Qisman to'langan" : "Qarzi bor"}
              <span className="float-right font-mono">
                {t("shop.debtLabel")}: {fmtUZS(Number(data.billing.total_debt))}
              </span>
            </div>
          )}

          {/* Asosiy ma'lumotlar */}
          <div className="card p-3 text-sm">
            <Row label={t("shop.shopId")} value={data.shop.shop_id} mono />
            <Row label={t("shop.pavilion")} value={data.shop.pavilion_code ?? "—"} />
            <Row label={t("shop.type")} value={data.shop.shop_type ?? "—"} />
            <Row label={t("shop.rent")} value={fmtUZS(data.shop.monthly_rent)} mono />
            {data.counterparty && (
              <>
                <Row label={t("shop.counterparty")} value={data.counterparty.name} />
                <Row label={t("shop.inn")} value={data.counterparty.inn} mono />
                <Row label={t("shop.contract")} value={data.counterparty.contract_no ?? "—"} />
                <Row label={t("shop.date")} value={data.counterparty.contract_date ?? "—"} />
                {data.counterparty.phone && (
                  <Row label={t("shop.phone")} value={data.counterparty.phone} />
                )}
              </>
            )}
          </div>

          {/* To'lovlar */}
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">
              {t("shop.paymentBreakdown")}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(["rent", "electricity", "water"] as const).map((cat) => {
                const c = data.billing?.categories.find((x) => x.category === cat);
                const due = Number(c?.due ?? 0);
                const paid = Number(c?.paid ?? 0);
                const debt = Math.max(0, due - paid);
                const hasData = due > 0 || paid > 0;
                return (
                  <div key={cat} className="card p-3">
                    <div className="text-xs font-bold text-ink-soft">
                      {CATEGORY_ICON[cat]} {t(CATEGORY_TKEY[cat])}
                    </div>
                    {hasData ? (
                      <>
                        <div className="mt-1 font-mono text-xs text-ink-faint">
                          {t("shop.account")}: {fmtUZS(due)}
                        </div>
                        <div className="font-mono text-xs text-ink-faint">
                          {t("common.paid")}: {fmtUZS(paid)}
                        </div>
                        <div
                          className="mt-1 font-mono text-sm font-bold"
                          style={{ color: debt > 0 ? STATUS_COLORS.unpaid : STATUS_COLORS.paid }}
                        >
                          {debt > 0 ? `${t("shop.debtLabel")}: ${fmtUZS(debt)}` : t("shop.noDebt")}
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 text-xs text-ink-faint">{t("shop.noData")}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tarix */}
          <div>
            <button
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-slate-100"
              onClick={() => setShowHistory((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <History size={15} className="text-brand" />
                Egalik tarixi
              </span>
              {showHistory ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {showHistory && (
              <div className="mt-2">
                {histLoading && <Spinner label="Yuklanmoqda..." />}
                {history && history.length === 0 && (
                  <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-ink-faint">
                    Tarix yo'q — bu do'kon hali hech kimga bog'lanmagan
                  </div>
                )}
                {history && history.length > 0 && (
                  <div className="space-y-2">
                    {history.map((h) => (
                      <HistoryRow key={h.id} entry={h} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function HistoryRow({ entry }: { entry: ShopHistoryEntry }) {
  const date = entry.changed_at
    ? new Date(entry.changed_at).toLocaleDateString("uz-UZ", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

  const isVacated = !entry.new_inn;
  const isAssigned = !entry.old_inn;

  return (
    <div className={`rounded-xl border px-3 py-2.5 text-xs ${
      isVacated ? "border-slate-200 bg-slate-50" : "border-status-paid/20 bg-status-paid/5"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold">
          {isVacated ? (
            <><UserX size={12} className="text-slate-400" /> Bo'shatildi</>
          ) : isAssigned ? (
            <><UserCheck size={12} className="text-status-paid" /> Yangi egasi tayinlandi</>
          ) : (
            <><UserCheck size={12} className="text-brand" /> Egasi o'zgartirildi</>
          )}
        </div>
        <span className="font-mono text-ink-faint">{date}</span>
      </div>

      {entry.old_inn && (
        <div className="mt-1.5 text-ink-soft">
          <span className="text-ink-faint">Oldin: </span>
          <span className="font-semibold">{entry.old_name ?? entry.old_inn}</span>
          <span className="ml-1 font-mono text-ink-faint">({entry.old_inn})</span>
        </div>
      )}
      {entry.new_inn && (
        <div className="mt-0.5 text-ink-soft">
          <span className="text-ink-faint">Keyin: </span>
          <span className="font-semibold">{entry.new_name ?? entry.new_inn}</span>
          <span className="ml-1 font-mono text-ink-faint">({entry.new_inn})</span>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-50 py-1.5 last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className={`text-right font-semibold text-slate-700 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
