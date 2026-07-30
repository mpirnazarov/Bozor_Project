import { useQuery } from "@tanstack/react-query";
import { Modal, Spinner } from "@/components/ui/Modal";
import { listToilets, getToiletMonth, type ToiletMonthSummary } from "@/api/toilet";
import { fmtUZS } from "@/lib/utils";

const MONTHS = ["Yanvar","Fevral","Mart","Aprel","May","Iyun",
                 "Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr"];

interface Props {
  toilet: { id: number; name: string } | null;
  onClose: () => void;
}

export function ToiletModal({ toilet, onClose }: Props) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: toilets } = useQuery({
    queryKey: ["toilets"],
    queryFn: listToilets,
    enabled: !!toilet && toilet.id === 0,
  });

  const resolvedId = toilet?.id === 0
    ? toilets?.find((t) => t.name === toilet?.name)?.id ?? null
    : toilet?.id ?? null;

  const { data, isLoading } = useQuery<ToiletMonthSummary>({
    queryKey: ["toilet-month", resolvedId, year, month],
    queryFn: () => getToiletMonth(resolvedId!, year, month),
    enabled: !!resolvedId,
  });

  return (
    <Modal
      open={!!toilet}
      onClose={onClose}
      title={data?.toilet.name ?? toilet?.name ?? ""}
      maxWidth="max-w-md"
      zClass="z-[60]"
    >
      {(isLoading || (!resolvedId && toilet?.id === 0)) && <Spinner />}

      {!isLoading && resolvedId && data && (
        <div className="space-y-4">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-600">
            🚻 Xojatxona
          </div>

          {/* Joriy oy jami */}
          <div className="rounded-xl bg-brand/8 px-4 py-4 text-center">
            <div className="text-xs text-ink-faint mb-1">{MONTHS[month - 1]} {year} — jami tushum</div>
            <div className="text-3xl font-bold text-brand">{fmtUZS(data.total)}</div>
            <div className="text-xs text-ink-faint mt-1">{data.revenues.length} kun kiritilgan</div>
          </div>

          {/* Kunlik tushum ro'yxati */}
          {data.revenues.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-400">
                    <th className="px-3 py-2 text-left">Sana</th>
                    <th className="px-3 py-2 text-right">Tushum</th>
                  </tr>
                </thead>
                <tbody>
                  {data.revenues.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-1.5 text-ink-soft">
                        {new Date(r.revenue_date).toLocaleDateString("uz-UZ")}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold text-ink">
                        {fmtUZS(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.revenues.length === 0 && (
            <div className="rounded-xl bg-slate-50 py-6 text-center text-sm text-ink-faint">
              {MONTHS[month - 1]} oyi uchun tushum kiritilmagan
            </div>
          )}
        </div>
      )}

      {!isLoading && !resolvedId && (
        <div className="py-6 text-center text-sm text-ink-faint">
          Bu xojatxona hali tizimda ro'yxatga olinmagan.
        </div>
      )}
    </Modal>
  );
}
