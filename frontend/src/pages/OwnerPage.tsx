import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Store, Plus, Trash2, KeyRound, Power, PowerOff, Check, X, Copy,
  AlertTriangle, CalendarClock, LogOut, CreditCard,
} from "lucide-react";
import {
  ownerListMarkets, ownerCreateMarket, ownerDeleteMarket, ownerChangePassword,
  ownerMarkPayment, ownerBlockMarket, type OwnerMarket, type NewMarketResult,
} from "@/api/owner";
import { useAuthStore } from "@/store/authStore";
import { fmtUZS } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];

export function OwnerPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { data: markets, isLoading } = useQuery({ queryKey: ["owner-markets"], queryFn: ownerListMarkets });

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [created, setCreated] = useState<NewMarketResult | null>(null);
  const [pwdFor, setPwdFor] = useState<OwnerMarket | null>(null);
  const [newPwd, setNewPwd] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["owner-markets"] });

  const createMut = useMutation({
    mutationFn: () => ownerCreateMarket(newName.trim()),
    onSuccess: (r) => { setCreated(r); setNewName(""); setShowCreate(false); invalidate(); },
  });
  const delMut = useMutation({
    mutationFn: (id: number) => ownerDeleteMarket(id),
    onSuccess: invalidate,
  });
  const blockMut = useMutation({
    mutationFn: ({ id, b }: { id: number; b: boolean }) => ownerBlockMarket(id, b),
    onSuccess: invalidate,
  });
  const payMut = useMutation({
    mutationFn: ({ id, y, m, paid }: { id: number; y: number; m: number; paid: boolean }) =>
      ownerMarkPayment(id, y, m, paid),
    onSuccess: invalidate,
  });
  const pwdMut = useMutation({
    mutationFn: ({ id, p }: { id: number; p: string }) => ownerChangePassword(id, p),
    onSuccess: () => { setPwdFor(null); setNewPwd(""); },
  });

  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="eyebrow">Dastur egasi</div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Bozorlar boshqaruvi</h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button className="btn-primary px-3.5 py-2" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Yangi bozor
          </button>
          <button className="btn-ghost px-3 py-2" onClick={() => logout()} title="Chiqish">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Yangi bozor yaratish formasi */}
      {showCreate && (
        <div className="card mb-4 flex items-end gap-3 p-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-bold text-ink-soft">Bozor nomi</label>
            <input className="input" placeholder="Masalan: Chorsu bozori" value={newName}
              onChange={(e) => setNewName(e.target.value)} autoFocus />
          </div>
          <button className="btn-primary" onClick={() => createMut.mutate()} disabled={!newName.trim() || createMut.isPending}>
            <Check size={16} /> Yaratish
          </button>
          <button className="btn-ghost" onClick={() => setShowCreate(false)}><X size={16} /></button>
        </div>
      )}

      {/* Yaratilgan bozor login/parol */}
      {created && (
        <div className="card mb-4 border-2 border-status-paid/40 bg-status-paid/5 p-4">
          <div className="mb-2 flex items-center gap-2 font-bold text-status-paid">
            <Check size={18} /> «{created.name}» yaratildi
          </div>
          <p className="mb-2 text-sm text-ink-soft">
            Login va parolni saqlab oling — parol qayta ko'rsatilmaydi:
          </p>
          <div className="flex flex-wrap gap-2">
            <CredBox label="Login" value={created.credentials.username} />
            <CredBox label="Parol" value={created.credentials.password} />
          </div>
          <button className="btn-ghost mt-3 px-3 py-1.5 text-xs" onClick={() => setCreated(null)}>
            <X size={14} /> Yopish
          </button>
        </div>
      )}

      {isLoading && <div className="text-sm text-ink-faint">Yuklanmoqda...</div>}

      <div className="space-y-3">
        {markets?.map((m) => (
          <MarketRow
            key={m.id} m={m} curY={curY} curM={curM}
            onView={() => navigate(`/?market=${m.slug}`)}
            onPay={(paid) => payMut.mutate({ id: m.id, y: curY, m: curM, paid })}
            onBlock={(b) => blockMut.mutate({ id: m.id, b })}
            onPwd={() => setPwdFor(m)}
            onDelete={() => { if (confirm(`«${m.name}» o'chirilsinmi?`)) delMut.mutate(m.id); }}
          />
        ))}
      </div>

      {/* Parol o'zgartirish modali */}
      {pwdFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-md" onClick={() => setPwdFor(null)}>
          <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 font-bold text-ink">«{pwdFor.name}» parolini o'zgartirish</div>
            <div className="mb-1 text-xs text-ink-faint">Login: {pwdFor.admin_username ?? "—"}</div>
            <input className="input mb-3" type="text" placeholder="Yangi parol (kamida 6 belgi)"
              value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={newPwd.length < 6 || pwdMut.isPending}
                onClick={() => pwdMut.mutate({ id: pwdFor.id, p: newPwd })}>
                <KeyRound size={15} /> Saqlash
              </button>
              <button className="btn-ghost" onClick={() => setPwdFor(null)}><X size={16} /></button>
            </div>
            {pwdMut.isSuccess && <div className="mt-2 text-xs font-semibold text-status-paid">✓ Parol o'zgartirildi</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function MarketRow({
  m, curY: _curY, curM, onView, onPay, onBlock, onPwd, onDelete,
}: {
  m: OwnerMarket; curY: number; curM: number;
  onView: () => void; onPay: (paid: boolean) => void; onBlock: (b: boolean) => void;
  onPwd: () => void; onDelete: () => void;
}) {
  const s = m.support;
  return (
    <div className={`card p-4 ${m.support_blocked ? "border-2 border-status-unpaid/40" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand"><Store size={20} /></div>
        <div className="min-w-[160px] flex-1">
          <div className="flex items-center gap-2 font-bold text-ink">
            {m.name}
            {m.support_blocked && (
              <span className="rounded-full bg-status-unpaid/10 px-2 py-0.5 text-[10px] font-bold uppercase text-status-unpaid">Bloklangan</span>
            )}
          </div>
          <div className="font-mono text-xs text-ink-faint">/{m.slug} · {m.shop_count} magazin · login: {m.admin_username ?? "—"}</div>
        </div>

        {/* To'lov holati badge */}
        <div>
          {s.free_period ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
              <CalendarClock size={13} /> Tekin ({s.free_until} gacha)
            </span>
          ) : s.paid_this_month ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-paid/10 px-3 py-1 text-xs font-bold text-status-paid">
              <Check size={13} /> {MONTHS[curM - 1]} to'langan
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-unpaid/10 px-3 py-1 text-xs font-bold text-status-unpaid">
              <AlertTriangle size={13} /> {MONTHS[curM - 1]} to'lanmagan
            </span>
          )}
        </div>
      </div>

      {/* Amallar */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={onView}>Ko'rish</button>

        {!s.free_period && (
          s.paid_this_month ? (
            <button className="btn-ghost px-3 py-1.5 text-xs text-status-unpaid" onClick={() => onPay(false)}>
              To'lovni bekor qilish
            </button>
          ) : (
            <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => onPay(true)}>
              <CreditCard size={14} /> {MONTHS[curM - 1]} to'landi ({fmtUZS(s.monthly_fee)})
            </button>
          )
        )}

        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={onPwd}>
          <KeyRound size={14} /> Parol
        </button>
        <button
          className={`btn-ghost px-3 py-1.5 text-xs ${m.support_blocked ? "text-status-paid" : "text-status-unpaid"}`}
          onClick={() => onBlock(!m.support_blocked)}
        >
          {m.support_blocked ? <><Power size={14} /> Blokdan chiqarish</> : <><PowerOff size={14} /> Bloklash</>}
        </button>
        <button className="btn-ghost px-3 py-1.5 text-xs text-status-unpaid" onClick={onDelete}>
          <Trash2 size={14} /> O'chirish
        </button>
      </div>

      {/* Ogohlantirish */}
      {s.needs_warning && !m.support_blocked && (
        <div className="mt-2 rounded-lg bg-status-unpaid/10 px-3 py-2 text-xs font-semibold text-status-unpaid">
          Diqqat: bu bozor {s.due_day}-sanadan o'tdi, to'lov belgilanmagan.
        </div>
      )}
    </div>
  );
}

function CredBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
      <span className="text-xs font-bold text-ink-faint">{label}:</span>
      <span className="font-mono text-sm font-bold text-ink">{value}</span>
      <button onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="text-ink-faint hover:text-brand">
        {copied ? <Check size={14} className="text-status-paid" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
