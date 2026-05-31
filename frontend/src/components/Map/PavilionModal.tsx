import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getPavilionShops } from "@/api/pavilions";
import { STATUS_COLORS, STATUS_LABELS, fmtUZS } from "@/lib/utils";
import { Modal, Spinner } from "@/components/ui/Modal";
import type { ShopStatus, BillingStatus, CategoryBalance } from "@/types/api";

interface Props {
  pavilionId: number | null;
  pavilionName: string;
  onClose: () => void;
  onSelectShop: (shopId: string) => void;
}

type ServiceKey = "all" | "rent" | "electricity" | "water";
const SERVICE_FILTERS: { key: ServiceKey; label: string }[] = [
  { key: "all", label: "Barcha" },
  { key: "rent", label: "Arenda" },
  { key: "electricity", label: "Elektr" },
  { key: "water", label: "Suv" },
];

type StatusFilter = "all" | ShopStatus;
const STATUS_FILTERS: { key: StatusFilter; label: string; color?: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "paid", label: STATUS_LABELS.paid, color: STATUS_COLORS.paid },
  { key: "partial", label: STATUS_LABELS.partial, color: STATUS_COLORS.partial },
  { key: "unpaid", label: STATUS_LABELS.unpaid, color: STATUS_COLORS.unpaid },
  { key: "no_data", label: STATUS_LABELS.no_data, color: STATUS_COLORS.no_data },
];

const EPS = 1;

function statusForService(b: BillingStatus | undefined, service: ServiceKey): {
  status: ShopStatus; due: number; paid: number; debt: number;
} {
  if (!b) return { status: "no_data", due: 0, paid: 0, debt: 0 };
  if (service === "all") {
    return {
      status: b.status,
      due: Number(b.total_due),
      paid: Number(b.total_paid),
      debt: Number(b.total_debt),
    };
  }
  const cat: CategoryBalance | undefined = b.categories.find((c) => c.category === service);
  if (!cat) return { status: "no_data", due: 0, paid: 0, debt: 0 };
  const due = Number(cat.due);
  const paid = Number(cat.paid);
  const debt = Math.max(0, due - paid);
  let status: ShopStatus;
  if (due <= EPS && paid <= EPS) status = "no_data";
  else if (debt <= EPS) status = "paid";
  else if (paid > EPS) status = "partial";
  else status = "unpaid";
  return { status, due, paid, debt };
}

export function PavilionModal({ pavilionId, pavilionName, onClose, onSelectShop }: Props) {
  const [service, setService] = useState<ServiceKey>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["pavilion-shops", pavilionId],
    queryFn: () => getPavilionShops(pavilionId!),
    enabled: !!pavilionId,
  });

  const computed = useMemo(() => {
    if (!data) return [];
    return data.shops.map((s) => {
      const r = statusForService(data.billing[s.shop_id], service);
      return { shop: s, ...r };
    });
  }, [data, service]);

  const totals = useMemo(() => {
    return computed.reduce(
      (acc, c) => {
        acc.due += c.due; acc.paid += c.paid; acc.debt += c.debt;
        return acc;
      },
      { due: 0, paid: 0, debt: 0 },
    );
  }, [computed]);

  return (
    <Modal open={!!pavilionId} onClose={onClose} title={pavilionName} maxWidth="max-w-3xl">
      {isLoading && <Spinner label="Magazinlar yuklanmoqda..." />}

      {data && (
        <>
          {/* Summalar */}
          <div className="mb-4 grid grid-cols-3 gap-2.5">
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

          {/* 1-filtr: xizmat turi */}
          <div className="mb-2">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Xizmat turi</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {SERVICE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setService(f.key)}
                  className="chip"
                  style={service === f.key
                    ? { background: "#0066ff", color: "#fff" }
                    : { background: "#f1f5f9", color: "#475569" }}
                >
                  {f.label}
                </button>
              ))}
              {isFetching && <Loader2 size={14} className="ml-1 animate-spin text-brand" />}
            </div>
          </div>

          {/* 2-filtr: to'lov holati (rangli) */}
          <div className="mb-3">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">To'lov holati</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className="chip"
                  style={statusFilter === f.key
                    ? { background: f.color ?? "#0066ff", color: "#fff" }
                    : { background: "#f1f5f9", color: f.color ?? "#475569" }}
                >
                  {f.color && (
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: f.color }} />
                  )}
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Magazinlar to'plami — filtr highlight qiladi, qolganlari seriy */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-1.5">
            {computed.map((c) => {
              const num = c.shop.shop_id.split("-").pop();
              const match = statusFilter === "all" || c.status === statusFilter;
              const color = STATUS_COLORS[c.status];
              return (
                <button
                  key={c.shop.shop_id}
                  onClick={() => match && onSelectShop(c.shop.shop_id)}
                  disabled={!match}
                  className="flex aspect-square items-center justify-center rounded-md text-xs font-bold text-white transition-all"
                  style={match
                    ? { background: color, opacity: 1, cursor: "pointer" }
                    : { background: "#e2e8f0", color: "#94a3b8", opacity: 0.55, cursor: "not-allowed" }}
                  title={`${c.shop.shop_id} — ${STATUS_LABELS[c.status]}`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          {computed.length === 0 && (
            <div className="py-8 text-center text-sm text-ink-faint">
              Bu regionda magazin topilmadi
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
            <span>Jami: {data.shops.length} ta magazin</span>
            <span>
              {statusFilter === "all"
                ? "Hammasi ko'rsatilmoqda"
                : `Ajratilgan: ${computed.filter((c) => c.status === statusFilter).length} ta`}
            </span>
          </div>
        </>
      )}
    </Modal>
  );
}
