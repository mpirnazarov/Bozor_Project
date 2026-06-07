import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Store, Plus, Trash2, KeyRound, Power, PowerOff, Check, X, Copy,
  AlertTriangle, CalendarClock, LogOut, CreditCard, ArrowRight, ArrowUpRight,
  Cpu, MemoryStick, Server, Rocket, CircleCheck, CircleX, Circle,
  Activity, Wallet, Crown, Eye, ShieldAlert, Sparkles,
} from "lucide-react";
import {
  ownerListMarkets, ownerCreateMarket, ownerDeleteMarket, ownerChangePassword,
  ownerMarkPayment, ownerBlockMarket, getOwnerRailway,
  type OwnerMarket, type NewMarketResult, type RailwayOverview,
} from "@/api/owner";
import { useAuthStore } from "@/store/authStore";
import { fmtUZS } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
const MONTHS_FULL = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

export function OwnerPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const { data: markets, isLoading } = useQuery({ queryKey: ["owner-markets"], queryFn: ownerListMarkets });
  const { data: railway } = useQuery({
    queryKey: ["owner-railway"], queryFn: getOwnerRailway, refetchInterval: 60_000, retry: false,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [created, setCreated] = useState<NewMarketResult | null>(null);
  const [pwdFor, setPwdFor] = useState<OwnerMarket | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [showAttention, setShowAttention] = useState(true);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["owner-markets"] });

  const createMut = useMutation({
    mutationFn: () => ownerCreateMarket(newName.trim()),
    onSuccess: (r) => { setCreated(r); setNewName(""); setShowCreate(false); invalidate(); },
  });
  const delMut = useMutation({ mutationFn: (id: number) => ownerDeleteMarket(id), onSuccess: invalidate });
  const blockMut = useMutation({
    mutationFn: ({ id, b }: { id: number; b: boolean }) => ownerBlockMarket(id, b), onSuccess: invalidate,
  });
  const payMut = useMutation({
    mutationFn: ({ id, y, m, paid }: { id: number; y: number; m: number; paid: boolean }) =>
      ownerMarkPayment(id, y, m, paid),
    onSuccess: invalidate,
  });
  const pwdMut = useMutation({
    mutationFn: ({ id, p }: { id: number; p: string }) => ownerChangePassword(id, p),
    onSuccess: () => { setPwdFor(null); setNewPwd(""); },
  });

  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;

  // Yig'ma ko'rsatkichlar
  const stats = useMemo(() => {
    const list = markets ?? [];
    let collected = 0, attention = 0, reds = 0, paid = 0, freeCount = 0;
    for (const m of list) {
      const a = m.support?.attention;
      if (a === "red" || a === "yellow" || a === "blocked") attention++;
      if (a === "red" || a === "blocked") reds++;
      if (m.support?.paid_this_month) { paid++; collected += m.support?.monthly_fee || 0; }
      if (m.support?.free_period) freeCount++;
    }
    return { total: list.length, collected, attention, reds, paid, freeCount };
  }, [markets]);

  const attentionMarkets = useMemo(
    () => (markets ?? []).filter((m) => {
      const a = m.support?.attention;
      return a === "red" || a === "yellow" || a === "blocked";
    }),
    [markets],
  );

  const greeting = now.getHours() < 12 ? "Xayrli tong" : now.getHours() < 18 ? "Xayrli kun" : "Xayrli kech";
  const ownerName = user?.full_name || user?.username || "Egasi";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060b18] text-slate-100">
      {/* Atmosfera: glow orbs + mesh + grain */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-40 -top-48 h-[40rem] w-[40rem] rounded-full bg-[#0066ff]/25 blur-[170px]" />
        <div className="absolute -right-48 top-1/3 h-[36rem] w-[36rem] rounded-full bg-[#00a3ff]/15 blur-[180px]" />
        <div className="absolute bottom-0 left-1/3 h-[32rem] w-[32rem] rounded-full bg-[#7c3aed]/12 blur-[200px]" />
        <div className="absolute inset-0 opacity-[0.5]"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>

      <div className="relative z-10 mx-auto max-w-[1500px] px-5 py-7 lg:px-10 lg:py-9">
        {/* ===== HERO HEADER ===== */}
        <header className="mb-9 flex flex-wrap items-start justify-between gap-5 animate-fade-up">
          <div className="flex items-center gap-4">
            <div className="relative grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-[#0066ff] to-[#00a3ff] shadow-[0_8px_32px_-4px_rgba(0,102,255,0.6)]">
              <Crown className="text-white" size={30} strokeWidth={2.2} />
              <span className="absolute -right-1 -top-1 flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-amber-400 ring-2 ring-[#060b18]" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#5b9dff]">
                <Sparkles size={13} /> Dastur egasi · Command Center
              </div>
              <h1 className="mt-1 font-display text-3xl font-extrabold leading-none tracking-tight text-white lg:text-4xl">
                {greeting}, {ownerName}
              </h1>
              <p className="mt-1.5 text-sm text-slate-400">
                Barcha bozorlar va platforma holatini bir joydan boshqaring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-right backdrop-blur sm:block">
              <div className="font-display text-2xl font-bold tabnum tracking-tight text-white">
                {now.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
              <div className="text-[11px] text-slate-400">
                {now.toLocaleDateString("uz-UZ", { weekday: "long", day: "numeric", month: "long" })}
              </div>
            </div>
            <LanguageSwitcher dark />
            <button onClick={() => setShowCreate(true)}
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#0066ff] to-[#0090ff] px-4 py-2.5 text-sm font-bold text-white shadow-[0_6px_24px_-6px_rgba(0,102,255,0.7)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_32px_-6px_rgba(0,102,255,0.8)]">
              <Plus size={17} className="transition-transform group-hover:rotate-90" /> Yangi bozor
            </button>
            <button onClick={() => logout()} title="Chiqish"
              className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-300 backdrop-blur transition-colors hover:bg-white/10 hover:text-white">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* ===== KPI CARDS ===== */}
        <div className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard delay={0} icon={<Store size={20} />} accent="#0066ff"
            label="Jami bozorlar" value={stats.total} suffix="ta"
            hint={`${stats.freeCount} ta tekin davrda`} />
          <KpiCard delay={70} icon={<Wallet size={20} />} accent="#16a34a"
            label="Bu oy yig'ildi" value={fmtUZS(stats.collected)} isMoney
            hint={`${stats.paid} ta bozor to'ladi`} />
          <KpiCard delay={140} icon={<CreditCard size={20} />} accent="#00a3ff"
            label="To'lov holati" value={`${stats.paid}/${Math.max(stats.total - stats.freeCount, 0)}`}
            hint="to'langan / kutilayotgan" />
          <KpiCard delay={210} icon={<ShieldAlert size={20} />} accent={stats.reds > 0 ? "#dc2626" : stats.attention > 0 ? "#eab308" : "#16a34a"}
            label="E'tibor kerak" value={stats.attention} suffix="ta"
            hint={stats.reds > 0 ? `${stats.reds} ta kechikkan!` : "hammasi joyida"}
            danger={stats.reds > 0} />
        </div>

        {/* ===== ATTENTION CENTER ===== */}
        <div className="mb-7 animate-fade-up" style={{ animationDelay: "240ms" }}>
          <AttentionCenter
            markets={attentionMarkets}
            open={showAttention}
            onToggle={() => setShowAttention((v) => !v)}
            onOpen={(slug) => navigate(`/?market=${slug}`)}
            curM={curM}
          />
        </div>

        {/* ===== RAILWAY MONITOR ===== */}
        {railway?.configured && (
          <div className="mb-7 animate-fade-up" style={{ animationDelay: "300ms" }}>
            <RailwayMonitor railway={railway} />
          </div>
        )}

        {/* Yaratilgan bozor login/parol */}
        {created && (
          <div className="mb-6 overflow-hidden rounded-3xl border border-[#16a34a]/30 bg-[#16a34a]/[0.06] p-5 backdrop-blur animate-scale-in">
            <div className="mb-2 flex items-center gap-2 font-bold text-[#4ade80]">
              <Check size={18} /> «{created.name}» yaratildi
            </div>
            <p className="mb-3 text-sm text-slate-300">Login va parolni saqlab oling — parol qayta ko'rsatilmaydi:</p>
            <div className="flex flex-wrap gap-2">
              <CredBox label="Login" value={created.credentials.username} />
              <CredBox label="Parol" value={created.credentials.password} />
            </div>
            <button onClick={() => setCreated(null)}
              className="mt-3 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white">
              <X size={14} /> Yopish
            </button>
          </div>
        )}

        {/* ===== MARKETS GRID ===== */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            <Activity size={14} /> Bozorlar ({stats.total})
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-white/[0.04]" />)}
          </div>
        ) : (markets?.length ?? 0) === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center text-slate-400">
            Hali bozor yo'q. «Yangi bozor» tugmasi bilan qo'shing.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {markets!.map((m, i) => (
              <MarketCard
                key={m.id} m={m} curM={curM} delay={i * 60}
                onView={() => navigate(`/?market=${m.slug}`)}
                onPay={(paid) => payMut.mutate({ id: m.id, y: curY, m: curM, paid })}
                onBlock={(b) => blockMut.mutate({ id: m.id, b })}
                onPwd={() => setPwdFor(m)}
                onDelete={() => { if (confirm(`«${m.name}» o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`)) delMut.mutate(m.id); }}
                busy={payMut.isPending || blockMut.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* ===== Yangi bozor modal ===== */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="Yangi bozor yaratish">
          <label className="mb-1.5 block text-xs font-bold text-slate-400">Bozor nomi</label>
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Masalan: Chorsu bozori"
            onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) createMut.mutate(); }}
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-[#0066ff] focus:ring-4 focus:ring-[#0066ff]/20" />
          <div className="mt-4 flex gap-2">
            <button onClick={() => createMut.mutate()} disabled={!newName.trim() || createMut.isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0066ff] to-[#0090ff] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              <Check size={16} /> {createMut.isPending ? "Yaratilmoqda..." : "Yaratish"}
            </button>
            <button onClick={() => setShowCreate(false)}
              className="rounded-xl border border-white/10 bg-white/[0.05] px-4 text-slate-300 hover:text-white"><X size={18} /></button>
          </div>
        </Modal>
      )}

      {/* ===== Parol modal ===== */}
      {pwdFor && (
        <Modal onClose={() => setPwdFor(null)} title={`«${pwdFor.name}» parolini o'zgartirish`}>
          <div className="mb-2 text-xs text-slate-500">Login: {pwdFor.admin_username ?? "—"}</div>
          <input autoFocus type="text" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
            placeholder="Yangi parol (kamida 6 belgi)"
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-[#0066ff] focus:ring-4 focus:ring-[#0066ff]/20" />
          <div className="mt-4 flex gap-2">
            <button onClick={() => pwdMut.mutate({ id: pwdFor.id, p: newPwd })} disabled={newPwd.length < 6 || pwdMut.isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0066ff] to-[#0090ff] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              <KeyRound size={15} /> Saqlash
            </button>
            <button onClick={() => setPwdFor(null)}
              className="rounded-xl border border-white/10 bg-white/[0.05] px-4 text-slate-300 hover:text-white"><X size={18} /></button>
          </div>
          {pwdMut.isSuccess && <div className="mt-2 text-xs font-semibold text-[#4ade80]">✓ Parol o'zgartirildi</div>}
        </Modal>
      )}
    </div>
  );
}

/* ============ KPI CARD ============ */
function KpiCard({ icon, accent, label, value, suffix, hint, delay, isMoney, danger }: {
  icon: React.ReactNode; accent: string; label: string; value: string | number;
  suffix?: string; hint?: string; delay: number; isMoney?: boolean; danger?: boolean;
}) {
  return (
    <div className="group relative animate-fade-up overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
      style={{ animationDelay: `${delay}ms` }}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ background: accent }} />
      <div className="mb-4 flex items-center justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: `${accent}22`, color: accent }}>
          {icon}
        </span>
        {danger && (
          <span className="flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full opacity-75" style={{ background: accent }} />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
          </span>
        )}
      </div>
      <div className={`font-display font-extrabold tracking-tight text-white tabnum ${isMoney ? "text-xl" : "text-3xl"}`}>
        {value}{suffix && <span className="ml-1 text-sm font-bold text-slate-400">{suffix}</span>}
      </div>
      <div className="mt-1 text-xs font-semibold text-slate-400">{label}</div>
      {hint && <div className="mt-2 text-[11px]" style={{ color: danger ? accent : "rgba(148,163,184,0.7)" }}>{hint}</div>}
    </div>
  );
}

/* ============ ATTENTION CENTER ============ */
function AttentionCenter({ markets, open, onToggle, onOpen, curM }: {
  markets: OwnerMarket[]; open: boolean; onToggle: () => void;
  onOpen: (slug: string) => void; curM: number;
}) {
  if (markets.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-[#16a34a]/25 bg-gradient-to-r from-[#16a34a]/[0.08] to-transparent px-6 py-5 backdrop-blur">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#16a34a]/15 text-[#4ade80]"><CircleCheck size={22} /></span>
        <div>
          <div className="font-display font-bold text-white">Hammasi joyida ✓</div>
          <div className="text-sm text-slate-400">Barcha bozorlar to'lovi nazoratda — e'tibor talab qiladigan holat yo'q</div>
        </div>
      </div>
    );
  }
  const reds = markets.filter((m) => m.support?.attention === "red" || m.support?.attention === "blocked").length;
  const yellows = markets.filter((m) => m.support?.attention === "yellow").length;
  const hasRed = reds > 0;
  const accent = hasRed ? "#dc2626" : "#eab308";

  return (
    <div className="overflow-hidden rounded-3xl border backdrop-blur-xl"
      style={{ borderColor: `${accent}44`, background: `linear-gradient(120deg, ${accent}14, transparent 70%)` }}>
      <button onClick={onToggle} className="flex w-full items-center gap-4 px-6 py-5 text-left">
        <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: `${accent}22`, color: accent }}>
          <AlertTriangle size={24} />
          {hasRed && <span className="absolute inset-0 animate-ping rounded-2xl opacity-40" style={{ background: accent }} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-extrabold text-white">
            {markets.length} ta bozor e'tibor talab qiladi
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
            {reds > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dc2626]/15 px-2.5 py-1 font-bold text-[#f87171]">
                <span className="h-2 w-2 rounded-full bg-[#dc2626]" /> {reds} ta SROCHNO (kechikkan)
              </span>
            )}
            {yellows > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 font-bold text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> {yellows} ta yaqinlashmoqda
              </span>
            )}
          </div>
        </div>
        <ArrowRight size={20} style={{ color: accent, transform: open ? "rotate(90deg)" : "none", transition: "transform .25s" }} />
      </button>
      {open && (
        <div className="space-y-1 border-t px-3 pb-3 pt-2" style={{ borderColor: `${accent}22` }}>
          {markets.map((m) => (
            <button key={m.id} onClick={() => onOpen(m.slug)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/[0.05]">
              <AttentionDot attention={m.support.attention} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-white">{m.name}</div>
                <div className="text-xs text-slate-500">/{m.slug} · {m.shop_count} magazin</div>
              </div>
              <span className="rounded-full px-2.5 py-1 text-xs font-bold"
                style={{ background: `${attColor(m.support.attention)}1f`, color: attColor(m.support.attention) }}>
                {attLabel(m.support.attention)}
              </span>
              <span className="hidden tabnum text-xs text-slate-400 sm:block">{fmtUZS(m.support.monthly_fee)}</span>
              <ArrowUpRight size={16} className="text-slate-500" />
            </button>
          ))}
          <div className="px-3 pt-1 text-[11px] text-slate-500">
            {MONTHS_FULL[curM - 1]} oyi uchun to'lov holati
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ MARKET CARD ============ */
function MarketCard({ m, curM, onView, onPay, onBlock, onPwd, onDelete, delay, busy }: {
  m: OwnerMarket; curM: number; delay: number; busy: boolean;
  onView: () => void; onPay: (paid: boolean) => void; onBlock: (b: boolean) => void;
  onPwd: () => void; onDelete: () => void;
}) {
  const s = m.support;
  const ring = attColor(s.attention);
  return (
    <div className="group relative animate-fade-up overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_20px_48px_-16px_rgba(0,0,0,0.6)]"
      style={{ animationDelay: `${delay}ms` }}>
      {/* status accent line */}
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${ring}, transparent)` }} />

      <div className="flex items-start gap-4">
        <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-white/10 to-white/[0.02] ring-1 ring-white/10">
          <Store size={22} className="text-[#5b9dff]" />
          <span className="absolute -bottom-1 -right-1"><AttentionDot attention={s.attention} /></span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-lg font-bold text-white">{m.name}</h3>
            {m.support_blocked && (
              <span className="rounded-full bg-[#dc2626]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#f87171]">Bloklangan</span>
            )}
          </div>
          <div className="mt-0.5 font-mono text-xs text-slate-500">
            /{m.slug} · {m.shop_count} magazin · {m.admin_username ?? "—"}
          </div>
          {/* status pill */}
          <div className="mt-2.5">
            {s.free_period ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0066ff]/15 px-3 py-1 text-xs font-bold text-[#5b9dff]">
                <CalendarClock size={13} /> Tekin davr ({s.free_until} gacha)
              </span>
            ) : s.paid_this_month ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#16a34a]/15 px-3 py-1 text-xs font-bold text-[#4ade80]">
                <Check size={13} /> {MONTHS[curM - 1]} to'langan
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                style={{ background: `${ring}1f`, color: ring }}>
                <AlertTriangle size={13} /> {MONTHS[curM - 1]} {attLabel(s.attention).toLowerCase()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Amallar */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-4">
        <ActBtn onClick={onView}><Eye size={14} /> Ko'rish</ActBtn>

        {!s.free_period && (
          s.paid_this_month ? (
            <button onClick={() => onPay(false)} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-[#f87171] transition-colors hover:bg-white/10 disabled:opacity-50">
              To'lovni bekor qilish
            </button>
          ) : (
            <button onClick={() => onPay(true)} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#16a34a] to-[#22c55e] px-3 py-1.5 text-xs font-bold text-white shadow-[0_4px_16px_-4px_rgba(22,163,74,0.6)] transition-all hover:-translate-y-0.5 disabled:opacity-50">
              <CreditCard size={14} /> To'landi ({fmtUZS(s.monthly_fee)})
            </button>
          )
        )}

        <ActBtn onClick={onPwd}><KeyRound size={14} /> Parol</ActBtn>
        <button onClick={() => onBlock(!m.support_blocked)} disabled={busy}
          className={`inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10 disabled:opacity-50 ${m.support_blocked ? "text-[#4ade80]" : "text-amber-300"}`}>
          {m.support_blocked ? <><Power size={14} /> Blokdan chiqarish</> : <><PowerOff size={14} /> Bloklash</>}
        </button>
        <button onClick={onDelete}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:border-[#dc2626]/30 hover:bg-[#dc2626]/10 hover:text-[#f87171]">
          <Trash2 size={14} />
        </button>
      </div>

      {s.needs_warning && !m.support_blocked && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#dc2626]/10 px-3 py-2 text-xs font-semibold text-[#f87171]">
          <AlertTriangle size={13} /> {s.due_day}-sanadan o'tdi — to'lov hali belgilanmagan
        </div>
      )}
    </div>
  );
}

function ActBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
      {children}
    </button>
  );
}

/* ============ RAILWAY MONITOR ============ */
function RailwayMonitor({ railway }: { railway: RailwayOverview }) {
  const m = railway.metrics || {};
  const deploys = railway.deployments || [];
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        <Server size={14} className="text-[#5b9dff]" /> Railway server holati
        <span className="ml-1 flex h-2 w-2"><span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-[#4ade80] opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ade80]" /></span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_2fr]">
        <Gauge icon={<Cpu size={15} />} label="CPU" accent="#0066ff" err={railway.metrics_error}
          value={m.cpu_vcpu_latest != null ? `${m.cpu_vcpu_latest}` : "—"} unit="vCPU"
          avg={m.cpu_vcpu_avg != null ? `${m.cpu_vcpu_avg} vCPU` : undefined} />
        <Gauge icon={<MemoryStick size={15} />} label="RAM" accent="#7c3aed" err={railway.metrics_error}
          value={m.ram_gb_latest != null ? `${m.ram_gb_latest}` : "—"} unit="GB"
          avg={m.ram_gb_avg != null ? `${m.ram_gb_avg} GB` : undefined} />
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-slate-400"><Rocket size={14} /> Oxirgi deploymentlar</div>
          {railway.deployments_error ? <div className="text-xs text-[#f87171]">Ma'lumot yuklanmadi</div>
            : deploys.length === 0 ? <div className="text-xs text-slate-500">Deployment topilmadi</div> : (
            <div className="space-y-2">
              {deploys.slice(0, 5).map((d) => {
                const st = deployStatusStyle(d.status);
                const Icon = st.icon;
                return (
                  <div key={d.id} className="flex items-center gap-2 text-xs">
                    <Icon size={14} style={{ color: st.color }} />
                    <span className="font-semibold" style={{ color: st.color }}>{st.label}</span>
                    <span className="ml-auto font-mono text-slate-500">
                      {d.created_at ? new Date(d.created_at).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Gauge({ icon, label, accent, value, unit, avg, err }: {
  icon: React.ReactNode; label: string; accent: string; value: string; unit: string;
  avg?: string; err?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-xl" style={{ background: accent }} />
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-400" style={{ color: accent }}>{icon} {label}</div>
      {err ? <div className="text-xs text-[#f87171]">Ma'lumot yo'q</div> : (
        <>
          <div className="font-display text-2xl font-extrabold tabnum text-white">
            {value}<span className="ml-1 text-sm font-bold text-slate-500">{unit}</span>
          </div>
          {avg && <div className="text-[11px] text-slate-500">1 soat o'rtacha: {avg}</div>}
        </>
      )}
    </div>
  );
}

/* ============ SHARED ============ */
function Modal({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0c1424] p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 font-display text-lg font-bold text-white">{title}</div>
        {children}
      </div>
    </div>
  );
}

function CredBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <span className="text-xs font-bold text-slate-500">{label}:</span>
      <span className="font-mono text-sm font-bold text-white">{value}</span>
      <button onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="text-slate-500 hover:text-[#5b9dff]">
        {copied ? <Check size={14} className="text-[#4ade80]" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function attColor(a: string): string {
  if (a === "red" || a === "blocked") return "#dc2626";
  if (a === "yellow") return "#eab308";
  if (a === "ok") return "#16a34a";
  return "#5b9dff";
}
function attLabel(a: string): string {
  if (a === "blocked") return "Bloklangan";
  if (a === "red") return "Kechikkan!";
  if (a === "yellow") return "To'lov yaqin";
  if (a === "ok") return "To'langan";
  return "Tekin davr";
}
function AttentionDot({ attention }: { attention: string }) {
  const color = attColor(attention);
  const pulse = attention === "red" || attention === "blocked";
  return (
    <span className="relative flex h-3.5 w-3.5 shrink-0">
      {pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: color }} />}
      <span className="relative inline-flex h-3.5 w-3.5 rounded-full ring-2 ring-[#0c1424]" style={{ background: color }} />
    </span>
  );
}
function deployStatusStyle(status: string): { color: string; icon: any; label: string } {
  const s = (status || "").toUpperCase();
  if (s === "SUCCESS") return { color: "#4ade80", icon: CircleCheck, label: "Muvaffaqiyatli" };
  if (s === "FAILED" || s === "CRASHED") return { color: "#f87171", icon: CircleX, label: "Xato" };
  if (s === "BUILDING" || s === "DEPLOYING" || s === "INITIALIZING") return { color: "#fbbf24", icon: Circle, label: "Jarayonda" };
  if (s === "REMOVED") return { color: "#64748b", icon: Circle, label: "O'chirilgan" };
  return { color: "#64748b", icon: Circle, label: status || "—" };
}
