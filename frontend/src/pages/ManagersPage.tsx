import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, UserPlus, Loader2, KeyRound, Ban, CheckCircle2,
  Trash2, MapPin, X, Search, Copy, Check, Clock, Eye, Layers,
} from "lucide-react";
import { useT } from "@/i18n/useT";
import {
  listManagers, createManager, changeManagerPassword, toggleManagerBlock,
  deleteManager, getManagerPavilions, assignManagerPavilions,
  getManagerCredentials, getPavilionsWithManagers,
  type Manager, type ManagerPavilionMini,
} from "@/api/managers";

type Tab = "managers" | "pavilions";

export function ManagersPage() {
  const t = useT();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("managers");
  const [showCreate, setShowCreate] = useState(false);
  const [pavilionsFor, setPavilionsFor] = useState<Manager | null>(null);
  const [pwdFor, setPwdFor] = useState<Manager | null>(null);
  const [credFor, setCredFor] = useState<Manager | null>(null);
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
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className="btn-ghost px-3.5 py-2">
            <ArrowLeft size={16} /> {t("common.back")}
          </Link>
          {tab === "managers" && (
            <button className="btn-primary px-4 py-2" onClick={() => setShowCreate(true)}>
              <UserPlus size={16} /> Yangi manager
            </button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
        <button
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === "managers" ? "bg-white text-ink shadow-sm" : "text-ink-faint hover:text-ink"}`}
          onClick={() => setTab("managers")}
        >
          <UserPlus size={14} className="mr-1 inline" /> Managerlar
        </button>
        <button
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === "pavilions" ? "bg-white text-ink shadow-sm" : "text-ink-faint hover:text-ink"}`}
          onClick={() => setTab("pavilions")}
        >
          <Layers size={14} className="mr-1 inline" /> Pavilion bo'yicha
        </button>
      </div>

      {/* === TAB: MANAGERLAR === */}
      {tab === "managers" && (
        <>
          {isLoading && (
            <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-brand" /></div>
          )}
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
                    <span className="rounded-full bg-status-unpaid/10 px-2.5 py-1 text-[10px] font-bold uppercase text-status-unpaid">
                      Bloklangan
                    </span>
                  )}
                </div>

                {/* So'nggi kirish vaqti */}
                <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
                  <Clock size={12} />
                  {m.last_login_at
                    ? <>So'nggi kirish: <span className="font-semibold text-ink-soft">{new Date(m.last_login_at).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></>
                    : "Hali kirmagan"}
                </div>

                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-soft">
                  <MapPin size={12} className="text-brand" />
                  <span className="font-semibold">{m.pavilion_count}</span> ta pavilion biriktirilgan
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setPavilionsFor(m)}>
                    <MapPin size={12} /> Pavilionlar
                  </button>
                  <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setCredFor(m)}>
                    <Eye size={12} /> Login ko'rish
                  </button>
                  <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setPwdFor(m)}>
                    <KeyRound size={12} /> Parol
                  </button>
                  <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => blockMut.mutate(m.id)} disabled={blockMut.isPending}>
                    {m.is_active ? <><Ban size={12} /> Bloklash</> : <><CheckCircle2 size={12} /> Yoqish</>}
                  </button>
                  <button
                    className="btn-ghost px-2.5 py-1.5 text-xs text-status-unpaid"
                    onClick={() => { if (confirm(`"${m.full_name ?? m.username}" managerini o'chirasizmi?`)) deleteMut.mutate(m.id); }}
                  >
                    <Trash2 size={12} /> O'chirish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* === TAB: PAVILION BO'YICHA === */}
      {tab === "pavilions" && <PavilionsByManagerTab />}

      {/* Modals */}
      {showCreate && (
        <CreateManagerModal
          onClose={() => setShowCreate(false)}
          onCreated={(res) => { setCreated(res); setShowCreate(false); qc.invalidateQueries({ queryKey: ["managers"] }); }}
        />
      )}
      {created && <CredentialsModal cred={created} onClose={() => setCreated(null)} />}
      {credFor && <ViewCredentialsModal manager={credFor} onClose={() => setCredFor(null)} />}
      {pavilionsFor && <PavilionAssignModal manager={pavilionsFor} onClose={() => setPavilionsFor(null)} />}
      {pwdFor && <PasswordModal manager={pwdFor} onClose={() => setPwdFor(null)} />}
    </div>
  );
}

