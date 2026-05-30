import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPavilionShops } from "@/api/pavilions";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/utils";
import { Modal, Spinner } from "@/components/ui/Modal";
import type { ShopStatus } from "@/types/api";

interface Props {
  pavilionId: number | null;
  pavilionName: string;
  onClose: () => void;
  onSelectShop: (shopId: string) => void;
}

type StatusFilter = "all" | ShopStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "paid", label: "Qarzsiz" },
  { key: "unpaid", label: "Qarzdor" },
  { key: "partial", label: "Qisman" },
  { key: "no_data", label: "Ma'lumotsiz" },
];

export function PavilionModal({ pavilionId, pavilionName, onClose, onSelectShop }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["pavilion-shops", pavilionId],
    queryFn: () => getPavilionShops(pavilionId!),
    enabled: !!pavilionId,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.shops.filter((s) => {
      if (statusFilter === "all") return true;
      const st = data.billing[s.shop_id]?.status ?? "no_data";
      return st === statusFilter;
    });
  }, [data, statusFilter]);

  return (
    <Modal open={!!pavilionId} onClose={onClose} title={pavilionName} maxWidth="max-w-3xl">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className="chip"
            style={
              statusFilter === f.key
                ? { background: "#0066ff", color: "#fff" }
                : { background: "#f1f5f9", color: "#475569" }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <Spinner label="Magazinlar yuklanmoqda..." />}

      {data && (
        <>
          <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-400">
            {(["paid", "partial", "unpaid", "no_data"] as ShopStatus[]).map((st) => (
              <span key={st} className="flex items-center gap-1">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ background: STATUS_COLORS[st] }}
                />
                {STATUS_LABELS[st]}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-1.5">
            {filtered.map((s) => {
              const st = data.billing[s.shop_id]?.status ?? "no_data";
              const num = s.shop_id.split("-").pop();
              return (
                <button
                  key={s.shop_id}
                  onClick={() => onSelectShop(s.shop_id)}
                  className="flex aspect-square items-center justify-center rounded-md text-xs font-bold text-white transition-transform hover:scale-105"
                  style={{ background: STATUS_COLORS[st] }}
                  title={s.shop_id}
                >
                  {num}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-400">
              Bu filtrda magazin topilmadi
            </div>
          )}

          <div className="mt-3 text-right text-xs text-slate-400">
            Jami: {data.shops.length} ta · Ko'rsatilmoqda: {filtered.length} ta
          </div>
        </>
      )}
    </Modal>
  );
}
