interface Props {
  /** Balandlik (px). Kenglik avtomatik nisbatda. */
  height?: number;
  className?: string;
}

/**
 * "clikc BAZAAR" logotipi (yuklangan rasmga mos).
 * - "clikc" — qora, "i" harfi ko'k urg'u bilan
 * - ostida "BAZAAR" — kulrang, harflar orasi kengaytirilgan
 * SVG bo'lgani uchun istalgan o'lchamda aniq chiqadi.
 */
export function ClikcBazaarLogo({ height = 28, className }: Props) {
  // viewBox nisbati ~ 132x46
  const width = (height * 132) / 46;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 132 46"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="clikc BAZAAR"
    >
      {/* "clikc" — Inter/sans, bold; "i" ko'k */}
      <text
        x="0"
        y="27"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="30"
        fontWeight="800"
        letterSpacing="-1.5"
      >
        <tspan fill="#0f1729">cl</tspan>
        <tspan fill="#1a56ff">i</tspan>
        <tspan fill="#0f1729">kc</tspan>
      </text>
      {/* "BAZAAR" — kulrang, keng harf oralig'i */}
      <text
        x="1"
        y="42"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontSize="11"
        fontWeight="700"
        letterSpacing="4.5"
        fill="#7c899c"
      >
        BAZAAR
      </text>
    </svg>
  );
}
