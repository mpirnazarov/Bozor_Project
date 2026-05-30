import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboard } from "@/api/dashboard";
import { updateDashboard } from "@/api/admin";
import { fmtUZS } from "@/lib/utils";

interface FormState {
  total: number;
  paid: number;
  rent: number;
  arava: number;
  xojatxona: number;
  parking: number;
  boshqa: number;
}

const FIELDS: { key: keyof FormState; label: string }[] = [
  { key: "total", label: "Jami summa" },
  { key: "paid", label: "To'langan" },
  { key: "rent", label: "🏪 Arenda" },
  { key: "arava", label: "🛒 Arava xizmati" },
  { key: "xojatxona", label: "🚻 Xojatxona xizmati" },
  { key: "parking", label: "🚗 Avtomobil saqlash" },
  { key: "boshqa", label: "📦 Boshqa tushumlar" },
];

export function DashboardEditor() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["dashboard", false], queryFn: () => getDashboard(false) });
  const [form, setForm] = useState<FormState | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data && !form) {
      setForm({
        total: data.total,
        paid: data.paid,
        rent: data.services.rent,
        arava: data.services.arava,
        xojatxona: data.services.xojatxona,
        parking: data.services.parking,
        boshqa: data.services.boshqa,
      });
    }
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: () =>
      updateDashboard({
        total: form!.total,
        paid: form!.paid,
        services: {
          rent: form!.rent,
          arava: form!.arava,
          xojatxona: form!.xojatxona,
          parking: form!.parking,
          boshqa: form!.boshqa,
        },
        period: data?.period,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (!form) return <div className="text-sm text-slate-400">Yuklanmoqda...</div>;

  const breakdownSum =
    form.rent + form.arava + form.xojatxona + form.parking + form.boshqa;
  const debt = form.total - form.paid;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Bu qiymatlar serverda saqlanadi va o'zgartirilganda barcha
        foydalanuvchilarning asosiy sahifasida ko'rinadi.
      </p>

      <div className="card divide-y divide-slate-100 p-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-4 py-2.5">
            <label className="text-sm font-medium text-slate-600">{f.label}</label>
            <input
              type="number"
              className="input max-w-[220px] text-right font-mono"
              value={form[f.key]}
              onChange={(e) =>
                setForm({ ...form, [f.key]: Number(e.target.value) || 0 })
              }
            />
          </div>
        ))}
      </div>

      <div className="card space-y-1.5 bg-slate-50 p-4 text-sm">
        <Row label="Qarzdorlik (avto)" value={fmtUZS(debt)} warn={debt < 0} />
        <Row
          label="Breakdown yig'indisi"
          value={fmtUZS(breakdownSum)}
          warn={breakdownSum !== form.paid}
          hint={
            breakdownSum !== form.paid
              ? "Diqqat: breakdown yig'indisi 'To'langan'ga teng emas"
              : "✓ To'langan'ga teng"
          }
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          className="btn-primary"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
        </button>
        {saved && <span className="text-sm font-semibold text-status-paid">✓ Saqlandi</span>}
        {mutation.isError && (
          <span className="text-sm font-semibold text-status-unpaid">Xatolik yuz berdi</span>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  warn,
  hint,
}: {
  label: string;
  value: string;
  warn?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">
        {label}
        {hint && (
          <span className={`ml-2 text-xs ${warn ? "text-status-unpaid" : "text-status-paid"}`}>
            {hint}
          </span>
        )}
      </span>
      <span className={`font-mono font-bold ${warn ? "text-status-unpaid" : "text-slate-700"}`}>
        {value}
      </span>
    </div>
  );
}
