"use client";

import { useEffect, useMemo, useState } from "react";
import type { DetectedDoor } from "@/lib/client/detect-doors";
import { detectDoorsInWorker } from "@/lib/client/detect-doors-worker";

import { mergeOpenings, openingKey, openingHostAt, type PlanReview } from "@/lib/plan-review";

type RoomBox={
  name:string;
  type:string;
  confidence:number;
  bbox:{x:number;y:number;width:number;height:number};
};

type Alignment={
  left:number;
  top:number;
  width:number;
  height:number;
  score:number;
};

function num(v:any){return typeof v==="number"&&Number.isFinite(v)?v:0}
function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v))}

function buildWallSamples(walls:any[],minX:number,minY:number,maxX:number,maxY:number){
  const dx=maxX-minX,dy=maxY-minY;
  if(!(dx>0&&dy>0))return [] as {u:number;v:number}[];
  const samples:{u:number;v:number}[]=[];
  for(const wall of walls){
    const x1=num(wall.x1),y1=num(wall.y1),x2=num(wall.x2),y2=num(wall.y2);
    const length=Math.hypot(x2-x1,y2-y1);
    const steps=clamp(Math.ceil(length*3.2),4,28);
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      samples.push({
        u:(x1+(x2-x1)*t-minX)/dx,
        v:1-(y1+(y2-y1)*t-minY)/dy
      });
    }
  }
  return samples;
}

function localDarknessField(data:Uint8ClampedArray,w:number,h:number){
  const src=new Uint8Array(w*h);
  for(let i=0,p=0;i<data.length;i+=4,p++){
    const r=data[i],g=data[i+1],b=data[i+2];
    const lum=.2126*r+.7152*g+.0722*b;
    src[p]=Math.round(clamp((205-lum)/165,0,1)*255);
  }
  const tmp=new Uint8Array(w*h);
  const out=new Uint8Array(w*h);
  const radius=2;
  for(let y=0;y<h;y++){
    const row=y*w;
    for(let x=0;x<w;x++){
      let m=0;
      for(let k=-radius;k<=radius;k++){
        const xx=x+k;
        if(xx>=0&&xx<w)m=Math.max(m,src[row+xx]);
      }
      tmp[row+x]=m;
    }
  }
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let m=0;
      for(let k=-radius;k<=radius;k++){
        const yy=y+k;
        if(yy>=0&&yy<h)m=Math.max(m,tmp[yy*w+x]);
      }
      out[y*w+x]=m;
    }
  }
  return out;
}

function scoreAlignment(
  field:Uint8Array,w:number,h:number,
  samples:{u:number;v:number}[],
  a:{left:number;top:number;width:number;height:number}
){
  let sum=0,inside=0;
  for(const s of samples){
    const x=Math.round((a.left+s.u*a.width)*w);
    const y=Math.round((a.top+s.v*a.height)*h);
    if(x<0||x>=w||y<0||y>=h)continue;
    sum+=field[y*w+x];
    inside++;
  }
  if(inside<samples.length*.82)return -1;
  return sum/inside;
}

function autoAlign(
  field:Uint8Array,w:number,h:number,
  samples:{u:number;v:number}[]
):Alignment|null{
  if(samples.length<20)return null;

  let best={left:.055,top:.045,width:.89,height:.91,score:-1};

  // بحث أول واسع: مستقل في X/Y حتى يصحّح القصّ أو اختلاف نسبة الصورة.
  for(let left=-.01;left<=.161;left+=.028){
    for(let top=-.01;top<=.161;top+=.028){
      for(let width=.76;width<=1.001;width+=.04){
        for(let height=.76;height<=1.001;height+=.04){
          const score=scoreAlignment(field,w,h,samples,{left,top,width,height});
          if(score>best.score)best={left,top,width,height,score};
        }
      }
    }
  }

  // تحسين دقيق حول أفضل حل.
  for(const step of [.012,.004]){
    const start={...best};
    for(let dl=-3;dl<=3;dl++){
      for(let dt=-3;dt<=3;dt++){
        for(let dw=-3;dw<=3;dw++){
          for(let dh=-3;dh<=3;dh++){
            const candidate={
              left:start.left+dl*step,
              top:start.top+dt*step,
              width:start.width+dw*step,
              height:start.height+dh*step
            };
            if(candidate.width<.62||candidate.width>1.08||candidate.height<.62||candidate.height>1.08)continue;
            const score=scoreAlignment(field,w,h,samples,candidate);
            if(score>best.score)best={...candidate,score};
          }
        }
      }
    }
  }

  return best.score>18?best:null;
}

