import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LogOut, Settings, ArrowLeft, Info, AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/i18n/useT";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ClikcBazaarLogo } from "@/components/ui/ClikcBazaarLogo";
import { HeaderStats } from "@/components/Dashboard/HeaderStats";
import { MarketInvoicesSection } from "@/components/MarketInvoicesSection";
import { getMarketInvoices } from "@/api/dashboard";
import { InnSearch } from "@/components/INN/InnSearch";
import { MapView } from "@/components/Map/MapView";
import { PavilionModal } from "@/components/Map/PavilionModal";
import { ShopDetailModal } from "@/components/Map/ShopDetailModal";
import { ToiletModal } from "@/components/Map/ToiletModal";
import { InfraShopModal } from "@/components/Map/InfraShopModal";
import { useQuery } from "@tanstack/react-query";
import { getInn } from "@/api/inn";
import { getMarketSupportStatus } from "@/api/owner";
import { Modal } from "@/components/ui/Modal";
import type { Pavilion } from "@/types/api";

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  // Bozor sahifasida admin tugmasi/tahrir faqat o'sha bozor admini uchun.
  // Super admin bu yerda FAQAT ko'ruvchi — tahrir qila olmaydi, admin tugmasi ko'rinmaydi.
  const isMarketAdmin = ["admin", "market_admin"].includes(user?.role ?? "");
  const isSuperAdmin = user?.role === "super_admin";
  const { data: _dashData } = useQuery({
    queryKey: ["dashboard-market-name"],
    queryFn: async () => {
      const { apiClient } = await import("@/api/client");
      const { data } = await apiClient.get("/dashboard");
      return data as { market_name?: string };
    },
    staleTime: 60_000,
  });
  const marketName = _dashData?.market_name;

  useEffect(() => {
    if (marketName) {
      document.title = marketName;
    }
  }, [marketName]);
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get("demo") === "1";
  const { data: supportStatus } = useQuery({
    queryKey: ["support-status"],
    queryFn: getMarketSupportStatus,
    retry: false,
  });
  // To'lanmagan to'lovlar soni — admin ikonkasidagi badge uchun
  const { data: marketInvoices } = useQuery({
    queryKey: ["market-invoices"],
    queryFn: () => getMarketInvoices(),
    refetchInterval: 60_000,
    retry: false,
    enabled: isMarketAdmin,
  });
  const unpaidCount = (marketInvoices?.stats?.counts.pending ?? 0) + (marketInvoices?.stats?.counts.overdue ?? 0) + (marketInvoices?.stats?.counts.partial ?? 0);
  const t = useT();

  const [activePavilion, setActivePavilion] = useState<Pavilion | null>(null);
  const [activeShop, setActiveShop] = useState<string | null>(null);
  const [activeShopTitle, setActiveShopTitle] = useState<string | undefined>(undefined);
  const [noShopIdPavilion, setNoShopIdPavilion] = useState<string | null>(null);
  const [activeInfraShop, setActiveInfraShop] = useState<{ id: number; name: string } | null>(null);
  const [activeToilet, setActiveToilet] = useState<{ id: number; name: string } | null>(null);
  const [activeInn, setActiveInn] = useState<string | null>(null);
  // Logo/i-tugma toggle: default i (Info), bosilganda logo (Store), yana bosilganda i
  const [showLogo, setShowLogo] = useState(false);

  const { data: innDetail } = useQuery({
    queryKey: ["inn", activeInn],
    queryFn: () => getInn(activeInn!),
    enabled: !!activeInn,
  });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowLogo((v) => !v)}
              className="grid h-11 w-11 place-items-center rounded-xl bg-brand-grad shadow-glow transition-transform active:scale-95"
              title={showLogo ? "Info" : t("app.title")}
              aria-label="logo-info-toggle"
            >
              <Info className="text-white" size={22} strokeWidth={2.2} />
            </button>
            <div>
              {showLogo ? (
                <ClikcBazaarLogo height={44} />
              ) : (
                <>
                  <h1 className="font-display text-base font-extrabold leading-tight text-ink">
                    {marketName || t("app.title")}
                  </h1>
                  <p className="text-xs text-ink-faint">{marketName ? t("app.subtitle") : t("app.subtitle")}</p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />
            <div className="flex items-center gap-2 rounded-full bg-white/60 py-1 pl-3 pr-1.5 ring-1 ring-slate-200/70">
              <span className="text-sm font-semibold text-ink-soft">{user?.username}</span>
              {isMarketAdmin && (
                <span className="rounded-full bg-brand-grad px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  admin
                </span>
              )}
              {isSuperAdmin && (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                  {t("home.view")}
                </span>
              )}
            </div>
            {/* Super admin uchun — boshqaruv markaziga qaytish */}
            {isSuperAdmin && (
              <Link to="/super" className="btn-ghost px-3 py-2" title="Boshqaruv markazi">
                <ArrowLeft size={16} /> {t("home.center")}
              </Link>
            )}
            {/* Admin tugmasi FAQAT bozor admini uchun (super admin uchun emas) */}
            {isMarketAdmin && (
              <Link to={unpaidCount > 0 ? "/admin?tab=documents" : "/admin"} className="relative btn-ghost px-2.5 py-2" title="Admin panel">
                <Settings size={16} />
                {unpaidCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-white animate-pulse">
                    {unpaidCount > 9 ? "9+" : unpaidCount}
                  </span>
                )}
              </Link>
            )}
            <button onClick={() => logout()} className="btn-ghost px-2.5 py-2" title="Chiqish">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        {supportStatus?.needs_warning && (
          <div className="flex items-center gap-2.5 rounded-2xl border-2 border-status-unpaid/50 bg-status-unpaid/10 px-4 py-3 text-sm font-bold text-status-unpaid animate-fade-in">
            <AlertTriangle size={18} className="shrink-0" />
            Bozor ma'muriyati tizim tex-podderjkasi uchun to'lov qilishi kerak, aks holda tizim ishlashi to'xtatiladi.
          </div>
        )}
        {isDemo && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            <Info size={16} />
            {t("home.demoNotice")}
          </div>
        )}
        <HeaderStats />
        <MarketInvoicesSection />
        <InnSearch onSelectInn={setActiveInn} />
        <MapView onSelectPavilion={(p) => {
          if (p.pavilion_type === "toilet") {
            const tid = p.meta?.toilet_id as number | undefined;
            setActiveToilet({ id: tid ?? 0, name: p.display_name });
          } else if (p.pavilion_type === "infra" || p.meta?.click_action === "shop_modal") {
            if (p.meta?.infra_shop_id) {
              // Infra do'kon modali
              setActiveInfraShop({ id: p.meta.infra_shop_id as number, name: p.display_name });
            } else if (p.meta?.target_shop_id) {
              // Oddiy magazin modali
              setActiveShop(p.meta.target_shop_id as string);
              setActiveShopTitle(p.display_name);
            } else if (p.pavilion_type === "infra") {
              // Infra lekin ID yo'q — name bo'yicha qidirish
              setActiveInfraShop({ id: 0, name: p.display_name });
            } else {
              setNoShopIdPavilion(p.display_name);
            }
          } else {
            setActivePavilion(p);
          }
        }} />
      </main>

      <PavilionModal
        pavilionId={activePavilion?.id ?? null}
        pavilionName={activePavilion?.display_name ?? ""}
        onClose={() => setActivePavilion(null)}
        onSelectShop={(id) => {
          // Pavilion modalni YOPMAYMIZ — magazin modali uning ustida ochiladi.
          // Magazin modali yopilganda pavilion modali ochiq qoladi.
          setActiveShop(id);
          setActiveShopTitle(undefined);
        }}
      />

      <ShopDetailModal shopId={activeShop} onClose={() => { setActiveShop(null); setActiveShopTitle(undefined); }} customTitle={activeShopTitle} />
      <InfraShopModal infraShop={activeInfraShop} onClose={() => setActiveInfraShop(null)} />
      <ToiletModal toilet={activeToilet} onClose={() => setActiveToilet(null)} />

      {noShopIdPavilion && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
             onClick={() => setNoShopIdPavilion(null)}>
          <div className="card w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-3xl">⚠️</div>
            <h3 className="mb-1 font-display text-lg font-bold text-ink">{noShopIdPavilion}</h3>
            <p className="text-sm text-ink-faint">
              Bu layout uchun magazin ID kiritilmagan.
              Admin → Xarita muharriri → layoutni tanlang →
              <b> "Magazin ID"</b> ni kiriting.
            </p>
            <button className="btn-primary mt-4 w-full py-2.5"
                    onClick={() => setNoShopIdPavilion(null)}>Yopish</button>
          </div>
        </div>
      )}

      <Modal
        open={!!activeInn}
        onClose={() => setActiveInn(null)}
        title={innDetail?.counterparty.name ?? "Yuklanmoqda..."}
        maxWidth="max-w-lg"
      >
        {innDetail && (
          <div className="space-y-3">
            <div className="card p-3 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-slate-400">INN</span>
                <span className="font-mono font-semibold">{innDetail.counterparty.inn}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Shartnoma</span>
                <span className="font-semibold">
                  {innDetail.counterparty.contract_no ?? "—"}
                </span>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-bold text-slate-500">
                Magazinlar ({innDetail.shops.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {innDetail.shops.map((s) => (
                  <button
                    key={s.shop_id}
                    onClick={() => {
                      setActiveInn(null);
                      setActiveShop(s.shop_id);
                    }}
                    className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-600 hover:bg-slate-200"
                  >
                    {s.shop_id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
