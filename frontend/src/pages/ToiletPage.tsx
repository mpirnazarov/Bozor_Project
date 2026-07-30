import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ChevronDown, ChevronUp, Trash2, Check } from "lucide-react";
import { listToilets, getToiletMonth, upsertToiletRevenue, deleteToiletRevenue, type ToiletItem, type ToiletMonthSummary } from "@/api/toilet";
import { fmtUZS } from "@/lib/utils";

const MONTHS = ["Yanvar","Fevral","Mart","Aprel","May","Iyun",
                 "Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr"];

const DAYS_IN_MONTH = (year: number, month: number) => new Date(year, month, 0).getDate();

function parseNum(s: string): number {
  return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
}

export function ToiletPage() {
  const now = new Date();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: toilets, isLoading } = useQuery({
    queryKey: ["toilets"],
    queryFn: listToilets,
  });

  const years = [now.getFullYear(), now.getFullYear() - 1];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Xojatxonalar</h1>
          <p className="mt-1 text-sm text-ink-faint">Kunlik tushum kiritish va oylik hisobot</p>
        </div>
        <Link to="/admin" className="btn-ghost px-3.5 py-2"><ArrowLeft size={16} /> Orqaga</Link>
      </div>

      {/* Yil/Oy tanlash */}
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
  const [editDate, setEditDate] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");

  const { data, isLoading } = useQuery<ToiletMonthSummary>({
    queryKey: ["toilet-month", toilet.id, year, month],
    queryFn: () => getToiletMonth(toilet.id, year, month),
  });

  const saveMut = useMutation({
    mutationFn: ({ date, amount }: { date: string; amount: number }) =>
      upsertToiletRevenue(toilet.id, { revenue_date: date, amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["toilet-month", toilet.id, year, month] });
      setEditDate(null);
      setEditAmount("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (revenueId: number) => deleteToiletRevenue(toilet.id, revenueId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["toilet-month", toilet.id, year, month] }),
  });

  const daysInMonth = DAYS_IN_MONTH(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const rev = data?.revenues.find((r) => r.revenue_date === dateStr);
    return { day: d, dateStr, rev };
  });

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-brand" /></div>;

  return (
    <div>
      {/* Oylik jami */}
      <div className="mb-4 rounded-xl bg-brand/8 px-4 py-3">
        <div className="text-xs text-ink-faint">{MONTHS[month - 1]} {year} — jami tushum</div>
        <div className="text-2xl font-bold text-brand">{fmtUZS(data?.total ?? 0)}</div>
        <div className="text-xs text-ink-faint">{data?.revenues.length ?? 0} kun kiritilgan</div>
      </div>

      {/* Kunlar jadvali */}
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-400">
              <th className="px-3 py-2 text-left">Kun</th>
              <th className="px-3 py-2 text-right">Tushum (so'm)</th>
              <th className="px-3 py-2 text-center">Amal</th>
            </tr>
          </thead>
          <tbody>
            {days.map(({ day, dateStr, rev }) => {
              const isEditing = editDate === dateStr;
              return (
                <tr key={dateStr} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-3 py-2 font-semibold">
                    {day}-{MONTHS[month - 1].slice(0, 3)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <input
                        className="input w-36 text-right font-mono"
                        value={editAmount}
                        placeholder="0"
                        autoFocus
                        onChange={(e) => setEditAmount(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveMut.mutate({ date: dateStr, amount: parseNum(editAmount) });
                          if (e.key === "Escape") { setEditDate(null); setEditAmount(""); }
                        }}
                      />
                    ) : rev ? (
                      <span
                        className="cursor-pointer font-mono font-semibold text-ink hover:text-brand"
                        onClick={() => { setEditDate(dateStr); setEditAmount(String(rev.amount)); }}
                      >
                        {fmtUZS(rev.amount)}
                      </span>
                    ) : (
                      <span
                        className="cursor-pointer text-ink-faint hover:text-brand"
                        onClick={() => { setEditDate(dateStr); setEditAmount(""); }}
                      >
                        — kiritish
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {isEditing ? (
                      <div className="flex justify-center gap-1">
                        <button
                          className="btn-primary px-2.5 py-1 text-xs disabled:opacity-50"
                          disabled={saveMut.isPending}
                          onClick={() => saveMut.mutate({ date: dateStr, amount: parseNum(editAmount) })}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          className="btn-ghost px-2.5 py-1 text-xs"
                          onClick={() => { setEditDate(null); setEditAmount(""); }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : rev ? (
                      <button
                        className="btn-ghost px-2 py-1 text-xs text-status-unpaid"
                        onClick={() => deleteMut.mutate(rev.id)}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {(data?.total ?? 0) > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <td className="px-3 py-2">Jami</td>
                <td className="px-3 py-2 text-right font-mono text-brand">{fmtUZS(data?.total ?? 0)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
