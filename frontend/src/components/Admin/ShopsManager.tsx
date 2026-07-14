import { useState } from "react";
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

// Bo'sh do'konlar upload — ShopsManager ichida alohida section
// (import qilish uchun ShopsManager.tsx oxirida)
export function VacantShopsUploader() {
  const qc = useQueryClient();
  const [result, setResult] = useState<{
    ok: boolean; marked_vacant: number; marked_not_vacant: number; not_found: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleFile(file: File) {
    setBusy(true); setErr(""); setResult(null);
    try {
      const { uploadVacantShops } = await import("@/api/admin");
      const r = await uploadVacantShops(file);
      setResult(r);
      qc.invalidateQueries({ queryKey: ["shops"] });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setErr(err?.response?.data?.detail ?? "Xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="text-sm font-bold text-ink">Bo'sh do'konlar ro'yxati</div>
      <p className="text-xs text-ink-faint">
        CSV yoki Excel fayl yuklang (shop_id ustuni). Fayldagi do'konlar bo'sh deb belgilanadi,
        qolganlar faol deb qaytariladi.
      </p>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-4 transition-colors hover:border-brand">
        <span className="text-xs font-semibold text-ink-soft">CSV yoki Excel yuklash</span>
        <input type="file" accept=".csv,.xlsx" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      </label>
      {busy && <div className="text-sm text-brand">Yuklanmoqda...</div>}
      {err && <div className="text-sm text-status-unpaid">{err}</div>}
      {result && (
        <div className="text-sm">
          <div className="text-status-paid">Bo'sh belgilandi: {result.marked_vacant}</div>
          <div className="text-ink-soft">Faol qaytarildi: {result.marked_not_vacant}</div>
          {result.not_found.length > 0 && (
            <div className="text-status-unpaid">Topilmadi: {result.not_found.slice(0,5).join(", ")}</div>
          )}
        </div>
      )}
    </div>
  );
}
