import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ChevronDown, ChevronUp, Check, Droplets } from "lucide-react";
import {
  listInfraShops, getInfraShop, upsertInfraBilling,
  type InfraShop, type InfraBillingUpsert, type InfraShopDetail,
} from "@/api/infra";
import { fmtUZS } from "@/lib/utils";

const MONTHS = ["Yanvar","Fevral","Mart","Aprel","May","Iyun",
                 "Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr"];

const CATS: { key: string; label: string; due: keyof InfraBillingUpsert; paid: keyof InfraBillingUpsert }[] = [
  { key: "rent",        label: "🏠 Arenda", due: "rent_due",        paid: "rent_paid" },
  { key: "electricity", label: "⚡ Elektr",  due: "electricity_due", paid: "electricity_paid" },
  { key: "water",       label: "💧 Suv",     due: "water_due",       paid: "water_paid" },
];

function parseNum(s: string): number {
  return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
}

export function InfraPage() {
  const now = new Date();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: shops, isLoading } = useQuery({
    queryKey: ["infra-shops"],
    queryFn: listInfraShops,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Infra do'konlar</h1>
          <p className="mt-1 text-sm text-ink-faint">INN siz to'lovchilar — arenda, elektr, suv to'lovlari</p>
        </div>
        <Link to="/admin" className="btn-ghost px-3.5 py-2"><ArrowLeft size={16} /> Orqaga</Link>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-brand" />
        </div>
      )}

      {!isLoading && (!shops || shops.length === 0) && (
        <div className="card p-10 text-center text-sm text-ink-faint">
          Hali infra do'kon qo'shilmagan. Xarita muharriridan yangi infra layout yarating.
        </div>
      )}

      <div className="space-y-3">
        {shops?.map((shop) => (
          <div key={shop.id} className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="flex items-center gap-2 font-bold text-ink">
                  {shop.name}
                  {shop.water_enabled === false && (
                    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-ink-faint">
                      <Droplets size={10} /> Suvsiz
                    </span>
                  )}
                </div>
                <div className="text-xs text-ink-faint">
                  {shop.contract_no} · Oylik: {fmtUZS(shop.monthly_rent)}
                </div>
              </div>
              <button
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => setExpandedId(expandedId === shop.id ? null : shop.id)}
              >
                To'lovlar {expandedId === shop.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {expandedId === shop.id && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                <ShopBillingPanel
                  shop={shop}
                  defaultYear={now.getFullYear()}
                  defaultMonth={now.getMonth() + 1}
                  waterEnabled={shop.water_enabled !== false}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShopBillingPanel({
  shop, defaultYear, defaultMonth, waterEnabled,
}: {
  shop: InfraShop;
  defaultYear: number;
  defaultMonth: number;
  waterEnabled: boolean;
}) {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [saved, setSaved] = useState(false);

  const emptyForm = (): InfraBillingUpsert => ({
    year, month,
    rent_due: shop.monthly_rent, rent_paid: 0,
    electricity_due: 0, electricity_paid: 0,
    water_due: 0, water_paid: 0,
  });

  const [form, setForm] = useState<InfraBillingUpsert>(emptyForm());

  const { data: detail } = useQuery<InfraShopDetail>({
    queryKey: ["infra-shop", shop.id],
    queryFn: () => getInfraShop(shop.id),
  });

  // detail kelganda formni to'ldiramiz
  const prevDetailRef = useRef<InfraShopDetail | null>(null);
  if (detail && detail !== prevDetailRef.current) {
    prevDetailRef.current = detail;
    const nf = emptyForm();
    detail.billings
      .filter((b) => b.year === year && b.month === month)
      .forEach((b) => {
        if (b.category === "rent") { nf.rent_due = b.due_amount; nf.rent_paid = b.paid_amount; }
        if (b.category === "electricity") { nf.electricity_due = b.due_amount; nf.electricity_paid = b.paid_amount; }
        if (b.category === "water") { nf.water_due = b.due_amount; nf.water_paid = b.paid_amount; }
      });
    setForm(nf);
  }

  const saveMut = useMutation({
    mutationFn: () => upsertInfraBilling(shop.id, { ...form, year, month }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ["infra-shop", shop.id] });
    },
  });

  function setField(key: keyof InfraBillingUpsert, val: string) {
    setForm((f) => ({ ...f, [key]: parseNum(val) }));
  }

  const years = [now.getFullYear(), now.getFullYear() - 1];
  const activeCats = CATS.filter((c) => c.key !== "water" || waterEnabled);

  const totalDue = form.rent_due + form.electricity_due + (waterEnabled ? form.water_due : 0);
  const totalPaid = form.rent_paid + form.electricity_paid + (waterEnabled ? form.water_paid : 0);
  const totalDebt = activeCats.reduce((acc, c) => acc + Math.max(0, form[c.due] as number - (form[c.paid] as number)), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
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

      {!waterEnabled && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-ink-faint">
          <Droplets size={14} /> Bu infra do'kon uchun suv hisobi o'chirilgan
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-400">
              <th className="px-3 py-2 text-left">Xizmat</th>
              <th className="px-3 py-2 text-right">Hisoblangan (so'm)</th>
              <th className="px-3 py-2 text-right">To'langan (so'm)</th>
              <th className="px-3 py-2 text-right">Qarz</th>
            </tr>
          </thead>
          <tbody>
            {activeCats.map((cat) => {
              const due = form[cat.due] as number;
              const paid = form[cat.paid] as number;
              const debt = Math.max(0, due - paid);
              return (
                <tr key={cat.key} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 font-semibold">{cat.label}</td>
                  <td className="px-3 py-2">
                    <input
                      className="input w-40 text-right font-mono"
                      value={due === 0 ? "" : due.toLocaleString("ru-RU")}
                      placeholder="0"
                      onChange={(e) => setField(cat.due, e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="input w-40 text-right font-mono"
                      value={paid === 0 ? "" : paid.toLocaleString("ru-RU")}
                      placeholder="0"
                      onChange={(e) => setField(cat.paid, e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold">
                    {debt > 0
                      ? <span className="text-status-unpaid">{fmtUZS(debt)}</span>
                      : paid > due && paid > 0
                        ? <span className="text-blue-600">+{fmtUZS(paid - due)}</span>
                        : <span className="text-status-paid">✓</span>
                    }
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
              <td className="px-3 py-2">Jami</td>
              <td className="px-3 py-2 text-right font-mono text-xs">{fmtUZS(totalDue)}</td>
              <td className="px-3 py-2 text-right font-mono text-xs">{fmtUZS(totalPaid)}</td>
              <td className="px-3 py-2 text-right font-mono">
                {totalDebt > 0
                  ? <span className="text-status-unpaid">{fmtUZS(totalDebt)}</span>
                  : <span className="text-status-paid">✓ Qarzsiz</span>
                }
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          className="btn-primary px-6 py-2 disabled:opacity-50"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate()}
        >
          {saveMut.isPending
            ? <Loader2 size={16} className="animate-spin" />
            : saved ? <><Check size={16} /> Saqlandi</> : "Saqlash"
          }
        </button>
      </div>

      {detail && detail.billings.filter((b) => !(b.year === year && b.month === month)).length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">Oldingi oylar</div>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-400">
                  <th className="px-3 py-2 text-left">Oy</th>
                  <th className="px-3 py-2 text-left">Xizmat</th>
                  <th className="px-3 py-2 text-right">Hisoblangan</th>
                  <th className="px-3 py-2 text-right">To'langan</th>
                  <th className="px-3 py-2 text-right">Qarz</th>
                </tr>
              </thead>
              <tbody>
                {detail.billings
                  .filter((b) => !(b.year === year && b.month === month))
                  .map((b) => (
                    <tr key={b.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-3 py-1.5 font-semibold">{MONTHS[b.month - 1]} {b.year}</td>
                      <td className="px-3 py-1.5">
                        {b.category === "rent" ? "🏠 Arenda" : b.category === "electricity" ? "⚡ Elektr" : "💧 Suv"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtUZS(b.due_amount)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtUZS(b.paid_amount)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold">
                        {b.debt > 0
                          ? <span className="text-status-unpaid">{fmtUZS(b.debt)}</span>
                          : <span className="text-status-paid">✓</span>
                        }
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
