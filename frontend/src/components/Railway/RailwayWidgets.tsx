import { useState } from "react";
import {
  Cpu, MemoryStick, CircleCheck, CircleX, Circle, X, GitBranch,
  ExternalLink, Clock, Hash, MapPin, Layers, Server,
  DollarSign, Globe, Network, HardDrive, KeySquare, Boxes, ShieldCheck, ShieldX,
} from "lucide-react";
import type { RailwayDeployment, RailwayOverview, RailwayMetricPoint } from "@/api/owner";

/* Foizga qarab rang: kam qolsa (yuqori foiz) qizil, o'rta sariq, bo'sh yashil */
export function usageColor(pct: number | undefined): string {
  if (pct == null) return "#5b9dff";
  if (pct >= 85) return "#dc2626";   // kam qoldi — qizil
  if (pct >= 65) return "#eab308";   // kamroq qoldi — sariq
  return "#16a34a";                  // yetarli — yashil
}
export function usageLabel(pct: number | undefined): string {
  if (pct == null) return "—";
  if (pct >= 85) return "Kam qoldi!";
  if (pct >= 65) return "Diqqat";
  return "Yetarli";
}

export function deployStatusStyle(status: string): { color: string; icon: any; label: string } {
  const s = (status || "").toUpperCase();
  if (s === "SUCCESS") return { color: "#4ade80", icon: CircleCheck, label: "Muvaffaqiyatli" };
  if (s === "FAILED" || s === "CRASHED") return { color: "#f87171", icon: CircleX, label: "Xato" };
  if (s === "BUILDING" || s === "DEPLOYING" || s === "INITIALIZING")
    return { color: "#fbbf24", icon: Circle, label: "Jarayonda" };
  if (s === "REMOVED") return { color: "#64748b", icon: Circle, label: "O'chirilgan" };
  if (s === "SLEEPING") return { color: "#94a3b8", icon: Circle, label: "Uyqu" };
  return { color: "#64748b", icon: Circle, label: status || "—" };
}

