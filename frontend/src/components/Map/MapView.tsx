import { useQuery } from "@tanstack/react-query";
import { getPavilions } from "@/api/pavilions";
import { Spinner } from "@/components/ui/Modal";
import type { Pavilion } from "@/types/api";

// Xarita SVG koordinata tizimi (index.html bilan bir xil viewBox)
const VIEW_W = 1568;
const VIEW_H = 1109;

interface Props {
  onSelectPavilion: (p: Pavilion) => void;
}

export function MapView({ onSelectPavilion }: Props) {
  const { data: pavilions, isLoading, isError, error } = useQuery({
    queryKey: ["pavilions"],
    queryFn: getPavilions,
  });

  if (isLoading) return <Spinner label="Xarita yuklanmoqda..." />;

  if (isError) {
    return (
      <div className="card p-6 text-center text-sm text-status-unpaid">
        Xaritani yuklashda xatolik: {(error as Error)?.message ?? "noma'lum"}
      </div>
    );
  }

  if (!Array.isArray(pavilions) || pavilions.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-slate-400">
        Pavilionlar topilmadi. Ma'lumotlar bazasi seed qilinmagan yoki API
        ulanmagan bo'lishi mumkin.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
        Xarita v2 · {pavilions.length} ta pavilion yuklandi
      </div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        className="block"
        style={{ background: "#e8eef3", display: "block", height: "auto" }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Xarita foni — map.jpg public papkaga qo'yiladi (ixtiyoriy).
            Rasm yo'q bo'lsa ham polygonlar ko'rinadi. */}
        <image
          href="/map.jpg"
          x="0"
          y="0"
          width={VIEW_W}
          height={VIEW_H}
          preserveAspectRatio="xMidYMid meet"
          onError={(e) => {
            (e.target as SVGImageElement).style.display = "none";
          }}
        />

        {pavilions.map((p) => {
          const meta = p.meta ?? {};
          const extra = (meta.extra_polygons as string[] | undefined) ?? [];
          const fontSize = (meta.label_font_size as number | undefined) ?? 20;
          const allPolys = [p.polygon_points, ...extra].filter(Boolean) as string[];
          return (
            <g
              key={p.id}
              className="cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => onSelectPavilion(p)}
            >
              {allPolys.map((pts, i) => (
                <polygon
                  key={i}
                  points={pts}
                  fill={p.fill_color}
                  fillOpacity={Math.max(p.fill_opacity ?? 0.45, 0.5)}
                  stroke={p.stroke_color}
                  strokeWidth={Math.max(p.stroke_width ?? 3, 3)}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {p.label_x != null && p.label_y != null && (
                <text
                  x={p.label_x}
                  y={p.label_y}
                  fontSize={fontSize}
                  fontWeight="700"
                  fill="#3b2c1a"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={
                    p.label_rotation
                      ? `rotate(${p.label_rotation} ${p.label_x} ${p.label_y})`
                      : undefined
                  }
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {p.display_text}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
