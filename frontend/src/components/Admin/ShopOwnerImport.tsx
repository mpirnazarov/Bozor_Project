import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Undo2, ChevronDown, ChevronRight } from "lucide-react";
import { importShopOwners, type ShopOwnerImportResult } from "@/api/admin";

export function ShopOwnerImport() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ShopOwnerImportResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mut = useMutation({
    mutationFn: () => importShopOwners(file!),
    onSuccess: (data) => { setResult(data); setShowDetail(false); },
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
  }

  const errDetail = (mut.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;

  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-soft">
      <div className="mb-1 flex items-center gap-2">
        <FileSpreadsheet size={18} className="text-brand" />
        <h3 className="text-base font-bold text-ink">Magazin egalarini yangilash (Excel)</h3>
      </div>
      <p className="mb-4 text-sm text-ink-soft">
        Excel ustunlari: <b>Magazin ID</b> (Магазин №), <b>QR №</b>, <b>Kontragent</b> (Ижарачи), <b>Summa</b> (Сумма).
        To'liq ro'yxatni qaytadan yuklang. Xato bo'lsa <b>Jurnal</b> bo'limidan 24 soat ichida ortga qaytariladi.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleFile} />
        <button className="btn-ghost px-4 py-2 text-sm" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> {file ? "Boshqa fayl" : "Excel tanlash"}
        </button>
        {file && <span className="text-sm text-ink-soft">{file.name}</span>}
        <button
          className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          disabled={!file || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? "Yuklanmoqda..." : "Yangilash"}
        </button>
      </div>

      {mut.isError && (
        <div className="mt-4 rounded-xl bg-status-unpaid/10 p-3 text-sm text-status-unpaid">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Import bajarilmadi</div>
              <div className="mt-1">
                {errDetail ?? "Noma'lum xatolik. Fayl formati .xlsx ekanini va ustun nomlarini tekshiring."}
              </div>
              <div className="mt-2 text-xs text-ink-soft">
                Nimani tekshirish kerak:
                <ul className="mt-1 list-disc pl-5">
                  <li>Birinchi qatorda ustun nomlari bo'lsin: <b>Магазин №, QR №, Ижарачи, Сумма</b></li>
                  <li>Magazin ID ustuni bo'sh bo'lmasin</li>
                  <li>Fayl <b>.xlsx</b> formatida bo'lsin (10 MB dan kichik)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl bg-status-paid/8 p-4">
          <div className="mb-2 flex items-center gap-2 font-bold text-status-paid">
            <CheckCircle2 size={18} /> Yangilandi
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-ink-soft sm:grid-cols-3">
            <Stat label="O'qilgan qator" value={result.rows_read} />
            <Stat label="Yangilangan magazin" value={result.updated} />
            <Stat label="Yangi magazin" value={result.inserted} />
            <Stat label="Egasi yangilandi" value={result.counterparties_updated} />
            <Stat label="Yangi egasi" value={result.counterparties_created} />
            {result.skipped_count > 0 && <Stat label="O'tkazib yuborilgan" value={result.skipped_count} />}
          </div>

          {result.snapshot_id != null && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
              <Undo2 size={13} /> Xato bo'lsa «Jurnal» bo'limidan ortga qaytarish mumkin (24 soat)
            </div>
          )}

          {(result.errors.length > 0 || result.skipped_count > 0) && (
            <button
              className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand"
              onClick={() => setShowDetail((v) => !v)}
            >
              {showDetail ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Batafsil ({result.errors.length + result.skipped_count})
            </button>
          )}

          {showDetail && (
            <div className="mt-2 space-y-3 rounded-lg bg-white/60 p-3 text-xs">
              {Object.keys(result.detected_columns).length > 0 && (
                <div>
                  <b className="text-ink">Topilgan ustunlar:</b>{" "}
                  <span className="text-ink-soft">
                    {Object.keys(result.detected_columns).join(", ")}
                  </span>
                </div>
              )}
              {result.errors.length > 0 && (
                <div>
                  <b className="text-status-unpaid">Ogohlantirishlar:</b>
                  <ul className="mt-1 list-disc pl-5 text-ink-soft">
                    {result.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              {result.skipped_count > 0 && (
                <div>
                  <b className="text-ink">O'tkazib yuborilgan qatorlar ({result.skipped_count}):</b>
                  <ul className="mt-1 list-disc pl-5 text-ink-soft">
                    {result.skipped.slice(0, 20).map((s, i) => (
                      <li key={i}>Qator {s.row} — {s.shop_id}: {s.reason}</li>
                    ))}
                  </ul>
                  {result.skipped_count > 20 && (
                    <div className="mt-1 text-ink-faint">...va yana {result.skipped_count - 20} ta</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span className="text-ink-faint">{label}: </span>
      <span className="tabnum font-bold text-ink">{value}</span>
    </div>
  );
}
