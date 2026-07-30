import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ChevronDown, ChevronUp, Plus, Trash2, Check, X } from "lucide-react";
import {
  listToilets, getToiletMonth, upsertToiletRevenue, deleteToiletRevenue,
  type ToiletItem, type ToiletMonthSummary,
} from "@/api/toilet";
import { fmtUZS } from "@/lib/utils";

const MONTHS = ["Yanvar","Fevral","Mart","Aprel","May","Iyun",
                 "Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr"];

function parseNum(s: string): number {
  return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
}

export function ToiletPage() {
  const now = new Date();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const years = [now.getFullYear(), now.getFullYear() - 1];

  const { data: toilets, isLoading } = useQuery({
    queryKey: ["toilets"],
    queryFn: listToilets,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Xojatxonalar</h1>
          <p className="mt-1 text-sm text-ink-faint">Kunlik tushum kiritish va oylik hisobot</p>
        </div>
        <Link to="/admin" className="btn-ghost px-3.5 py-2"><ArrowLeft size={16} /> Orqaga</Link>
      </div>

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">Yil</label>
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">Oy</label>
          <select className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-brand" /></div>}

      {!isLoading && (!toilets || toilets.length === 0) && (
        <div className="card p-10 text-center text-sm text-ink-faint">
          Xojatxona topilmadi. Xarita muharriridan xojatxona layouti yarating.
        </div>
      )}

      <div className="space-y-3">
        {toilets?.map((toilet) => (
          <div key={toilet.id} className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="font-bold text-ink">🚻 {toilet.name}</div>
              <button
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => setExpandedId(expandedId === toilet.id ? null : toilet.id)}
              >
                Tushum {expandedId === toilet.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
            {expandedId === toilet.id && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                <ToiletRevenuePanel toilet={toilet} year={year} month={month} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ToiletRevenuePanel({ toilet, year, month }: { toilet: ToiletItem; year: number; month: number }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const { data, isLoading } = useQuery<ToiletMonthSummary>({
    queryKey: ["toilet-month", toilet.id, year, month],
    queryFn: () => getToiletMonth(toilet.id, year, month),
  });

  const saveMut = useMutation({
    mutationFn: ({ date, amount }: { date: string; amount: number }) =>
      upsertToiletRevenue(toilet.id, { revenue_date: date, amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["toilet-month", toilet.id, year, month] });
      setShowAdd(false);
      setNewDate("");
      setNewAmount("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (revenueId: number) => deleteToiletRevenue(toilet.id, revenueId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["toilet-month", toilet.id, year, month] }),
  });

  // Min/max sana — tanlangan oy
  const minDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const maxDate = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-brand" /></div>;

  return (
    <div>
      {/* Oylik jami */}
      <div className="mb-4 flex items-center justify-between rounded-xl bg-brand/8 px-4 py-3">
        <div>
          <div className="text-xs text-ink-faint">{MONTHS[month - 1]} {year} — jami tushum</div>
          <div className="text-2xl font-bold text-brand">{fmtUZS(data?.total ?? 0)}</div>
        </div>
        <div className="text-right text-xs text-ink-faint">{data?.revenues.length ?? 0} kun kiritilgan</div>
      </div>

      {/* Kiritilgan kunlar */}
      {(data?.revenues.length ?? 0) > 0 && (
        <div className="mb-3 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-400">
                <th className="px-3 py-2 text-left">Sana</th>
                <th className="px-3 py-2 text-right">Tushum</th>
                <th className="px-3 py-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody>
              {data?.revenues.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-3 py-2 text-ink-soft">
                    {new Date(r.revenue_date + "T00:00:00").toLocaleDateString("uz-UZ")}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-ink">
                    {fmtUZS(r.amount)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      className="rounded p-1 text-ink-faint hover:bg-status-unpaid/10 hover:text-status-unpaid"
                      onClick={() => deleteMut.mutate(r.id)}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Yangi kiritish */}
      {showAdd ? (
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-3">
          <div className="mb-2 text-xs font-bold text-ink-faint">Yangi tushum kiritish</div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">Sana</label>
              <input
                type="date"
                className="input"
                min={minDate}
                max={maxDate}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">Summa (so'm)</label>
              <input
                className="input w-40 text-right font-mono"
                placeholder="0"
                value={newAmount}
                autoFocus
                onChange={(e) => setNewAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDate && newAmount)
                    saveMut.mutate({ date: newDate, amount: parseNum(newAmount) });
                }}
              />
            </div>
            <button
              className="btn-primary px-4 py-2 disabled:opacity-50"
              disabled={!newDate || !newAmount || saveMut.isPending}
              onClick={() => saveMut.mutate({ date: newDate, amount: parseNum(newAmount) })}
            >
              {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button className="btn-ghost px-3 py-2" onClick={() => { setShowAdd(false); setNewDate(""); setNewAmount(""); }}>
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-ghost w-full py-2.5 text-sm"
          onClick={() => setShowAdd(true)}
        >
          <Plus size={15} /> Tushum qo'shish
        </button>
      )}
    </div>
  );
}
