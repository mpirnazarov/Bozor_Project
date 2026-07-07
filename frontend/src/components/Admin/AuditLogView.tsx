import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus, Pencil, Trash2, Upload, Palette, EyeOff, LayoutDashboard,
  Power, Activity, User as UserIcon, Clock, Undo2, RotateCcw, Download, AlertTriangle,
} from "lucide-react";
import { getAuditLog, revertAction, importLogFileUrl } from "@/api/admin";
import { useT } from "@/i18n/useT";

// Amalga qarab rang va ikonka
function actionStyle(action: string): { color: string; bg: string; icon: React.ReactNode } {
  if (action.startsWith("create")) return { color: "#16a34a", bg: "rgba(22,163,74,0.1)", icon: <Plus size={16} /> };
  if (action.startsWith("delete")) return { color: "#dc2626", bg: "rgba(220,38,38,0.1)", icon: <Trash2 size={16} /> };
  if (action === "import_billing_failed") return { color: "#dc2626", bg: "rgba(220,38,38,0.1)", icon: <AlertTriangle size={16} /> };
  if (action.startsWith("import")) return { color: "#0066ff", bg: "rgba(0,102,255,0.1)", icon: <Upload size={16} /> };
  if (action === "update_theme") return { color: "#7c3aed", bg: "rgba(124,58,237,0.1)", icon: <Palette size={16} /> };
  if (action === "update_hide_unmatched") return { color: "#d97706", bg: "rgba(217,119,6,0.1)", icon: <EyeOff size={16} /> };
  if (action === "update_dashboard") return { color: "#0891b2", bg: "rgba(8,145,178,0.1)", icon: <LayoutDashboard size={16} /> };
  if (action === "toggle_market") return { color: "#d97706", bg: "rgba(217,119,6,0.1)", icon: <Power size={16} /> };
  if (action.startsWith("update")) return { color: "#0066ff", bg: "rgba(0,102,255,0.1)", icon: <Pencil size={16} /> };
  return { color: "#64748b", bg: "rgba(100,116,139,0.1)", icon: <Activity size={16} /> };
}

export function AuditLogView() {
  const t = useT();
  const qc = useQueryClient();
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => getAuditLog(100),
  });

  const revertMut = useMutation({
    mutationFn: (snapshotId: number) => revertAction(snapshotId),
    onSettled: () => {
      setRevertingId(null);
      qc.invalidateQueries({ queryKey: ["audit-log"] });
      qc.invalidateQueries({ queryKey: ["pavilions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  function handleRevert(snapshotId: number) {
    if (!confirm("Bu amalni ortga qaytarasizmi? O'zgartirilgan yozuvlar import oldidagi holatiga qaytariladi.")) return;
    setRevertingId(snapshotId);
    revertMut.mutate(snapshotId);
  }

  if (isLoading) return <div className="text-sm text-ink-faint">{t("common.loading")}</div>;
  if (!data || data.length === 0)
    return <div className="text-sm text-ink-faint">{t("audit.empty")}</div>;

  return (
    <div className="space-y-2.5">
      {data.map((row) => {
        const st = actionStyle(row.action);
        return (
          <div key={row.id} className="card flex items-start gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: st.bg, color: st.color }}>
              {st.icon}
            </div>

            <div className="min-w-0 flex-1">
              {/* Amal nomi + vaqt */}
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="font-bold text-ink">{row.action_label}</span>
                <span className="inline-flex items-center gap-1 font-mono text-xs text-ink-faint">
                  <Clock size={12} />
                  {new Date(row.created_at).toLocaleString("uz-UZ", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Tushunarli izoh */}
              <p className="mt-1 text-sm text-ink-soft">{row.summary}</p>

              {/* Resurs + foydalanuvchi */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
                <span className="inline-flex items-center gap-1">
                  <span className="font-semibold text-ink-soft">{t("audit.resource")}:</span>
                  {row.resource_label}
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserIcon size={12} />
                  <span className="font-semibold text-ink-soft">{row.user_label}</span>
                  {row.user_role && (
                    <span className="rounded-full bg-brand/10 px-1.5 py-0.5 font-semibold text-brand">
                      {row.user_role}
                    </span>
                  )}
                </span>
              </div>

              {/* Xatoli billing import — fayl + xatolar soni */}
              {(row.import_failed || row.import_log_id != null) && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {row.import_failed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                      <AlertTriangle size={12} /> {row.error_count} ta xato — saqlanmadi
                    </span>
                  )}
                  {row.import_log_id != null && (
                    <a
                      href={importLogFileUrl(row.import_log_id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-slate-100"
                    >
                      <Download size={14} /> Faylni yuklab olish
                    </a>
                  )}
                </div>
              )}

              {/* Ortga qaytarish (rollback) — faqat 24 soat ichidagi snapshotli amallar */}
              {row.snapshot_id != null && (row.revertable || row.reverted) && (
                <div className="mt-2.5">
                  {row.reverted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-ink-faint">
                      <RotateCcw size={12} /> Qaytarilgan
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRevert(row.snapshot_id!)}
                      disabled={revertingId === row.snapshot_id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                    >
                      <Undo2 size={14} />
                      {revertingId === row.snapshot_id ? "Qaytarilmoqda..." : "Ortga qaytarish"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
