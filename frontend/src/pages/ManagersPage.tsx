import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, UserPlus, Loader2, KeyRound, Ban, CheckCircle2,
  Trash2, MapPin, X, Search, Copy, Check,
} from "lucide-react";
import { useT } from "@/i18n/useT";
import {
  listManagers, createManager, changeManagerPassword, toggleManagerBlock,
  deleteManager, getManagerPavilions, assignManagerPavilions,
  type Manager, type ManagerPavilionMini,
} from "@/api/managers";

export function ManagersPage() {
  const t = useT();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [pavilionsFor, setPavilionsFor] = useState<Manager | null>(null);
  const [pwdFor, setPwdFor] = useState<Manager | null>(null);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);

  const { data: managers, isLoading } = useQuery({
    queryKey: ["managers"],
    queryFn: listManagers,
  });

  const blockMut = useMutation({
    mutationFn: (id: number) => toggleManagerBlock(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["managers"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteManager(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["managers"] }),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="eyebrow">Bozor boshqaruvi</div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Managerlar</h1>
          <p className="mt-1 text-sm text-ink-faint">To'lov tekshiruvchilar — har biriga pavilion/bloklar biriktiriladi</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className="btn-ghost px-3.5 py-2"><ArrowLeft size={16} /> {t("common.back")}</Link>
          <button className="btn-primary px-4 py-2" onClick={() => setShowCreate(true)}>
            <UserPlus size={16} /> Yangi manager
          </button>
        </div>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-brand" /></div>}

      {managers && managers.length === 0 && (
        <div className="card p-10 text-center">
          <UserPlus size={32} className="mx-auto mb-3 text-ink-faint" />
          <p className="text-sm text-ink-faint">Hali manager yaratilmagan</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {managers?.map((m) => (
          <div key={m.id} className={`card p-4 ${!m.is_active ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold text-ink">{m.full_name ?? m.username}</div>
                <div className="font-mono text-xs text-ink-faint">{m.username}</div>
              </div>
              {!m.is_active && (
                <span className="rounded-full bg-status-unpaid/10 px-2.5 py-1 text-[10px] font-bold uppercase text-status-unpaid">Bloklangan</span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
              <MapPin size={13} className="text-brand" />
              <span className="font-semibold">{m.pavilion_count}</span> ta pavilion biriktirilgan
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setPavilionsFor(m)}>
                <MapPin size={12} /> Pavilionlar
              </button>
              <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setPwdFor(m)}>
                <KeyRound size={12} /> Parol
              </button>
              <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => blockMut.mutate(m.id)} disabled={blockMut.isPending}>
                {m.is_active ? <><Ban size={12} /> Bloklash</> : <><CheckCircle2 size={12} /> Yoqish</>}
              </button>
              <button className="btn-ghost px-2.5 py-1.5 text-xs text-status-unpaid"
                onClick={() => { if (confirm(`"${m.full_name ?? m.username}" o'chirasizmi?`)) deleteMut.mutate(m.id); }}>
                <Trash2 size={12} /> O'chirish
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && <CreateManagerModal onClose={() => setShowCreate(false)} onCreated={(r) => { setCreated(r); setShowCreate(false); qc.invalidateQueries({ queryKey: ["managers"] }); }} />}
      {created && <CredentialsModal cred={created} onClose={() => setCreated(null)} />}
      {pavilionsFor && <PavilionAssignModal manager={pavilionsFor} onClose={() => setPavilionsFor(null)} />}
      {pwdFor && <PasswordModal manager={pwdFor} onClose={() => setPwdFor(null)} />}
    </div>
  );
}

function CreateManagerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: { username: string; password: string }) => void }) {
  const [name, setName] = useState("");
  const mut = useMutation({ mutationFn: () => createManager(name.trim()), onSuccess: (r) => onCreated({ username: r.username, password: r.password }) });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">Yangi manager</h3>
          <button onClick={onClose}><X size={18} className="text-ink-faint" /></button>
        </div>
        <input className="input w-full" placeholder="Ism familiya" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <button className="btn-primary mt-4 w-full py-2.5 disabled:opacity-50" disabled={!name.trim() || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? <Loader2 size={16} className="animate-spin" /> : "Yaratish"}
        </button>
      </div>
    </div>
  );
}

function CredentialsModal({ cred, onClose }: { cred: { username: string; password: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-3 flex items-center gap-2"><CheckCircle2 size={20} className="text-status-paid" /><h3 className="font-display text-lg font-bold text-ink">Manager yaratildi</h3></div>
        <p className="mb-3 text-xs text-ink-faint">Login va parolni yozib bering — qayta ko'rsatilmaydi.</p>
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center justify-between"><span className="text-xs text-ink-faint">Login</span><span className="font-mono text-sm font-bold text-ink">{cred.username}</span></div>
          <div className="flex items-center justify-between"><span className="text-xs text-ink-faint">Parol</span><span className="font-mono text-sm font-bold text-ink">{cred.password}</span></div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => { navigator.clipboard.writeText(`Login: ${cred.username}\nParol: ${cred.password}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Nusxalandi" : "Nusxalash"}
          </button>
          <button className="btn-primary flex-1 py-2 text-sm" onClick={onClose}>Yopish</button>
        </div>
      </div>
    </div>
  );
}

function PasswordModal({ manager, onClose }: { manager: Manager; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const mut = useMutation({ mutationFn: () => changeManagerPassword(manager.id, pwd), onSuccess: onClose });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink">«{manager.full_name ?? manager.username}» paroli</h3>
          <button onClick={onClose}><X size={18} className="text-ink-faint" /></button>
        </div>
        <input type="text" className="input w-full font-mono" placeholder="Yangi parol (kamida 6 belgi)" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus />
        <button className="btn-primary mt-3 w-full py-2.5 disabled:opacity-50" disabled={pwd.length < 6 || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? <Loader2 size={16} className="animate-spin" /> : "Saqlash"}
        </button>
      </div>
    </div>
  );
}

function PavilionAssignModal({ manager, onClose }: { manager: Manager; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number> | null>(null);

  const { data: pavilions, isLoading } = useQuery({
    queryKey: ["manager-pavilions", manager.id],
    queryFn: () => getManagerPavilions(manager.id),
  });

  if (pavilions && selected === null) {
    setSelected(new Set(pavilions.filter((p) => p.assigned).map((p) => p.id)));
  }

  const saveMut = useMutation({
    mutationFn: () => assignManagerPavilions(manager.id, Array.from(selected ?? [])),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["managers"] }); onClose(); },
  });

  const filtered = (pavilions ?? []).filter((p) => p.display_name.toLowerCase().includes(search.toLowerCase()));

  function toggle(p: ManagerPavilionMini) {
    setSelected((prev) => { const next = new Set(prev ?? []); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next; });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card flex max-h-[85vh] w-full max-w-2xl flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">«{manager.full_name ?? manager.username}» — pavilionlar</h3>
            <p className="text-xs text-ink-faint">{selected?.size ?? 0} ta tanlangan</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-ink-faint" /></button>
        </div>
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className="input w-full pl-9" placeholder="Pavilion qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isLoading && <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-brand" /></div>}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filtered.map((p) => {
              const isSel = selected?.has(p.id) ?? false;
              return (
                <button key={p.id} onClick={() => toggle(p)}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm transition-colors ${isSel ? "border-brand bg-brand/10 text-brand" : "border-slate-200 bg-white text-ink-soft hover:border-slate-300"}`}>
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${isSel ? "border-brand bg-brand" : "border-slate-300"}`}>
                    {isSel && <Check size={11} className="text-white" />}
                  </div>
                  <span className="truncate font-semibold">{p.display_name}</span>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && !isLoading && <div className="py-8 text-center text-sm text-ink-faint">Topilmadi</div>}
        </div>
        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
          <button className="btn-ghost flex-1 py-2.5" onClick={onClose}>Bekor qilish</button>
          <button className="btn-primary flex-1 py-2.5 disabled:opacity-50" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? <Loader2 size={16} className="animate-spin" /> : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
