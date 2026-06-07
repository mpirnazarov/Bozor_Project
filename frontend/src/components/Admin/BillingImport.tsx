import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { importBilling, type BillingImportResult } from "@/api/admin";

const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

export function BillingImport() {
  const now = new Date();
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [result, setResult] = useState<BillingImportResult | null>(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => importBilling(file!, year, month),
    onSuccess: (r) => {
      setResult(r);
      // Faqat haqiqiy muvaffaqiyatda keshni yangilaymiz
      if (r.ok) {
        qc.invalidateQueries({ queryKey: ["pavilions"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["audit-log"] });
      } else {
        // Xatoli import ham audit logga tushadi
        qc.invalidateQueries({ queryKey: ["audit-log"] });
      }
    },
  });

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand/15 bg-brand/5 p-4 text-sm text-ink-soft">
        <p className="font-semibold text-ink">Billing import (buxgalteriya fayli)</p>
        <p className="mt-1">
          Ustunlar: <b>Контрагент.ИНН</b>, <b>Виды взаиморасчетов</b> (Аренда/Электроэнергия/Вода),
          <b> Дебет</b> (qarz), <b>Кредит</b> (ortiqcha to'lov). Yil va oyni tanlab yuklang.
        </p>
        <a
          href="/billing_NAMUNA_example.xlsx"
          download
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/10"
        >
          <Download size={14} /> Namuna faylni yuklab olish
        </a>
      </div>

      {/* Davr tanlash */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
          Yil
          <select
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setResult(null); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
          Oy
          <select
            value={month}
            onChange={(e) => { setMonth(Number(e.target.value)); setResult(null); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink"
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </label>
      </div>

      {/* Fayl tanlash */}
      <div className="card flex flex-col items-center gap-3 border-dashed p-6">
        <FileSpreadsheet size={28} className="text-brand/50" />
        <input
          type="file"
          accept=".xlsx,.xlsm"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
          className="text-sm"
        />
        {file && <span className="text-sm font-semibold text-ink-soft">{file.name}</span>}
        <button
          className="btn-primary inline-flex items-center gap-2"
          disabled={!file || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          <Upload size={16} />
          {mutation.isPending ? "Yuklanmoqda..." : `${MONTHS[month - 1]} ${year} uchun import`}
        </button>
      </div>

      {mutation.isError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
          <AlertTriangle size={16} /> Server xatosi — qayta urinib ko'ring
        </div>
      )}

      {result && result.ok && (
        <div className="card space-y-2 p-4 text-sm">
          <div className="flex items-center gap-2 font-bold text-status-paid">
            <CheckCircle2 size={18} /> Import muvaffaqiyatli
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="O'qildi" value={result.rows_read} />
            <Stat label="Kontragent" value={result.counterparties} />
            <Stat label="Yozuvlar" value={result.records} />
            <Stat label="O'tkazildi" value={result.skipped} muted />
          </div>
          <p className="text-xs text-ink-faint">
            Ma'lumotlar {MONTHS[month - 1]} {year} uchun yangilandi. Xato bo'lsa — Audit jurnalidan ortga qaytaring.
          </p>
        </div>
      )}

      {result && !result.ok && (
        <div className="space-y-2 rounded-xl border-2 border-red-200 bg-red-50 p-4 text-sm">
          <div className="flex items-center gap-2 font-bold text-red-600">
            <AlertTriangle size={18} /> Import bekor qilindi — hech narsa saqlanmadi
          </div>
          <p className="text-red-700">
            Faylda <b>{result.errors.length}</b> ta muammo topildi ({result.rows_read} qator o'qildi).
            Quyidagi xatolarni tuzatib, qaytadan yuklang. Bu urinish Audit jurnalida saqlandi
            (faylni o'sha yerdan ham yuklab olishingiz mumkin).
          </p>
          <div className="max-h-56 overflow-y-auto rounded-lg bg-white p-3 text-xs text-red-700">
            {result.errors.map((e, i) => (
              <div key={i} className="border-b border-red-100 py-1 last:border-0">{e}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={`text-lg font-extrabold ${muted ? "text-ink-faint" : "text-ink"}`}>{value}</div>
    </div>
  );
}
