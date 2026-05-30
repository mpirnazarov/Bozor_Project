import { useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";
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
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-extrabold text-slate-800">
              O'rikzor Savdo Kompleksi
            </h1>
            <p className="text-xs text-slate-400">Bozor boshqaruv tizimi</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {user?.username}
              {user?.role === "admin" && (
                <span className="ml-1 rounded bg-brand/10 px-1.5 py-0.5 text-xs font-bold text-brand">
                  admin
                </span>
              )}
            </span>
            {user?.role === "admin" && (
              <Link to="/admin" className="btn-ghost" title="Admin panel">
                <Settings size={16} />
              </Link>
            )}
            <button onClick={() => logout()} className="btn-ghost" title="Chiqish">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
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
