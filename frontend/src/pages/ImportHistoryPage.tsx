import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Filter, Search, Loader2, FileDown } from "lucide-react";
import { apiClient } from "@/api/client";
import { fmtUZS } from "@/lib/utils";
import { useT } from "@/i18n/useT";

interface ImportHistoryRow {
  id: number;
  bill_date: string | null;
  category: string;
  shop_id: string | null;
  inn: string | null;
  counterparty_name: string | null;
  monthly_amount: number | null;
  paid: number;
  debt: number;
  filename: string | null;
  imported_at: string;
}

interface ImportHistoryOut {
  rows: ImportHistoryRow[];
  total: number;
}

const CATS = [
  { key: "all",         label: "Hammasi" },
  { key: "rent",        label: "Arenda" },
  { key: "electricity", label: "Elektr" },
  { key: "water",       label: "Suv" },
];

function today()    { return new Date().toISOString().slice(0, 10); }
function monthAgo() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

async function fetchHistory(params: Record<string, string>) {
  const { data } = await apiClient.get<ImportHistoryOut>("/admin/import-history", { params });
  return data;
}

export function ImportHistoryPage() {
  const t = useT();
  const [dateFrom, setDateFrom] = useState(monthAgo());
  const [dateTo,   setDateTo]   = useState(today());
  const [category, setCategory] = useState("all");
  const [innFilter, setInnFilter]   = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["import-history", dateFrom, dateTo, category, innFilter, shopFilter, page],
    queryFn: () => fetchHistory({
      date_from: dateFrom,
      date_to:   dateTo,
      category,
      ...(innFilter  ? { inn:     innFilter  } : {}),
      ...(shopFilter ? { shop_id: shopFilter } : {}),
      page:     String(page),
      per_page: String(PER_PAGE),
    }),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 1;

  function catLabel(c: string) {
    const m: Record<string,string> = { rent: "Arenda", electricity: "Elektr", water: "Suv" };
    return m[c] ?? c;
  }

  function formatDate(s: string | null) {
    if (!s) return "—";
    return new Date(s).toLocaleDateString("uz-UZ", { day:"2-digit", month:"2-digit", year:"numeric" });
  }

  function formatImportedAt(s: string) {
    if (!s) return "—";
    return new Date(s).toLocaleString("uz-UZ", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Import tarixi</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Arenda, elektr va suv bo'yicha kiritilgan ma'lumotlar
          </p>
        </div>
        <Link to="/admin" className="btn-ghost px-3.5 py-2">
          <ArrowLeft size={16} /> {t("common.back")}
        </Link>
      </div>

      {/* Filtrlar */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Sana oraligi */}
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-faint">Boshlanish</label>
            <input type="date" className="input" value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-faint">Tugash</label>
            <input type="date" className="input" value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </div>

          {/* Kategoriya */}
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-faint">Tur</label>
            <div className="flex gap-1">
              {CATS.map((c) => (
                <button key={c.key}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    category === c.key ? "bg-brand text-white" : "bg-slate-100 text-ink-soft hover:bg-slate-200"
                  }`}
                  onClick={() => { setCategory(c.key); setPage(1); }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* INN */}
          <div className="relative">
            <label className="mb-1 block text-xs font-bold text-ink-faint">INN</label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input className="input pl-8 w-40" placeholder="INN..."
                value={innFilter} onChange={(e) => { setInnFilter(e.target.value); setPage(1); }} />
            </div>
          </div>

          {/* Magazin ID */}
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-faint">Magazin ID</label>
            <input className="input w-40" placeholder="01-1-1-001..."
              value={shopFilter} onChange={(e) => { setShopFilter(e.target.value); setPage(1); }} />
          </div>
        </div>

        {data && (
          <div className="mt-3 text-xs text-ink-faint">
            Jami: <span className="font-semibold text-ink">{data.total}</span> ta yozuv
          </div>
        )}
      </div>

      {/* Jadval */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-brand" />
        </div>
      )}

      {data && data.rows.length === 0 && !isLoading && (
        <div className="card p-10 text-center text-sm text-ink-faint">
          Ma'lumot topilmadi
        </div>
      )}

      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-400">
                <th className="px-3 py-2.5 text-left font-semibold">Sana</th>
                <th className="px-3 py-2.5 text-left font-semibold">Tur</th>
                <th className="px-3 py-2.5 text-left font-semibold">Magazin / INN</th>
                <th className="px-3 py-2.5 text-left font-semibold">Kontragent</th>
                <th className="px-3 py-2.5 text-right font-semibold">Oylik</th>
                <th className="px-3 py-2.5 text-right font-semibold">To'langan</th>
                <th className="px-3 py-2.5 text-right font-semibold">Qarz</th>
                <th className="px-3 py-2.5 text-left font-semibold">Fayl / Kiritilgan</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={`${r.category}-${r.id}`}
                  className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 font-mono text-xs text-ink-soft whitespace-nowrap">
                    {formatDate(r.bill_date)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      r.category === "rent"        ? "bg-blue-50 text-blue-600" :
                      r.category === "electricity" ? "bg-yellow-50 text-yellow-600" :
                      "bg-sky-50 text-sky-600"
                    }`}>
                      {catLabel(r.category)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.shop_id && <div className="font-mono text-xs font-semibold text-brand">{r.shop_id}</div>}
                    {r.inn && <div className="font-mono text-xs text-ink-faint">{r.inn}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-soft max-w-48 truncate">
                    {r.counterparty_name ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-ink-soft">
                    {r.monthly_amount != null ? fmtUZS(r.monthly_amount) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-status-paid">
                    {r.paid > 0 ? fmtUZS(r.paid) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs font-bold">
                    {r.debt > 0
                      ? <span className="text-status-unpaid">{fmtUZS(r.debt)}</span>
                      : <span className="text-status-paid">✓</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-faint">
                    {r.filename && (
                      <div className="flex items-center gap-1.5">
                        <FileDown size={11} className="shrink-0 text-brand" />
                        <span className="max-w-40 truncate font-mono text-[11px]">{r.filename}</span>
                      </div>
                    )}
                    <div className="mt-0.5 text-[11px]">{formatImportedAt(r.imported_at)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-faint">
            Sahifa {page} / {totalPages} ({data?.total} ta)
          </span>
          <div className="flex gap-2">
            <button className="btn-ghost px-3 py-1.5 disabled:opacity-40"
              disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Oldingi</button>
            <button className="btn-ghost px-3 py-1.5 disabled:opacity-40"
              disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Keyingi →</button>
          </div>
        </div>
      )}
    </div>
  );
}
