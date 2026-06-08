import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database, DownloadCloud, RotateCcw, Plus, CircleCheck, CircleX, Loader2,
  X, ShieldAlert, Clock, HardDriveDownload, Zap,
} from "lucide-react";
import {
  getBackups, createBackup, restoreBackup, backupDownloadUrl, type BackupLog,
} from "@/api/owner";

export function BackupPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["owner-backups"], queryFn: getBackups, refetchInterval: 30_000 });
  const [restoreFor, setRestoreFor] = useState<BackupLog | null>(null);

  const createMut = useMutation({
    mutationFn: createBackup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owner-backups"] }),
  });

  const backups = data?.backups || [];
  const available = data?.available ?? false;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          <Database size={14} className="text-[#5b9dff]" /> Backup (zaxira nusxa)
        </div>
        <button onClick={() => createMut.mutate()} disabled={!available || createMut.isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0066ff] to-[#0090ff] px-3.5 py-2 text-xs font-bold text-white shadow-[0_4px_16px_-4px_rgba(0,102,255,0.6)] transition-all hover:-translate-y-0.5 disabled:opacity-50">
          {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Hoziroq backup
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
          <Clock size={12} className="text-[#5b9dff]" /> Har kuni 00:00 (Toshkent) avtomatik
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
          <HardDriveDownload size={12} className="text-[#5b9dff]" /> Oxirgi 14 ta saqlanadi
        </span>
      </div>

      {!available && (
        <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <b>Diqqat:</b> serverda <code>pg_dump</code> topilmadi. Backend Dockerfile'ga
          <code> postgresql-client</code> qo'shilib qayta deploy qilinishi kerak.
        </div>
      )}

      {createMut.isError && (
        <div className="mb-3 rounded-xl border border-[#dc2626]/30 bg-[#dc2626]/10 px-3 py-2 text-xs text-[#f87171]">
          Backup yaratishda xato. Server logini tekshiring.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>
      ) : backups.length === 0 ? (
        <div className="rounded-xl bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500">
          Hali backup yo'q. «Hoziroq backup» tugmasini bosing.
        </div>
      ) : (
        <div className="space-y-1.5">
          {backups.map((b) => <BackupRow key={b.id} b={b} onRestore={() => setRestoreFor(b)} />)}
        </div>
      )}

      {restoreFor && (
        <RestoreModal backup={restoreFor} onClose={() => setRestoreFor(null)}
          onDone={() => { setRestoreFor(null); qc.invalidateQueries({ queryKey: ["owner-backups"] }); }} />
      )}
    </div>
  );
}

function BackupRow({ b, onRestore }: { b: BackupLog; onRestore: () => void }) {
  const ok = b.status === "success";
  const running = b.status === "running";
  const when = new Date(b.created_at).toLocaleString("uz-UZ", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
      {running ? <Loader2 size={16} className="animate-spin text-amber-400" />
        : ok ? <CircleCheck size={16} className="text-[#4ade80]" />
        : <CircleX size={16} className="text-[#f87171]" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-300">{when}</span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${b.trigger === "auto" ? "bg-[#5b9dff]/15 text-[#5b9dff]" : "bg-white/[0.06] text-slate-400"}`}>
            {b.trigger === "auto" ? <><Clock size={9} /> avto</> : <><Zap size={9} /> qo'lda</>}
          </span>
        </div>
        {ok ? (
          <div className="text-xs text-slate-500">{b.size_mb} MB · {(b.duration_ms / 1000).toFixed(1)}s</div>
        ) : b.error ? (
          <div className="truncate text-xs text-[#f87171]">{b.error}</div>
        ) : null}
      </div>
      {ok && (
        <>
          <a href={backupDownloadUrl(b.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
            <DownloadCloud size={13} /> Yuklab olish
          </a>
          <button onClick={onRestore}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 px-2.5 py-1.5 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/15">
            <RotateCcw size={13} /> Qaytarish
          </button>
        </>
      )}
    </div>
  );
}

function RestoreModal({ backup, onClose, onDone }: {
  backup: BackupLog; onClose: () => void; onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const mut = useMutation({
    mutationFn: () => restoreBackup(backup.id, password),
    onSuccess: (r) => { if (r.ok) onDone(); },
  });
  const when = new Date(backup.created_at).toLocaleString("uz-UZ", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-amber-400/30 bg-[#0c1424] p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-amber-300">
            <ShieldAlert size={20} /> Backup'ni qaytarish
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="mb-4 rounded-xl border border-[#dc2626]/30 bg-[#dc2626]/10 p-3 text-xs text-[#f87171]">
          <b>XAVFLI AMAL!</b> Bu hozirgi barcha ma'lumotlarni o'chirib, <b>{when}</b> dagi
          holatga qaytaradi. Bu amalni <b>orqaga qaytarib bo'lmaydi</b>. Avval hozirgi holatni
          backup qilib oling.
        </div>

        <label className="mb-2 flex items-start gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-[#dc2626]" />
          <span>Men oqibatlarni tushunaman va shu backup'ga qaytarishni xohlayman</span>
        </label>

        <label className="mb-1.5 mt-3 block text-xs font-bold text-slate-400">Tasdiqlash uchun parolingizni kiriting</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Owner paroli" autoComplete="off"
          className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20" />

        {mut.isError && (
          <div className="mt-2 text-xs font-semibold text-[#f87171]">
            Xato: parol noto'g'ri yoki restore amalga oshmadi.
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={() => mut.mutate()} disabled={!confirmed || password.length < 1 || mut.isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#dc2626] to-[#ef4444] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {mut.isPending ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
            Qaytarish
          </button>
          <button onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/[0.05] px-4 text-slate-300 hover:text-white"><X size={18} /></button>
        </div>
      </div>
    </div>
  );
}
