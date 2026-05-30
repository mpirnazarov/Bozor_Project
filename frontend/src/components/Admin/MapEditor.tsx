import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, X, MousePointer2 } from "lucide-react";
import { getPavilions } from "@/api/pavilions";
import { createPavilion, updatePavilion, deletePavilion } from "@/api/admin";

const VIEW_W = 1568;
const VIEW_H = 1109;

type Pt = { x: number; y: number };

// "x1,y1 x2,y2" -> [{x,y}]
function parsePoints(s: string | null): Pt[] {
  if (!s) return [];
  return s
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x, y };
    })
    .filter((p) => isFinite(p.x) && isFinite(p.y));
}

function pointsToStr(pts: Pt[]): string {
  return pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");
}

type Mode = "select" | "draw";

export function MapEditor() {
  const qc = useQueryClient();
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: pavilions } = useQuery({ queryKey: ["pavilions-all"], queryFn: getPavilions });

  const [mode, setMode] = useState<Mode>("select");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [points, setPoints] = useState<Pt[]>([]);
  const [name, setName] = useState("");
  const [labelText, setLabelText] = useState("");
  const [fillColor, setFillColor] = useState("#d4a373");
  const [strokeColor, setStrokeColor] = useState("#b45309");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Tanlanган pavilion ma'lumotларини formага yuklash
  useEffect(() => {
    if (selectedId == null) return;
    const p = pavilions?.find((x) => x.id === selectedId);
    if (!p) return;
    setPoints(parsePoints(p.polygon_points));
    setName(p.display_name);
    setLabelText(p.display_text ?? "");
    setFillColor(p.fill_color);
    setStrokeColor(p.stroke_color);
  }, [selectedId, pavilions]);

  // SVG koordinatasига o'tkazish (ekran -> viewBox)
  function toSvgCoords(e: React.MouseEvent): Pt {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    return { x, y };
  }

  function handleSvgClick(e: React.MouseEvent) {
    if (mode !== "draw") return;
    const p = toSvgCoords(e);
    setPoints((prev) => [...prev, p]);
  }

  function handlePointDrag(e: React.MouseEvent) {
    if (dragIdx == null) return;
    const p = toSvgCoords(e);
    setPoints((prev) => prev.map((pt, i) => (i === dragIdx ? p : pt)));
  }

  function startNew() {
    setSelectedId(null);
    setPoints([]);
    setName("");
    setLabelText("");
    setFillColor("#d4a373");
    setStrokeColor("#b45309");
    setMode("draw");
    setMsg("");
  }

  function removePoint(idx: number) {
    setPoints((prev) => prev.filter((_, i) => i !== idx));
  }

  // Markaz (label uchun)
  function centroid(pts: Pt[]): Pt {
    if (pts.length === 0) return { x: VIEW_W / 2, y: VIEW_H / 2 };
    const sx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const sy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    return { x: sx, y: sy };
  }

  async function handleSave() {
    if (points.length < 3) {
      setMsg("Kamida 3 ta nuqta kerak");
      return;
    }
    if (!name.trim()) {
      setMsg("Nom kiriting");
      return;
    }
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
      <p className="text-sm text-slate-500">
        Xaritada region (blok) chizing. "Chizish" rejimида nuqta qo'shish uchun
        bosing, nuqtalarni surib joyini o'zgartiring. Saqlasangiz barcha
        foydalanuvchilarda ko'rinadi.
      </p>

      {/* Asboblar paneli */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={mode === "select" ? "btn-primary" : "btn-ghost"}
          onClick={() => setMode("select")}
        >
          <MousePointer2 size={15} /> Tanlash
        </button>
        <button className="btn-ghost" onClick={startNew}>
          <Plus size={15} /> Yangi region
        </button>
        {mode === "draw" && (
          <span className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Chizish rejimi — nuqta qo'shish uchun xaritaga bosing
          </span>
        )}
        {points.length > 0 && (
          <button className="btn-ghost text-status-unpaid" onClick={() => setPoints([])}>
            <X size={15} /> Nuqtalarni tozalash
          </button>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr,260px]">
        {/* Xarita */}
        <div className="card overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            width="100%"
            style={{ background: "#e8eef3", display: "block", cursor: mode === "draw" ? "crosshair" : "default" }}
            onClick={handleSvgClick}
            onMouseMove={handlePointDrag}
            onMouseUp={() => setDragIdx(null)}
            onMouseLeave={() => setDragIdx(null)}
          >
            <image href="/map.jpg" x="0" y="0" width={VIEW_W} height={VIEW_H}
              preserveAspectRatio="xMidYMid meet"
              onError={(e) => ((e.target as SVGImageElement).style.display = "none")} />

            {/* Mavjud pavilionlar (fon) */}
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
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    if (mode === "select") {
                      e.stopPropagation();
                      setSelectedId(p.id);
                    }
                  }}
                />
              );
            })}

            {/* Joriy chizilayotgan polygon */}
            {points.length >= 2 && (
              <polygon
                points={pointsToStr(points)}
                fill={fillColor}
                fillOpacity={0.5}
                stroke={strokeColor}
                strokeWidth={3}
              />
            )}

            {/* Nuqtalar (drag uchun) */}
            {points.map((pt, i) => (
              <circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r={8}
                fill="#fff"
                stroke={strokeColor}
                strokeWidth={3}
                style={{ cursor: "move" }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragIdx(i);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  removePoint(i);
                }}
              />
            ))}
          </svg>
        </div>

        {/* O'ng panel — tahrirlash */}
        <div className="space-y-3">
          <div className="card space-y-2 p-3">
            <div className="text-xs font-bold text-slate-500">
              {selectedId != null ? `Region #${selectedId}` : "Yangi region"}
            </div>
            <input
              className="input"
              placeholder="Nomi (masalan A-BLOK)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Belgi (xaritada, masalan A)"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
            />
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">To'ldirish</span>
              <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} />
              <span className="text-slate-500">Chegara</span>
              <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} />
            </div>
            <div className="text-xs text-slate-400">Nuqtalar: {points.length}</div>

            <button className="btn-primary w-full" onClick={handleSave} disabled={saving}>
              <Save size={15} /> {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
            {selectedId != null && (
              <button className="btn-ghost w-full text-status-unpaid" onClick={handleDelete}>
                <Trash2 size={15} /> O'chirish
              </button>
            )}
            {msg && <div className="text-center text-xs font-semibold text-brand">{msg}</div>}
          </div>

          <div className="card p-3 text-xs text-slate-500">
            <div className="mb-1 font-bold">Yo'riqnoma</div>
            <ul className="list-disc space-y-1 pl-4">
              <li>"Yangi region" → "Chizish" rejimi yoqiladi</li>
              <li>Xaritaga bosib nuqta qo'shing (ko'p qirrali bo'lishi mumkin)</li>
              <li>Nuqtani surib joyini o'zgartiring</li>
              <li>Nuqtaga ikki marta bosib o'chiring</li>
              <li>Mavjud regionni tahrirlash uchun "Tanlash"da ustiga bosing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
