import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, Loader2, FileDown, Copy, Check } from "lucide-react";
import { apiClient } from "@/api/client";
import { fmtUZS, isZeroSegmentShop } from "@/lib/utils";
import { useT } from "@/i18n/useT";

interface ImportHistoryRow {
  id: number; bill_date: string | null; category: string;
  shop_id: string | null; inn: string | null; counterparty_name: string | null;
  monthly_amount: number | null; paid: number; debt: number;
  filename: string | null; imported_at: string;
}
interface ImportHistoryOut { rows: ImportHistoryRow[]; total: number; }

const CATS = [{key:"all",label:"Hammasi"},{key:"rent",label:"Arenda"},{key:"electricity",label:"Elektr"},{key:"water",label:"Suv"}];
const MONTHS = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr"];

function today() { return new Date().toISOString().slice(0,10); }
function monthAgo() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); }

function CopyableFilename({ filename }: { filename: string }) {
  const [copied, setCopied] = useState(false);
  const display = filename.replace(/\s*\([^)]+\)\s*$/, "").trim() || filename;
  return (
    <button className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] text-brand hover:bg-brand/10"
      onClick={() => { navigator.clipboard.writeText(display); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
      {copied ? <Check size={10} className="text-status-paid"/> : <Copy size={10}/>}
      <span className="max-w-32 truncate">{display}</span>
    </button>
  );
}

