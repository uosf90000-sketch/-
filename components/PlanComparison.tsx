"use client";
import { useEffect, useState } from "react";
import { imagePoint, roomLabel, validSection, type ComparisonPlan, type Section } from "@/lib/tectly/geometry";
import type { PlanReview } from "@/lib/plan-review";

type State = { stage: string; results: ComparisonPlan[]; error?: string; completedPlans: number; planCount: number };
export default function PlanComparison({ id, extension, analysis, alignment, configured, onReviewSaved, currentOpenings = [] }: {
  id: string; extension: string; analysis: any; alignment: Section | null; configured: boolean;
  onReviewSaved: (review: PlanReview) => void; currentOpenings?: any[];
}) {
  const [state, setState] = useState<State | null>(null), [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [connection, setConnection] = useState<"idle" | "connected" | "failed">("idle");
  const [consent, setConsent] = useState(false), [aligned, setAligned] = useState(false), [paused, setPaused] = useState(false);
  const [fusionReview, setFusionReview] = useState<{ id: string; reason: string }[]>([]);
  const [zoom, setZoom] = useState(1);
  const [index, setIndex] = useState(0), [layer, setLayer] = useState<"both" | "bimy" | "tectly">("both");
  const [size, setSize] = useState({ width: 1000, height: 1400 });
  const [selected, setSelected] = useState<{ kind: "opening" | "room"; id: string; label: string } | null>(null);
  const raster = ["png", "jpg", "jpeg", "webp"].includes(extension);
  const supported = raster || extension === "pdf";
  const image = `/api/uploads/${id}/file`;
  const endpoint = `/api/uploads/${id}/tectly`;
  useEffect(() => {
    let live = true;
    setLoaded(false); setState(null); setSelected(null); setIndex(0); setZoom(1); setPaused(false);
    fetch(endpoint).then(r => r.json()).then(body => { if (live && body.ok) setState(body.state); }).catch(() => { if (live) setError("تعذر استعادة المقارنة. حدّث الصفحة قبل تشغيل قراءة جديدة."); }).finally(() => { if (live) setLoaded(true); });
    if (raster) { const img = new Image(); img.onload = () => { if (live) setSize({ width: img.naturalWidth, height: img.naturalHeight }); }; img.src = image; }
    return () => { live = false; };
  }, [endpoint, image, raster]);
  useEffect(() => { setAligned(false); }, [alignment?.left, alignment?.top, alignment?.width, alignment?.height, index]);
  useEffect(() => {
    if (state?.stage !== "processing" || paused) return;
    let live = true, timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController(), started = Date.now();
    const tick = async () => {
      try {
        const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "poll" }), signal: controller.signal });
        const body = await response.json();
        if (!live) return;
        if (!response.ok || !body.ok) throw new Error(body.error || "تعذر استكمال القراءة الإضافية.");
        setState(body.state);
        if (body.state.stage === "processing" && Date.now() - started < 600000) timer = setTimeout(tick, 3000);
        else if (body.state.stage === "processing") setPaused(true);
      } catch (e) { if (live) { setError(e instanceof Error ? e.message : "تعذر استكمال القراءة."); setPaused(true); } }
    };
    timer = setTimeout(tick, 1500);
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, [endpoint, state?.stage, paused]);
  async function checkConnection() {
    setBusy(true); setError("");
    try { const r = await fetch("/api/tectly/check"); const body = await r.json(); if (!r.ok || !body.ok) throw new Error(body.error || "تعذر اختبار الاتصال."); setConnection("connected"); }
    catch (e) { setConnection("failed"); setError(e instanceof Error ? e.message : "تعذر اختبار الاتصال."); }
    finally { setBusy(false); }
  }
  async function run(action: "start" | "poll") {
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, confirmUsage: action === "start" && consent }) });
      const body = await r.json(); if (!r.ok || !body.ok) throw new Error(body.error || "تعذر تشغيل القراءة الإضافية.");
      setState(body.state); setPaused(false);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تشغيل القراءة الإضافية."); }
    finally { setBusy(false); }
  }
  async function fuse() {
    if (!plan || !alignment || !aligned || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "fuse", planId: plan.id, alignment, alignmentConfirmed: true }) });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || "تعذر دمج القراءتين.");
      onReviewSaved(body.review);
      setMessage(`تم الدمج: أضفنا ${body.report.added} فتحة و${body.report.named} اسم غرفة. ${body.report.matched} فتحة متطابقة، و${body.report.review.length} عنصر يحتاج مراجعة. بقيت الفتحات الحالية محفوظة.`);
      setFusionReview(body.report.review);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر الدمج."); }
    finally { setBusy(false); }
  }
  async function adopt() {
    if (!selected || !plan || !alignment || !aligned) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "adopt", planId: plan.id, element: { kind: selected.kind, id: selected.id }, alignment, alignmentConfirmed: aligned }) });
      const body = await r.json(); if (!r.ok || !body.ok) throw new Error(body.error || "تعذر اعتماد العنصر.");
      onReviewSaved(body.review); setMessage("حُفظ التصحيح في مخططك ونموذج 3D."); setSelected(null);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر اعتماد العنصر."); }
    finally { setBusy(false); }
  }
  const plan = state?.results[index];
  const walls = analysis?.ifcPlan?.walls || [];
  const xs = walls.flatMap((w: any) => [w.x1, w.x2]), ys = walls.flatMap((w: any) => [w.y1, w.y2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const canAlign = raster && validSection(alignment) && maxX > minX && maxY > minY;
  const width = raster ? size.width : 1000, height = raster ? size.height : 1000;
  const currentPoint = (x: number, y: number) => [(alignment!.left + (x - minX) / (maxX - minX) * alignment!.width) * width, (alignment!.top + (1 - (y - minY) / (maxY - minY)) * alignment!.height) * height];
  const tectlyPoint = (p: [number, number]) => { const [x, y] = imagePoint(p, raster ? plan!.section : { left: 0, top: 0, width: 1, height: 1 }); return [x * width, y * height]; };
  if (!supported) return null;
  return <section className="bt-comparison" aria-labelledby="comparison-title">
    <div className="bt-comparison-head"><div><span className="bt-eyebrow">رؤية ثانية لمخططك</span><h2 id="comparison-title">قارن القراءة، ثم اعتمد التفاصيل.</h2><p>قراءة إضافية تساعدك على مراجعة الأبواب والنوافذ وأسماء المساحات على الصورة.</p></div>
      <button className="bt-button secondary" onClick={checkConnection} disabled={busy || !configured}>{connection === "connected" ? "✓ الاتصال جاهز" : "فحص الاتصال"}</button>
    </div>
    {!configured && <p className="bt-muted">القراءة الإضافية غير مفعّلة. تحقق من إضافة بيانات Tectly إلى خدمة بيتي الحالية.</p>}
    {error && <p className="bt-error" role="alert">{error}</p>}
    {state?.error && <p className="bt-error" role="alert">{state.error}</p>}
    {message && <p role="status">{message}</p>}
    {!loaded ? <p role="status">نستعيد القراءة الإضافية…</p> : !state ? <div className="bt-comparison-start">
      <label className="bt-comparison-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />أوافق على تشغيل قراءة Tectly لهذا الملف من رصيد حسابي. قد يحتوي PDF على أكثر من مخطط.</label>
      <button className="bt-button" disabled={!configured || !consent || busy} onClick={() => void run("start")}>{busy ? "نرسل المخطط…" : "ابدأ القراءة الإضافية"}</button>
    </div> : ["creating", "uploading", "processing", "uncertain"].includes(state.stage) && <div className="bt-comparison-progress" role="status">
      <b>{state.stage === "uncertain" ? "نتحقق من وصول المخطط" : "نكتشف تفاصيل إضافية…"}</b>
      <p>{state.planCount ? `اكتملت قراءة ${state.completedPlans} من ${state.planCount} مخططات.` : "ننتظر تحديد المخطط والمساحات. يمكنك العودة إلى المشروع وسيبقى تقدم القراءة محفوظًا."}</p>
      {(paused || state.stage !== "processing") && <button className="bt-button secondary" disabled={busy} onClick={() => void run("poll")}>استكمال الطلب الحالي</button>}
    </div>}
    {plan && <>
      <div className="bt-comparison-tools">
        {state!.results.length > 1 && <label>المخطط <select value={index} onChange={e => { setIndex(Number(e.target.value)); setZoom(1); setSelected(null); }}>{state!.results.map((p, i) => <option key={p.id} value={i}>صفحة {p.pageNumber + 1} · مخطط {i + 1}</option>)}</select></label>}
        {canAlign && <div className="bt-segment" aria-label="القراءة المعروضة">{([['bimy', 'الحالية'], ['tectly', 'الإضافية'], ['both', 'معًا']] as const).map(([value, label]) => <button key={value} aria-pressed={layer === value} onClick={() => setLayer(value)}>{label}</button>)}</div>}
        <div className="bt-segment"><button aria-label="تكبير المقارنة" onClick={() => setZoom(v => Math.min(3, v + .5))}>+</button><button aria-label="تصغير المقارنة" onClick={() => setZoom(v => Math.max(1, v - .5))}>−</button><button onClick={() => setZoom(1)}>ضبط</button></div>
        <span className="bt-comparison-legend"><i />BIMy <i />Tectly</span>
      </div>
      <div className="bt-comparison-counts">{walls.length > 0 && <span>المحفوظ في منزلي و3D: <b>{currentOpenings.filter(o => o.kind === "door").length}</b> باب · <b>{currentOpenings.filter(o => o.kind === "window").length}</b> نافذة</span>}<span>القراءة الإضافية: <b>{plan.walls.length}</b> جدار · <b>{plan.openings.filter(o => o.kind === "door").length}</b> باب · <b>{plan.openings.filter(o => o.kind === "window").length}</b> نافذة · <b>{plan.rooms.length}</b> مساحة</span><small>الأعداد للمراجعة؛ صحة الموضع أهم من زيادة العدد.</small></div>
      <div className="bt-comparison-canvas"><svg viewBox={`0 0 ${width} ${height}`} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} aria-label="مقارنة القراءتين فوق المخطط">
        {raster && <image href={image} width={width} height={height} opacity=".7" />}
        {canAlign && layer !== "tectly" && walls.map((wall: any) => { const a = currentPoint(wall.x1, wall.y1), b = currentPoint(wall.x2, wall.y2); return <line key={wall.entityId} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#4b543e" strokeWidth={3} vectorEffect="non-scaling-stroke" />; })}
        {canAlign && layer !== "tectly" && currentOpenings.map((o: any, i: number) => { const w = walls.find((w: any) => w.entityId === o.wallEntityId); if (!w) return null; const p = currentPoint(w.x1 + (w.x2-w.x1)*o.position, w.y1 + (w.y2-w.y1)*o.position); return <circle key={i} cx={p[0]} cy={p[1]} r={width*.006} fill="#4b543e" stroke="white" />; })}
        {(!canAlign || layer !== "bimy") && <>
          {plan.rooms.map(room => { const points = room.boundary.map(tectlyPoint); const cx = points.reduce((v, p) => v + p[0], 0) / points.length, cy = points.reduce((v, p) => v + p[1], 0) / points.length; const choose = () => { setSelected({ kind: "room", id: room.id, label: roomLabel(room) + (room.caption ? "" : " (تصنيف)") }); setError(""); setMessage(""); }; return <g key={room.id} tabIndex={0} role="button" aria-label={`مراجعة اسم ${roomLabel(room)}`} onClick={choose} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } }}><polygon points={points.map(p => p.join(",")).join(" ")} fill={selected?.id === room.id ? "#37779735" : "#3777970a"} /><text x={cx} y={cy} fontSize={width*.015} textAnchor="middle" fill="#19445d" stroke="white" strokeWidth={width*.003} paintOrder="stroke">{roomLabel(room)}</text></g>; })}
          {plan.walls.map(wall => <polygon key={wall.id} points={wall.boundary.map(tectlyPoint).map(p => p.join(",")).join(" ")} fill="#37779724" stroke="#377797" strokeWidth={1.3} vectorEffect="non-scaling-stroke" pointerEvents="none" />)}
          {plan.openings.map(o => { const from = tectlyPoint(o.from), to = tectlyPoint(o.to); const choose = () => { setSelected({ kind: "opening", id: o.id, label: o.kind === "door" ? "باب" : "نافذة" }); setError(""); setMessage(""); }; return <g key={o.id} tabIndex={0} role="button" aria-label={`مراجعة ${o.kind === "door" ? "باب" : "نافذة"}`} onClick={choose} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } }}><line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="transparent" strokeWidth={24} vectorEffect="non-scaling-stroke" /><line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={selected?.id === o.id ? "#a96221" : o.kind === "door" ? "#a16c34" : "#206b94"} strokeWidth={5} vectorEffect="non-scaling-stroke" /><circle cx={(from[0]+to[0])/2} cy={(from[1]+to[1])/2} r={width*.007} fill="white" stroke="#206b94" /></g>; })}
        </>}
      </svg></div>
      {plan.warnings.map((warning, i) => <p className="bt-muted" key={i}>{warning}</p>)}
      {canAlign ? <label className="bt-comparison-check"><input type="checkbox" checked={aligned} onChange={e => setAligned(e.target.checked)} />راجعت الجدران الحالية وتأكدت من تطابقها مع صورة المخطط.</label> : <p className="bt-muted">{raster ? "أكمل قراءة المخطط الحالية ومحاذاته أولًا لتتمكن من اعتماد العناصر في 3D." : "هذه معاينة مستقلة لصفحة PDF. نقل العناصر إلى النموذج متاح للصور حاليًا."}</p>}
      <div className="bt-comparison-start">
        <p>ادمج العناصر الناقصة في مخططك و3D. نحافظ على الفتحات الحالية، ونترك اختلاف النوع أو العرض للمراجعة. يستخدم الدمج النتائج المحفوظة دون إرسال قراءة جديدة.</p>
        <button className="bt-button" disabled={!canAlign || !aligned || busy} onClick={fuse}>{busy ? "نعالج الطلب…" : "دمج القراءتين في منزلي"}</button>
        {!!fusionReview.length && <details><summary>{fusionReview.length} عنصر يحتاج مراجعة</summary><ul>{fusionReview.map((item, i) => <li key={item.id}><button className="bt-text-button" onClick={() => { const opening = plan.openings.find(o => o.id === item.id); if (opening) setSelected({ kind: "opening", id: item.id, label: opening.kind === "door" ? "باب" : "نافذة" }); }}>{i + 1}. {item.reason}</button></li>)}</ul></details>}
      </div>
      {selected ? <div className="bt-comparison-selection"><div><b>{selected.label}</b><p>{selected.kind === "room" ? "اعتماد الاسم ينقله إلى المساحة المطابقة في مخططك." : "سنتحقق من تطابق الفتحة مع الجدار قبل حفظها. الموضع المتداخل سيُعامل كتصحيح."}</p></div><button className="bt-button" disabled={!canAlign || !aligned || busy} onClick={adopt}>{busy ? "نحفظ…" : selected.kind === "room" ? "اعتماد الاسم" : "اعتماد الفتحة"}</button><button className="bt-text-button" onClick={() => setSelected(null)}>إلغاء</button></div> : <p className="bt-muted">اضغط على فتحة أو اسم غرفة في القراءة الإضافية لمراجعته واعتماده.</p>}
    </>}
  </section>;
}
