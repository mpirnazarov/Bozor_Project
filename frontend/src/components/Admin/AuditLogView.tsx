import { useQuery } from "@tanstack/react-query";
import { getAuditLog } from "@/api/admin";

export function AuditLogView() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => getAuditLog(100),
  });

  if (isLoading) return <div className="text-sm text-slate-400">Yuklanmoqda...</div>;

  if (!data || data.length === 0)
    return <div className="text-sm text-slate-400">Audit yozuvlari yo'q</div>;

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold text-slate-500">
          <tr>
            <th className="px-3 py-2">Vaqt</th>
            <th className="px-3 py-2">Amal</th>
            <th className="px-3 py-2">Resurs</th>
            <th className="px-3 py-2">User</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-mono text-xs text-slate-400">
                {new Date(row.created_at).toLocaleString("uz")}
              </td>
              <td className="px-3 py-2 font-semibold text-slate-700">{row.action}</td>
              <td className="px-3 py-2 text-slate-500">
                {row.resource_type}
                {row.resource_id ? ` · ${row.resource_id}` : ""}
              </td>
              <td className="px-3 py-2 text-slate-400">#{row.user_id ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
