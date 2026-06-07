import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { importExcel, type ImportResult } from "@/api/admin";

export function ExcelImport() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => importExcel(file!),
    onSuccess: (r) => setResult(r),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Excel (.xlsx) faylidan oylik balanslarni yuklash. Ustunlar: inn, year,
        month, category (rent/water/electricity), due, paid.
      </p>

      <div className="card flex flex-col items-center gap-3 border-dashed p-6">
        <Upload size={28} className="text-slate-300" />
        <input
          type="file"
          accept=".xlsx,.xlsm"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
          }}
          className="text-sm"
        />
        {file && <span className="text-sm font-semibold text-slate-600">{file.name}</span>}
        <button
          className="btn-primary"
          disabled={!file || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Yuklanmoqda..." : "Import qilish"}
        </button>
      </div>

      {mutation.isError && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
          Import xatosi
        </div>
      )}

      {result && (
        <div className="card space-y-1 p-4 text-sm">
          <div className="font-bold text-slate-700">Natija</div>
          <div>O'qildi: {result.rows_read}</div>
          <div className="text-status-paid">Yuklandi/yangilandi: {result.inserted}</div>
          <div className="text-slate-400">O'tkazildi: {result.skipped}</div>
          {result.errors.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded bg-slate-50 p-2 text-xs text-slate-500">
              {result.errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
