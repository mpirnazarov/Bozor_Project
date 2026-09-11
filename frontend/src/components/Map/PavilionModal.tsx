import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getPavilionShops } from "@/api/pavilions";
import { getHideUnmatched } from "@/api/admin";
import { getDashboard } from "@/api/dashboard";
import { STATUS_COLORS, fmtUZS } from "@/lib/utils";
import { Modal, Spinner } from "@/components/ui/Modal";
import { PeriodSwitch } from "@/components/ui/PeriodSwitch";
import { useT } from "@/i18n/useT";
import type { ShopStatus } from "@/types/api";

interface Props {
  pavilionId: number | null;
  pavilionName: string;
  /** Blokning meta.shop_prefix qiymati — plitkadagi raqamni to'g'ri
   *  ko'rsatish uchun (masalan CH-ML-112-a -> "112-a"). */
  shopPrefix?: string;
  onClose: () => void;
  /** Magazin modali AYNAN shu davr uchun ochilishi kerak — aks holda blok
   *  modali bir oyni, magazin modali boshqasini ko'rsatadi. */
  onSelectShop: (shopId: string, year: number, month: number) => void;
}

// "all" (Barcha) olib tashlandi — uchala xizmatni bir plitkada aralashtirish
// chalkash edi. Sukut bo'yicha arenda ochiladi.
type ServiceKey = "rent" | "electricity" | "water";
const SERVICE_FILTERS: { key: ServiceKey; tkey: string }[] = [
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
  { key: "vacant", tkey: "pav.status.vacant", color: STATUS_COLORS.vacant },
];


// VAQTINCHA: qisman to'langan (partial) magazinlarni ham QIZIL (unpaid) ko'rsatish.
// Orqaga qaytarish uchun shu qiymatni `false` qiling — partial yana SARIQ bo'ladi.

// ===== PREZENTATSIYA (DEMO) REJIMI =====
// VAQTINCHA: prezentatsiya uchun har blok ochilganda Qarzdorlik/To'langan
// summalari umumiy proporsiyaga yaqin RANDOM qiymatga o'zgartiriladi.
// Orqaga qaytarish uchun DEMO_MODE = false qiling — real summalar qaytadi.
const DEMO_MODE = false;
// Umumiy qarzdorlik / umumiy jami = 6,761,618,398 / 11,689,498,000
const DEMO_DEBT_RATIO = 6761618398 / 11689498000; // ≈ 0.5784
// Random tebranish: proporsiyaning ±12% atrofida
const DEMO_JITTER = 0.12;

/** Blok jami summasidan demo qarzdorlik/to'langan hisoblaydi (proporsiyaga yaqin random). */
function demoSplit(totalDue: number, seed: number): { debt: number; paid: number } {
  // seed asosida barqaror "random" (har ochilganda bir xil bo'lishi uchun)
  const rnd = Math.abs(Math.sin(seed) * 10000) % 1; // 0..1
  const ratio = DEMO_DEBT_RATIO * (1 + (rnd - 0.5) * 2 * DEMO_JITTER);
  const debt = Math.max(0, Math.min(totalDue, totalDue * ratio));
  return { debt, paid: totalDue - debt };
}

// ===== DASHBOARD PROPORSIYASI (vaqtinchalik, qo'lda kiritilgan summalar bilan moslash) =====
// Ma'muriyat dashboardda umumiy To'langan/Qarz summalarini qo'lda o'zgartiradi.
// Yoqilgan bo'lsa, har blok modalida ham o'sha umumiy foiz (paid/total)
// qo'llanadi: blok To'langan = blok Jami × foiz, Qarz = Jami − To'langan.
// Keyinroq avtomatik hisobga o'tkazish uchun shu qiymatni `false` qiling.
const USE_DASHBOARD_PROPORTION = false;

