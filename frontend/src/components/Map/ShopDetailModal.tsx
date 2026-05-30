import { useQuery } from "@tanstack/react-query";
import { getShop } from "@/api/shops";
import { fmtUZS, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils";
import { Modal, Spinner } from "@/components/ui/Modal";

const CATEGORY_LABELS: Record<string, string> = {
  rent: "🏠 Arenda",
  electricity: "⚡ Elektr",
  water: "💧 Suv",
};

interface Props {
  shopId: string | null;
  onClose: () => void;
}

export function ShopDetailModal({ shopId, onClose }: Props) {
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
              {STATUS_LABELS[data.billing.status]}
              {data.billing.status !== "no_data" && (
                <span className="float-right font-mono">
                  Qarz: {fmtUZS(data.billing.total_debt)}
                </span>
              )}
            </div>
          )}

          <div className="card p-3 text-sm">
            <Row label="Magazin ID" value={data.shop.shop_id} mono />
            <Row label="Pavilion" value={data.shop.pavilion_code ?? "—"} />
            <Row label="Tur" value={data.shop.shop_type ?? "—"} />
            <Row label="Oylik ijara" value={fmtUZS(data.shop.monthly_rent)} mono />
            {data.counterparty && (
              <>
                <Row label="Kontragent" value={data.counterparty.name} />
                <Row label="INN" value={data.counterparty.inn} mono />
                <Row label="Shartnoma" value={data.counterparty.contract_no ?? "—"} />
                <Row label="Sana" value={data.counterparty.contract_date ?? "—"} />
                {data.counterparty.phone && (
                  <Row label="Telefon" value={data.counterparty.phone} />
                )}
              </>
            )}
          </div>

          {data.billing && data.billing.categories.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {data.billing.categories.map((c) => {
                const debt = Number(c.debt);
                return (
                  <div key={c.category} className="card p-3">
                    <div className="text-xs font-semibold text-slate-500">
                      {CATEGORY_LABELS[c.category] ?? c.category}
                    </div>
                    <div className="mt-1 font-mono text-xs text-slate-400">
                      Hisob: {fmtUZS(c.due)}
                    </div>
                    <div className="font-mono text-xs text-slate-400">
                      To'langan: {fmtUZS(c.paid)}
                    </div>
                    <div
                      className="mt-1 font-mono text-sm font-bold"
                      style={{ color: debt > 0 ? STATUS_COLORS.unpaid : STATUS_COLORS.paid }}
                    >
                      {debt > 0 ? `Qarz: ${fmtUZS(debt)}` : "Qarzsiz"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