/* ===== PAVILION BO'YICHA TAB ===== */
function PavilionsByManagerTab() {
  const [search, setSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState<number | null | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["pavilions-with-managers"],
    queryFn: getPavilionsWithManagers,
  });

  const layers = data
    ? Array.from(new Map(data.filter(p => p.map_layer_id).map(p => [p.map_layer_id, p.map_layer_name])).entries())
    : [];

  const filtered = (data ?? []).filter((p) => {
    const matchLayer = layerFilter === "all" || p.map_layer_id === layerFilter;
    const matchSearch = !search || p.pavilion_name.toLowerCase().includes(search.toLowerCase());
    return matchLayer && matchSearch;
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className="input w-full pl-8 text-sm" placeholder="Pavilion qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input text-sm" value={layerFilter === "all" ? "all" : layerFilter === null ? "null" : String(layerFilter)} onChange={(e) => {
          const v = e.target.value;
          setLayerFilter(v === "all" ? "all" : v === "null" ? null : Number(v));
        }}>
          <option value="all">Barcha qavatlar</option>
          {layers.map(([id, name]) => (
            <option key={String(id)} value={String(id)}>{name ?? `Layer ${id}`}</option>
          ))}
          <option value="null">Qavatsiz</option>
        </select>
      </div>

      {isLoading && <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-brand" /></div>}

      <div className="space-y-2">
        {filtered.map((p) => (
          <div key={p.pavilion_id} className="card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">{p.pavilion_name}</span>
                {p.map_layer_name && (
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">{p.map_layer_name}</span>
                )}
              </div>
              <span className="text-xs text-ink-faint">
                {p.managers.length > 0 ? `${p.managers.length} ta manager` : "Biriktirilmagan"}
              </span>
            </div>
            {p.managers.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.managers.map((m) => (
                  <span key={m.id} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${m.is_active ? "bg-status-paid/10 text-status-paid" : "bg-slate-100 text-slate-400"}`}>
                    {!m.is_active && <Ban size={10} />}
                    {m.full_name ?? m.username}
                    <span className="font-normal opacity-60">({m.username})</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-1 text-xs text-ink-faint">Manager biriktirilmagan</div>
            )}
          </div>
        ))}
        {filtered.length === 0 && !isLoading && (
          <div className="py-8 text-center text-sm text-ink-faint">Pavilion topilmadi</div>
        )}
      </div>
    </div>
  );
}

/* ===== LOGIN KO'RISH MODAL ===== */
function ViewCredentialsModal({ manager, onClose }: { manager: Manager; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["manager-cred", manager.id],
    queryFn: () => getManagerCredentials(manager.id),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink">Login ma'lumotlari</h3>
          <button onClick={onClose}><X size={18} className="text-ink-faint" /></button>
        </div>
        {isLoading && <div className="py-4 text-center"><Loader2 size={20} className="animate-spin text-brand" /></div>}
        {data && (
          <>
            <div className="space-y-2 rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-faint">Ism</span>
                <span className="font-semibold text-ink">{data.full_name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-faint">Login</span>
                <span className="font-mono text-sm font-bold text-ink">{data.username}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-faint">Holati</span>
                <span className={`text-xs font-bold ${data.is_active ? "text-status-paid" : "text-status-unpaid"}`}>
                  {data.is_active ? "Faol" : "Bloklangan"}
                </span>
              </div>
              {data.last_login_at && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-faint">So'nggi kirish</span>
                  <span className="text-xs font-semibold text-ink-soft">
                    {new Date(data.last_login_at).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}
            </div>
            <button
              className="btn-ghost mt-3 w-full py-2 text-sm"
              onClick={() => {
                navigator.clipboard.writeText(`Login: ${data.username}`);
                setCopied(true); setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Nusxalandi" : "Loginni nusxalash"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ===== YANGI MANAGER YARATISH ===== */
function CreateManagerModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (res: { username: string; password: string }) => void;
}) {
  const [name, setName] = useState("");
  const mut = useMutation({
    mutationFn: () => createManager(name.trim()),
    onSuccess: (r) => onCreated({ username: r.username, password: r.password }),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">Yangi manager</h3>
          <button onClick={onClose}><X size={18} className="text-ink-faint" /></button>
        </div>
        <label className="mb-1 block text-xs font-bold text-ink-faint">Ism familiya</label>
        <input className="input w-full" placeholder="Masalan: Aziz Aliyev" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <button className="btn-primary mt-4 w-full py-2.5 disabled:opacity-50" disabled={!name.trim() || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? <Loader2 size={16} className="animate-spin" /> : "Yaratish"}
        </button>
      </div>
    </div>
  );
}

/* ===== CREDENTIALS MODAL (yaratilgandan keyin) ===== */
function CredentialsModal({ cred, onClose }: { cred: { username: string; password: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 size={20} className="text-status-paid" />
          <h3 className="font-display text-lg font-bold text-ink">Manager yaratildi</h3>
        </div>
        <p className="mb-3 text-xs text-ink-faint">Login va parolni planshetga yozib bering — parol qayta ko'rsatilmaydi.</p>
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-faint">Login</span>
            <span className="font-mono text-sm font-bold text-ink">{cred.username}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-faint">Parol</span>
            <span className="font-mono text-sm font-bold text-ink">{cred.password}</span>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => {
            navigator.clipboard.writeText(`Login: ${cred.username}\nParol: ${cred.password}`);
            setCopied(true); setTimeout(() => setCopied(false), 2000);
          }}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Nusxalandi" : "Nusxalash"}
          </button>
          <button className="btn-primary flex-1 py-2 text-sm" onClick={onClose}>Yopish</button>
        </div>
      </div>
    </div>
  );
}

/* ===== PAROL O'ZGARTIRISH ===== */
function PasswordModal({ manager, onClose }: { manager: Manager; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const mut = useMutation({ mutationFn: () => changeManagerPassword(manager.id, pwd), onSuccess: onClose });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink">Parolni o'zgartirish</h3>
          <button onClick={onClose}><X size={18} className="text-ink-faint" /></button>
        </div>
        <div className="mb-2 text-xs text-ink-faint">Manager: {manager.full_name ?? manager.username}</div>
        <input type="text" className="input w-full font-mono" placeholder="Yangi parol (kamida 6 belgi)" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus />
        <button className="btn-primary mt-3 w-full py-2.5 disabled:opacity-50" disabled={pwd.length < 6 || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? <Loader2 size={16} className="animate-spin" /> : "Saqlash"}
        </button>
      </div>
    </div>
  );
}

/* ===== PAVILION BIRIKTIRISH ===== */
function PavilionAssignModal({ manager, onClose }: { manager: Manager; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState<number | null | "all">("all");
  const [selected, setSelected] = useState<Set<number> | null>(null);

  const { data: pavilions, isLoading } = useQuery({
    queryKey: ["manager-pavilions", manager.id],
    queryFn: () => getManagerPavilions(manager.id),
  });

  if (pavilions && selected === null) {
    setSelected(new Set(pavilions.filter((p) => p.assigned).map((p) => p.id)));
  }

  const layers = pavilions
    ? Array.from(new Map(pavilions.filter(p => p.map_layer_id).map(p => [p.map_layer_id, p.map_layer_name])).entries())
    : [];

  const filtered = (pavilions ?? []).filter((p) => {
    const matchLayer = layerFilter === "all" || p.map_layer_id === layerFilter;
    const matchSearch = !search || p.display_name.toLowerCase().includes(search.toLowerCase());
    return matchLayer && matchSearch;
  });

  const saveMut = useMutation({
    mutationFn: () => assignManagerPavilions(manager.id, Array.from(selected ?? [])),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["managers"] }); qc.invalidateQueries({ queryKey: ["pavilions-with-managers"] }); onClose(); },
  });

  function toggle(p: ManagerPavilionMini) {
    setSelected((prev) => { const next = new Set(prev ?? []); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next; });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card flex max-h-[88vh] w-full max-w-2xl flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">«{manager.full_name ?? manager.username}» — pavilionlar</h3>
            <p className="text-xs text-ink-faint">{selected?.size ?? 0} ta tanlangan</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-ink-faint" /></button>
        </div>

        {/* Filtrlar */}
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input className="input w-full pl-8 text-sm" placeholder="Qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input text-sm" value={layerFilter === "all" ? "all" : layerFilter === null ? "null" : String(layerFilter)}
            onChange={(e) => { const v = e.target.value; setLayerFilter(v === "all" ? "all" : v === "null" ? null : Number(v)); }}>
            <option value="all">Barchasi</option>
            {layers.map(([id, name]) => <option key={String(id)} value={String(id)}>{name ?? `Layer ${id}`}</option>)}
            <option value="null">Qavatsiz</option>
          </select>
        </div>

        {isLoading && <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-brand" /></div>}

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filtered.map((p) => {
              const isSel = selected?.has(p.id) ?? false;
              return (
                <button key={p.id} onClick={() => toggle(p)}
                  className={`flex flex-col items-start rounded-xl border-2 px-3 py-2.5 text-left text-sm transition-colors ${isSel ? "border-brand bg-brand/10" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <div className="flex w-full items-center gap-2">
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${isSel ? "border-brand bg-brand" : "border-slate-300"}`}>
                      {isSel && <Check size={11} className="text-white" />}
                    </div>
                    <span className={`truncate font-semibold ${isSel ? "text-brand" : "text-ink-soft"}`}>{p.display_name}</span>
                  </div>
                  {p.map_layer_name && (
                    <span className="mt-1 ml-6 text-[10px] text-ink-faint">{p.map_layer_name}</span>
                  )}
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && !isLoading && <div className="py-8 text-center text-sm text-ink-faint">Pavilion topilmadi</div>}
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
