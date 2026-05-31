import { useQuery } from "@tanstack/react-query";
import { getShop } from "@/api/shops";
import { fmtUZS, STATUS_COLORS } from "@/lib/utils";
import { useT } from "@/i18n/useT";
import { Modal, Spinner } from "@/components/ui/Modal";

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
  const { data, isLoading } = useQuery({
    queryKey: ["shop", shopId],
    queryFn: () => getShop(shopId!),
    enabled: !!shopId,
  });

  return (
    <Modal open={!!shopId} onClose={onClose} title={shopId ?? ""} maxWidth="max-w-lg">
      {isLoading && <Spinner label="Yuklanmoqda..." />}
      {data && (
        <div className="space-y-4">
          {data.billing && (
            <div
              className="rounded-lg px-4 py-2.5 text-sm font-bold text-white"
              style={{ background: STATUS_COLORS[data.billing.status] }}
            >
              {t("pav.status." + data.billing.status)}
              {data.billing.status !== "no_data" && (
                <span className="float-right font-mono">
                  {t("shop.debtLabel")}: {fmtUZS(data.billing.total_debt)}
                </span>
              )}
            </div>
          )}

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
        </div>
      )}
    </Modal>
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
