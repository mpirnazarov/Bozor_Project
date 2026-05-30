import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, RefreshCw } from "lucide-react";
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

  return (
    <>
      <div className="flex flex-wrap items-stretch gap-3">
        <StatCard
          label="Jami"
          value={data?.total}
          loading={isLoading}
          color="text-brand"
        />
        <StatCard
          label="To'langan"
          value={data?.paid}
          loading={isLoading}
          color="text-status-paid"
          action={
            <button
              onClick={() => setShowBreakdown(true)}
              className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-status-paid text-white"
              title="Tushum tarkibi"
            >
              <Info size={11} />
            </button>
          }
        />
        <StatCard
          label="Qarzdorlik"
          value={data ? data.debt : undefined}
          loading={isLoading}
          color="text-status-unpaid"
        />

        <button
          onClick={() => {
            setLive((v) => !v);
            setTimeout(() => refetch(), 0);
          }}
          className={`flex items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors ${
            live
              ? "border-brand bg-brand/10 text-brand"
              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          }`}
          title="monthly_balances'dan real hisoblash"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          {live ? "Real ma'lumot" : "Real hisobla"}
        </button>
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
              <span className="text-sm font-medium text-slate-600">{it.name}</span>
              <span className="font-mono text-sm font-bold text-slate-800">
                {fmtUZS(it.amount)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t-2 border-slate-200 pt-3">
          <span className="text-sm font-extrabold text-slate-800">Jami to'langan</span>
          <span className="font-mono text-base font-extrabold text-status-paid">
            {fmtUZS(data?.paid ?? 0)}
          </span>
        </div>
      </Modal>
    </>
  );
}

function StatCard({
  label,
  value,
  loading,
  color,
  action,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  color: string;
  action?: ReactNode;
}) {
  return (
    <div className="card min-w-[150px] flex-1 px-4 py-3">
      <div className="flex items-center text-xs font-semibold text-slate-400">
        {label}
        {action}
      </div>
      <div className={`mt-1 font-mono text-lg font-extrabold ${color}`}>
        {loading ? "…" : fmtUZS(value ?? 0)}
      </div>
    </div>
  );
}
