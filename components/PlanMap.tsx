"use client";
import { useState } from "react";
export default function PlanMap({
  analysis,
  interactive = true,
}: {
  analysis: any;
  interactive?: boolean;
}) {
  const [selected, setSelected] = useState<any>(null);
  const walls = analysis?.ifcPlan?.walls || [];
  const rooms = analysis?.inferredRooms || [];
  if (!walls.length)
    return (
      <div className="bt-empty compact">
        <p>معاينة المخطط غير متوفرة بعد.</p>
      </div>
    );
  const xs = walls.flatMap((w: any) => [w.x1, w.x2]).map(Number),
    ys = walls.flatMap((w: any) => [w.y1, w.y2]).map(Number);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const width = maxX - minX,
    height = maxY - minY;
  const margin = Math.max(width, height) * 0.07;
  const choose = (data: any) =>
    interactive ? () => setSelected(data) : undefined;
  return (
    <div className="bt-plan-map">
      <svg
        viewBox={`${minX - margin} ${-maxY - margin} ${width + 2 * margin} ${height + 2 * margin}`}
        role="img"
        aria-label="مخطط المنزل والغرف"
      >
        {rooms.map((room: any, i: number) => (
          <g
            key={room.id || i}
            tabIndex={interactive ? 0 : undefined}
            role={interactive ? "button" : undefined}
            aria-label={room.name || "غرفة " + (i + 1)}
            onClick={choose({
              name: room.name || "غرفة " + (i + 1),
              detail: `${Number(room.areaM2 || 0).toFixed(1)} م²`,
            })}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                setSelected({
                  name: room.name || "غرفة " + (i + 1),
                  detail: `${Number(room.areaM2 || 0).toFixed(1)} م²`,
                });
            }}
          >
            <polygon
              points={(room.polygon || [])
                .map((p: any) => `${p.x},${-p.y}`)
                .join(" ")}
              fill={i % 2 ? "#eee9df" : "#e2e6dc"}
            />
            <text
              x={room.center?.x}
              y={-room.center?.y}
              textAnchor="middle"
              fontSize={Math.max(width, height) * 0.025}
              fill="#47513c"
            >
              {room.name || "غرفة " + (i + 1)}
            </text>
          </g>
        ))}
        {walls.map((w: any) => (
          <line
            key={w.entityId}
            x1={w.x1}
            x2={w.x2}
            y1={-w.y1}
            y2={-w.y2}
            stroke="#56624d"
            strokeWidth={Number(w.thickness) || 0.18}
            onClick={choose({
              name: "جدار",
              detail: `${Math.hypot(w.x2 - w.x1, w.y2 - w.y1).toFixed(2)} م · سماكة ${Number(w.thickness || 0.18).toFixed(2)} م`,
            })}
          />
        ))}
        {(analysis?.ifcPlan?.openings || []).map((o: any, i: number) => {
          const w = walls.find((w: any) => w.entityId === o.wallEntityId);
          if (!w) return null;
          const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
          const half = (o.widthM || 0.9) / Math.max(len, 0.01) / 2;
          const a = Math.max(0, o.position - half),
            b = Math.min(1, o.position + half);
          return (
            <line
              key={i}
              x1={w.x1 + (w.x2 - w.x1) * a}
              y1={-w.y1 - (w.y2 - w.y1) * a}
              x2={w.x1 + (w.x2 - w.x1) * b}
              y2={-w.y1 - (w.y2 - w.y1) * b}
              stroke={o.kind === "door" ? "#c9ae78" : "#93acb2"}
              strokeWidth={(Number(w.thickness) || 0.18) * 1.4}
              onClick={choose({
                name: o.kind === "door" ? "باب" : "نافذة",
                detail: `العرض ${Number(o.widthM || 0.9).toFixed(2)} م`,
              })}
            />
          );
        })}
      </svg>
      {interactive && selected && (
        <div className="bt-map-detail" role="status">
          <b>{selected.name}</b>
          <span>{selected.detail}</span>
          <button onClick={() => setSelected(null)} aria-label="إغلاق التفاصيل">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
