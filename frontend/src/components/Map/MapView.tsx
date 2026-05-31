import { useQuery } from "@tanstack/react-query";
import { useRef, useState, useCallback } from "react";
import { Plus, Minus, Maximize2 } from "lucide-react";
import { getPavilions } from "@/api/pavilions";
import { Spinner } from "@/components/ui/Modal";
import type { Pavilion } from "@/types/api";
import { useT } from "@/i18n/useT";

const VIEW_W = 1568;
const VIEW_H = 1109;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

interface Props {
  onSelectPavilion: (p: Pavilion) => void;
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function MapView({ onSelectPavilion }: Props) {
  const t = useT();
  const { data: pavilions, isLoading, isError, error } = useQuery({
    queryKey: ["pavilions"],
    queryFn: getPavilions,
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState<ViewBox>({ x: 0, y: 0, w: VIEW_W, h: VIEW_H });
  const pan = useRef<{ active: boolean; moved: boolean; sx: number; sy: number; ox: number; oy: number }>({
    active: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0,
  });

  const zoom = VIEW_W / vb.w; // 1 = to'liq, katta = yaqinroq

  // Zoom — markaz nuqtasi atrofida
  const applyZoom = useCallback((factor: number, cx?: number, cy?: number) => {
    setVb((prev) => {
      const newW = Math.min(VIEW_W / MIN_ZOOM, Math.max(VIEW_W / MAX_ZOOM, prev.w / factor));
      const newH = newW * (VIEW_H / VIEW_W);
      // markaz (cx,cy) viewBox koordinatasida; berilmasa markazga
      const fx = cx ?? prev.x + prev.w / 2;
      const fy = cy ?? prev.y + prev.h / 2;
      let nx = fx - (fx - prev.x) * (newW / prev.w);
      let ny = fy - (fy - prev.y) * (newH / prev.h);
      // chegaralar ichida ushlab turamiz
      nx = Math.min(Math.max(0, nx), VIEW_W - newW);
      ny = Math.min(Math.max(0, ny), VIEW_H - newH);
      return { x: nx, y: ny, w: newW, h: newH };
    });
  }, []);

  function reset() {
    setVb({ x: 0, y: 0, w: VIEW_W, h: VIEW_H });
  }

  // Ekran -> viewBox koordinatasi
  function toVb(clientX: number, clientY: number): { x: number; y: number } {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    return { x: vb.x + px * vb.w, y: vb.y + py * vb.h };
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const { x, y } = toVb(e.clientX, e.clientY);
    applyZoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, x, y);
  }

  function handlePointerDown(e: React.PointerEvent) {
    // DIQQAT: setPointerCapture'ni shu yerda chaqirmaymiz — aks holda region
    // polygonining onClick'i ishlamaydi (pointer SVG'ga qamalib qoladi).
    // Capture faqat haqiqiy surish boshlanganda qilinadi (handlePointerMove'da).
    pan.current = {
      active: true, moved: false,
      sx: e.clientX, sy: e.clientY, ox: vb.x, oy: vb.y,
    };
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!pan.current.active) return;
    const movedEnough =
      Math.abs(e.clientX - pan.current.sx) > 4 || Math.abs(e.clientY - pan.current.sy) > 4;
    if (!movedEnough && !pan.current.moved) return; // hali surish emas — clickka ruxsat
    if (!pan.current.moved) {
      pan.current.moved = true;
      try { (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId); } catch { /* noop */ }
    }
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();
    const dx = ((e.clientX - pan.current.sx) / rect.width) * vb.w;
    const dy = ((e.clientY - pan.current.sy) / rect.height) * vb.h;
    let nx = pan.current.ox - dx;
    let ny = pan.current.oy - dy;
    nx = Math.min(Math.max(0, nx), VIEW_W - vb.w);
    ny = Math.min(Math.max(0, ny), VIEW_H - vb.h);
    setVb((prev) => ({ ...prev, x: nx, y: ny }));
  }
  function handlePointerUp(e: React.PointerEvent) {
    try {
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    } catch {
      // pointer allaqachon bo'shatilgan bo'lishi mumkin
    }
    pan.current.active = false;
  }

  if (isLoading) return <Spinner label={t("map.loading")} />;

  if (isError) {
    return (
      <div className="card p-6 text-center text-sm text-status-unpaid">
        {t("map.error")}: {(error as Error)?.message ?? "noma'lum"}
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
    <div className="card relative overflow-hidden">
      {/* Zoom boshqaruvi */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={() => applyZoom(1.4)}
          className="grid h-9 w-9 place-items-center rounded-xl border border-white/60 bg-white/90 text-ink-soft shadow-soft backdrop-blur transition-colors hover:bg-white hover:text-brand"
          title={t("map.zoomIn")}
        >
          <Plus size={17} />
        </button>
        <button
          onClick={() => applyZoom(1 / 1.4)}
          className="grid h-9 w-9 place-items-center rounded-xl border border-white/60 bg-white/90 text-ink-soft shadow-soft backdrop-blur transition-colors hover:bg-white hover:text-brand"
          title={t("map.zoomOut")}
        >
          <Minus size={17} />
        </button>
        <button
          onClick={reset}
          className="grid h-9 w-9 place-items-center rounded-xl border border-white/60 bg-white/90 text-ink-soft shadow-soft backdrop-blur transition-colors hover:bg-white hover:text-brand"
          title={t("map.reset")}
        >
          <Maximize2 size={15} />
        </button>
      </div>

      {/* Zoom darajasi */}
      {zoom > 1.05 && (
        <div className="absolute left-3 top-3 z-10 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
          {zoom.toFixed(1)}×
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        width="100%"
        className="block touch-none select-none"
        style={{
          background: "#e8eef3",
          display: "block",
          height: "auto",
          cursor: pan.current.active ? "grabbing" : "grab",
        }}
        preserveAspectRatio="xMidYMid meet"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
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
              onClick={() => {
                // Pan (surish) bo'lsa, klik hisoblanmasin
                if (pan.current.moved) return;
                onSelectPavilion(p);
              }}
            >
              {allPolys.map((pts, i) => (
                <polygon
                  key={i}
                  points={pts}
                  fill={p.fill_color}
                  fillOpacity={0.55}
                  stroke={p.stroke_color}
                  strokeWidth={4}
                  strokeOpacity={1}
                  paintOrder="stroke"
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: "drop-shadow(0 0 1px rgba(0,0,0,0.6))" }}
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
