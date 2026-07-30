import { useQuery } from "@tanstack/react-query";
import { Modal, Spinner } from "@/components/ui/Modal";
import { listInfraShops, getInfraShop, type InfraShopDetail } from "@/api/infra";
import { fmtUZS } from "@/lib/utils";

const MONTHS = ["Yanvar","Fevral","Mart","Aprel","May","Iyun",
                 "Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr"];

interface Props {
  infraShop: { id: number; name: string } | null;
  onClose: () => void;
}

export function InfraShopModal({ infraShop, onClose }: Props) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // id=0 bo'lsa name bo'yicha qidirамиз
  const { data: shops } = useQuery({
    queryKey: ["infra-shops"],
    queryFn: listInfraShops,
    enabled: !!infraShop && infraShop.id === 0,
  });

  const resolvedId = infraShop?.id === 0
    ? shops?.find((s) => s.name === infraShop?.name)?.id ?? null
    : infraShop?.id ?? null;

  const { data: detail, isLoading } = useQuery<InfraShopDetail>({
    queryKey: ["infra-shop", resolvedId],
    queryFn: () => getInfraShop(resolvedId!),
    enabled: !!resolvedId,
  });

  const currentBillings = detail?.billings.filter(
    (b) => b.year === year && b.month === month
  ) ?? [];

  const waterEnabled = detail?.shop.water_enabled !== false;

  const cats = [
    { key: "rent", label: "🏠 Arenda" },
    { key: "electricity", label: "⚡ Elektr" },
    ...(waterEnabled ? [{ key: "water", label: "💧 Suv" }] : []),
  ];

  return (
    <Modal
      open={!!infraShop}
      onClose={onClose}
      title={infraShop?.name ?? ""}
      maxWidth="max-w-lg"
      zClass="z-[60]"
    >
      {(isLoading || (!resolvedId && infraShop?.id === 0)) && <Spinner />}

      {!isLoading && resolvedId && detail && (
        <div className="space-y-4">
          {/* Info */}
          <div className="card p-3 text-sm">
            {detail.shop.contract_no && (
              <div className="flex justify-between py-1">
                <span className="text-ink-faint">Shartnoma</span>
                <span className="font-semibold text-ink">{detail.shop.contract_no}</span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-ink-faint">Oylik ijara</span>
              <span className="font-semibold text-ink">{fmtUZS(detail.shop.monthly_rent)}</span>
            </div>
          </div>

          {/* Joriy oy to'lovlari */}
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">
              TO'LOV TARKIBI — {MONTHS[month - 1]} {year}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {cats.map((cat) => {
                const b = currentBillings.find((x) => x.category === cat.key);
                const due = b?.due_amount ?? 0;
                const paid = b?.paid_amount ?? 0;
                const debt = Math.max(0, due - paid);
                const hasData = due > 0 || paid > 0;
                return (
                  <div key={cat.key} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                    <div className="mb-1 font-bold text-ink">{cat.label}</div>
                    {!hasData ? (
                      <div className="text-ink-faint">Ma'lumot yo'q</div>
                    ) : (
                      <>
                        <div className="text-ink-soft">Hisob: {fmtUZS(due)}</div>
                        <div className="text-ink-soft">To'langan: {fmtUZS(paid)}</div>
                        {debt > 0 ? (
                          <div className="mt-1 font-bold text-status-unpaid">Qarz: {fmtUZS(debt)}</div>
                        ) : paid > due && paid > 0 ? (
                          <div className="mt-1 font-bold text-blue-600">Avans: +{fmtUZS(paid - due)}</div>
                        ) : (
                          <div className="mt-1 font-bold text-status-paid">Qarzsiz</div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {!waterEnabled && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-ink-faint">
              💧 Bu infra do'kon uchun suv hisobi yo'q
            </div>
          )}
        </div>
      )}

      {!isLoading && !resolvedId && (
        <div className="py-6 text-center text-sm text-ink-faint">
          Bu infra do'kon hali tizimda ro'yxatga olinmagan.
        </div>
      )}
    </Modal>
  );
}
