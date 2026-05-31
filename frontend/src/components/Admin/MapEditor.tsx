import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Save, X, MousePointer2, Maximize2, Minimize2,
  ZoomIn, ZoomOut,
} from "lucide-react";
import { getPavilions } from "@/api/pavilions";
import { createPavilion, updatePavilion, deletePavilion } from "@/api/admin";
import { useT } from "@/i18n/useT";

const VIEW_W = 1568;
const VIEW_H = 1109;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

type Pt = { x: number; y: number };
type VB = { x: number; y: number; w: number; h: number };

function parsePoints(s: string | null): Pt[] {
  if (!s) return [];
  return s.trim().split(/\s+/).map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x, y };
  }).filter((p) => isFinite(p.x) && isFinite(p.y));
}

function pointsToStr(pts: Pt[]): string {
  return pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");
}

type Mode = "select" | "draw";

export function MapEditor() {
  const qc = useQueryClient();
  const t = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: pavilions } = useQuery({ queryKey: ["pavilions-all"], queryFn: getPavilions });

  const [mode, setMode] = useState<Mode>("select");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [points, setPoints] = useState<Pt[]>([]);
  const [name, setName] = useState("");
  const [labelText, setLabelText] = useState("");
  const [shopPrefix, setShopPrefix] = useState("");
  const [fillColor, setFillColor] = useState("#d4a373");
  const [strokeColor, setStrokeColor] = useState("#b45309");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [vb, setVb] = useState<VB>({ x: 0, y: 0, w: VIEW_W, h: VIEW_H });
  const [fullscreen, setFullscreen] = useState(false);
  const pan = useRef({ active: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const zoom = VIEW_W / vb.w;

  useEffect(() => {
    if (selectedId == null) return;
    const p = pavilions?.find((x) => x.id === selectedId);
    if (!p) return;
    setPoints(parsePoints(p.polygon_points));
    setName(p.display_name);
    setLabelText(p.display_text ?? "");
    setShopPrefix((p.meta?.shop_prefix as string | undefined) ?? "");
    setFillColor(p.fill_color);
    setStrokeColor(p.stroke_color);
  }, [selectedId, pavilions]);

  useEffect(() => {
    function onFsChange() {
      setFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ekran -> viewBox koordinatasi (zoom/pan'ni hisobga oladi)
  function toSvgCoords(clientX: number, clientY: number): Pt {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    return { x: vb.x + px * vb.w, y: vb.y + py * vb.h };
  }

  function applyZoom(factor: number, cx?: number, cy?: number) {
    setVb((prev) => {
      const newW = Math.min(VIEW_W / MIN_ZOOM, Math.max(VIEW_W / MAX_ZOOM, prev.w / factor));
      const newH = newW * (VIEW_H / VIEW_W);
      const fx = cx ?? prev.x + prev.w / 2;
      const fy = cy ?? prev.y + prev.h / 2;
      let nx = fx - (fx - prev.x) * (newW / prev.w);
      let ny = fy - (fy - prev.y) * (newH / prev.h);
      nx = Math.min(Math.max(0, nx), VIEW_W - newW);
      ny = Math.min(Math.max(0, ny), VIEW_H - newH);
      return { x: nx, y: ny, w: newW, h: newH };
    });
  }
  function resetZoom() { setVb({ x: 0, y: 0, w: VIEW_W, h: VIEW_H }); }

  function handleWheel(e: React.WheelEvent) {
    if (mode === "draw") return; // chizishda zoom o'chiq (nuqta qo'yishga xalaqit bermasin)
    e.preventDefault();
    const { x, y } = toSvgCoords(e.clientX, e.clientY);
    applyZoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, x, y);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) wrapRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  // --- chizish/surish ---
  function handleSvgPointerDown(e: React.PointerEvent) {
    if (mode === "draw") return; // draw rejimida pan yo'q
    if (dragIdx != null) return; // nuqta surilyapti
    // DIQQAT: setPointerCapture'ni shu yerda chaqirmaymiz! Aks holda region
    // polygonining onClick'i ishlamaydi (pointer SVG'ga qamalib qoladi).
    // Capture'ni faqat haqiqiy surish (harakat) boshlanganda qilamiz.
    pan.current = { active: true, moved: false, sx: e.clientX, sy: e.clientY, ox: vb.x, oy: vb.y };
  }
  function handleSvgPointerMove(e: React.PointerEvent) {
    if (dragIdx != null) {
      const p = toSvgCoords(e.clientX, e.clientY);
      setPoints((prev) => prev.map((pt, i) => (i === dragIdx ? p : pt)));
      return;
    }
    if (!pan.current.active) return;
    const movedEnough =
      Math.abs(e.clientX - pan.current.sx) > 4 || Math.abs(e.clientY - pan.current.sy) > 4;
    if (!movedEnough && !pan.current.moved) return; // hali surish emas — clickka ruxsat
    if (!pan.current.moved) {
      // haqiqiy surish boshlandi — endi pointerni ushlaymiz
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
  function handleSvgPointerUp(e: React.PointerEvent) {
    try { (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    pan.current.active = false;
    setDragIdx(null);
  }

  function handleSvgClick(e: React.MouseEvent) {
    if (mode !== "draw") return;
    if (pan.current.moved) return;
    const p = toSvgCoords(e.clientX, e.clientY);
    setPoints((prev) => [...prev, p]);
  }

  function startNew() {
    setSelectedId(null);
    setPoints([]);
    setName("");
    setLabelText("");
    setShopPrefix("");
    setFillColor("#d4a373");
    setStrokeColor("#b45309");
    setMode("draw");
    setMsg("");
  }

  function removePoint(idx: number) {
    setPoints((prev) => prev.filter((_, i) => i !== idx));
  }

  // idx va idx+1 nuqtalar orasiga yangi nuqta qo'shadi (chetga bosilganda)
  function insertPointAfter(idx: number) {
    setPoints((prev) => {
      const a = prev[idx];
      const b = prev[(idx + 1) % prev.length];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const next = [...prev];
      next.splice(idx + 1, 0, mid);
      return next;
    });
  }

  function centroid(pts: Pt[]): Pt {
    if (pts.length === 0) return { x: VIEW_W / 2, y: VIEW_H / 2 };
    const sx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const sy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    return { x: sx, y: sy };
  }

  async function handleSave() {
    if (points.length < 3) { setMsg("Kamida 3 ta nuqta kerak"); return; }
    if (!name.trim()) { setMsg("Nom kiriting"); return; }
    setSaving(true);
    setMsg("");
    const c = centroid(points);
    const payload = {
      display_name: name.trim(),
      display_text: labelText.trim() || null,
      polygon_points: pointsToStr(points),
      fill_color: fillColor,
      stroke_color: strokeColor,
      label_x: c.x,
      label_y: c.y,
      is_active: true,
      meta: { shop_prefix: shopPrefix.trim() || undefined },
    };
    try {
      if (selectedId != null) {
        await updatePavilion(selectedId, payload);
        setMsg("✓ Yangilandi");
      } else {
        await createPavilion(payload);
        setMsg("✓ Yangi region qo'shildi");
      }
      qc.invalidateQueries({ queryKey: ["pavilions"] });
      qc.invalidateQueries({ queryKey: ["pavilions-all"] });
      setMode("select");
    } catch {
      setMsg("Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (selectedId == null) return;
    if (!confirm("Bu regionni o'chirishni tasdiqlaysizmi?")) return;
    try {
      await deletePavilion(selectedId);
      qc.invalidateQueries({ queryKey: ["pavilions"] });
      qc.invalidateQueries({ queryKey: ["pavilions-all"] });
      startNew();
      setMsg("✓ O'chirildi");
    } catch {
      setMsg("O'chirishda xatolik");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        {t("editor.intro")} <span className="font-mono font-bold">04-1-1</span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button className={mode === "select" ? "btn-primary" : "btn-ghost"} onClick={() => setMode("select")}>
          <MousePointer2 size={15} /> {t("editor.select")}
        </button>
        <button className="btn-ghost" onClick={startNew}>
          <Plus size={15} /> {t("editor.newRegion")}
        </button>
        {mode === "draw" && (
          <span className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            {t("editor.drawMode")}
          </span>
        )}
        {points.length > 0 && (
          <button className="btn-ghost text-status-unpaid" onClick={() => setPoints([])}>
            <X size={15} /> {t("editor.clearPoints")}
          </button>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr,260px]">
        {/* Xarita */}
        <div ref={wrapRef} className={`card relative overflow-hidden ${fullscreen ? "grid place-items-center bg-slate-900" : ""}`}>
          {/* Boshqaruv tugmalari */}
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
            <button onClick={toggleFullscreen} className="grid h-9 w-9 place-items-center rounded-xl border border-white/60 bg-white/90 text-ink-soft shadow-soft backdrop-blur hover:text-brand" title={t("editor.fullscreen")}>
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={() => applyZoom(1.4)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/60 bg-white/90 text-ink-soft shadow-soft backdrop-blur hover:text-brand" title={t("map.zoomIn")}>
              <ZoomIn size={16} />
            </button>
            <button onClick={() => applyZoom(1 / 1.4)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/60 bg-white/90 text-ink-soft shadow-soft backdrop-blur hover:text-brand" title={t("map.zoomOut")}>
              <ZoomOut size={16} />
            </button>
            <button onClick={resetZoom} className="grid h-9 w-9 place-items-center rounded-xl border border-white/60 bg-white/90 text-ink-soft shadow-soft backdrop-blur hover:text-brand" title={t("map.reset")}>
              <Maximize2 size={14} />
            </button>
          </div>
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
              maxHeight: fullscreen ? "100vh" : undefined,
              cursor: mode === "draw" ? "crosshair" : pan.current.active ? "grabbing" : "grab",
            }}
            preserveAspectRatio="xMidYMid meet"
            onClick={handleSvgClick}
            onWheel={handleWheel}
            onPointerDown={handleSvgPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerLeave={handleSvgPointerUp}
          >
            <image href="/map.jpg" x="0" y="0" width={VIEW_W} height={VIEW_H}
              preserveAspectRatio="xMidYMid meet"
              onError={(e) => ((e.target as SVGImageElement).style.display = "none")} />

            {pavilions?.map((p) => {
              if (p.id === selectedId) return null;
              const pts = parsePoints(p.polygon_points);
              if (pts.length < 3) return null;
              return (
                <polygon
                  key={p.id}
                  points={pointsToStr(pts)}
                  fill={p.fill_color}
                  fillOpacity={0.35}
                  stroke={p.stroke_color}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    if (mode === "select" && !pan.current.moved) {
                      e.stopPropagation();
                      setSelectedId(p.id);
                    }
                  }}
                />
              );
            })}

            {points.length >= 2 && (
              <polygon points={pointsToStr(points)} fill={fillColor} fillOpacity={0.5}
                stroke={strokeColor} strokeWidth={3} vectorEffect="non-scaling-stroke" />
            )}

            {/* Segment o'rtalaridagi "+" — bosilganda shu joyga nuqta qo'shadi */}
            {points.length >= 2 && points.map((pt, i) => {
              const next = points[(i + 1) % points.length];
              // oxirgi -> birinchi segmentni faqat polygon yopiq bo'lsa (3+) ko'rsatamiz
              if (i === points.length - 1 && points.length < 3) return null;
              const mx = (pt.x + next.x) / 2;
              const my = (pt.y + next.y) / 2;
              const r = 7 / zoom;
              return (
                <g key={`mid-${i}`} style={{ cursor: "copy" }}
                  onPointerDown={(e) => { e.stopPropagation(); insertPointAfter(i); }}>
                  <circle cx={mx} cy={my} r={r} fill={strokeColor} fillOpacity={0.85}
                    stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  <line x1={mx - r * 0.5} y1={my} x2={mx + r * 0.5} y2={my}
                    stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  <line x1={mx} y1={my - r * 0.5} x2={mx} y2={my + r * 0.5}
                    stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </g>
              );
            })}

            {/* Asosiy nuqtalar (surish / o'chirish) */}
            {points.map((pt, i) => (
              <circle
                key={i}
                cx={pt.x} cy={pt.y} r={9 / zoom}
                fill="#fff" stroke={strokeColor} strokeWidth={3}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: "move" }}
                onPointerDown={(e) => { e.stopPropagation(); setDragIdx(i); }}
                onDoubleClick={(e) => { e.stopPropagation(); removePoint(i); }}
              />
            ))}
          </svg>
        </div>

        {/* O'ng panel */}
        <div className="space-y-3">
          <div className="card space-y-2 p-3">
            <div className="text-xs font-bold text-ink-soft">
              {selectedId != null ? `${t("editor.region")} #${selectedId}` : t("editor.newRegion")}
            </div>
            <input className="input" placeholder={t("editor.name")} value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" placeholder={t("editor.label")} value={labelText} onChange={(e) => setLabelText(e.target.value)} />
            <div>
              <input className="input font-mono" placeholder={t("editor.prefix")} value={shopPrefix} onChange={(e) => setShopPrefix(e.target.value)} />
              <div className="mt-1 text-[11px] text-ink-faint">
                {t("editor.prefixHint")}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ink-soft">{t("editor.fill")}</span>
              <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} />
              <span className="text-ink-soft">{t("editor.stroke")}</span>
              <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} />
            </div>
            <div className="text-xs text-ink-faint">{t("editor.points")}: {points.length}</div>
            <button className="btn-primary w-full" onClick={handleSave} disabled={saving}>
              <Save size={15} /> {saving ? t("common.saving") : t("common.save")}
            </button>
            {selectedId != null && (
              <button className="btn-ghost w-full text-status-unpaid" onClick={handleDelete}>
                <Trash2 size={15} /> {t("common.delete")}
              </button>
            )}
            {msg && <div className="text-center text-xs font-semibold text-brand">{msg}</div>}
          </div>

          <div className="card p-3 text-xs text-ink-soft">
            <div className="mb-1 font-bold">{t("editor.guide")}</div>
            <ul className="list-disc space-y-1 pl-4">
              <li>"Yangi region" → "Chizish" rejimi</li>
              <li>Xaritaga bosib nuqta qo'shing</li>
              <li>Nuqtani surib joyini o'zgartiring</li>
              <li>Chetdagi "+" ni bosib nuqtalar orasiga yangi nuqta qo'shing</li>
              <li>Nuqtaga ikki marta bosib o'chiring</li>
              <li>Tanlash rejimida: scroll = zoom, surish = ko'chirish</li>
              <li>Magazin ID prefiksini kiriting (04-1-1)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
