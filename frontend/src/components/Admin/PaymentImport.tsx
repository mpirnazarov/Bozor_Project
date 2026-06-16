import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Upload, CalendarDays, CheckCircle2, AlertTriangle, Undo2,
  ChevronDown, ChevronRight, Download, Info, Users,
} from "lucide-react";
import {
  importRentBilling, type RentBillingImportResult,
  importInnPayments, type InnPaymentImportResult,
} from "@/api/admin";

function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function PaymentImport() {
  return (
    <div className="space-y-5">
      {/* USUL 1 — Arenda billing (sana bo'yicha) */}
      <Method1 />
      {/* USUL 2 — INN bo'yicha to'lovlar */}
      <Method2 />
    </div>
  );
}

/* ============ USUL 1 ============ */
function Method1() {
  const [file, setFile] = useState<File | null>(null);
  const [billDate, setBillDate] = useState(todayISO());
  const [result, setResult] = useState<RentBillingImportResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mut = useMutation({
    mutationFn: () => importRentBilling(file!, billDate),
    onSuccess: (d) => { setResult(d); setShowDetail(false); },
  });
  const errDetail = (mut.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;

  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-soft">
      <div className="mb-1 flex items-center gap-2">
        <CalendarDays size={18} className="text-brand" />
        <h3 className="text-base font-bold text-ink">1-usul · Arenda billing (oy boshida, po faktu)</h3>
      </div>

      <div className="mb-3 flex items-start gap-2 rounded-xl bg-brand/5 p-3 text-xs text-ink-soft">
        <Info size={15} className="mt-0.5 shrink-0 text-brand" />
        <div>
          <b>Har oy boshida bir marta</b> shu ko'rinishda kiritiladi — magazinlarning po faktu
          qarzi yoki to'lovlari. Shu bilan oyni hisoblash boshlanadi (masalan Iyul oyi boshida).
          Ustunlar: <b>Контрагент, Договор, Основное арендное место</b> (magazin ID),
          <b> Арендная площадь, ИНН, Ойлик сумма, Карз, тўланган</b>.
          <a href="/NAMUNA_1_arenda_sana.xlsx" download
             className="mt-1 inline-flex items-center gap-1 font-semibold text-brand hover:underline">
            <Download size={13} /> Namuna Excel yuklab olish
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">Sana</label>
          <input type="date" className="input" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden"
               onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
        <button className="btn-ghost px-4 py-2 text-sm" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> {file ? "Boshqa fayl" : "Excel tanlash"}
        </button>
        {file && <span className="text-sm text-ink-soft">{file.name}</span>}
        <button className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
                disabled={!file || !billDate || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? "Yuklanmoqda..." : "Import qilish"}
        </button>
      </div>

      {mut.isError && (
        <div className="mt-4 rounded-xl bg-status-unpaid/10 p-3 text-sm text-status-unpaid">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Import bajarilmadi</div>
              <div className="mt-1">{errDetail ?? "Noma'lum xatolik."}</div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl bg-status-paid/8 p-4">
          <div className="mb-2 flex items-center gap-2 font-bold text-status-paid">
            <CheckCircle2 size={18} /> {result.bill_date} sanasiga saqlandi
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-ink-soft sm:grid-cols-4">
            <Stat label="O'qilgan" value={result.rows_read} />
            <Stat label="Saqlandi" value={result.upserted} />
            <Stat label="Qarzli" value={result.with_debt} />
            <Stat label="Qarzsiz" value={result.no_debt} />
          </div>
          {result.snapshot_id != null && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
              <Undo2 size={13} /> «Jurnal» bo'limidan ortga qaytarish mumkin (24 soat)
            </div>
          )}
          {(result.errors.length > 0 || result.skipped_count > 0) && (
            <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand"
                    onClick={() => setShowDetail((v) => !v)}>
              {showDetail ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Batafsil ({result.errors.length + result.skipped_count})
            </button>
          )}
          {showDetail && <DetailBox errors={result.errors} skipped={result.skipped}
                                    skippedCount={result.skipped_count} cols={result.detected_columns} />}
        </div>
      )}
    </div>
  );
}

