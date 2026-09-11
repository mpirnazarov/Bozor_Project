/**
 * Do'kon va infra ro'yxati importi (bitta Excel faylda).
 *
 * `Infra summasi` to'ldirilgan qator — infra do'kon, `Ijara summasi`
 * to'ldirilgani — oddiy do'kon. Ega raqami xonalar soniga qarab INN (9)
 * yoki JSHSHIR (14) deb belgilanadi.
 *
 * Ikki qadamli: avval hisob ko'rsatiladi, keyin tasdiqlanadi.
 */
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Building2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { fmtUZS } from "@/lib/utils";

interface Out {
  preview: boolean;
  rows_read: number;
  shops_new: number; shops_updated: number;
  infra_new: number; infra_updated: number;
  cp_new: number; cp_updated: number;
  inn_count: number; jshshir_count: number;
  no_id: number; bad_id: string[];
  shops_total: number; infra_total: number;
  detected_columns: Record<string, number>;
  skipped: { no: string; name: string; reason: string }[];
  sample: { no: string; shop_id: string | null; name: string; ident: string;
            id_type: string; kind: string; summa: number }[];
}

export function ShopsInfraImport() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [prefix, setPrefix] = useState("");
  const [busy, setBusy] = useState(false);
  const [pre, setPre] = useState<Out | null>(null);
  const [done, setDone] = useState<Out | null>(null);
  const [err, setErr] = useState("");

  function reset() { setFile(null); setPre(null); setDone(null); setErr(""); }

  async function send(f: File, isPreview: boolean) {
    setBusy(true); setErr("");
    try {
      const form = new FormData();
      form.append("file", f);
      const { apiClient } = await import("@/api/client");
      const { data } = await apiClient.post<Out>(
        `/admin/import/shops-infra?preview=${isPreview}&prefix=${encodeURIComponent(prefix)}`,
        form, { headers: { "Content-Type": "multipart/form-data" } },
      );
      if (isPreview) { setPre(data); setDone(null); }
      else {
        setDone(data); setPre(null); setFile(null);
        qc.invalidateQueries({ queryKey: ["shops"] });
        qc.invalidateQueries({ queryKey: ["pavilion-shops"] });
      }
    } catch (e: unknown) {
      const ex = e as { response?: { data?: { detail?: string } } };
      setErr(ex?.response?.data?.detail ?? "Xatolik yuz berdi");
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-soft">
      <div className="mb-1 flex items-center gap-2">
        <Building2 size={18} className="text-brand" />
        <h3 className="text-base font-bold text-ink">Do'kon va infra ro'yxati (Excel)</h3>
      </div>
      <p className="mb-4 text-sm text-ink-soft">
        Ustunlar: <b>№</b>, <b>Tadbirkorlar ro'yxati</b>, <b>JSHSHIR</b>, <b>Telefon</b>,
        {" "}<b>Kv.metr</b>, <b>Infra stavkasi/summasi</b>, <b>Ijara stavkasi/summasi</b>.<br />
        <b>Infra summasi</b> to'ldirilgan qator — infra do'kon, <b>Ijara summasi</b> —
        oddiy do'kon. Ega raqami xonalar soniga qarab ajratiladi:
        {" "}<b>9 xonali → INN</b>, <b>14 xonali → JSHSHIR</b>.
        {" "}<span className="text-ink-faint">Komunal, Poteriya va Jami to'lov o'qilmaydi.</span>
      </p>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            Magazin ID oldiga qo'shiladi
          </label>
          <input
            className="input w-56"
            placeholder="masalan: CH-ATROF-"
            value={prefix}
            onChange={(e) => { setPrefix(e.target.value); setPre(null); }}
          />
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden"
               onChange={(e) => {
                 const f = e.target.files?.[0]; e.target.value = "";
                 if (f) { reset(); setFile(f); send(f, true); }
               }} />
        {!pre && (
          <button className="btn-ghost px-4 py-2 text-sm disabled:opacity-50"
                  disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> {busy ? "Tekshirilmoqda..." : "Excel tanlash"}
          </button>
        )}
      </div>

      {err && (
        <div className="flex items-start gap-2 rounded-xl bg-status-unpaid/10 px-3 py-2 text-sm text-status-unpaid">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span>{err}</span>
        </div>
      )}

      {/* 1-qadam — hisob */}
      {pre && file && (
        <div className="space-y-3 rounded-xl border border-slate-200/80 bg-surface-muted p-3.5">
          <div className="font-bold text-ink">{file.name} — tekshirildi</div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-white/70 p-2.5 text-xs">
              <div className="font-bold text-ink">Oddiy do'konlar</div>
              <div className="mt-1 text-ink-soft">
                Yangi: <b className="text-status-paid">{pre.shops_new}</b> ·
                {" "}Yangilanadi: <b>{pre.shops_updated}</b>
              </div>
              <div className="tabnum mt-0.5 text-ink">Ijara jami: {fmtUZS(pre.shops_total)}</div>
            </div>
            <div className="rounded-lg bg-white/70 p-2.5 text-xs">
              <div className="font-bold text-ink">Infra do'konlar</div>
              <div className="mt-1 text-ink-soft">
                Yangi: <b className="text-status-paid">{pre.infra_new}</b> ·
                {" "}Yangilanadi: <b>{pre.infra_updated}</b>
              </div>
              <div className="tabnum mt-0.5 text-ink">Infra jami: {fmtUZS(pre.infra_total)}</div>
            </div>
          </div>

          <div className="text-xs text-ink-soft">
            O'qilgan qator: <b className="text-ink">{pre.rows_read}</b> ·
            {" "}INN: <b className="text-ink">{pre.inn_count}</b> ·
            {" "}JSHSHIR: <b className="text-ink">{pre.jshshir_count}</b> ·
            {" "}Yangi kontragent: <b className="text-ink">{pre.cp_new}</b>
          </div>

          {(pre.no_id > 0 || pre.bad_id.length > 0) && (
            <div className="rounded-lg bg-status-partial/15 px-2.5 py-2 text-xs text-ink-soft">
              {pre.no_id > 0 && <div>ID si yo'q qator: <b>{pre.no_id}</b> ta — egasiz kiritiladi.</div>}
              {pre.bad_id.length > 0 && (
                <div>Noto'g'ri uzunlikdagi ID: {pre.bad_id.join("; ")} — egasiz kiritiladi.</div>
              )}
            </div>
          )}

          {!prefix && pre.shops_new > 0 && (
            <div className="rounded-lg bg-status-unpaid/10 px-2.5 py-2 text-xs text-status-unpaid">
              Prefiks kiritilmadi — magazin ID lar fayldagidek qisqa bo'ladi (1A, 2 …).
            </div>
          )}

          {pre.sample.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200/70">
              <table className="w-full min-w-[520px] text-[11px]">
                <thead>
                  <tr className="bg-white/70 text-left text-ink-faint">
                    <th className="px-2 py-1.5">№</th>
                    <th className="px-2 py-1.5">Magazin ID</th>
                    <th className="px-2 py-1.5">Ega</th>
                    <th className="px-2 py-1.5">Raqam</th>
                    <th className="px-2 py-1.5">Turi</th>
                    <th className="px-2 py-1.5 text-right">Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {pre.sample.map((r, i) => (
                    <tr key={i} className="border-t border-slate-200/60">
                      <td className="px-2 py-1.5 font-mono">{r.no}</td>
                      <td className="px-2 py-1.5 font-mono text-ink">{r.shop_id ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.name}</td>
                      <td className="px-2 py-1.5 font-mono">
                        {r.ident || "—"}
                        <span className="ml-1 text-ink-faint">
                          {r.id_type === "jshshir" ? "JSHSHIR" : r.id_type === "inn" ? "INN" : ""}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">{r.kind === "infra" ? "Infra" : "Do'kon"}</td>
                      <td className="tabnum px-2 py-1.5 text-right">{fmtUZS(r.summa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-2 py-1 text-[10px] text-ink-faint">
                Birinchi {pre.sample.length} qator ko'rsatilmoqda
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
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
        <div className="rounded-xl bg-status-paid/10 px-3 py-2.5 text-sm">
          <div className="flex items-center gap-1.5 font-bold text-status-paid">
            <CheckCircle2 size={15} /> Saqlandi
          </div>
          <div className="mt-1 text-ink-soft">
            Do'kon: <b>{done.shops_new}</b> yangi, <b>{done.shops_updated}</b> yangilandi ·
            {" "}Infra: <b>{done.infra_new}</b> yangi, <b>{done.infra_updated}</b> yangilandi ·
            {" "}Kontragent: <b>{done.cp_new}</b> yangi
          </div>
        </div>
      )}
    </div>
  );
}
