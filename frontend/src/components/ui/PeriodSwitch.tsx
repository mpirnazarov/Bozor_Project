/**
 * Davr (oy/yil) tanlagich — blok modali, INN modali va boshqa ekranlar uchun
 * yagona ko'rinish. Uslublari globals.css dagi `.period-*` klasslarida
 * (dark rejim uchun html.dark overrideslari bilan).
 *
 * Kelajakdagi oyga o'tish bloklangan — u davr uchun ma'lumot bo'lmaydi.
 */

export const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2.5"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points={dir === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  );
}

interface Props {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  /** So'rov ketayotganini bildiradi (yonida "yuklanmoqda…" chiqadi). */
  busy?: boolean;
}

export function PeriodSwitch({ year, month, onChange, busy }: Props) {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const isCurrent = year === curYear && month === curMonth;

  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    onChange(d.getFullYear(), d.getMonth() + 1);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="period-switch">
        <button type="button" className="period-nav"
                onClick={() => shift(-1)} aria-label="Oldingi oy">
          <Chevron dir="left" />
        </button>
        <div className="period-value">
          <div className="font-display text-[13px] font-extrabold leading-none text-ink">
            {MONTHS[month - 1]}
          </div>
          <div className="mt-1 text-[10px] font-semibold leading-none tracking-wider text-ink-faint">
            {year}
          </div>
        </div>
        <button type="button" className="period-nav"
                onClick={() => shift(1)} disabled={isCurrent} aria-label="Keyingi oy">
          <Chevron dir="right" />
        </button>
      </div>

      {!isCurrent && (
        <button type="button" className="period-reset"
                onClick={() => onChange(curYear, curMonth)}>
          Joriy oyga qaytish
        </button>
      )}

      {busy && (
        <span className="text-[11px] font-semibold text-ink-faint">yuklanmoqda…</span>
      )}
    </div>
  );
}
