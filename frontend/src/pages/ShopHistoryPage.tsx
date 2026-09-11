/**
 * Magazin egasi va ijara narxi o'zgarishlari tarixi.
 *
 * Har o'zgarish `shop_periods` da alohida davr bo'lib saqlanadi, shuning
 * uchun "bu magazin martda kimniki edi, narxi qancha edi" degan savolga
 * javob beriladi. O'tgan oy hisobotlari ham shu davrlardan hisoblanadi.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, Loader2, History } from "lucide-react";
import { getShopPeriods } from "@/api/admin";
import { fmtUZS } from "@/lib/utils";

const PER_PAGE = 50;

function fmtDate(d: string | null) {
  if (!d) return "hozirgacha";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export function ShopHistoryPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["shop-periods", search, page],
    queryFn: () => getShopPeriods(search, page, PER_PAGE),
    placeholderData: (prev) => prev,
  });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Sarlavha */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="btn-ghost">
              <ArrowLeft size={15} /> Admin panel
            </Link>
            <div>
              <div className="eyebrow">Magazinlar</div>
              <h1 className="font-display text-xl font-extrabold text-ink">
                O'zgarishlar tarixi
              </h1>
            </div>
          </div>
          <div className="text-sm text-ink-soft">
            Jami <b className="text-ink">{total}</b> ta o'zgarish
          </div>
        </div>

        {/* Qidiruv */}
        <form
          className="mb-4 flex flex-wrap items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); setSearch(q); setPage(1); }}
        >
          <div className="relative flex-1 md:max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              className="input pl-9"
              placeholder="Magazin ID, INN yoki kontragent..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="btn-primary" type="submit">Qidirish</button>
          {search && (
            <button type="button" className="btn-ghost"
                    onClick={() => { setQ(""); setSearch(""); setPage(1); }}>
              Tozalash
            </button>
          )}
          {isFetching && <Loader2 size={15} className="animate-spin text-brand" />}
        </form>

        {isLoading && <div className="py-10 text-center text-ink-soft">Yuklanmoqda...</div>}

        {data && data.items.length === 0 && (
          <div className="rounded-2xl border border-white/60 bg-white/70 py-14 text-center shadow-soft">
            <History size={28} className="mx-auto mb-3 text-ink-faint" />
            <div className="text-base font-bold text-ink">Hozircha o'zgarish yo'q</div>
            <div className="mt-1 text-sm text-ink-soft">
              Magazin egasi yoki ijara narxi o'zgarganda shu yerda ko'rinadi.
            </div>
          </div>
        )}

        {data && data.items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/70 shadow-soft">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-3 font-bold">Magazin</th>
                  <th className="px-4 py-3 font-bold">Davr</th>
                  <th className="px-4 py-3 font-bold">Ega</th>
                  <th className="px-4 py-3 text-right font-bold">Ijara</th>
                  <th className="px-4 py-3 font-bold">Manba</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r, i) => {
                  const innChanged = r.prev_inn != null && r.prev_inn !== r.inn;
                  const rentChanged =
                    r.prev_monthly_rent != null && r.prev_monthly_rent !== r.monthly_rent;
                  return (
                    <tr key={`${r.shop_id}-${r.valid_from}-${i}`}
                        className="border-t border-slate-200/60 align-top">
                      <td className="px-4 py-3 font-mono font-semibold text-ink">{r.shop_id}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                        {fmtDate(r.valid_from)} — {fmtDate(r.valid_to)}
                      </td>
                      <td className="px-4 py-3">
                        {innChanged && (
                          <div className="text-[11px] text-ink-faint line-through">
                            {r.prev_counterparty_name ?? r.prev_inn}
                          </div>
                        )}
                        <div className="font-semibold text-ink">
                          {r.counterparty_name ?? "—"}
                        </div>
                        <div className="font-mono text-[11px] text-ink-faint">{r.inn ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {rentChanged && (
                          <div className="tabnum text-[11px] text-ink-faint line-through">
                            {fmtUZS(r.prev_monthly_rent!)}
                          </div>
                        )}
                        <div className="tabnum font-semibold text-ink">
                          {fmtUZS(r.monthly_rent)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-ink-faint">{r.source ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button className="btn-ghost" disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Oldingi
            </button>
            <span className="text-sm text-ink-soft">{page} / {pages}</span>
            <button className="btn-ghost" disabled={page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}>
              Keyingi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