export function ImportHistoryPage() {
  const t = useT();
  const [viewTab, setViewTab] = useState<"detail"|"contragent">("detail");
  const [dateFrom, setDateFrom] = useState(monthAgo());
  const [dateTo, setDateTo] = useState(today());
  const [category, setCategory] = useState("rent");
  const [innFilter, setInnFilter] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [expandedInn, setExpandedInn] = useState<string|null>(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["import-history", dateFrom, dateTo, category, innFilter, shopFilter, page],
    queryFn: async () => {
      const params: Record<string, string|number> = { date_from: dateFrom, date_to: dateTo, category, page, per_page: PER_PAGE };
      if (innFilter) params.inn = innFilter;
      if (shopFilter) params.shop_id = shopFilter;
      const { data } = await apiClient.get<ImportHistoryOut>("/admin/import-history", { params });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 1;

  const visibleRows = data?.rows.filter(r => !r.shop_id || !isZeroSegmentShop(r.shop_id)) ?? [];

  const contragentRows = (() => {
    const map = new Map<string, { inn: string; name: string|null; total_monthly: number; total_paid: number; total_debt: number; files: string[]; shops: { shop_id: string; monthly_amount: number; paid: number; debt: number; bill_date: string; filename: string|null }[] }>();
    for (const r of visibleRows) {
      const key = r.inn ?? "unknown";
      if (!map.has(key)) map.set(key, { inn: key, name: r.counterparty_name, total_monthly: 0, total_paid: 0, total_debt: 0, files: [], shops: [] });
      const cr = map.get(key)!;
      if (r.monthly_amount != null) cr.total_monthly += r.monthly_amount;
      cr.total_paid += r.paid; cr.total_debt += r.debt;
      if (r.shop_id) cr.shops.push({ shop_id: r.shop_id, monthly_amount: r.monthly_amount??0, paid: r.paid, debt: r.debt, bill_date: r.bill_date??"", filename: r.filename });
      if (r.filename && !cr.files.includes(r.filename)) cr.files.push(r.filename);
    }
    return Array.from(map.values()).sort((a,b) => b.total_monthly - a.total_monthly);
  })();

  function catLabel(c: string) { return {rent:"Arenda",electricity:"Elektr",water:"Suv"}[c] ?? c; }
  function formatDate(s: string|null) { if (!s) return "—"; return new Date(s).toLocaleDateString("uz-UZ"); }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Import tarixi</h1>
        </div>
        <Link to="/admin" className="btn-ghost px-3.5 py-2"><ArrowLeft size={16}/> {t("common.back")}</Link>
      </div>

      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {[{key:"detail",label:"Batafsil"},{key:"contragent",label:"Kontragent kesimi"}].map((tab) => (
          <button key={tab.key} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${viewTab===tab.key?"bg-white text-ink shadow-sm":"text-ink-faint"}`}
            onClick={() => setViewTab(tab.key as typeof viewTab)}>{tab.label}</button>
        ))}
      </div>

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="mb-1 block text-xs font-bold text-ink-faint">Boshlanish</label><input type="date" className="input" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}/></div>
          <div><label className="mb-1 block text-xs font-bold text-ink-faint">Tugash</label><input type="date" className="input" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}/></div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-faint">Tur</label>
            <div className="flex gap-1">
              {CATS.map((c) => (
                <button key={c.key} className={`rounded-lg px-3 py-2 text-sm font-semibold ${category===c.key?"bg-brand text-white":"bg-slate-100 text-ink-soft"}`}
                  onClick={() => { setCategory(c.key); setPage(1); }}>{c.label}</button>
              ))}
            </div>
          </div>
          <div className="relative">
            <label className="mb-1 block text-xs font-bold text-ink-faint">INN</label>
            <div className="relative"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"/>
              <input className="input pl-8 w-40" placeholder="INN..." value={innFilter} onChange={(e) => { setInnFilter(e.target.value); setPage(1); }}/></div>
          </div>
          <div><label className="mb-1 block text-xs font-bold text-ink-faint">Magazin ID</label>
            <input className="input w-40" placeholder="01-1-1-001..." value={shopFilter} onChange={(e) => { setShopFilter(e.target.value); setPage(1); }}/></div>
        </div>
        {data && <div className="mt-3 text-xs text-ink-faint">Jami: <span className="font-semibold text-ink">{data.total}</span> ta yozuv</div>}
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-brand"/></div>}

      {viewTab === "detail" && data && visibleRows.length === 0 && !isLoading && (
        <div className="card p-10 text-center text-sm text-ink-faint">Ma'lumot topilmadi</div>
      )}

      {viewTab === "detail" && visibleRows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-400">
              <th className="px-3 py-2.5 text-left">Sana</th><th className="px-3 py-2.5 text-left">Tur</th>
              <th className="px-3 py-2.5 text-left">Magazin/INN</th><th className="px-3 py-2.5 text-left">Kontragent</th>
              <th className="px-3 py-2.5 text-right">Oylik</th><th className="px-3 py-2.5 text-right">To'langan</th>
              <th className="px-3 py-2.5 text-right">Qarz</th><th className="px-3 py-2.5 text-left">Fayl</th>
            </tr></thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={`${r.category}-${r.id}`} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 font-mono text-xs">{formatDate(r.bill_date)}</td>
                  <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.category==="rent"?"bg-blue-50 text-blue-600":r.category==="electricity"?"bg-yellow-50 text-yellow-600":"bg-sky-50 text-sky-600"}`}>{catLabel(r.category)}</span></td>
                  <td className="px-3 py-2.5">{r.shop_id&&<div className="font-mono text-xs font-semibold text-brand">{r.shop_id}</div>}{r.inn&&<div className="font-mono text-xs text-ink-faint">{r.inn}</div>}</td>
                  <td className="px-3 py-2.5 text-xs max-w-48 truncate">{r.counterparty_name??"—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">{r.monthly_amount!=null?fmtUZS(r.monthly_amount):"—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-status-paid">{r.paid>0?fmtUZS(r.paid):"—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs font-bold">{r.debt>0?<span className="text-status-unpaid">{fmtUZS(r.debt)}</span>:<span className="text-status-paid">✓</span>}</td>
                  <td className="px-3 py-2.5">{r.filename&&<><div className="flex items-center gap-1"><FileDown size={11} className="text-brand"/><span className="font-mono text-[11px] max-w-32 truncate">{r.filename}</span></div></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewTab === "contragent" && !isLoading && (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-400">
              <th className="px-3 py-2.5 text-left">INN</th><th className="px-3 py-2.5 text-left">Kontragent</th>
              <th className="px-3 py-2.5 text-right">Do'konlar</th><th className="px-3 py-2.5 text-right">Oylik</th>
              <th className="px-3 py-2.5 text-right">To'langan</th><th className="px-3 py-2.5 text-right">Qarz</th>
              <th className="px-3 py-2.5 text-left">Fayllar</th><th className="px-3 py-2.5 text-left">Taqsimlash</th>
            </tr></thead>
            <tbody>
              {contragentRows.map((cr) => (
                <>
                  <tr key={cr.inn} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 font-mono text-xs">{cr.inn}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold">{cr.name??"—"}</td>
                    <td className="px-3 py-2.5 text-right text-xs">{cr.shops.length}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{fmtUZS(cr.total_monthly)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-status-paid">{fmtUZS(cr.total_paid)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-bold">{cr.total_debt>0?<span className="text-status-unpaid">{fmtUZS(cr.total_debt)}</span>:<span className="text-status-paid">✓</span>}</td>
                    <td className="px-3 py-2.5">{cr.files.map((f,i) => <CopyableFilename key={i} filename={f}/>)}</td>
                    <td className="px-3 py-2.5">{cr.shops.length>0&&<button className="text-xs font-semibold text-brand hover:underline" onClick={() => setExpandedInn(expandedInn===cr.inn?null:cr.inn)}>{expandedInn===cr.inn?"Yig'ish ▲":"Ko'rsatish ▼"}</button>}</td>
                  </tr>
                  {expandedInn===cr.inn && cr.shops.map((s,i) => (
                    <tr key={i} className="border-b border-slate-50 bg-brand/3">
                      <td className="py-2 pl-8 pr-3 font-mono text-[11px] text-brand" colSpan={2}>└ {s.shop_id} <span className="text-ink-faint">{formatDate(s.bill_date)}</span></td>
                      <td></td>
                      <td className="px-3 py-2 text-right font-mono text-[11px]">{s.monthly_amount>0?fmtUZS(s.monthly_amount):"—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] text-status-paid">{s.paid>0?fmtUZS(s.paid):"—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] font-bold">{s.debt>0?<span className="text-status-unpaid">{fmtUZS(s.debt)}</span>:<span className="text-status-paid">✓</span>}</td>
                      <td className="px-3 py-2">{s.filename&&<CopyableFilename filename={s.filename}/>}</td>
                      <td></td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
          {contragentRows.length===0&&<div className="py-10 text-center text-sm text-ink-faint">Ma'lumot topilmadi</div>}
        </div>
      )}

      {viewTab==="detail" && totalPages>1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-faint">Sahifa {page}/{totalPages}</span>
          <div className="flex gap-2">
            <button className="btn-ghost px-3 py-1.5 disabled:opacity-40" disabled={page<=1} onClick={() => setPage(p=>p-1)}>← Oldingi</button>
            <button className="btn-ghost px-3 py-1.5 disabled:opacity-40" disabled={page>=totalPages} onClick={() => setPage(p=>p+1)}>Keyingi →</button>
          </div>
        </div>
      )}
    </div>
  );
}
