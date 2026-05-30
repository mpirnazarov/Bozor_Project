import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, RefreshCw, Wallet, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
import { getDashboard } from "@/api/dashboard";
import { fmtUZS } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

export function HeaderStats() {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [live, setLive] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["dashboard", live],
    queryFn: () => getDashboard(live),
  });

  const services = data?.services;
  const breakdownItems = services
    ? [
        { name: "🏪 Arenda", amount: services.rent },
        { name: "🛒 Arava xizmati", amount: services.arava },
        { name: "🚻 Xojatxona xizmati", amount: services.xojatxona },
        { name: "🚗 Avtomobillarni saqlash", amount: services.parking },
        { name: "📦 Boshqa tushumlar", amount: services.boshqa },
      ]
    : [];

  const paidPct = data && data.total ? Math.round((data.paid / data.total) * 100) : 0;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="eyebrow">Umumiy ko'rsatkichlar</div>
          <h2 className="font-display text-lg font-bold text-ink">Moliyaviy holat</h2>
        </div>
        <button
          onClick={() => {
            setLive((v) => !v);
            setTimeout(() => refetch(), 0);
          }}
          className={live ? "btn-primary px-3.5 py-2" : "btn-ghost px-3.5 py-2"}
          title="monthly_balances'dan real hisoblash"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          {live ? "Real ma'lumot" : "Real hisobla"}
        </button>
      </div>

      <div className="stagger grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Jami summa"
          value={data?.total}
          loading={isLoading}
          icon={<Wallet size={18} />}
          tone="brand"
          footer={
            <span className="inline-flex items-center gap-1 text-ink-faint">
              <TrendingUp size={12} /> umumiy hisob-kitob
            </span>
          }
        />
        <StatCard
          label="To'langan"
          value={data?.paid}
          loading={isLoading}
          icon={<CheckCircle2 size={18} />}
          tone="paid"
          footer={
            <div className="flex w-full items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-status-paid/15">
                <div
                  className="h-full rounded-full bg-status-paid transition-all duration-700"
                  style={{ width: `${paidPct}%` }}
                />
              </div>
              <span className="tabnum text-[11px] font-bold text-status-paid">{paidPct}%</span>
            </div>
          }
          action={
            <button
              onClick={() => setShowBreakdown(true)}
              className="grid h-5 w-5 place-items-center rounded-full bg-status-paid/12 text-status-paid transition-colors hover:bg-status-paid/20"
              title="Tushum tarkibi"
            >
              <Info size={12} />
            </button>
          }
        />
        <StatCard
          label="Qarzdorlik"
          value={data?.debt}
          loading={isLoading}
          icon={<AlertTriangle size={18} />}
          tone="unpaid"
          footer={
            <span className="inline-flex items-center gap-1 text-ink-faint">
              undirilishi kerak
            </span>
          }
        />
      </div>

      <Modal
        open={showBreakdown}
        onClose={() => setShowBreakdown(false)}
        title="To'langan summa tarkibi"
        maxWidth="max-w-md"
      >
        <div className="divide-y divide-slate-100">
          {breakdownItems.map((it) => (
            <div key={it.name} className="flex items-center justify-between py-2.5">
              <span className="text-sm font-medium text-ink-soft">{it.name}</span>
              <span className="tabnum text-sm font-bold text-ink">{fmtUZS(it.amount)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-status-paid/8 px-3 py-3">
          <span className="text-sm font-extrabold text-ink">Jami to'langan</span>
          <span className="tabnum text-base font-extrabold text-status-paid">
            {fmtUZS(data?.paid ?? 0)}
          </span>
        </div>
      </Modal>
    </>
  );
}

const TONE: Record<string, { text: string; ring: string; iconBg: string; glow: string }> = {
  brand: { text: "text-brand", ring: "ring-brand/10", iconBg: "bg-brand-grad text-white", glow: "from-brand/10" },
  paid: { text: "text-status-paid", ring: "ring-status-paid/10", iconBg: "bg-status-paid/12 text-status-paid", glow: "from-status-paid/10" },
  unpaid: { text: "text-status-unpaid", ring: "ring-status-unpaid/10", iconBg: "bg-status-unpaid/12 text-status-unpaid", glow: "from-status-unpaid/10" },
};

function StatCard({
  label, value, loading, icon, tone, action, footer,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  icon: ReactNode;
  tone: keyof typeof TONE | string;
  action?: ReactNode;
  footer?: ReactNode;
}) {
  const t = TONE[tone] ?? TONE.brand;
  return (
    <div className={`stat-card ring-1 ${t.ring}`}>
      <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${t.glow} to-transparent blur-2xl`} />
      <div className="relative flex items-start justify-between">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${t.iconBg} shadow-sm`}>
          {icon}
        </div>
        {action}
      </div>
      <div className="relative mt-4 flex items-center gap-1.5 text-xs font-bold text-ink-faint">
        {label}
      </div>
      <div className={`relative mt-0.5 font-display text-2xl font-extrabold tabnum ${t.text}`}>
        {loading ? <span className="skeleton inline-block h-7 w-32" /> : fmtUZS(value ?? 0)}
      </div>
      {footer && <div className="relative mt-3 text-[11px] font-semibold">{footer}</div>}
    </div>
  );
}
