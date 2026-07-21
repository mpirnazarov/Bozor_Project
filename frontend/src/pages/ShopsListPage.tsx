import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { apiClient } from "@/api/client";
import { fmtUZS } from "@/lib/utils";
import { useT } from "@/i18n/useT";

interface ShopRow {
  shop_id: string; pavilion_code: string | null; inn: string | null;
  shop_type: string | null; monthly_rent: number; is_active: boolean;
  is_vacant: boolean; counterparty_name: string | null;
  rent_due: number; rent_paid: number; rent_debt: number;
  elec_due: number; elec_paid: number; elec_debt: number;
  water_due: number; water_paid: number; water_debt: number;
}
interface ShopsListOut { items: ShopRow[]; total: number; page: number; per_page: number; }
const MONTHS = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr"];

function DebtCell({ due, paid, debt }: { due: number; paid: number; debt: number }) {
  if (due <= 0 && paid <= 0) return <span className="text-ink-faint text-xs">—</span>;
  if (debt <= 0) return <span className="text-status-paid text-xs font-bold">✓</span>;
  return <span className="text-status-unpaid text-xs font-bold">{fmtUZS(debt)}</span>;
}

export function ShopsListPage() {
  const t = useT();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [q, setQ] = useState("");
  const [innFilter, setInnFilter] = useState("");
  const [vacant, setVacant] = useState<"all"|"vacant"|"not_vacant">("all");
  const [debtFilter, setDebtFilter] = useState<"all"|"rent"|"electricity"|"water"|"any">("all");
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["shops-list", year, month, q, innFilter, vacant, debtFilter, page],
    queryFn: async () => {
      const params: Record<string, string|number> = { year, month, page, per_page: PER_PAGE };
      if (q) params.q = q;
      if (innFilter) params.inn = innFilter;
      if (vacant !== "all") params.vacant = vacant;
      if (debtFilter !== "all") params.debt_filter = debtFilter;
      const { data } = await apiClient.get<ShopsListOut>("/admin/shops-list", { params });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 1;
  const years = [now.getFullYear(), now.getFullYear() - 1];

  function shopStatus(row: ShopRow) {
    if (row.is_vacant) return { label: "Bo'sh", color: "#9ca3af" };
    if (!row.inn) return { label: "Egasiz", color: "#f97316" };
    const hasDebt = row.rent_debt > 0 || row.elec_debt > 0 || row.water_debt > 0;
    const hasPaid = row.rent_paid > 0 || row.elec_paid > 0 || row.water_paid > 0;
    const hasData = row.rent_due > 0 || row.elec_due > 0 || row.water_due > 0 || hasPaid;
    if (!hasData) return { label: "Ma'lumot yo'q", color: "#f97316" };
    if (!hasDebt) return { label: "To'langan", color: "#16a34a" };
    if (hasPaid) return { label: "Qisman", color: "#eab308" };
    return { label: "Qarzdor", color: "#dc2626" };
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Magazinlar ro'yxati</h1>
          {data && <p className="mt-1 text-sm text-ink-faint">Jami: {data.total} ta</p>}
        </div>
        <Link to="/admin" className="btn-ghost px-3.5 py-2"><ArrowLeft size={16} /> {t("common.back")}</Link>
      </div>
      <div className="card mb-4 space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-faint">Yil</label>
            <select className="input" value={year} onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-faint">Oy</label>
            <select className="input" value={month} onChange={(e) => { setMonth(Number(e.target.value)); setPage(1); }}>
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-faint">Magazin ID</label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input className="input pl-8 w-36" placeholder="01-1-1-001..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-faint">INN</label>
            <input className="input w-36" placeholder="INN..." value={innFilter} onChange={(e) => { setInnFilter(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-faint">Holat</label>
            <div className="flex gap-1">
              {[{key:"all",label:"Hammasi"},{key:"vacant",label:"Bo'sh"},{key:"not_vacant",label:"Faol"}].map((o) => (
                <button key={o.key} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${vacant===o.key?"bg-brand text-white":"bg-slate-100 text-ink-soft"}`}
                  onClick={() => { setVacant(o.key as typeof vacant); setPage(1); }}>{o.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-faint">Qarzdorlik</label>
            <div className="flex gap-1">
              {[{key:"all",label:"Hammasi"},{key:"any",label:"Qarzdorlar"},{key:"rent",label:"Arenda"},{key:"electricity",label:"Elektr"},{key:"water",label:"Suv"}].map((o) => (
                <button key={o.key} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${debtFilter===o.key?"bg-status-unpaid text-white":"bg-slate-100 text-ink-soft"}`}
                  onClick={() => { setDebtFilter(o.key as typeof debtFilter); setPage(1); }}>{o.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {isLoading && <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-brand" /></div>}
      {data && data.items.length === 0 && !isLoading && <div className="card p-10 text-center text-sm text-ink-faint">Ma'lumot topilmadi</div>}
      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-400">
                <th className="px-3 py-2.5 text-left">Magazin ID</th>
                <th className="px-3 py-2.5 text-left">Pavilyon</th>
                <th className="px-3 py-2.5 text-left">Egasi</th>
                <th className="px-3 py-2.5 text-left">INN</th>
                <th className="px-3 py-2.5 text-right">Oylik</th>
                <th className="px-3 py-2.5 text-center">Holat</th>
                <th className="px-3 py-2.5 text-center">🏠 Arenda</th>
                <th className="px-3 py-2.5 text-center">⚡ Elektr</th>
                <th className="px-3 py-2.5 text-center">💧 Suv</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => {
                const st = shopStatus(row);
                return (
                  <tr key={row.shop_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-brand">{row.shop_id}</td>
                    <td className="px-3 py-2.5 text-xs text-ink-soft">{row.pavilion_code ?? "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-ink max-w-40 truncate">{row.counterparty_name ?? "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-ink-soft">{row.inn ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{fmtUZS(row.monthly_rent)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{background:st.color}}>{st.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center"><DebtCell due={row.rent_due} paid={row.rent_paid} debt={row.rent_debt} /></td>
                    <td className="px-3 py-2.5 text-center"><DebtCell due={row.elec_due} paid={row.elec_paid} debt={row.elec_debt} /></td>
                    <td className="px-3 py-2.5 text-center"><DebtCell due={row.water_due} paid={row.water_paid} debt={row.water_debt} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-faint">Sahifa {page} / {totalPages}</span>
          <div className="flex gap-2">
            <button className="btn-ghost px-3 py-1.5 disabled:opacity-40" disabled={page<=1} onClick={() => setPage(p=>p-1)}><ChevronLeft size={16}/></button>
            <button className="btn-ghost px-3 py-1.5 disabled:opacity-40" disabled={page>=totalPages} onClick={() => setPage(p=>p+1)}><ChevronRight size={16}/></button>
          </div>
        </div>
      )}
    </div>
  );
}
