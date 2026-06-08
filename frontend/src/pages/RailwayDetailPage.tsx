import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Server, RefreshCw, Activity, Rocket, Gauge as GaugeIcon, Info,
} from "lucide-react";
import { getOwnerRailway } from "@/api/owner";
import {
  MetricCard, DeploymentRow, ServiceChips, usageColor, usageLabel,
  HistoryChart, ExtraStats, DomainsPanel, ProjectPanel,
} from "@/components/Railway/RailwayWidgets";

export function RailwayDetailPage() {
  const navigate = useNavigate();
  const { data: railway, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["owner-railway"], queryFn: getOwnerRailway, refetchInterval: 30_000, retry: false,
  });

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pct = railway?.usage_pct || {};
  const deploys = railway?.deployments || [];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060b18] text-slate-100">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-40 -top-48 h-[40rem] w-[40rem] rounded-full bg-[#0066ff]/22 blur-[170px]" />
        <div className="absolute -right-48 top-1/2 h-[34rem] w-[34rem] rounded-full bg-[#7c3aed]/12 blur-[190px]" />
        <div className="absolute inset-0 opacity-50"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-5 py-7 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 animate-fade-up">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/owner")}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              <ArrowLeft size={18} />
            </button>
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-[#0066ff] to-[#00a3ff] shadow-[0_8px_32px_-4px_rgba(0,102,255,0.6)]">
              <Server className="text-white" size={26} />
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-white lg:text-3xl">Railway server</h1>
              <p className="text-sm text-slate-400">Infratuzilma holati va monitoring · to'liq ko'rinish</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-right backdrop-blur sm:block">
              <div className="font-display text-lg font-bold tabnum text-white">
                {now.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
              <div className="text-[11px] text-slate-400">jonli yangilanmoqda</div>
            </div>
            <button onClick={() => refetch()} title="Yangilash"
              className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              <RefreshCw size={18} className={isFetching ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-44 animate-pulse rounded-3xl bg-white/[0.04]" />)}
          </div>
        ) : !railway?.configured ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
            <Info size={32} className="mx-auto mb-3 text-slate-500" />
            <div className="font-display text-lg font-bold text-white">Railway sozlanmagan</div>
            <p className="mt-1 text-sm text-slate-400">
              RAILWAY_API_TOKEN va boshqa o'zgaruvchilar Railway Variables'da sozlanishi kerak.
            </p>
          </div>
        ) : (
          <>
            {/* Diagnostika */}
            {(railway.metrics_error || railway.deployments_error || railway.service_error || railway.usage?.error) && (
              <div className="mb-5 rounded-2xl border border-[#dc2626]/30 bg-[#dc2626]/10 px-4 py-3 text-xs text-[#f87171] animate-fade-up">
                <div className="font-bold">Diagnostika:</div>
                {railway.metrics_error && <div className="mt-1 break-all font-mono opacity-90">Metrics: {railway.metrics_error}</div>}
                {railway.service_error && <div className="mt-1 break-all font-mono opacity-90">Service: {railway.service_error}</div>}
                {railway.deployments_error && <div className="mt-1 break-all font-mono opacity-90">Deploy: {railway.deployments_error}</div>}
                {railway.usage?.error && <div className="mt-1 break-all font-mono opacity-90">Usage: {railway.usage.error}</div>}
              </div>
            )}

            {/* Servis info chiplari */}
            <div className="mb-5 animate-fade-up" style={{ animationDelay: "60ms" }}>
              <ServiceChips railway={railway} />
            </div>

            {/* CPU / RAM gauge kartalar */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 animate-fade-up" style={{ animationDelay: "120ms" }}>
              <MetricCard kind="cpu" railway={railway} />
              <MetricCard kind="ram" railway={railway} />
            </div>

            {/* Status banneri (eng yuqori foizga qarab) */}
            {(() => {
              const worst = Math.max(pct.cpu ?? 0, pct.ram ?? 0);
              const color = usageColor(worst);
              return (
                <div className="mb-6 flex items-center gap-3 rounded-2xl border px-5 py-4 animate-fade-up"
                  style={{ borderColor: `${color}44`, background: `${color}12`, animationDelay: "180ms" }}>
                  <GaugeIcon size={20} style={{ color }} />
                  <div className="text-sm">
                    <span className="font-bold text-white">Resurs holati: {usageLabel(worst)}</span>
                    <span className="ml-2 text-slate-400">
                      CPU {pct.cpu != null ? `${pct.cpu}%` : "—"} · RAM {pct.ram != null ? `${pct.ram}%` : "—"}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Qo'shimcha statistikalar: xarajat, network, disk, env */}
            <div className="mb-6 animate-fade-up" style={{ animationDelay: "200ms" }}>
              <ExtraStats railway={railway} />
            </div>

            {/* 24 soatlik grafik */}
            <div className="mb-6 animate-fade-up" style={{ animationDelay: "230ms" }}>
              <HistoryChart railway={railway} />
            </div>

            {/* Domenlar + Loyiha servislari */}
            <div className="mb-6 grid gap-4 lg:grid-cols-2 animate-fade-up" style={{ animationDelay: "250ms" }}>
              <DomainsPanel railway={railway} />
              <ProjectPanel railway={railway} />
            </div>

            {/* Deploymentlar */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl animate-fade-up" style={{ animationDelay: "270ms" }}>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                <Rocket size={14} className="text-[#5b9dff]" /> Deploymentlar tarixi ({deploys.length})
              </div>
              {railway.deployments_error ? (
                <div className="text-sm text-[#f87171]">Deployment ma'lumoti yuklanmadi</div>
              ) : deploys.length === 0 ? (
                <div className="text-sm text-slate-500">Deployment topilmadi</div>
              ) : (
                <div className="space-y-1">
                  {deploys.map((d) => <DeploymentRow key={d.id} d={d} />)}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-600">
              <Activity size={12} /> Ma'lumotlar Railway GraphQL API orqali, har 30 soniyada yangilanadi
            </div>
          </>
        )}
      </div>
    </div>
  );
}
