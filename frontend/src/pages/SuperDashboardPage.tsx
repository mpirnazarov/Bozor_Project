import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  LayoutGrid, LogOut, Wallet, CheckCircle2, AlertTriangle, Store,
  ArrowRight, Sun, Moon, Maximize, RefreshCw, TrendingUp,
} from "lucide-react";
import { getSuperDashboard, type MarketSummary } from "@/api/markets";
import { setCurrentMarket } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { fmtUZS } from "@/lib/utils";

type Theme = "dark" | "light";

export function SuperDashboardPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [theme, setTheme] = useState<Theme>("dark");

  // Real vaqt — har 30 soniyada avtomatik yangilanadi
  const { data, isLoading, isError, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["super-dashboard"],
    queryFn: getSuperDashboard,
    refetchInterval: 30_000,
  });

  // Soat — jonli ko'rinish uchun
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function openMarket(slug: string) {
    setCurrentMarket(slug);
    navigate("/");
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  const dark = theme === "dark";
  // Tema ranglari (CSS o'zgaruvchilar orqali)
  const t = dark
    ? {
        bg: "#070d1a",
        panel: "rgba(255,255,255,0.04)",
        panelBorder: "rgba(255,255,255,0.08)",
        text: "#f1f5f9",
        sub: "rgba(241,245,249,0.55)",
        faint: "rgba(241,245,249,0.35)",
      }
    : {
        bg: "#eef2f9",
        panel: "rgba(255,255,255,0.9)",
        panelBorder: "rgba(255,255,255,0.6)",
        text: "#0a1628",
        sub: "#475569",
        faint: "#94a3b8",
      };

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center" style={{ background: t.bg }}>
        <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-white/20 border-t-brand" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="grid min-h-screen place-items-center" style={{ background: t.bg }}>
        <div className="text-status-unpaid">Ma'lumotlarni yuklashda xatolik</div>
      </div>
    );
  }

  const paidPct = data.total ? Math.round((data.paid / data.total) * 100) : 0;
  const debtPct = 100 - paidPct;
  const maxMarket = Math.max(1, ...data.markets.map((m) => m.total));

  return (
    <div
      className="min-h-screen transition-colors duration-500"
      style={{ background: t.bg, color: t.text }}
    >
      {/* Atmosfera */}
      {dark && (
        <>
          <div className="pointer-events-none fixed -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand/20 blur-[160px]" />
          <div className="pointer-events-none fixed -bottom-48 -right-40 h-[36rem] w-[36rem] rounded-full bg-[#00a3ff]/12 blur-[180px]" />
        </>
      )}

      <div className="relative mx-auto max-w-[1700px] px-6 py-6 lg:px-10 lg:py-8">
        {/* Sarlavha qatori */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-grad shadow-glow">
              <LayoutGrid className="text-white" size={28} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold leading-tight lg:text-3xl">
                Boshqaruv Markazi
              </h1>
              <p className="text-sm" style={{ color: t.sub }}>
                Barcha bozorlar · yagona ko'rinish
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Jonli soat */}
            <div className="hidden text-right sm:block">
              <div className="font-display text-2xl font-bold tabnum lg:text-3xl">
                {now.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
              <div className="text-xs" style={{ color: t.faint }}>
                {now.toLocaleDateString("uz-UZ", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            </div>
            <IconBtn t={t} onClick={() => refetch()} title="Yangilash">
              <RefreshCw size={18} className={isFetching ? "animate-spin" : ""} />
            </IconBtn>
            <IconBtn t={t} onClick={() => setTheme(dark ? "light" : "dark")} title="Tema">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </IconBtn>
            <IconBtn t={t} onClick={toggleFullscreen} title="To'liq ekran">
              <Maximize size={18} />
            </IconBtn>
            <IconBtn t={t} onClick={() => logout()} title="Chiqish">
              <LogOut size={18} />
            </IconBtn>
          </div>
        </header>

        {/* Katta umumiy ko'rsatkichlar */}
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <BigStat
            t={t} dark={dark}
            label="Jami summa"
            value={fmtUZS(data.total)}
            icon={<Wallet size={22} />}
            accent="#0066ff"
            sub={<span className="inline-flex items-center gap-1"><TrendingUp size={13} /> {data.markets.length} ta bozor</span>}
          />
          <BigStat
            t={t} dark={dark}
            label="To'langan"
            value={fmtUZS(data.paid)}
            icon={<CheckCircle2 size={22} />}
            accent="#16a34a"
            sub={<span>{paidPct}% to'lov darajasi</span>}
          />
          <BigStat
            t={t} dark={dark}
            label="Qarzdorlik"
            value={fmtUZS(data.debt)}
            icon={<AlertTriangle size={22} />}
            accent="#dc2626"
            sub={<span>{debtPct}% undirilishi kerak</span>}
          />
        </div>

        {/* O'rta qator: to'lov taqsimoti + bozor solishtiruvi */}
        <div className="mb-6 grid gap-4 lg:grid-cols-[380px_1fr]">
          {/* To'lov holati — donut */}
          <Panel t={t} title="To'lov holati">
            <div className="flex items-center gap-6">
              <Donut paidPct={paidPct} dark={dark} />
              <div className="space-y-3">
                <Legend color="#16a34a" label="To'langan" value={`${paidPct}%`} sub={fmtUZS(data.paid)} t={t} />
                <Legend color="#dc2626" label="Qarz" value={`${debtPct}%`} sub={fmtUZS(data.debt)} t={t} />
              </div>
            </div>
          </Panel>

          {/* Bozorlar solishtiruvi — bar chart */}
          <Panel t={t} title="Bozorlar bo'yicha summa">
            <div className="space-y-3">
              {data.markets.map((m) => (
                <BarRow key={m.id} m={m} max={maxMarket} t={t} dark={dark} />
              ))}
              {data.markets.length === 0 && (
                <div className="py-6 text-center text-sm" style={{ color: t.faint }}>
                  Bozorlar topilmadi
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Bozor kartochkalari */}
        <div>
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: t.faint }}>
            Bozorlar ({data.markets.length})
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.markets.map((m) => {
              const pct = m.total ? Math.round((m.paid / m.total) * 100) : 0;
              return (
                <button
                  key={m.id}
                  onClick={() => !m.is_demo && openMarket(m.slug)}
                  className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${m.is_demo ? "cursor-default" : "hover:-translate-y-1"}`}
                  style={{ background: t.panel, borderColor: t.panelBorder }}
                >
                  <div className="mb-3 flex items-center gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand/15 text-brand">
                      <Store size={17} />
                    </div>
                    <div className="font-display font-bold">{m.name}</div>
                    {m.is_demo && (
                      <span className="ml-auto rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-500">
                        demo
                      </span>
                    )}
                  </div>
                  <div className="mb-1 font-display text-xl font-extrabold tabnum">{fmtUZS(m.total)}</div>
                  <div className="mb-3 h-1.5 overflow-hidden rounded-full" style={{ background: dark ? "rgba(255,255,255,0.1)" : "#e2e8f0" }}>
                    <div className="h-full rounded-full bg-status-paid transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs" style={{ color: t.sub }}>
                    <span className="text-status-paid">{fmtUZS(m.paid)}</span>
                    <span className="text-status-unpaid">{fmtUZS(m.debt)}</span>
                  </div>
                  {m.is_demo ? (
                    <div className="mt-3 text-xs font-semibold" style={{ color: t.faint }}>
                      Namuna ma'lumot
                    </div>
                  ) : (
                    <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand">
                      Ochish <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pastki holat satri */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs" style={{ color: t.faint }}>
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-status-paid" />
          Jonli · oxirgi yangilanish {new Date(dataUpdatedAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

function IconBtn({ t, onClick, title, children }: { t: any; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid h-11 w-11 place-items-center rounded-xl border backdrop-blur transition-all hover:scale-105"
      style={{ background: t.panel, borderColor: t.panelBorder, color: t.text }}
    >
      {children}
    </button>
  );
}

function BigStat({
  t, dark, label, value, icon, accent, sub,
}: {
  t: any; dark: boolean; label: string; value: string;
  icon: React.ReactNode; accent: string; sub: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border p-6 backdrop-blur lg:p-7"
      style={{ background: t.panel, borderColor: t.panelBorder }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
        style={{ background: accent, opacity: dark ? 0.18 : 0.1 }}
      />
      <div className="relative flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-lg" style={{ background: accent }}>
          {icon}
        </div>
        <span className="text-sm font-bold" style={{ color: t.sub }}>{label}</span>
      </div>
      <div className="relative mt-4 font-display text-3xl font-extrabold tabnum lg:text-[2.6rem] lg:leading-none" style={{ color: accent }}>
        {value}
      </div>
      <div className="relative mt-3 text-sm font-semibold" style={{ color: t.sub }}>{sub}</div>
    </div>
  );
}

function Panel({ t, title, children }: { t: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border p-6 backdrop-blur" style={{ background: t.panel, borderColor: t.panelBorder }}>
      <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: t.faint }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Donut({ paidPct, dark }: { paidPct: number; dark: boolean }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const paidLen = (paidPct / 100) * C;
  return (
    <div className="relative grid place-items-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke={dark ? "rgba(255,255,255,0.08)" : "#e2e8f0"} strokeWidth="16" />
        <circle cx="70" cy="70" r={R} fill="none" stroke="#dc2626" strokeWidth="16"
          strokeDasharray={`${C} ${C}`} strokeDashoffset={paidLen} strokeLinecap="round" />
        <circle cx="70" cy="70" r={R} fill="none" stroke="#16a34a" strokeWidth="16"
          strokeDasharray={`${paidLen} ${C}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)" }} />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-2xl font-extrabold tabnum text-status-paid">{paidPct}%</div>
        <div className="text-[10px] font-bold uppercase tracking-wide opacity-50">to'langan</div>
      </div>
    </div>
  );
}

function Legend({ color, label, value, sub, t }: { color: string; label: string; value: string; sub: string; t: any }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-3 w-3 rounded-sm" style={{ background: color }} />
      <div>
        <div className="text-sm font-bold">{label} · {value}</div>
        <div className="text-xs tabnum" style={{ color: t.sub }}>{sub}</div>
      </div>
    </div>
  );
}

function BarRow({ m, max, t, dark }: { m: MarketSummary; max: number; t: any; dark: boolean }) {
  const totalPct = (m.total / max) * 100;
  const paidPct = m.total ? (m.paid / m.total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-semibold">{m.name}</span>
        <span className="tabnum font-bold" style={{ color: t.sub }}>{fmtUZS(m.total)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full" style={{ background: dark ? "rgba(255,255,255,0.06)" : "#e2e8f0" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${totalPct}%`, background: "linear-gradient(90deg,#0066ff,#00a3ff)" }}>
          <div className="h-full rounded-full bg-status-paid/70" style={{ width: `${paidPct}%` }} />
        </div>
      </div>
    </div>
  );
}