/* Aylana foiz gauge (CPU/RAM uchun) */
export function RingGauge({ pct, color, size = 96, stroke = 9 }: {
  pct: number | undefined; color: string; size?: number; stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const val = Math.min(Math.max(pct ?? 0, 0), 100);
  const dash = (val / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
        style={{ transition: "stroke-dasharray .8s cubic-bezier(0.16,1,0.3,1), stroke .4s" }} />
    </svg>
  );
}

/* CPU yoki RAM kartasi: foiz + rang + jonli/o'rtacha + limit */
export function MetricCard({ kind, railway }: { kind: "cpu" | "ram"; railway: RailwayOverview }) {
  const m = railway.metrics || {};
  const pctAll = railway.usage_pct || {};
  const limits = railway.limits;
  const isCpu = kind === "cpu";
  const pct = isCpu ? pctAll.cpu : pctAll.ram;
  const color = usageColor(pct);
  const used = isCpu ? m.cpu_vcpu_latest : m.ram_gb_latest;
  const avg = isCpu ? m.cpu_vcpu_avg : m.ram_gb_avg;
  const limit = isCpu ? limits?.cpu_vcpu : limits?.ram_gb;
  const unit = isCpu ? "vCPU" : "GB";
  const Icon = isCpu ? Cpu : MemoryStick;

  if (railway.metrics_error) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold" style={{ color }}><Icon size={15} /> {isCpu ? "CPU" : "RAM"}</div>
        <div className="text-xs text-[#f87171]">Ma'lumot yo'q</div>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: color }} />
      <div className="flex items-center gap-4">
        <div className="relative grid shrink-0 place-items-center" style={{ width: 96, height: 96 }}>
          <RingGauge pct={pct} color={color} />
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-display text-xl font-extrabold tabnum text-white">{pct != null ? `${pct}%` : "—"}</div>
              <div className="text-[10px] font-semibold" style={{ color }}>{usageLabel(pct)}</div>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color }}><Icon size={15} /> {isCpu ? "CPU" : "RAM"}</div>
          <div className="mt-1 font-display text-lg font-extrabold tabnum text-white">
            {used != null ? used : "—"}<span className="ml-1 text-xs font-bold text-slate-500">/ {limit ?? "?"} {unit}</span>
          </div>
          {avg != null && <div className="text-[11px] text-slate-500">1 soat o'rtacha: {avg} {unit}</div>}
          {limits && (
            <div className="mt-0.5 text-[10px] text-slate-600">
              limit manbai: {limits.source === "railway" ? "Railway" : `${limits.plan} plan`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Bitta deployment qatori + bosilganda popup */
export function DeploymentRow({ d }: { d: RailwayDeployment }) {
  const [open, setOpen] = useState(false);
  const st = deployStatusStyle(d.status);
  const Icon = st.icon;
  const when = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  return (
    <>
      <div className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-xs transition-colors hover:bg-white/[0.04]">
        <Icon size={15} style={{ color: st.color }} />
        <span className="font-semibold" style={{ color: st.color }}>{st.label}</span>
        {d.branch && (
          <span className="hidden items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-slate-400 sm:inline-flex">
            <GitBranch size={10} /> {d.branch}
          </span>
        )}
        {d.commit_message && (
          <span className="hidden max-w-[200px] truncate text-slate-400 md:inline">{d.commit_message}</span>
        )}
        <span className="ml-auto font-mono text-slate-500">{when(d.created_at)}</span>
        <button onClick={() => setOpen(true)}
          className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
          To'liq ma'lumot
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-md animate-fade-in" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0c1424] p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <Icon size={20} style={{ color: st.color }} /> Deployment
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-2.5 text-sm">
              <DetailRow icon={<Circle size={14} style={{ color: st.color }} />} label="Holat"
                value={<span className="font-semibold" style={{ color: st.color }}>{st.label} ({d.status})</span>} />
              <DetailRow icon={<Hash size={14} />} label="ID" value={<span className="font-mono text-xs">{d.id}</span>} />
              {d.commit_sha && <DetailRow icon={<Hash size={14} />} label="Commit" value={<span className="font-mono">{d.commit_sha}</span>} />}
              {d.branch && <DetailRow icon={<GitBranch size={14} />} label="Branch" value={d.branch} />}
              {d.commit_message && <DetailRow icon={<GitBranch size={14} />} label="Xabar" value={d.commit_message} />}
              <DetailRow icon={<Clock size={14} />} label="Yaratilgan" value={when(d.created_at)} />
              {d.updated_at && <DetailRow icon={<Clock size={14} />} label="Yangilangan" value={when(d.updated_at)} />}
              {d.url && (
                <DetailRow icon={<ExternalLink size={14} />} label="URL"
                  value={<a href={d.url.startsWith("http") ? d.url : `https://${d.url}`} target="_blank" rel="noreferrer" className="text-[#5b9dff] hover:underline">{d.url}</a>} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
      <span className="mt-0.5 text-slate-500">{icon}</span>
      <span className="w-24 shrink-0 text-xs font-semibold text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 break-words text-slate-200">{value}</span>
    </div>
  );
}

/* Servis info chiplari (region, replicas, builder) */
export function ServiceChips({ railway }: { railway: RailwayOverview }) {
  const s = railway.service;
  if (!s) return null;
  const chips: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (s.region) chips.push({ icon: <MapPin size={13} />, label: "Region", value: s.region });
  if (s.replicas != null) chips.push({ icon: <Layers size={13} />, label: "Replicas", value: String(s.replicas) });
  if (s.builder) chips.push({ icon: <Server size={13} />, label: "Builder", value: s.builder });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
          <span className="text-[#5b9dff]">{c.icon}</span>
          <span className="text-slate-500">{c.label}:</span> <span className="font-semibold text-white">{c.value}</span>
        </span>
      ))}
    </div>
  );
}

/* ===== Sparkline grafik (24h CPU/RAM) ===== */
export function Sparkline({ series, color, height = 56 }: {
  series?: RailwayMetricPoint[]; color: string; height?: number;
}) {
  if (!series || series.length < 2) {
    return <div className="flex h-14 items-center justify-center text-xs text-slate-600">Grafik uchun ma'lumot yetarli emas</div>;
  }
  const w = 280;
  const vals = series.map((p) => p.v);
  const max = Math.max(...vals, 0.0001);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const step = w / (series.length - 1);
  const pts = series.map((p, i) => {
    const x = i * step;
    const y = height - ((p.v - min) / range) * (height - 6) - 3;
    return [x, y];
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${height} L0,${height} Z`;
  const id = `grad-${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* 24h grafik kartasi */
export function HistoryChart({ railway }: { railway: RailwayOverview }) {
  const m = railway.metrics || {};
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">24 soatlik tarix</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#0066ff]"><Cpu size={13} /> CPU (vCPU)</div>
          <Sparkline series={m.cpu_series} color="#0066ff" />
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#a855f7]"><MemoryStick size={13} /> RAM (GB)</div>
          <Sparkline series={m.ram_series} color="#a855f7" />
        </div>
      </div>
    </div>
  );
}

/* Kichik statistik karta (usage, network, disk, env) */
export function StatTile({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl" style={{ background: accent }} />
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold" style={{ color: accent }}>
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${accent}22` }}>{icon}</span>
        {label}
      </div>
      <div className="font-display text-xl font-extrabold tabnum text-white">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

/* Qo'shimcha statistikalar qatori */
export function ExtraStats({ railway }: { railway: RailwayOverview }) {
  const m = railway.metrics || {};
  const tiles: React.ReactNode[] = [];
  if (railway.usage?.month_cost_usd != null) {
    tiles.push(<StatTile key="cost" icon={<DollarSign size={15} />} accent="#16a34a"
      label="Bu oy xarajat" value={`$${railway.usage.month_cost_usd}`} sub="taxminiy resurs narxi" />);
  }
  if (m.network_gb_total != null) {
    tiles.push(<StatTile key="net" icon={<Network size={15} />} accent="#00a3ff"
      label="Network (egress)" value={`${m.network_gb_total} GB`} sub="24 soatlik chiqish trafigi" />);
  }
  if (m.disk_gb_latest != null) {
    tiles.push(<StatTile key="disk" icon={<HardDrive size={15} />} accent="#eab308"
      label="Disk" value={`${m.disk_gb_latest} GB`} sub="volume ishlatilishi" />);
  }
  if (railway.env_count != null) {
    tiles.push(<StatTile key="env" icon={<KeySquare size={15} />} accent="#a855f7"
      label="Env o'zgaruvchilar" value={`${railway.env_count} ta`} sub="sozlangan" />);
  }
  if (tiles.length === 0) return null;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tiles}</div>;
}

/* Domenlar paneli */
export function DomainsPanel({ railway }: { railway: RailwayOverview }) {
  const domains = railway.domains || [];
  if (domains.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        <Globe size={14} className="text-[#5b9dff]" /> Domenlar ({domains.length})
      </div>
      <div className="space-y-2">
        {domains.map((d, i) => {
          const ok = !/pending|wait|invalid|error/i.test(d.status);
          return (
            <div key={i} className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
              {ok ? <ShieldCheck size={15} className="text-[#4ade80]" /> : <ShieldX size={15} className="text-amber-400" />}
              <a href={`https://${d.domain}`} target="_blank" rel="noreferrer"
                className="truncate font-medium text-white hover:text-[#5b9dff]">{d.domain}</a>
              {d.type === "custom" && (
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-slate-400">custom</span>
              )}
              <span className="ml-auto text-xs" style={{ color: ok ? "#4ade80" : "#fbbf24" }}>
                {ok ? "SSL faol" : d.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Loyiha servislari paneli */
export function ProjectPanel({ railway }: { railway: RailwayOverview }) {
  const services = railway.project?.services || [];
  if (services.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        <Boxes size={14} className="text-[#5b9dff]" /> Loyiha servislari ({services.length})
        {railway.project?.name && <span className="ml-1 normal-case text-slate-600">· {railway.project.name}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {services.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-white">
            <Server size={13} className="text-[#5b9dff]" /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
