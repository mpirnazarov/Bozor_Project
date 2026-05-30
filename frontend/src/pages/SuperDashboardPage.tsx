import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, LogOut, Wallet, CheckCircle2, AlertTriangle, Store, ArrowRight } from "lucide-react";
import { getSuperDashboard } from "@/api/markets";
import { setCurrentMarket } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { Spinner } from "@/components/ui/Modal";
import { fmtUZS } from "@/lib/utils";

export function SuperDashboardPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["super-dashboard"],
    queryFn: getSuperDashboard,
  });

  function openMarket(slug: string) {
    // Tanlangan bozorni o'rnatib, bozor sahifasini ochamiz
    setCurrentMarket(slug);
    navigate("/");
  }

  if (isLoading) return <Spinner label="Yuklanmoqda..." />;
  if (isError || !data)
    return (
      <div className="p-6 text-center text-sm text-status-unpaid">
        Ma'lumotlarni yuklashda xatolik
      </div>
    );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-grad shadow-glow">
              <LayoutGrid className="text-white" size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="font-display text-base font-extrabold leading-tight text-ink">
                Super Dashboard
              </h1>
              <p className="text-xs text-ink-faint">Barcha bozorlar yagona ko'rinishda</p>
            </div>
          </div>
          <button className="btn-ghost px-3.5 py-2" onClick={() => logout()}>
            <LogOut size={15} /> Chiqish
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* Umumiy ko'rsatkichlar */}
        <div>
          <div className="eyebrow mb-2">Konsolidatsiya</div>
          <div className="stagger grid gap-3 sm:grid-cols-3">
            <div className="stat-card ring-1 ring-brand/10">
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-brand/10 to-transparent blur-2xl" />
              <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-brand-grad text-white shadow-sm">
                <Wallet size={18} />
              </div>
              <div className="relative mt-4 text-xs font-bold text-ink-faint">Jami summa</div>
              <div className="relative font-display text-2xl font-extrabold tabnum text-brand">{fmtUZS(data.total)}</div>
            </div>
            <div className="stat-card ring-1 ring-status-paid/10">
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-status-paid/10 to-transparent blur-2xl" />
              <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-status-paid/12 text-status-paid shadow-sm">
                <CheckCircle2 size={18} />
              </div>
              <div className="relative mt-4 text-xs font-bold text-ink-faint">To'langan</div>
              <div className="relative font-display text-2xl font-extrabold tabnum text-status-paid">{fmtUZS(data.paid)}</div>
            </div>
            <div className="stat-card ring-1 ring-status-unpaid/10">
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-status-unpaid/10 to-transparent blur-2xl" />
              <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-status-unpaid/12 text-status-unpaid shadow-sm">
                <AlertTriangle size={18} />
              </div>
              <div className="relative mt-4 text-xs font-bold text-ink-faint">Qarzdorlik</div>
              <div className="relative font-display text-2xl font-extrabold tabnum text-status-unpaid">{fmtUZS(data.debt)}</div>
            </div>
          </div>
        </div>

        {/* Bozorlar ro'yxati */}
        <div>
          <div className="eyebrow mb-2">Bozorlar ({data.markets.length})</div>
          <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.markets.map((m) => (
              <button
                key={m.id}
                className="card group relative overflow-hidden p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-float"
                onClick={() => openMarket(m.slug)}
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand/5 blur-2xl transition-all group-hover:bg-brand/10" />
                <div className="relative mb-3 flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand">
                    <Store size={17} />
                  </div>
                  <div className="font-display font-bold text-ink">{m.name}</div>
                </div>
                <div className="relative space-y-1.5 text-sm">
                  <Row label="Jami" value={fmtUZS(m.total)} cls="text-ink" />
                  <Row label="To'langan" value={fmtUZS(m.paid)} cls="text-status-paid" />
                  <Row label="Qarz" value={fmtUZS(m.debt)} cls="text-status-unpaid" />
                </div>
                <div className="relative mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand">
                  Bozorni ochish
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            ))}
            {data.markets.length === 0 && (
              <div className="text-sm text-ink-faint">Bozorlar topilmadi</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-faint">{label}</span>
      <span className={`tabnum font-bold ${cls}`}>{value}</span>
    </div>
  );
}
