import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Store, Eye, Power, PowerOff, Pencil, Check, X, ExternalLink,
} from "lucide-react";
import { getMarkets, updateMarket, toggleMarket, type Market } from "@/api/markets";
import { useT } from "@/i18n/useT";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export function SuperAdminPage() {
  const qc = useQueryClient();
  const t = useT();
  const navigate = useNavigate();
  const { data: markets, isLoading } = useQuery({ queryKey: ["markets"], queryFn: getMarkets });

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editOrder, setEditOrder] = useState(0);

  const saveMut = useMutation({
    mutationFn: (m: Market) => updateMarket(m.id, { name: editName, display_order: editOrder }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["markets"] }); setEditId(null); },
  });
  const toggleMut = useMutation({
    mutationFn: (id: number) => toggleMarket(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["markets"] }),
  });

  function startEdit(m: Market) {
    setEditId(m.id);
    setEditName(m.name);
    setEditOrder(m.display_order);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="eyebrow">{t("superadmin.title")}</div>
          <h1 className="font-display text-2xl font-extrabold text-ink">{t("superadmin.markets")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link to="/super" className="btn-ghost px-3.5 py-2">
            <ArrowLeft size={16} /> {t("superadmin.toDashboard")}
          </Link>
        </div>
      </div>

      {isLoading && <div className="text-sm text-ink-faint">{t("common.loading")}</div>}

      <div className="space-y-2.5">
        {markets?.map((m) => {
          const editing = editId === m.id;
          return (
            <div key={m.id} className={`card flex flex-wrap items-center gap-3 p-4 ${!m.is_active ? "opacity-60" : ""}`}>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                <Store size={20} />
              </div>

              <div className="min-w-[180px] flex-1">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input
                      className="input py-1.5"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <input
                      type="number"
                      className="input w-20 py-1.5 text-center"
                      value={editOrder}
                      onChange={(e) => setEditOrder(Number(e.target.value) || 0)}
                      title={t("superadmin.order")}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 font-bold text-ink">
                      {m.name}
                      {!m.is_active && (
                        <span className="rounded-full bg-status-unpaid/10 px-2 py-0.5 text-[10px] font-bold uppercase text-status-unpaid">
                          {t("superadmin.disabled")}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-ink-faint">/{m.slug}</div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {editing ? (
                  <>
                    <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => saveMut.mutate(m)} disabled={saveMut.isPending}>
                      <Check size={14} /> {t("common.save")}
                    </button>
                    <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setEditId(null)}>
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn-ghost px-3 py-1.5 text-xs"
                      onClick={() => navigate(`/?market=${m.slug}`)}
                      title={t("superadmin.view")}
                    >
                      <Eye size={14} /> {t("superadmin.view")}
                    </button>
                    <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => startEdit(m)}>
                      <Pencil size={14} /> {t("common.edit")}
                    </button>
                    <button
                      className={`px-3 py-1.5 text-xs ${m.is_active ? "btn-ghost text-status-unpaid" : "btn-ghost text-status-paid"}`}
                      onClick={() => toggleMut.mutate(m.id)}
                      disabled={toggleMut.isPending}
                      title={m.is_active ? t("superadmin.disable") : t("superadmin.enable")}
                    >
                      {m.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                      {m.is_active ? t("superadmin.disable") : t("superadmin.enable")}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Link to="/super" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
        <ExternalLink size={15} /> {t("superadmin.openDashboard")}
      </Link>
    </div>
  );
}
