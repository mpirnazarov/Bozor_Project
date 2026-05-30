import { useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Settings, Store } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { HeaderStats } from "@/components/Dashboard/HeaderStats";
import { InnSearch } from "@/components/INN/InnSearch";
import { MapView } from "@/components/Map/MapView";
import { PavilionModal } from "@/components/Map/PavilionModal";
import { ShopDetailModal } from "@/components/Map/ShopDetailModal";
import { useQuery } from "@tanstack/react-query";
import { getInn } from "@/api/inn";
import { Modal } from "@/components/ui/Modal";
import type { Pavilion } from "@/types/api";

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = ["admin", "super_admin", "market_admin"].includes(user?.role ?? "");

  const [activePavilion, setActivePavilion] = useState<Pavilion | null>(null);
  const [activeShop, setActiveShop] = useState<string | null>(null);
  const [activeInn, setActiveInn] = useState<string | null>(null);

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
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-grad shadow-glow">
              <Store className="text-white" size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="font-display text-base font-extrabold leading-tight text-ink">
                O'rikzor Savdo Kompleksi
              </h1>
              <p className="text-xs text-ink-faint">Bozor boshqaruv tizimi</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-full bg-white/60 py-1 pl-3 pr-1.5 ring-1 ring-slate-200/70">
              <span className="text-sm font-semibold text-ink-soft">{user?.username}</span>
              {isAdmin && (
                <span className="rounded-full bg-brand-grad px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  admin
                </span>
              )}
            </div>
            {isAdmin && (
              <Link to="/admin" className="btn-ghost px-2.5 py-2" title="Admin panel">
                <Settings size={16} />
              </Link>
            )}
            <button onClick={() => logout()} className="btn-ghost px-2.5 py-2" title="Chiqish">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <HeaderStats />
        <InnSearch onSelectInn={setActiveInn} />
        <MapView onSelectPavilion={setActivePavilion} />
      </main>

      <PavilionModal
        pavilionId={activePavilion?.id ?? null}
        pavilionName={activePavilion?.display_name ?? ""}
        onClose={() => setActivePavilion(null)}
        onSelectShop={(id) => {
          setActivePavilion(null);
          setActiveShop(id);
        }}
      />

      <ShopDetailModal shopId={activeShop} onClose={() => setActiveShop(null)} />

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