export default function PlanReading({
  imageUrl,
  analysis,
  rooms,
  uploadId,
  onReviewSaved,
  onDoorsDetected,
  detectedDoors,
}: {
  imageUrl: string;
  analysis: any;
  rooms: RoomBox[];
  uploadId: string;
  onReviewSaved: (review: PlanReview) => void;
  onDoorsDetected: (doors: any[]) => void;
  detectedDoors: DetectedDoor[];
}) {
  const scanProject = analysis?.scan?.project || {};
  const scale = scanProject?.scanScale || {};
  const plan = analysis?.ifcPlan || null;
  const walls = Array.isArray(plan?.walls) ? plan.walls : [];
  const openings = Array.isArray(plan?.openings) ? plan.openings : [];
  const scanCounts =
    analysis?.scanCounts || scanProject?.scanProgress?.counts || {};
  const ifcCounts = analysis?.ifcCounts || {};
  const inferredRooms = Array.isArray(analysis?.inferredRooms)
    ? analysis.inferredRooms
    : [];

  const [selected, setSelected] = useState<any>(null);
  const [zoom, setZoom] = useState(1);
  const [showOverlay, setShowOverlay] = useState(true);
  const [rasterSize, setRasterSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [alignment, setAlignment] = useState<Alignment | null>(null);
  const [aligning, setAligning] = useState(walls.length > 0);
  const [alignError, setAlignError] = useState(false);
  const [detectingDoors, setDetectingDoors] = useState(false);

  const imageWidth = rasterSize?.width || num(scale.imageWidth) || 1000;
  const imageHeight = rasterSize?.height || num(scale.imageHeight) || 1400;

  const [addMode, setAddMode] = useState<"door" | "window" | null>(null);
  const [editName, setEditName] = useState("");
  const [editWidth, setEditWidth] = useState("0.9");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const combinedOpenings = mergeOpenings(walls, openings, detectedDoors, analysis?.reviewRemoved || []);
  const supplementalDoors = combinedOpenings.filter(o => !openings.some((p: any) => openingKey(p) === openingKey(o)));
  async function saveCorrection(action: any) {
    if (saving) return;
    setSaving(true); setEditError("");
    try {
      const response = await fetch(`/api/uploads/${uploadId}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action) });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "تعذر حفظ التصحيح.");
      onReviewSaved(body.review); setSelected(null); setAddMode(null);
    } catch (error) { setEditError(error instanceof Error ? error.message : "تعذر حفظ التصحيح."); }
    finally { setSaving(false); }
  }

  const providerDoorCount =
    openings.filter((o: any) => o.kind === "door").length ||
    num(ifcCounts.doors) ||
    num(scanCounts.doors);
  const doorCount = combinedOpenings.filter(o => o.kind === "door").length;
  const windowCount = combinedOpenings.filter(o => o.kind === "window").length;
  const wallCount =
    walls.length || num(ifcCounts.walls) || num(scanCounts.walls);
  const roomCount =
    inferredRooms.length || rooms.length || num(ifcCounts.spaces);

  const bounds = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const w of walls) {
      for (const x of [num(w.x1), num(w.x2)]) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
      for (const y of [num(w.y1), num(w.y2)]) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    return {
      minX,
      minY,
      maxX,
      maxY,
      valid:
        walls.length > 0 && Number.isFinite(minX) && maxX > minX && maxY > minY,
    };
  }, [walls]);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    if (!bounds.valid || !imageUrl) {
      setAligning(false);
      return;
    }

    setAligning(true);
    setAlignError(false);
    setAlignment(null);

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const naturalW = img.naturalWidth || num(scale.imageWidth) || 1000;
      const naturalH = img.naturalHeight || num(scale.imageHeight) || 1400;
      setRasterSize({ width: naturalW, height: naturalH });

      const maxSide = 720;
      const ratio = Math.min(1, maxSide / Math.max(naturalW, naturalH));
      const w = Math.max(1, Math.round(naturalW * ratio));
      const h = Math.max(1, Math.round(naturalH * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setAlignError(true);
        setAligning(false);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h).data;
      const field = localDarknessField(pixels, w, h);
      const samples = buildWallSamples(
        walls,
        bounds.minX,
        bounds.minY,
        bounds.maxX,
        bounds.maxY,
      );

      setTimeout(async () => {
        if (cancelled) return;
        const result = autoAlign(field, w, h, samples);
        if (result) {
          setAlignment(result);
          try {
            localStorage.setItem(
              "bayti-overlay-v3:" + imageUrl,
              JSON.stringify(result),
            );
          } catch {}

          setDetectingDoors(true);
          try {
            // Alignment stays fast at 720px; arc evidence retains fine strokes.
            const detailRatio = Math.min(1, 1600 / Math.max(naturalW, naturalH));
            const detail = document.createElement("canvas");
            detail.width = Math.round(naturalW * detailRatio);
            detail.height = Math.round(naturalH * detailRatio);
            const detailContext = detail.getContext("2d", { willReadFrequently: true });
            if (!detailContext) throw new Error("canvas unavailable");
            detailContext.drawImage(img, 0, 0, detail.width, detail.height);
            const doors = await detectDoorsInWorker({
              pixels: detailContext.getImageData(0, 0, detail.width, detail.height).data,
              width: detail.width,
              height: detail.height,
              alignment: result,
              bounds: {
                minX: bounds.minX,
                minY: bounds.minY,
                maxX: bounds.maxX,
                maxY: bounds.maxY,
              },
              walls,
              knownOpenings: openings,
            }, abortController.signal);
            if (!cancelled) {
              const savedResponse = await fetch(`/api/uploads/${uploadId}/doors`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ doors }),
              });
              const saved = await savedResponse.json();
              if (!savedResponse.ok || !saved.ok) throw new Error("لم نتمكن من حفظ اقتراحات الأبواب. أعد المحاولة قبل فتح 3D.");
              if (!cancelled) onDoorsDetected(saved.doors);

            }
          } catch (error) {
            if (!cancelled) setEditError(error instanceof Error ? error.message : "تعذر قراءة الأبواب.");
          } finally {
            if (!cancelled) setDetectingDoors(false);
          }
        } else {
          setAlignError(true);
        }
        setAligning(false);
      }, 20);
    };
    img.onerror = () => {
      if (!cancelled) {
        setAlignError(true);
        setAligning(false);
      }
    };
    img.src = imageUrl;

    try {
      const cached = localStorage.getItem("bayti-overlay-v3:" + imageUrl);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          parsed &&
          Number.isFinite(parsed.left) &&
          Number.isFinite(parsed.width)
        )
          setAlignment(parsed);
      }
    } catch {}

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [
    imageUrl,
    uploadId,
    walls,
    openings,
    bounds.valid,
    bounds.minX,
    bounds.minY,
    bounds.maxX,
    bounds.maxY,
    scale.imageWidth,
    scale.imageHeight,
  ]);

  const hasIfc = bounds.valid;
  const active = alignment;
  const tx = (x: number) => {
    if (!active || !hasIfc) return 0;
    const u = (x - bounds.minX) / (bounds.maxX - bounds.minX);
    return (active.left + u * active.width) * imageWidth;
  };
  const ty = (y: number) => {
    if (!active || !hasIfc) return 0;
    const v = 1 - (y - bounds.minY) / (bounds.maxY - bounds.minY);
    return (active.top + v * active.height) * imageHeight;
  };
  const pxPerMeter =
    active && hasIfc
      ? ((active.width * imageWidth) / (bounds.maxX - bounds.minX) +
          (active.height * imageHeight) / (bounds.maxY - bounds.minY)) /
        2
      : 0;

  const wallById = new Map<number, any>();
  walls.forEach((w: any) => wallById.set(w.entityId, w));

  return (
    <section className="readingCard">
      <div className="readingHead">
        <div>
          <span className="kicker">قراءة المخطط</span>
          <h2>ملامح منزلك</h2>
          <p>راجع المساحات والفتحات على مخططك الأصلي.</p>
        </div>
        <div className="readingStatus">
          {aligning
            ? "جارٍ ضبط المحاذاة…"
            : alignError
              ? "المحاذاة تحتاج مراجعة"
              : analysis?.scanStatus === "ready"
                ? "✓ المحاذاة جاهزة — راجع التفاصيل"
                : "نستكمل تفاصيل المنزل"}
        </div>
      </div>

      <div className="readingStats" aria-label="نتائج قراءة المخطط">
        <div>
          <span>الغرف/الفراغات</span>
          <b>{roomCount}</b>
        </div>
        <div>
          <span>الجدران</span>
          <b>{wallCount}</b>
        </div>
        <div>
          <span>الأبواب</span>
          <b>{doorCount}</b>
        </div>
        <div>
          <span>النوافذ</span>
          <b>{windowCount}</b>
        </div>
      </div>

      <div className="bt-plan-tools">
        <button
          aria-pressed={showOverlay}
          onClick={() => setShowOverlay((v) => !v)}
        >
          {showOverlay ? "إخفاء التحديد" : "إظهار التحديد"}
        </button>
        <button
          aria-label="تقريب المخطط"
          onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
        >
          +
        </button>
        <button
          aria-label="إبعاد المخطط"
          onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
        >
          −
        </button>
        <button onClick={() => setZoom(1)}>إعادة ضبط</button>
        <button disabled={!active || saving} aria-pressed={addMode === "door"} onClick={() => { setAddMode("door"); setSelected(null); setEditError(""); setShowOverlay(true); }}>إضافة باب</button>
        <button disabled={!active || saving} aria-pressed={addMode === "window"} onClick={() => { setAddMode("window"); setSelected(null); setEditError(""); setShowOverlay(true); }}>إضافة نافذة</button>
      </div>
      {addMode && <p className="bt-muted" role="status">اضغط على منتصف {addMode === "door" ? "الباب" : "النافذة"} على الجدار، ثم راجع العرض واحفظ. <button className="bt-text-button" onClick={() => { setAddMode(null); setSelected(null); }}>إلغاء</button></p>}
      {editError && <p className="bt-error" role="alert">{editError}</p>}
      <div className="planOverlayWrap">
        <svg
          viewBox={`0 0 ${imageWidth} ${imageHeight}`}
          className="planOverlaySvg"
          style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
          preserveAspectRatio="xMidYMid meet"
          onClickCapture={(event) => {
            if (!addMode || !active || saving) return;
            event.stopPropagation();
            const svg = event.currentTarget;
            const matrix = svg.getScreenCTM();
            if (!matrix) return;
            const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
            const x = bounds.minX + (point.x / imageWidth - active.left) / active.width * (bounds.maxX - bounds.minX);
            const y = bounds.maxY - (point.y / imageHeight - active.top) / active.height * (bounds.maxY - bounds.minY);
            const nearest = openingHostAt(walls, x, y);
            if (!nearest || nearest.distance > .65) { setEditError("اضغط بالقرب من الجدار الذي تقع عليه الفتحة."); return; }
            setEditError(""); setEditWidth(nearest.wall.source === "user-confirmed-gap" ? Math.hypot(nearest.wall.x2-nearest.wall.x1, nearest.wall.y2-nearest.wall.y1).toFixed(3) : addMode === "door" ? "0.9" : "1.2");
            setSelected({ draft: { kind: addMode, wallEntityId: nearest.wall.entityId, position: nearest.position, point: { x, y }, host: nearest.wall }, name: addMode === "door" ? "باب جديد" : "نافذة جديدة", detail: "راجع العرض قبل الحفظ. سيظهر التصحيح في المخطط و3D." });
          }}
        >
          <image
            href={imageUrl}
            x="0"
            y="0"
            width={imageWidth}
            height={imageHeight}
            opacity="0.64"
          />

          {showOverlay &&
            active &&
            hasIfc &&
            inferredRooms.map((room: any, i: number) => {
              const points = Array.isArray(room?.polygon) ? room.polygon : [];
              if (points.length < 3) return null;
              const pts = points
                .map(
                  (p: any) => String(tx(num(p.x))) + "," + String(ty(num(p.y))),
                )
                .join(" ");
              const cx = tx(num(room?.center?.x));
              const cy = ty(num(room?.center?.y));
              return (
                <g
                  key={room.id || i}
                  onClick={() => {
                    setEditName(room.name || ""); setEditError("");
                    setSelected({ roomId: String(room.id), name: room.name || "غرفة " + (i + 1), detail: Number(room.areaM2 || 0).toFixed(1) + " م²" });
                  }}
                >
                  <polygon
                    points={pts}
                    fill="rgba(126,144,114,.08)"
                    stroke="rgba(126,144,114,.38)"
                    strokeWidth={1.5}
                  />
                  <rect
                    x={cx - (room.name ? Math.max(84, room.name.length * 8) : 84) / 2}
                    y={cy - 15}
                    width={room.name ? Math.max(84, room.name.length * 8) : 84}
                    height={30}
                    rx={9}
                    fill="rgba(21,28,34,.82)"
                  />
                  <text
                    x={cx}
                    y={cy + 5}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={13}
                    fontWeight="700"
                  >
                    {room.name || (room?.areaM2
                      ? Number(room.areaM2).toFixed(1) + " م²"
                      : "فراغ " + String(i + 1))}
                  </text>
                </g>
              );
            })}

          {showOverlay && !inferredRooms.length &&
            rooms.map((room, i) => {
              const x = (room.bbox.x / 1000) * imageWidth;
              const y = (room.bbox.y / 1000) * imageHeight;
              const w = (room.bbox.width / 1000) * imageWidth;
              const h = (room.bbox.height / 1000) * imageHeight;
              return (
                <g
                  key={`${room.name}-${i}`}
                  onClick={() =>
                    setSelected({
                      name: room.name,
                      detail: "المساحة تظهر عند توفر أبعاد الغرفة",
                    })
                  }
                >
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={8}
                    fill="rgba(89,180,221,.08)"
                    stroke="rgba(89,180,221,.34)"
                    strokeWidth={2}
                  />
                  <rect
                    x={x + 5}
                    y={y + 5}
                    width={Math.max(70, room.name.length * 13)}
                    height={28}
                    rx={8}
                    fill="rgba(21,28,34,.82)"
                  />
                  <text
                    x={x + 13}
                    y={y + 24}
                    fill="#fff"
                    fontSize={15}
                    fontWeight="700"
                  >
                    {room.name}
                  </text>
                </g>
              );
            })}

          {showOverlay &&
            active &&
            hasIfc &&
            walls.map((wall: any) => {
              const width = Math.max(3, num(wall.thickness) * pxPerMeter * 0.7);
              return (
                <line
                  onClick={() =>
                    setSelected({
                      name: "جدار",
                      detail:
                        Math.hypot(
                          wall.x2 - wall.x1,
                          wall.y2 - wall.y1,
                        ).toFixed(2) +
                        " م · السماكة " +
                        Number(wall.thickness || 0).toFixed(2) +
                        " م",
                    })
                  }
                  key={wall.entityId}
                  x1={tx(num(wall.x1))}
                  y1={ty(num(wall.y1))}
                  x2={tx(num(wall.x2))}
                  y2={ty(num(wall.y2))}
                  stroke="#7e9072"
                  strokeWidth={width}
                  strokeLinecap="square"
                  opacity=".92"
                />
              );
            })}

          {showOverlay &&
            active &&
            hasIfc &&
            openings.map((opening: any, i: number) => {
              const host = wallById.get(opening.wallEntityId);
              if (!host) return null;
              const t = Math.max(0, Math.min(1, num(opening.position)));
              const x = num(host.x1) + (num(host.x2) - num(host.x1)) * t;
              const y = num(host.y1) + (num(host.y2) - num(host.y1)) * t;
              const color =
                opening.kind === "door"
                  ? "#f1d28f"
                  : opening.kind === "window"
                    ? "#071729"
                    : "#f4c95d";
              const radius = Math.max(4, imageWidth * 0.006);
              return (
                <circle
                  onClick={() =>
                    setSelected({
                      opening,
                      name: opening.kind === "door" ? "باب" : "نافذة",
                      detail:
                        "العرض " +
                        Number(opening.widthM || 0).toFixed(2) +
                        " م · الجدار " +
                        opening.wallEntityId,
                    })
                  }
                  key={i}
                  cx={tx(x)}
                  cy={ty(y)}
                  r={radius}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              );
            })}

          {showOverlay &&
            active &&
            hasIfc &&
            supplementalDoors.map((door: any, i: number) => {
              const host = wallById.get(Number(door.wallEntityId));
              if (!host) return null;
              const t = Math.max(0, Math.min(1, num(door.position)));
              const x = num(host.x1) + (num(host.x2) - num(host.x1)) * t;
              const y = num(host.y1) + (num(host.y2) - num(host.y1)) * t;
              const r = Math.max(5, imageWidth * 0.007);
              return (
                <g key={`door-${door.wallEntityId}-${i}`} onClick={() => setSelected({ opening: door, name: "باب مقترح", detail: "راجع موضع الباب قبل اعتماد النموذج." })}>
                  <circle
                    cx={tx(x)}
                    cy={ty(y)}
                    r={r}
                    fill="#f1d28f"
                    stroke="#3b3023"
                    strokeWidth={1.5}
                  />
                  <text
                    x={tx(x)}
                    y={ty(y) + 4}
                    textAnchor="middle"
                    fill="#33281c"
                    fontSize={Math.max(9, r * 0.95)}
                    fontWeight="800"
                  >
                    D
                  </text>
                </g>
              );
            })}
          {selected?.draft && active && (() => {
            const wall = wallById.get(selected.draft.wallEntityId) || selected.draft.host;
            if (!wall) return null;
            const t = selected.draft.position;
            return <circle cx={tx(wall.x1 + (wall.x2 - wall.x1) * t)} cy={ty(wall.y1 + (wall.y2 - wall.y1) * t)} r={imageWidth * .014} fill="none" stroke="#b27633" strokeWidth={3} />;
          })()}
        </svg>

        {aligning && (
          <div className="overlayAlignNotice">
            جارٍ مطابقة الجدران مع صورة المخطط…
          </div>
        )}
        {detectingDoors && !aligning && (
          <div className="overlayAlignNotice">
            جارٍ قراءة أقواس الأبواب من المخطط…
          </div>
        )}
        {alignError && (
          <div className="overlayAlignNotice error">
            هذا الجزء من المخطط يحتاج مراجعة. جرّب نسخة أوضح لإظهار التحديد
            بدقة.
          </div>
        )}
      </div>

      <div className="readingLegend">
        <span>
          <i className="legendWall" />
          جدار
        </span>
        <span>
          <i className="legendDoor" />
          باب
        </span>
        <span>
          <i className="legendWindow" />
          نافذة
        </span>
        <span>
          <i className="legendRoom" />
          غرفة
        </span>
      </div>

      {selected && (
        <div className="bt-map-detail bt-plan-edit" role="region" aria-label="تصحيح العنصر">
          <b>{selected.name}</b>
          <span>{selected.detail}</span>
          {selected.roomId && <form onSubmit={e => { e.preventDefault(); void saveCorrection({ type: "room", roomId: selected.roomId, name: editName }); }}>
            <label>اسم الغرفة <input value={editName} maxLength={80} required onChange={e => setEditName(e.target.value)} placeholder="مثال: مجلس النساء" /></label>
            <button className="bt-button" disabled={saving}>{saving ? "نحفظ…" : "حفظ الاسم"}</button>
          </form>}
          {selected.draft && <form onSubmit={e => { e.preventDefault(); void saveCorrection({ type: "opening", opening: { ...selected.draft, widthM: Number(editWidth) } }); }}>
            <label>العرض بالمتر <input type="number" min="0.4" max="4" step="0.001" required value={editWidth} onChange={e => setEditWidth(e.target.value)} /></label>
            <button className="bt-button" disabled={saving}>{saving ? "نحفظ…" : "حفظ الفتحة"}</button>
          </form>}
          {selected.opening && <button className="bt-text-button" disabled={saving} onClick={() => void saveCorrection({ type: "remove", key: openingKey(selected.opening) })}>ليست فتحة — إزالة</button>}
          <button aria-label="إغلاق التفاصيل" onClick={() => setSelected(null)}>
            ×
          </button>
        </div>
      )}
    </section>
  );
}
