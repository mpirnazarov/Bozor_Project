import { useQuery } from "@tanstack/react-query";
import { useRef, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Minus, Maximize2, ChevronLeft, ChevronRight, Layers, MapPin } from "lucide-react";
import { getPavilions } from "@/api/pavilions";
import { getMapLayers, mapImageUrl } from "@/api/maps";
import { getCurrentMarket } from "@/api/client";
import { Spinner } from "@/components/ui/Modal";
import type { Pavilion } from "@/types/api";
import { useT } from "@/i18n/useT";
import { useAuthStore } from "@/store/authStore";

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
  const user = useAuthStore((s) => s.user);
  const isMarketAdmin = ["admin", "market_admin"].includes(user?.role ?? "");
  // URL ?market= parametri — React state, o'zgarganda qayta render bo'ladi
  const [searchParams] = useSearchParams();
  const marketSlug = searchParams.get("market") ?? getCurrentMarket() ?? user?.market_slug ?? "orikzor";

  // Bozorning xaritalari (qavatlar). Bo'lmasa — xarita yuklanmagan xabari.
  const { data: layers } = useQuery({ queryKey: ["map-layers", marketSlug], queryFn: () => getMapLayers() });
  const [activeIdx, setActiveIdx] = useState(0);
  const activeLayer = layers && layers.length > 0 ? layers[Math.min(activeIdx, layers.length - 1)] : null;

  const { data: pavilions, isLoading, isError, error } = useQuery({
    queryKey: ["pavilions", marketSlug, activeLayer?.id ?? "all"],
    queryFn: () => getPavilions(activeLayer?.id),
  });

  // Joriy qavat rasmi manbasi
  // has_image bo'lmasa mapSrc null — /map.jpg ga FALLBACK YO'Q (O'rikzor xaritasi boshqa bozorlarga chiqmasin)
  const mapSrc = activeLayer?.has_image ? mapImageUrl(activeLayer.id) : undefined;

  // Rasm yuklanmaguncha progress. DIQQAT: hook'lar har doim early return'lardan
  // OLDIN chaqirilishi kerak (React hooks qoidasi).
  // mapSrc null bo'lsa (xarita yo'q) — loading spinner kerak emas
  const [imgLoading, setImgLoading] = useState(!!mapSrc);
  useEffect(() => {
    if (!mapSrc) { setImgLoading(false); return; }
    setImgLoading(true);
    const tmr = window.setTimeout(() => setImgLoading(false), 4000);
    return () => window.clearTimeout(tmr);
  }, [mapSrc]);

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

  const hasLayer = Array.isArray(layers) && layers.length > 0;

  // To'liq spinner faqat eng birinchi yuklashda (hali xarita ham, ma'lumot ham yo'q).
  // Xaritalar mavjud bo'lsa — UI ni almashtirmaymiz, rasm overlay'i kifoya
  // (aks holda qavat almashganda hamma narsa "yuklanmoqda"ga aylanib qolardi).
  if (isLoading && !hasLayer) return <Spinner label={t("map.loading")} />;

  if (isError && !hasLayer) {
    return (
      <div className="card p-6 text-center text-sm text-status-unpaid">
        {t("map.error")}: {(error as Error)?.message ?? "noma'lum"}
      </div>
    );
  }

  // Faqat HECH narsa bo'lmaganda (xarita ham, region ham yo'q) xabar ko'rsatamiz.
  const noPavilions = !Array.isArray(pavilions) || pavilions.length === 0;
  if (noPavilions && !hasLayer && !isLoading) {
    // Yangi bozor admini uchun — xaritani yuklash yo'riqnomasi
    if (isMarketAdmin) {
      return (
        <div className="card p-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
            <MapPin size={32} className="text-brand" />
          </div>
          <h3 className="font-display text-lg font-bold text-ink">Xarita hali yuklanmagan</h3>
          <p className="mt-2 text-sm text-ink-faint">
            Bozor xaritasini qo'shish uchun Admin panelga o'ting
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            Admin → Xarita bo'limida xarita rasmini yuklang va regionlarni belgilang
          </p>
        </div>
      );
    }
    // Oddiy foydalanuvchi uchun
    return (
      <div className="card p-6 text-center text-sm text-slate-400">
        Xarita hali tayyorlanmoqda. Iltimos, keyinroq kiring.
      </div>
    );
  }

  const safePavilions = Array.isArray(pavilions) ? pavilions : [];

  return (
    <div className="card relative overflow-hidden">
      {/* Yashirin preloader — rasm kelganini ishonchli aniqlaydi */}
      <img
        src={mapSrc}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        onLoad={() => setImgLoading(false)}
        onError={() => setImgLoading(false)}
      />
      {/* Rasm yuklanayotganda progress overlay (xarita almashganda kutiladi) */}
      {imgLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/75 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand/25 border-t-brand" />
          <span className="text-sm font-semibold text-ink-soft">{t("map.loading")}</span>
        </div>
      )}
      {/* Bu qavatda hali region chizilmagan bo'lsa — xabar (xarita baribir ko'rinadi) */}
      {!imgLoading && safePavilions.length === 0 && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-ink/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
          Bu qavatda hali region yo'q
        </div>
      )}
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

      {/* Xaritalar (qavatlar) o'rtasida o'tish — faqat bittadan ko'p bo'lsa */}
      {layers && layers.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/95 px-1.5 py-1 shadow-soft ring-1 ring-slate-200 backdrop-blur">
          <button
            onClick={() => { setActiveIdx((i) => (i - 1 + layers.length) % layers.length); reset(); }}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-slate-100 hover:text-brand"
            title="Oldingi xarita"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-1.5 px-2 text-sm font-bold text-ink">
            <Layers size={15} className="text-brand" />
            {activeLayer?.name ?? ""}
            <span className="text-xs font-normal text-ink-faint">({activeIdx + 1}/{layers.length})</span>
          </div>
          <button
            onClick={() => { setActiveIdx((i) => (i + 1) % layers.length); reset(); }}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-slate-100 hover:text-brand"
            title="Keyingi xarita"
          >
            <ChevronRight size={18} />
          </button>
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
        {/* mapSrc null bo'lsa (xarita yuklanmagan) SVG image ko'rsatmaymiz — /map.jpg fallback YO'Q */}
        {mapSrc && (
          <image
            href={mapSrc}
            x="0"
            y="0"
            width={VIEW_W}
            height={VIEW_H}
            preserveAspectRatio="xMidYMid meet"
            onLoad={() => setImgLoading(false)}
            onError={(e) => {
              setImgLoading(false);
              (e.target as SVGImageElement).style.display = "none";
            }}
          />
        )}

        {safePavilions.map((p) => {
          const meta = p.meta ?? {};
          const extra = (meta.extra_polygons as string[] | undefined) ?? [];
          const fontSize = (meta.label_font_size as number | undefined) ?? 20;
          const allPolys = [p.polygon_points, ...extra].filter(Boolean) as string[];
          const isHidden = meta.is_hidden === true;
          const showLabel = meta.show_label !== false; // default true

          // Berkitilgan region — oq, chegarasiz, nomsiz, bosilmaydigan
          if (isHidden) {
            return (
              <g key={p.id} style={{ pointerEvents: "none" }}>
                {allPolys.map((pts, i) => (
                  <polygon
                    key={i}
                    points={pts}
                    fill="#ffffff"
                    fillOpacity={1}
                    stroke="none"
                  />
                ))}
              </g>
            );
          }

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
              {showLabel && p.label_x != null && p.label_y != null && (
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
