import { useState } from "react";
import { fmtUZS } from "@/lib/utils";
import { Link, useSearchParams } from "react-router-dom";
import { getMarket } from "@/api/markets";
import { LogOut, Settings, ArrowLeft, Info, AlertTriangle, Users } from "lucide-react";
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

  // super_admin/owner ?market=slug bilan kiradi — slug'dan nomni olamiz
  const marketSlugFromUrl = searchParams.get("market");
  const { data: marketFromUrl } = useQuery({
    queryKey: ["market", marketSlugFromUrl],
    queryFn: () => getMarket(marketSlugFromUrl!),
    enabled: !!marketSlugFromUrl,
    staleTime: 60_000,
  });

  // Bozor nomi: URL slug > user.market_name > fallback
  const resolvedSlug = marketSlugFromUrl ?? user?.market_slug;
  const resolvedName = marketFromUrl?.name ?? user?.market_name;
  const marketTitle = resolvedSlug === "orikzor"
    ? "O'rikzor Savdo Kompleksi"
    : resolvedName ?? t("app.title");

  const [activePavilion, setActivePavilion] = useState<Pavilion | null>(null);
  const [activeShop, setActiveShop] = useState<string | null>(null);
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
                    {marketTitle}
                  </h1>
                  <p className="text-xs text-ink-faint">{t("app.subtitle")}</p>
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
            {/* Managerlar tugmasi — faqat market_admin */}
            {isMarketAdmin && (
              <Link to="/managers" className="btn-ghost px-2.5 py-2" title="Managerlar">
                <Users size={16} />
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
        <MapView onSelectPavilion={setActivePavilion} />
      </main>

      <PavilionModal
        pavilionId={activePavilion?.id ?? null}
        pavilionName={activePavilion?.display_name ?? ""}
        onClose={() => setActivePavilion(null)}
        onSelectShop={(id) => {
          // Pavilion modalni YOPMAYMIZ — magazin modali uning ustida ochiladi.
          // Magazin modali yopilganda pavilion modali ochiq qoladi.
          setActiveShop(id);
        }}
      />

      <ShopDetailModal shopId={activeShop} onClose={() => setActiveShop(null)} />

      <Modal
        open={!!activeInn}
        onClose={() => setActiveInn(null)}
        title={innDetail?.counterparty.name ?? "Yuklanmoqda..."}
        maxWidth="max-w-2xl"
      >
        {innDetail && (
          <div className="space-y-4">
            {/* Kontragent ma'lumotlari */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-4">
              <div>
                <div className="text-xs text-slate-400">INN</div>
                <div className="font-mono font-bold text-ink">{innDetail.counterparty.inn}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Shartnoma</div>
                <div className="font-semibold text-ink">{innDetail.counterparty.contract_no ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Jami hisoblangan</div>
                <div className="font-mono font-bold text-ink">{fmtUZS(innDetail.total_due)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Jami to'langan</div>
                <div className="font-mono font-bold text-status-paid">{fmtUZS(innDetail.total_paid)}</div>
              </div>
            </div>

            {/* Umumiy qarz banner */}
            {innDetail.total_debt > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-status-unpaid/10 px-4 py-2.5 text-sm font-bold text-status-unpaid">
                <span>Jami qarz</span>
                <span className="font-mono">{fmtUZS(innDetail.total_debt)}</span>
              </div>
            )}
            {innDetail.total_debt <= 0 && innDetail.total_paid > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-status-paid/10 px-4 py-2.5 text-sm font-bold text-status-paid">
                <span>To'liq to'langan</span>
                <span className="font-mono">{fmtUZS(innDetail.total_paid)}</span>
              </div>
            )}

            {/* Magazinlar jadvali */}
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Magazinlar ({innDetail.shops.length}) —{" "}
                {innDetail.year && innDetail.month
                  ? `${innDetail.year}-yil ${innDetail.month}-oy`
                  : "joriy oy"}
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-400">
                      <th className="px-3 py-2 text-left font-semibold">Magazin ID</th>
                      <th className="px-3 py-2 text-right font-semibold">Hisoblangan</th>
                      <th className="px-3 py-2 text-right font-semibold">To'langan</th>
                      <th className="px-3 py-2 text-right font-semibold">Qarz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {innDetail.shops.map((s) => {
                      const due  = s.billing_due  ?? 0;
                      const paid = s.billing_paid ?? 0;
                      const debt = s.billing_debt ?? 0;
                      return (
                        <tr key={s.shop_id}
                          className="cursor-pointer border-b border-slate-50 transition-colors last:border-0 hover:bg-brand-50"
                          onClick={() => { setActiveInn(null); setActiveShop(s.shop_id); }}
                        >
                          <td className="px-3 py-2.5 font-mono font-semibold text-brand">{s.shop_id}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-ink-soft">
                            {due > 0 ? fmtUZS(due) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-status-paid">
                            {paid > 0 ? fmtUZS(paid) : "—"}
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono font-bold ${debt > 0 ? "text-status-unpaid" : "text-status-paid"}`}>
                            {debt > 0 ? fmtUZS(debt) : "✓"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-xs font-bold">
                    <tr>
                      <td className="px-3 py-2 text-slate-400">Jami</td>
                      <td className="px-3 py-2 text-right font-mono text-ink">{fmtUZS(innDetail.total_due)}</td>
                      <td className="px-3 py-2 text-right font-mono text-status-paid">{fmtUZS(innDetail.total_paid)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${innDetail.total_debt > 0 ? "text-status-unpaid" : "text-status-paid"}`}>
                        {innDetail.total_debt > 0 ? fmtUZS(innDetail.total_debt) : "✓"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
