import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt, Plus, Search, ArrowLeft, CircleCheck, Clock, AlertTriangle,
  Paperclip, Trash2, X, Loader2, FileText, Calendar, Wallet, Filter,
  Pencil, Coins,
} from "lucide-react";
import {
  getInvoices, createInvoice, setInvoicePaid, setInvoicePaidAmount, updateInvoice,
  deleteInvoice, invoiceDocUrl, ownerListMarkets, type Invoice, type InvoiceCreateInput,
} from "@/api/owner";

type StatusFilter = "all" | "paid" | "partial" | "pending" | "overdue";

const STATUS = {
  paid:    { label: "To'langan",    color: "#16a34a", icon: CircleCheck },
  partial: { label: "Qisman",       color: "#0ea5e9", icon: Coins },
  pending: { label: "Kutilmoqda",   color: "#eab308", icon: Clock },
  overdue: { label: "Muddati o'tgan", color: "#dc2626", icon: AlertTriangle },
} as const;

function fmtMoney(n: number, cur = "UZS") {
  return new Intl.NumberFormat("uz-UZ").format(n) + " " + cur;
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [marketFilter, setMarketFilter] = useState<number | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editInv, setEditInv] = useState<Invoice | null>(null);
  const [payInv, setPayInv] = useState<Invoice | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["owner-invoices"],
    queryFn: () => getInvoices(),
    refetchInterval: 60_000,
  });

  const invoices = data?.invoices || [];
  const stats = data?.stats;

  const markets = useMemo(() => {
    const m = new Map<number, string>();
    for (const i of invoices) if (i.market_name) m.set(i.market_id, i.market_name);
    return [...m.entries()];
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (marketFilter !== "all" && i.market_id !== marketFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!i.title.toLowerCase().includes(q) &&
            !(i.description || "").toLowerCase().includes(q) &&
            !(i.market_name || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, marketFilter, search]);

  return (
    <div className="min-h-screen bg-[#060b18] text-white">
      {/* glow fon */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-[#0066ff]/10 blur-[120px]" />
        <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[#a855f7]/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/owner")}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
                <Receipt size={24} className="text-[#5b9dff]" /> To'lovlar
              </h1>
              <p className="text-sm text-slate-500">Bozorlarga qo'shimcha to'lovlar (schyot)</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0066ff] to-[#0090ff] px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_-4px_rgba(0,102,255,0.6)] transition-all hover:-translate-y-0.5">
            <Plus size={16} /> Yangi to'lov
          </button>
        </div>

        {/* Stats kartalar */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Jami summa" value={fmtMoney(stats.total_amount)} accent="#5b9dff" icon={<Wallet size={16} />} count={stats.count} />
            <StatCard label="To'langan" value={fmtMoney(stats.paid_amount)} accent="#16a34a" icon={<CircleCheck size={16} />} count={stats.counts.paid} />
            <StatCard label="Kutilmoqda" value={fmtMoney(stats.pending_amount)} accent="#eab308" icon={<Clock size={16} />} count={stats.counts.pending} />
            <StatCard label="Muddati o'tgan" value={fmtMoney(stats.overdue_amount)} accent="#dc2626" icon={<AlertTriangle size={16} />} count={stats.counts.overdue} />
          </div>
        )}

        {/* Search + filtrlar */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Sarlavha, izoh yoki bozor bo'yicha qidirish..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#0066ff] focus:ring-4 focus:ring-[#0066ff]/15" />
          </div>
          {markets.length > 0 && (
            <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="rounded-xl border border-white/10 bg-[#0c1424] px-3 py-2.5 text-sm text-white outline-none focus:border-[#0066ff]">
              <option value="all">Barcha bozorlar</option>
              {markets.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
        </div>

        {/* Status filtr tablari */}
        <div className="mb-5 flex flex-wrap gap-2">
          {(["all", "pending", "partial", "overdue", "paid"] as StatusFilter[]).map((s) => {
            const active = statusFilter === s;
            const meta = s === "all" ? null : STATUS[s];
            const color = meta?.color || "#5b9dff";
            const TabIcon = meta?.icon || Filter;
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all"
                style={{
                  borderColor: active ? color : "rgba(255,255,255,0.1)",
                  background: active ? `${color}1a` : "transparent",
                  color: active ? color : "#94a3b8",
                }}>
                <TabIcon size={12} /> {meta ? meta.label : "Hammasi"}
              </button>
            );
          })}
        </div>

        {/* Ro'yxat */}
        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] py-16 text-center text-slate-500">
            <Receipt size={40} className="mx-auto mb-3 opacity-40" />
            {invoices.length === 0 ? "Hali to'lov qo'shilmagan. «Yangi to'lov» tugmasini bosing." : "Filtrga mos to'lov topilmadi."}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((inv) => (
              <InvoiceCard key={inv.id} inv={inv}
                onTogglePaid={() => setInvoicePaid(inv.id, !inv.is_paid).then(() => qc.invalidateQueries({ queryKey: ["owner-invoices"] }))}
                onPay={() => setPayInv(inv)}
                onEdit={() => setEditInv(inv)}
                onDelete={() => { if (confirm("Bu to'lovni o'chirishni tasdiqlaysizmi?")) deleteInvoice(inv.id).then(() => qc.invalidateQueries({ queryKey: ["owner-invoices"] })); }}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)}
        onDone={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["owner-invoices"] }); }} />}
      {editInv && <EditInvoiceModal inv={editInv} onClose={() => setEditInv(null)}
        onDone={() => { setEditInv(null); qc.invalidateQueries({ queryKey: ["owner-invoices"] }); }} />}
      {payInv && <PayAmountModal inv={payInv} onClose={() => setPayInv(null)}
        onDone={() => { setPayInv(null); qc.invalidateQueries({ queryKey: ["owner-invoices"] }); }} />}
    </div>
  );
}

function StatCard({ label, value, accent, icon, count }: {
  label: string; value: string; accent: string; icon: React.ReactNode; count: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl" style={{ background: accent }} />
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold" style={{ color: accent }}>
        <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${accent}22` }}>{icon}</span>
        {label}
      </div>
      <div className="font-display text-lg font-extrabold text-white">{value}</div>
      <div className="text-[11px] text-slate-500">{count} ta to'lov</div>
    </div>
  );
}

function InvoiceCard({ inv, onTogglePaid, onPay, onEdit, onDelete }: {
  inv: Invoice; onTogglePaid: () => void; onPay: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const meta = STATUS[inv.status];
  const Icon = meta.icon;
  const hasPartial = inv.paid_amount > 0 && !inv.is_paid;
  const pct = inv.amount > 0 ? Math.min(100, Math.round((inv.paid_amount / inv.amount) * 100)) : 0;
  return (
    <div className="rounded-2xl border bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.06]"
      style={{ borderColor: `${meta.color}33` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{ background: `${meta.color}22`, color: meta.color }}>
              <Icon size={11} /> {meta.label}
            </span>
            {inv.market_name && <span className="text-xs font-semibold text-[#5b9dff]">{inv.market_name}</span>}
          </div>
          <h3 className="mt-1.5 font-display text-lg font-bold text-white">{inv.title}</h3>
          {inv.description && <p className="mt-0.5 text-sm text-slate-400">{inv.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} /> Muddat: {fmtDate(inv.due_date)}
              {inv.status === "overdue" && inv.days_left != null && (
                <span className="font-bold text-[#f87171]"> ({Math.abs(inv.days_left)} kun o'tdi)</span>
              )}
              {(inv.status === "pending" || inv.status === "partial") && inv.days_left != null && inv.days_left >= 0 && (
                <span className="text-amber-400"> ({inv.days_left} kun qoldi)</span>
              )}
            </span>
            {inv.has_doc && (
              <a href={invoiceDocUrl(inv.id)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#5b9dff] hover:underline">
                <Paperclip size={12} /> {inv.doc_name || "Hujjat"}
              </a>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-xl font-extrabold text-white">{fmtMoney(inv.amount, inv.currency)}</div>
          {inv.is_paid && inv.paid_at && <div className="text-[11px] text-[#4ade80]">{fmtDate(inv.paid_at)} da to'landi</div>}
        </div>
      </div>

      {/* Qisman to'lov progress */}
      {hasPartial && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-[#38bdf8]">To'langan: {fmtMoney(inv.paid_amount, inv.currency)}</span>
            <span className="text-slate-400">Qoldi: <b className="text-white">{fmtMoney(inv.remaining, inv.currency)}</b></span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#38bdf8] transition-all"
              style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-0.5 text-right text-[10px] font-semibold text-[#38bdf8]">{pct}%</div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
        <button onClick={onPay}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0ea5e9]/15 px-3 py-1.5 text-xs font-semibold text-[#38bdf8] transition-colors hover:bg-[#0ea5e9]/25">
          <Coins size={13} /> To'lov kiritish
        </button>
        <button onClick={onTogglePaid}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{
            background: inv.is_paid ? "rgba(255,255,255,0.06)" : "#16a34a22",
            color: inv.is_paid ? "#94a3b8" : "#4ade80",
          }}>
          <CircleCheck size={13} /> {inv.is_paid ? "To'lanmagan deb belgilash" : "To'landi deb belgilash"}
        </button>
        <button onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
          <Pencil size={13} /> Tahrirlash
        </button>
        <button onClick={onDelete}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[#dc2626]/30 px-3 py-1.5 text-xs font-semibold text-[#f87171] transition-colors hover:bg-[#dc2626]/15">
          <Trash2 size={13} /> O'chirish
        </button>
      </div>
    </div>
  );
}

function CreateInvoiceModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState<InvoiceCreateInput>({
    market_id: 0, title: "", amount: 0, description: "", currency: "UZS", due_date: null,
  });
  const [docName, setDocName] = useState<string | null>(null);

  const { data: marketsData } = useQuery({ queryKey: ["owner-markets-mini"], queryFn: ownerListMarkets });
  const markets = marketsData || [];

  const mut = useMutation({
    mutationFn: () => createInvoice(form),
    onSuccess: onDone,
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert("Fayl 8 MB dan kichik bo'lsin"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",", 2)[1] : result;
      setForm((f) => ({ ...f, doc_data: base64, doc_name: file.name, doc_mime: file.type }));
      setDocName(file.name);
    };
    reader.readAsDataURL(file);
  }

  const valid = form.market_id > 0 && form.title.trim().length > 0 && form.amount > 0;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0c1424] p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-white">
            <Receipt size={20} className="text-[#5b9dff]" /> Yangi to'lov (schyot)
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <Field label="Bozor *">
            <select value={form.market_id} onChange={(e) => setForm({ ...form, market_id: Number(e.target.value) })}
              className="w-full rounded-xl border border-white/10 bg-[#0a1120] px-3 py-2.5 text-sm text-white outline-none focus:border-[#0066ff]">
              <option value={0}>— Bozorni tanlang —</option>
              {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>

          <Field label="Nima uchun (sarlavha) *">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Masalan: Reklama bannerи uchun to'lov"
              className="w-full rounded-xl border border-white/10 bg-[#0a1120] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#0066ff]" />
          </Field>

          <Field label="Batafsil izoh (ixtiyoriy)">
            <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2} placeholder="Qo'shimcha tafsilotlar..."
              className="w-full resize-none rounded-xl border border-white/10 bg-[#0a1120] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#0066ff]" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Summa *">
              <input type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                placeholder="0"
                className="w-full rounded-xl border border-white/10 bg-[#0a1120] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#0066ff]" />
            </Field>
            <Field label="Muddat (deadline)">
              <input type="date" value={form.due_date || ""} onChange={(e) => setForm({ ...form, due_date: e.target.value || null })}
                className="w-full rounded-xl border border-white/10 bg-[#0a1120] px-3 py-2.5 text-sm text-white outline-none focus:border-[#0066ff]" />
            </Field>
          </div>

          <Field label="Hujjat biriktirish (ixtiyoriy)">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 bg-[#0a1120] px-3 py-2.5 text-sm text-slate-400 hover:border-[#0066ff]">
              <FileText size={16} className="text-[#5b9dff]" />
              {docName || "PDF yoki rasm tanlang (maks 8 MB)"}
              <input type="file" accept=".pdf,image/*" onChange={onFile} className="hidden" />
            </label>
          </Field>

          {mut.isError && <div className="text-xs font-semibold text-[#f87171]">Xato: to'lovni saqlab bo'lmadi.</div>}

          <button onClick={() => mut.mutate()} disabled={!valid || mut.isPending}
            className="mt-1 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0066ff] to-[#0090ff] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
            {mut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            To'lovni qo'shish
          </button>
        </div>
      </div>
    </div>
  );
}

function PayAmountModal({ inv, onClose, onDone }: { inv: Invoice; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState<number>(inv.paid_amount || 0);
  const [note, setNote] = useState("");
  const mut = useMutation({
    mutationFn: () => setInvoicePaidAmount(inv.id, amount, note || undefined),
    onSuccess: onDone,
  });
  const remaining = Math.max(inv.amount - amount, 0);
  const willBePaid = amount >= inv.amount;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0c1424] p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-white">
            <Coins size={20} className="text-[#38bdf8]" /> To'lov kiritish
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <p className="mb-4 text-sm text-slate-400">{inv.title} — {inv.market_name}</p>

        <div className="mb-3 rounded-xl bg-white/[0.04] p-3 text-sm">
          <div className="flex justify-between py-0.5"><span className="text-slate-400">Jami summa</span><span className="font-bold text-white">{fmtMoney(inv.amount, inv.currency)}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-slate-400">Hozirgача to'langan</span><span className="text-[#38bdf8]">{fmtMoney(inv.paid_amount, inv.currency)}</span></div>
        </div>

        <Field label="Jami to'langan summa (qisman bo'lsa ham)">
          <input type="number" min={0} max={inv.amount} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-xl border border-white/10 bg-[#0a1120] px-3 py-2.5 text-sm text-white outline-none focus:border-[#0ea5e9]" />
        </Field>
        <div className="mt-1 flex gap-2">
          <button onClick={() => setAmount(inv.amount)}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10">To'liq summa</button>
          <button onClick={() => setAmount(0)}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10">Nol</button>
        </div>

        <div className="mt-3 rounded-xl p-3 text-sm" style={{ background: willBePaid ? "#16a34a14" : "#0ea5e914" }}>
          {willBePaid ? (
            <span className="font-semibold text-[#4ade80]">✓ To'liq to'langan deb belgilanadi (yashil)</span>
          ) : (
            <span className="text-slate-300">Qoladi: <b className="text-white">{fmtMoney(remaining, inv.currency)}</b> — "Qisman" holatida qoladi</span>
          )}
        </div>

        <div className="mt-3">
          <Field label="Izoh (ixtiyoriy)">
            <input value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0a1120] px-3 py-2.5 text-sm text-white outline-none focus:border-[#0ea5e9]" />
          </Field>
        </div>

        {mut.isError && <div className="mt-2 text-xs font-semibold text-[#f87171]">Xato: saqlab bo'lmadi.</div>}

        <button onClick={() => mut.mutate()} disabled={mut.isPending}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0ea5e9] to-[#38bdf8] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
          {mut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Coins size={16} />}
          Saqlash
        </button>
      </div>
    </div>
  );
}

function EditInvoiceModal({ inv, onClose, onDone }: { inv: Invoice; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(inv.title);
  const [description, setDescription] = useState(inv.description || "");
  const [amount, setAmount] = useState(inv.amount);
  const [dueDate, setDueDate] = useState(inv.due_date || "");
  const [docName, setDocName] = useState<string | null>(null);
  const [docPayload, setDocPayload] = useState<{ doc_data: string; doc_name: string; doc_mime: string } | null>(null);

  const mut = useMutation({
    mutationFn: () => updateInvoice(inv.id, {
      title: title.trim(), description, amount, due_date: dueDate || null,
      ...(docPayload || {}),
    }),
    onSuccess: onDone,
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert("Fayl 8 MB dan kichik bo'lsin"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",", 2)[1] : result;
      setDocPayload({ doc_data: base64, doc_name: file.name, doc_mime: file.type });
      setDocName(file.name);
    };
    reader.readAsDataURL(file);
  }

  const valid = title.trim().length > 0 && amount > 0;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0c1424] p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-white">
            <Pencil size={18} className="text-[#5b9dff]" /> To'lovni tahrirlash
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <Field label="Nima uchun (sarlavha) *">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0a1120] px-3 py-2.5 text-sm text-white outline-none focus:border-[#0066ff]" />
          </Field>
          <Field label="Batafsil izoh">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full resize-none rounded-xl border border-white/10 bg-[#0a1120] px-3 py-2.5 text-sm text-white outline-none focus:border-[#0066ff]" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Summa *">
              <input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-[#0a1120] px-3 py-2.5 text-sm text-white outline-none focus:border-[#0066ff]" />
            </Field>
            <Field label="Muddat (deadline)">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0a1120] px-3 py-2.5 text-sm text-white outline-none focus:border-[#0066ff]" />
            </Field>
          </div>
          <Field label="Hujjatni almashtirish (ixtiyoriy)">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 bg-[#0a1120] px-3 py-2.5 text-sm text-slate-400 hover:border-[#0066ff]">
              <FileText size={16} className="text-[#5b9dff]" />
              {docName || (inv.has_doc ? `Joriy: ${inv.doc_name || "hujjat"} (almashtirish)` : "PDF yoki rasm tanlang")}
              <input type="file" accept=".pdf,image/*" onChange={onFile} className="hidden" />
            </label>
          </Field>

          {mut.isError && <div className="text-xs font-semibold text-[#f87171]">Xato: saqlab bo'lmadi.</div>}

          <button onClick={() => mut.mutate()} disabled={!valid || mut.isPending}
            className="mt-1 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0066ff] to-[#0090ff] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
            {mut.isPending ? <Loader2 size={16} className="animate-spin" /> : <CircleCheck size={16} />}
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-slate-400">{label}</label>
      {children}
    </div>
  );
}
