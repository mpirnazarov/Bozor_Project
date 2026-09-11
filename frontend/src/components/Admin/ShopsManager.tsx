import { useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload, Link2, Loader2, CheckCircle2, AlertTriangle, Filter, Store,
} from "lucide-react";
import {
  importShopsCsv, importShopsGsheet, type ShopImportResult,
} from "@/api/admin";
import { listShops } from "@/api/shops";
import { useT } from "@/i18n/useT";

export function ShopsManager() {
  const qc = useQueryClient();
  const t = useT();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ShopImportResult | null>(null);
  const [err, setErr] = useState("");
  const [onlyNotFound, setOnlyNotFound] = useState(false);

  // Umumiy magazin statistikasi
  const { data: shopStats } = useQuery({
    queryKey: ["shops-stat"],
    queryFn: () => listShops({ per_page: 1 }),
  });

  async function runFile(file: File) {
    setBusy(true); setErr(""); setResult(null);
    try {
      const r = await importShopsCsv(file);
      setResult(r);
      qc.invalidateQueries({ queryKey: ["shops-stat"] });
      qc.invalidateQueries({ queryKey: ["pavilions"] });
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Import xatosi");
    } finally {
      setBusy(false);
    }
  }

  async function runUrl() {
    if (!url.trim()) { setErr("Havola kiriting"); return; }
    setBusy(true); setErr(""); setResult(null);
    try {
      const r = await importShopsGsheet(url.trim());
      setResult(r);
      qc.invalidateQueries({ queryKey: ["shops-stat"] });
      qc.invalidateQueries({ queryKey: ["pavilions"] });
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Import xatosi");
    } finally {
      setBusy(false);
    }
  }

  const notFound = result?.not_found ?? [];
  const shownNotFound = onlyNotFound ? notFound : notFound.slice(0, 10);

  return (
    <div className="space-y-4">
      <VacantShopsUploader />

      <VacantShopsList />

      <p className="text-sm text-ink-soft">
        {t("shopsmgr.intro")}
      </p>

      {/* Import manbalari */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Google Sheets */}
        <div className="card space-y-2 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Link2 size={16} className="text-brand" /> {t("shopsmgr.gsheet")}
          </div>
          <input
            className="input font-mono text-xs"
            placeholder="https://docs.google.com/.../pub?output=csv"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="text-[11px] text-ink-faint">
            Sheets → Fayl → Nashr qilish → CSV → havolani nusxalang
          </div>
          <button className="btn-primary w-full" onClick={runUrl} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
            {t("shopsmgr.gsheetLoad")}
          </button>
        </div>

        {/* CSV fayl */}
        <div className="card space-y-2 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Upload size={16} className="text-brand" /> {t("shopsmgr.csv")}
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-6 text-center transition-colors hover:border-brand hover:bg-brand-50">
            <Upload size={22} className="text-ink-faint" />
            <span className="text-xs font-semibold text-ink-soft">
              {t("shopsmgr.csvDrop")}
            </span>
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) runFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {err && (
        <div className="rounded-xl bg-status-unpaid/10 px-4 py-3 text-sm font-semibold text-status-unpaid">
          {err}
        </div>
      )}

      {busy && (
        <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand">
          <Loader2 size={16} className="animate-spin" /> {t("shopsmgr.importing")}
        </div>
      )}

      {/* Import statistikasi */}
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label={t("shopsmgr.rowsRead")} value={result.rows_read} tone="ink" icon={<Store size={16} />} />
            <StatBox label={t("shopsmgr.inserted")} value={result.inserted} tone="paid" icon={<CheckCircle2 size={16} />} />
            <StatBox label={t("shopsmgr.updated")} value={result.updated} tone="brand" icon={<CheckCircle2 size={16} />} />
            <StatBox label={t("shopsmgr.unlinked")} value={result.not_found_count} tone="unpaid" icon={<AlertTriangle size={16} />} />
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-ink-soft">
            <span>{t("shopsmgr.linked")}: <b className="text-status-paid">{result.linked}</b></span>
            <span>{t("shopsmgr.cpCreated")}: <b className="text-brand">{result.counterparties_created}</b></span>
          </div>

          {/* Topilmaganlar ro'yxati + filter */}
          {notFound.length > 0 && (
            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  <AlertTriangle size={16} className="text-status-unpaid" />
                  {t("shopsmgr.notFoundTitle")} ({result.not_found_count})
                </div>
                <button
                  className={onlyNotFound ? "btn-primary px-3 py-1.5 text-xs" : "btn-ghost px-3 py-1.5 text-xs"}
                  onClick={() => setOnlyNotFound((v) => !v)}
                >
                  <Filter size={13} /> {onlyNotFound ? t("shopsmgr.showAll") : t("shopsmgr.onlyNotFound")}
                </button>
              </div>
              <div className="max-h-80 space-y-1.5 overflow-y-auto">
                {shownNotFound.map((n, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-ink">
                        {n.shop_id ?? `Qator ${n.row}`}
                      </div>
                      {n.name && <div className="truncate text-ink-soft">{n.name}</div>}
                      {n.raw && <div className="truncate text-ink-faint">{n.raw}</div>}
                    </div>
                    <span className="shrink-0 rounded-full bg-status-unpaid/10 px-2 py-0.5 font-semibold text-status-unpaid">
                      {n.reason}
                    </span>
                  </div>
                ))}
                {!onlyNotFound && notFound.length > 10 && (
                  <button onClick={() => setOnlyNotFound(true)} className="w-full py-2 text-xs font-semibold text-brand">
                    Yana {notFound.length - 10} ta ko'rsatish →
                  </button>
                )}
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="card p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-600">
                <AlertTriangle size={16} /> Ogohlantirishlar ({result.errors.length})
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto text-xs text-ink-soft">
                {result.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Umumiy magazin statistikasi (DB) */}
      {!result && shopStats && (
        <div className="card p-4">
          <div className="mb-2 text-sm font-bold text-ink">{t("shopsmgr.dbShops")}</div>
          <div className="text-2xl font-extrabold text-brand tabnum">
            {shopStats.total?.toLocaleString("uz-UZ") ?? 0}
          </div>
          <div className="text-xs text-ink-faint">{t("shopsmgr.totalShops")}</div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, tone, icon }: {
  label: string; value: number; tone: "ink" | "paid" | "brand" | "unpaid"; icon: React.ReactNode;
}) {
  const color = {
    ink: "text-ink", paid: "text-status-paid", brand: "text-brand", unpaid: "text-status-unpaid",
  }[tone];
  return (
    <div className="card p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-faint">
        {icon} {label}
      </div>
      <div className={`text-2xl font-extrabold tabnum ${color}`}>
        {value.toLocaleString("uz-UZ")}
      </div>
    </div>
  );
}

interface VacantUploadOut {
  preview: boolean;
  file_shop_ids: number;
  vacant_before: number;
  vacant_after: number;
  to_mark: number;
  to_unmark: number;
  unchanged: number;
  not_found: string[];
  unmark_sample: string[];
}

/**
 * Bo'sh do'konlar ro'yxati — TO'LIQ ALMASHTIRISH.
 *
 * Fayl butun bozor bo'yicha to'liq ro'yxat bo'lishi shart: faylda bo'lmagan
 * har bir do'kondan "bo'sh" belgisi olib tashlanadi. Shuning uchun avval
 * `preview` bilan nima o'zgarishi hisoblanadi va foydalanuvchi tasdiqlaydi.
 */
function VacantShopsUploader() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<VacantUploadOut | null>(null);
  const [done, setDone] = useState<VacantUploadOut | null>(null);
  const [err, setErr] = useState("");
  const [inputRef, setInputRef] = useState<HTMLInputElement | null>(null);

  function reset() { setFile(null); setPreview(null); setDone(null); setErr(""); }

  async function send(f: File, isPreview: boolean) {
    setBusy(true); setErr("");
    try {
      const form = new FormData();
      form.append("file", f);
      const { apiClient } = await import("@/api/client");
      const { data } = await apiClient.post<VacantUploadOut>(
        `/admin/vacant-shops/upload?preview=${isPreview}`, form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      if (isPreview) { setPreview(data); setDone(null); }
      else {
        setDone(data); setPreview(null); setFile(null);
        qc.invalidateQueries({ queryKey: ["shops"] });
        qc.invalidateQueries({ queryKey: ["shops-list-vacant"] });
        qc.invalidateQueries({ queryKey: ["pavilion-shops"] });
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { detail?: string } } };
      setErr(ex?.response?.data?.detail ?? "Xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-ink">
        <span>🏚</span> Bo'sh do'konlar ro'yxati
      </div>
      <p className="text-xs text-ink-faint">
        CSV yoki Excel (.xlsx) yuklang — bitta ustun: <b>shop_id</b>.<br />
        <b className="text-status-unpaid">Diqqat:</b> bu to'liq almashtirish —
        faylda bo'lmagan do'konlardan bo'sh belgisi olib tashlanadi. Fayl butun
        bozor bo'yicha to'liq ro'yxat bo'lsin.
      </p>

      <input
        ref={setInputRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) { reset(); setFile(f); send(f, true); }
        }}
      />

      {!preview && (
        <button
          className="btn-primary w-full py-2 text-sm disabled:opacity-50"
          disabled={busy}
          onClick={() => inputRef?.click()}
        >
          {busy ? "Tekshirilmoqda..." : "Fayl tanlash"}
        </button>
      )}

      {err && <div className="rounded-xl bg-status-unpaid/10 px-3 py-2 text-sm text-status-unpaid">{err}</div>}

      {/* 1-qadam: nima o'zgarishini ko'rsatamiz, hech narsa yozilmaydi */}
      {preview && file && (
        <div className="space-y-2.5 rounded-xl border border-slate-200/80 bg-surface-muted p-3 text-sm">
          <div className="font-bold text-ink">{file.name} — tekshirildi</div>
          <div className="grid grid-cols-2 gap-1.5 text-xs text-ink-soft">
            <div>Fayldagi magazin ID: <b className="text-ink">{preview.file_shop_ids}</b></div>
            <div>Hozir bo'sh: <b className="text-ink">{preview.vacant_before}</b></div>
            <div>Yangi belgilanadi: <b className="text-status-paid">{preview.to_mark}</b></div>
            <div>O'zgarmaydi: <b className="text-ink">{preview.unchanged}</b></div>
            <div className="col-span-2">
              Amaldan keyin bo'sh do'kon: <b className="text-ink">{preview.vacant_after}</b> ta
            </div>
          </div>

          {preview.to_unmark > 0 && (
            <div className="rounded-lg bg-status-unpaid/10 px-2.5 py-2 text-xs text-status-unpaid">
              <b>{preview.to_unmark}</b> ta do'kondan bo'sh belgisi olinadi
              {preview.unmark_sample.length > 0 && (
                <>: {preview.unmark_sample.slice(0, 6).join(", ")}
                  {preview.to_unmark > 6 ? " …" : ""}</>
              )}
            </div>
          )}
          {preview.not_found.length > 0 && (
            <div className="text-xs text-ink-faint">
              Bazada topilmadi: {preview.not_found.slice(0, 5).join(", ")}
              {preview.not_found.length > 5 ? ` va yana ${preview.not_found.length - 5} ta` : ""}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
                    disabled={busy} onClick={() => send(file, false)}>
              {busy ? "Saqlanmoqda..." : "Tasdiqlash va saqlash"}
            </button>
            <button className="btn-ghost px-4 py-2 text-sm" disabled={busy} onClick={reset}>
              Bekor qilish
            </button>
          </div>
        </div>
      )}

      {/* 2-qadam natijasi */}
      {done && (
        <div className="rounded-xl bg-status-paid/10 px-3 py-2 text-sm">
          <div className="font-bold text-status-paid">✓ Saqlandi</div>
          <div className="mt-1 text-ink-soft">
            Bo'sh belgilandi: <b>{done.to_mark}</b> ta ·
            Belgisi olib tashlandi: <b>{done.to_unmark}</b> ta ·
            Jami bo'sh: <b>{done.vacant_after}</b> ta
          </div>
        </div>
      )}
    </div>
  );
}

function VacantShopsList() {
  const now = new Date();
  const { data, isLoading } = useQuery({
    queryKey: ["shops-list-vacant"],
    queryFn: async () => {
      const { data } = await apiClient.get("/admin/shops-list", {
        params: {
          vacant: "vacant",
          per_page: 500,
          page: 1,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        },
      });
      return data as { items: { shop_id: string; counterparty_name: string | null; pavilion_code: string | null; inn: string | null }[]; total: number };
    },
  });

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-ink">
          <span>🏚</span> Bo'sh do'konlar ro'yxati
          {data && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink-faint">
              {data.total} ta
            </span>
          )}
        </div>
      </div>
      {isLoading && <div className="text-xs text-ink-faint">Yuklanmoqda...</div>}
      {data && data.items.length === 0 && (
        <div className="text-xs text-ink-faint">Bo'sh do'konlar yo'q</div>
      )}
      {data && data.items.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-400">
                <th className="px-3 py-2 text-left">Magazin ID</th>
                <th className="px-3 py-2 text-left">Pavilyon</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.shop_id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-1.5 font-mono font-semibold text-brand">{row.shop_id}</td>
                  <td className="px-3 py-1.5 text-ink-faint">{row.pavilion_code ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}