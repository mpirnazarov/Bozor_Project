import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getPavilionShops } from "@/api/pavilions";
import { getHideUnmatched } from "@/api/admin";
import { STATUS_COLORS, fmtUZS } from "@/lib/utils";
import { Modal, Spinner } from "@/components/ui/Modal";
import { useT } from "@/i18n/useT";
import type { ShopStatus, BillingStatus, CategoryBalance } from "@/types/api";

interface Props {
  pavilionId: number | null;
  pavilionName: string;
  onClose: () => void;
  onSelectShop: (shopId: string) => void;
}

type ServiceKey = "all" | "rent" | "electricity" | "water";
const SERVICE_FILTERS: { key: ServiceKey; tkey: string }[] = [
  { key: "all", tkey: "pav.service.all" },
  { key: "rent", tkey: "pav.service.rent" },
  { key: "electricity", tkey: "pav.service.electricity" },
  { key: "water", tkey: "pav.service.water" },
];

type StatusFilter = "all" | ShopStatus;
const STATUS_FILTERS: { key: StatusFilter; tkey: string; color?: string }[] = [
  { key: "all", tkey: "pav.status.all" },
  { key: "paid", tkey: "pav.status.paid", color: STATUS_COLORS.paid },
  { key: "partial", tkey: "pav.status.partial", color: STATUS_COLORS.partial },
  { key: "unpaid", tkey: "pav.status.unpaid", color: STATUS_COLORS.unpaid },
  { key: "no_data", tkey: "pav.status.no_data", color: STATUS_COLORS.no_data },
];

const EPS = 1;