/* ============ USUL 2 ============ */
function Method2() {
  const [file, setFile] = useState<File | null>(null);
  const [billDate, setBillDate] = useState(todayISO());
  const [result, setResult] = useState<InnPaymentImportResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mut = useMutation({
    mutationFn: () => importInnPayments(file!, billDate),
    onSuccess: (d) => { setResult(d); setShowDetail(false); },
  });
  const errDetail = (mut.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;

  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-soft">
      <div className="mb-1 flex items-center gap-2">
        <Users size={18} className="text-brand" />
        <h3 className="text-base font-bold text-ink">2-usul · INN bo'yicha to'lovlar (oy davomida)</h3>
      </div>

      <div className="mb-3 flex items-start gap-2 rounded-xl bg-brand/5 p-3 text-xs text-ink-soft">
        <Info size={15} className="mt-0.5 shrink-0 text-brand" />
        <div>
          <b>Oy davomida</b> shu ko'rinishda to'lovlar kiritiladi. Har qator bitta to'lov.
          Tizim to'lovlarni <b>INN bo'yicha yig'ib</b>, o'sha INN ning barcha magazinlariga
          bo'lib yuboradi va qarzdan ayiradi. Oy oxirida oxirgi holat po faktu saqlanadi,
          keyingi oy boshida yana 1-usul bilan yangilanadi.
          Ustunlar: <b>Дата, Поступило, Назначение платежа, Контрагент, Вх# номер, Вх# дата, ИНН</b>.
          <a href="/NAMUNA_2_inn_tolovlar.xlsx" download
             className="mt-1 inline-flex items-center gap-1 font-semibold text-brand hover:underline">
            <Download size={13} /> Namuna Excel yuklab olish
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">Sana</label>
          <input type="date" className="input" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden"
               onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
        <button className="btn-ghost px-4 py-2 text-sm" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> {file ? "Boshqa fayl" : "Excel tanlash"}
        </button>
        {file && <span className="text-sm text-ink-soft">{file.name}</span>}
        <button className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
                disabled={!file || !billDate || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? "Yuklanmoqda..." : "Import qilish"}
        </button>
      </div>

      {mut.isError && (
        <div className="mt-4 rounded-xl bg-status-unpaid/10 p-3 text-sm text-status-unpaid">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Import bajarilmadi</div>
              <div className="mt-1">{errDetail ?? "Noma'lum xatolik."}</div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl bg-status-paid/8 p-4">
          <div className="mb-2 flex items-center gap-2 font-bold text-status-paid">
            <CheckCircle2 size={18} /> {result.bill_date} sanasiga saqlandi
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-ink-soft sm:grid-cols-3">
            <Stat label="To'lov qatori" value={result.rows_read} />
            <Stat label="Jami to'lov" value={Math.round(result.payments_total)} money />
            <Stat label="Mos INN" value={result.inns_matched} />
            <Stat label="Magazin yangilandi" value={result.shops_updated} />
            {result.inns_unmatched > 0 && <Stat label="Magazinsiz INN" value={result.inns_unmatched} />}
          </div>
          {result.snapshot_id != null && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
              <Undo2 size={13} /> «Jurnal» bo'limidan ortga qaytarish mumkin (24 soat)
            </div>
          )}
          {(result.errors.length > 0 || result.skipped_count > 0) && (
            <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand"
                    onClick={() => setShowDetail((v) => !v)}>
              {showDetail ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Batafsil ({result.errors.length + result.skipped_count})
            </button>
          )}
          {showDetail && <DetailBox errors={result.errors} skipped={result.skipped}
                                    skippedCount={result.skipped_count} cols={result.detected_columns} />}
        </div>
      )}
    </div>
  );
}

/* ============ umumiy ============ */
function Stat({ label, value, money }: { label: string; value: number; money?: boolean }) {
  return (
    <div>
      <span className="text-ink-faint">{label}: </span>
      <span className="tabnum font-bold text-ink">
        {money ? value.toLocaleString("ru-RU") : value}
      </span>
    </div>
  );
}

function DetailBox({ errors, skipped, skippedCount, cols }: {
  errors: string[];
  skipped: { row: number; shop_id: string; reason: string }[];
  skippedCount: number;
  cols: Record<string, number>;
}) {
  return (
    <div className="mt-2 space-y-3 rounded-lg bg-white/60 p-3 text-xs">
      {Object.keys(cols).length > 0 && (
        <div>
          <b className="text-ink">Topilgan ustunlar:</b>{" "}
          <span className="text-ink-soft">{Object.keys(cols).join(", ")}</span>
        </div>
      )}
      {errors.length > 0 && (
        <div>
          <b className="text-status-unpaid">Ogohlantirishlar:</b>
          <ul className="mt-1 list-disc pl-5 text-ink-soft">
            {errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
      {skippedCount > 0 && (
        <div>
          <b className="text-ink">O'tkazib yuborilgan ({skippedCount}):</b>
          <ul className="mt-1 list-disc pl-5 text-ink-soft">
            {skipped.slice(0, 20).map((s, i) => (
              <li key={i}>{s.shop_id}: {s.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