/** Plitkada ko'rsatiladigan magazin raqami.
 *
 *  Odatda oxirgi "-" dan keyingi qism kifoya (04-1-1-001 -> "001").
 *  Lekin raqamning O'ZIDA "-" bo'lishi mumkin (CH-ML-112-a, CH-ML-110-111) —
 *  bunda blok prefiksi kesiladi, aks holda "a" deb ko'rinib qolardi.
 */
function shopNumber(shopId: string, prefix?: string): string {
  for (const part of (prefix ?? "").split(/[/,]/)) {
    const base = part.trim().replace(/-+$/, "");
    if (!base || !shopId.startsWith(base)) continue;
    const rest = shopId.slice(base.length).replace(/^-+/, "");
    if (rest && rest.includes("-")) return rest;
  }
  return shopId.split("-").pop() ?? shopId;
}


/** partial -> unpaid (agar bayroq yoqilgan bo'lsa). Boshqa statuslar o'zgarmaydi. */


export function PavilionModal({ pavilionId, pavilionName, shopPrefix, onClose, onSelectShop }: Props) {
  const [service, setService] = useState<ServiceKey>("rent");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const t = useT();

  // Davr — sukut bo'yicha joriy oy. Elektr/suv importi ba'zan o'tgan oy
  // uchun qilinadi (masalan avgust), shuning uchun oyni almashtirib
  // ko'rish kerak bo'ladi.
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["pavilion-shops", pavilionId, year, month],
    queryFn: () => getPavilionShops(pavilionId!, year, month),
    enabled: !!pavilionId,
  });

  const { data: hideUnmatched } = useQuery({
    queryKey: ["hide-unmatched"],
    queryFn: getHideUnmatched,
  });

  // "no_data" ni faqat arenda ko'rinishida yashiramiz (pastdagi izohga qarang)

  // Dashboard umumiy summalari (qo'lda kiritilgan) — proporsiya uchun
  const { data: dashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(false),
    enabled: USE_DASHBOARD_PROPORTION,
  });

  const computed = useMemo(() => {
    if (!data) return [];
    const list = data.shops.map((s) => {
      // "Topilmagan" = bo'sh yozuv: na INN, na ijara summasi bor. Faqat
      // SHULAR berkitiladi. Shu oyda to'lov fayli kelmagan (lekin INN va
      // ijarasi bor) magazin "topilmagan" EMAS — u ro'yxatda qolishi shart.
      // BO'SH DO'KON ham hech qachon berkitilmaydi: unda INN ham, ijara ham
      // bo'lmasligi TABIIY, shuning uchun filtr aynan "Bo'sh do'kon"
      // toifasini yo'q qilib yuborardi (164 tadan 148 tasi ko'rinmasdi).
      const emptyRecord =
        !s.is_vacant && !s.inn && Number(s.monthly_rent ?? 0) <= 0;

      // 1. Bo'sh do'kon — kulrang "vacant"
      if (s.is_vacant) {
        return { shop: s, emptyRecord, status: "vacant" as ShopStatus, due: 0, paid: 0, debt: 0 };
      }

      // 2. INN yo'q — egasiz (qizil)
      if (!s.inn) {
        return { shop: s, emptyRecord, status: "unpaid" as ShopStatus, due: 0, paid: 0, debt: 0 };
      }

      const billing = data.billing[s.shop_id];
      const monthlyRent = Number(s.monthly_rent ?? 0);

      // Rang uchun DOIM uchala kategoriyani tekshiramiz
      // Arenda: billing yo'q yoki rent kategoriyasi yo'q bo'lsa monthly_rent dan
      const rentCat = billing?.categories.find((x) => x.category === "rent");
      const rentDue = rentCat ? Number(rentCat.due) : monthlyRent;
      const rentPaid = rentCat ? Number(rentCat.paid) : 0;
      const rentDebt = Math.max(0, rentDue - rentPaid);

      const elecCat = billing?.categories.find((x) => x.category === "electricity");
      const elecDue = elecCat ? Number(elecCat.due) : 0;
      const elecPaid = elecCat ? Number(elecCat.paid) : 0;
      const elecDebt = Math.max(0, elecDue - elecPaid);

      const waterCat = billing?.categories.find((x) => x.category === "water");
      const waterDue = waterCat ? Number(waterCat.due) : 0;
      const waterPaid = waterCat ? Number(waterCat.paid) : 0;
      const waterDebt = Math.max(0, waterDue - waterPaid);

      // Rang — TANLANGAN xizmat bo'yicha. Avval bu yerda har doim uchala
      // kategoriya birgalikda hisoblanardi, shuning uchun xizmat turini
      // almashtirganda ranglar umuman o'zgarmasdi.
      // Kategoriya yo'q bo'lsa (masalan shu oyda elektr importi bo'lmagan)
      // — "ma'lumot yo'q", "to'lanmagan" EMAS.
      const statusOf = (present: boolean, paid: number, debt: number): ShopStatus =>
        !present ? "no_data" : debt <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid";

      if (service === "rent") {
        // ARENDA uchun "ma'lumot yo'q" faqat summasi ham noma'lum bo'lganda.
        // Arenda kategoriyasi bo'lmasa ham magazinning belgilangan summasi
        // (monthly_rent) ma'lum — bu holda to'lov YOZUVI yo'q, ya'ni
        // "to'lanmagan". Magazin modali ham aynan shu fallback'ni ishlatadi
        // (ShopDetailModal), shuning uchun avval plitka "Ma'lumot yo'q" deb,
        // modal esa arenda summasini ko'rsatib ziddiyat chiqarardi.
        const rentKnown = !!rentCat || monthlyRent > 0;
        return { shop: s, emptyRecord, status: statusOf(rentKnown, rentPaid, rentDebt),
                 due: rentDue, paid: rentPaid, debt: rentDebt };
      }
      if (service === "electricity") {
        return { shop: s, emptyRecord, status: statusOf(!!elecCat, elecPaid, elecDebt),
                 due: elecDue, paid: elecPaid, debt: elecDebt };
      }
      return { shop: s, emptyRecord, status: statusOf(!!waterCat, waterPaid, waterDebt),
               due: waterDue, paid: waterPaid, debt: waterDebt };
    });

    // "Topilmaganlar berkitilgan" — FAQAT bo'sh yozuvlarni (na INN, na ijara)
    // olib tashlaydi. Avval bu filtr `status !== "no_data"` bo'yicha ishlardi;
    // eski kod hech qachon no_data yaratmagani uchun u amalda hech narsa
    // qilmasdi. "Ma'lumot yo'q" holati joriy qilingach esa u birdan INN va
    // ijarasi bor haqiqiy magazinlarni ham yashira boshladi (1-PAVILON,
    // sentabr: 35 magazin, 188 mln so'm).
    return hideUnmatched ? list.filter((c) => !c.emptyRecord) : list;
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
    }
    // QARZDORLIK = JAMI − TO'LANGAN.
    // Avval har magazinning `total_debt` i qo'shilardi, u esa rent_billing
    // faylidagi qarz — boshqa bazadan hisoblangan va faqat shu oyda yozuvi
    // BOR magazinlarda mavjud. Natijada yozuvi yo'q magazinlarning ijarasi
    // Jami'ga kirar, lekin Qarzga kirmasdi va uchala raqam bir-biriga
    // to'g'ri kelmasdi (masalan 13-BLOK: 323 mln − 8.9 mln ≠ 243 mln).
    // Adminka hisoboti ham shu formulani ishlatadi — endi ikkalasi bir xil.
    acc.debt = Math.max(0, acc.due - acc.paid);
    // PREZENTATSIYA REJIMI: qarz/to'langanni proporsiyaga yaqin random qilamiz.
    // Jami (due) o'zgarmaydi — faqat uning ichida debt/paid taqsimoti.
    if (DEMO_MODE && acc.due > 0) {
      const { debt, paid } = demoSplit(acc.due, (pavilionId ?? 1) * 7.13);
      return { due: acc.due, debt, paid };
    }
    // DASHBOARD PROPORSIYASI: umumiy (qo'lda kiritilgan) To'langan/Jami foizini
    // har blokka qo'llaymiz. Blok Jami o'zgarmaydi, To'langan/Qarz moslashadi.
    if (USE_DASHBOARD_PROPORTION && dashboard && dashboard.total > 0 && acc.due > 0) {
      const paidRatio = Math.min(1, Math.max(0, dashboard.paid / dashboard.total));
      const paid = acc.due * paidRatio;
      return { due: acc.due, paid, debt: acc.due - paid };
    }
    return acc;
  }, [data, pavilionId, dashboard]);

  // Har holat bo'yicha magazin soni (filtr yonida ko'rsatish uchun)
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: computed.length, paid: 0, partial: 0, unpaid: 0, no_data: 0 };
    for (const x of computed) c[x.status] = (c[x.status] ?? 0) + 1;
    return c;
  }, [computed]);

  // Har xizmat ostida ham BARCHA magazinlar soni ko'rsatiladi (191 = 191).
  // Filtr tanlanganda magazin tushib qolmaydi — billing satri bo'lmasa ham ko'rinadi.
  // Xizmat chiplaridagi son ro'yxatdagi HAQIQIY magazin soniga teng bo'lishi
  // shart. Avval bu yerda doim `data.shops.length` turardi, shuning uchun
  // "Arenda 191" va "Hammasi 156" bir-biriga qarama-qarshi chiqardi.
  const serviceCounts = useMemo(() => {
    const n = computed.length;
    return { rent: n, electricity: n, water: n } as Record<string, number>;
  }, [computed]);

  return (
    <Modal open={!!pavilionId} onClose={onClose} title={pavilionName} maxWidth="max-w-3xl">
      {isLoading && <Spinner label="Magazinlar yuklanmoqda..." />}

      {data && (
        <>
          {/* Davr tanlash — elektr/suv importi o'tgan oy uchun bo'lishi mumkin */}
          <div className="mb-3.5">
            <PeriodSwitch
              year={year}
              month={month}
              busy={isFetching}
              onChange={(y, m) => { setYear(y); setMonth(m); }}
            />
          </div>

          {/* Summalar */}
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-surface-muted p-3">
              <div className="text-[11px] font-semibold text-ink-faint">{t("common.total")}</div>
              <div className="tabnum text-base font-extrabold text-ink">{fmtUZS(totals.due)}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--tint-paid)" }}>
              <div className="text-[11px] font-semibold text-ink-faint">{t("common.paid")}</div>
              <div className="tabnum text-base font-extrabold text-status-paid">{fmtUZS(totals.paid)}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--tint-debt)" }}>
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
                    : { background: "var(--chip-off-bg)", color: "var(--chip-off-fg)" }}
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
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className="chip"
                  style={statusFilter === f.key
                    ? { background: f.color ?? "#0066ff", color: "#fff" }
                    : { background: "var(--chip-off-bg)", color: f.color ?? "var(--chip-off-fg)" }}
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
              const num = shopNumber(c.shop.shop_id, shopPrefix);
              const match = statusFilter === "all" || c.status === statusFilter;
              const color = STATUS_COLORS[c.status];
              return (
                <button
                  key={c.shop.shop_id}
                  onClick={() => match && onSelectShop(c.shop.shop_id, year, month)}
                  disabled={!match}
                  className="flex aspect-square items-center justify-center rounded text-[10px] font-bold text-white transition-all"
                  style={match
                    ? { background: color, opacity: 1, cursor: "pointer" }
                    : { background: "var(--tile-off-bg)", color: "var(--tile-off-fg)", opacity: 0.5, cursor: "not-allowed" }}
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