function statusForService(b: BillingStatus | undefined, service: ServiceKey): {
  status: ShopStatus; due: number; paid: number; debt: number;
} {
  if (!b) return { status: "no_data", due: 0, paid: 0, debt: 0 };

  // "Barcha" (default) — status va qarz FAQAT arenda bo'yicha aniqlanadi.
  // Elektr/suv qarzi faqat o'sha filtr tanlanganda hisobga olinadi.
  const effective = service === "all" ? "rent" : service;

  const cat: CategoryBalance | undefined = b.categories.find((c) => c.category === effective);
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
  const t = useT();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["pavilion-shops", pavilionId],
    queryFn: () => getPavilionShops(pavilionId!),
    enabled: !!pavilionId,
  });

  const { data: hideUnmatched } = useQuery({
    queryKey: ["hide-unmatched"],
    queryFn: getHideUnmatched,
  });

  const computed = useMemo(() => {
    if (!data) return [];
    const list = data.shops.map((s) => {
      const r = statusForService(data.billing[s.shop_id], service);
      return { shop: s, ...r };
    });
    // Topilmagan berkitilgan bo'lsa — no_data magazinlarni chiqarib tashlaymiz
    return hideUnmatched ? list.filter((c) => c.status !== "no_data") : list;
  }, [data, service, hideUnmatched]);

  // Tepadagi summalar HAR DOIM umumiy (barcha xizmatlar bo'yicha) bo'ladi.
  // MUHIM: endi har magazinning JAMI'si — o'zining belgilangan summasi
  // (monthly_rent), QARZ esa INN qarzidan teng taqsimlangan ulush. Shuning
  // uchun HAR MAGAZINNI alohida qo'shamiz (INN bo'yicha dedup QILMAYMIZ).
  const totals = useMemo(() => {
    if (!data) return { due: 0, paid: 0, debt: 0 };
    const acc = { due: 0, paid: 0, debt: 0 };
    for (const s of data.shops) {
      const b = data.billing[s.shop_id];
      if (!b) continue;
      acc.due += Number(b.total_due);
      acc.paid += Number(b.total_paid);
      acc.debt += Number(b.total_debt);
    }
    return acc;
  }, [data]);

  // Har holat bo'yicha magazin soni (filtr yonida ko'rsatish uchun)
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: computed.length, paid: 0, partial: 0, unpaid: 0, no_data: 0 };
    for (const x of computed) c[x.status] = (c[x.status] ?? 0) + 1;
    return c;
  }, [computed]);

  // Har xizmat bo'yicha ma'lumoti bor magazinlar soni
  const serviceCounts = useMemo(() => {
    const c: Record<string, number> = { all: data?.shops.length ?? 0, rent: 0, electricity: 0, water: 0 };
    if (data) {
      for (const s of data.shops) {
        const b = data.billing[s.shop_id];
        if (!b) continue;
        for (const cat of b.categories) {
          if (Number(cat.due) > 0 || Number(cat.paid) > 0) {
            c[cat.category] = (c[cat.category] ?? 0) + 1;
          }
        }
      }
    }
    return c;
  }, [data]);

  return (
    <Modal open={!!pavilionId} onClose={onClose} title={pavilionName} maxWidth="max-w-3xl">
      {isLoading && <Spinner label="Magazinlar yuklanmoqda..." />}

      {data && (
        <>
          {/* Summalar */}
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-surface-muted p-3">
              <div className="text-[11px] font-semibold text-ink-faint">{t("common.total")}</div>
              <div className="tabnum text-base font-extrabold text-ink">{fmtUZS(totals.due)}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: "rgba(22,163,74,0.08)" }}>
              <div className="text-[11px] font-semibold text-ink-faint">{t("common.paid")}</div>
              <div className="tabnum text-base font-extrabold text-status-paid">{fmtUZS(totals.paid)}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: "rgba(220,38,38,0.08)" }}>
              <div className="text-[11px] font-semibold text-ink-faint">{t("common.debt")}</div>
              <div className="tabnum text-base font-extrabold text-status-unpaid">{fmtUZS(totals.debt)}</div>
            </div>
          </div>

          {/* 1-filtr: xizmat turi */}
          <div className="mb-2">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t("pav.serviceType")}</div>
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
                  {t(f.tkey)}
                  <span className="ml-0.5 rounded-full bg-black/10 px-1.5 text-[10px] tabnum">
                    {serviceCounts[f.key] ?? 0}
                  </span>
                </button>
              ))}
              {isFetching && <Loader2 size={14} className="ml-1 animate-spin text-brand" />}
            </div>
          </div>

          {/* 2-filtr: to'lov holati (rangli) */}
          <div className="mb-3">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t("pav.paymentStatus")}</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {STATUS_FILTERS.filter((f) => !(hideUnmatched && f.key === "no_data")).map((f) => (
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
                  {t(f.tkey)}
                  <span className="ml-0.5 rounded-full bg-black/10 px-1.5 text-[10px] tabnum">
                    {counts[f.key] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Magazinlar to'plami — filtr highlight qiladi, qolganlari seriy */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1">
            {computed.map((c) => {
              const num = c.shop.shop_id.split("-").pop();
              const match = statusFilter === "all" || c.status === statusFilter;
              const color = STATUS_COLORS[c.status];
              return (
                <button
                  key={c.shop.shop_id}
                  onClick={() => match && onSelectShop(c.shop.shop_id)}
                  disabled={!match}
                  className="flex aspect-square items-center justify-center rounded text-[10px] font-bold text-white transition-all"
                  style={match
                    ? { background: color, opacity: 1, cursor: "pointer" }
                    : { background: "#e2e8f0", color: "#94a3b8", opacity: 0.5, cursor: "not-allowed" }}
                  title={`${c.shop.shop_id} — ${t("pav.status." + c.status)}`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          {computed.length === 0 && (
            <div className="py-8 text-center text-sm text-ink-faint">
              {t("pav.noShops")}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
            <span>{t("pav.totalShops", { n: data.shops.length })}</span>
            <span>
              {statusFilter === "all"
                ? t("pav.allShown")
                : t("pav.highlighted", { n: computed.filter((c) => c.status === statusFilter).length })}
            </span>
          </div>
        </>
      )}
    </Modal>
  );
}
