"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const RealHouse3D=dynamic(()=>import("@/components/RealHouse3D"),{ssr:false});

function fmt(n:any,d=1){
  return typeof n==="number"&&Number.isFinite(n)?n.toFixed(d):"—";
}

export default function Real3DPage(){
  const params=useParams<{id:string}>();
  const id=params?.id;
  const [analysis,setAnalysis]=useState<any>(null);
  const [design,setDesign]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [mode,setMode]=useState<"overview"|"tour">("overview");
  const [autoplay,setAutoplay]=useState(false);
  const [selected,setSelected]=useState<any>(null);
  const [doors,setDoors]=useState<any[]>([]);
  const [showStats,setShowStats]=useState(true);

  useEffect(()=>{
    if(!id)return;
    Promise.all([
      fetch("/api/uploads/"+id+"/analysis").then(async r=>r.ok?await r.json():null),
      fetch("/api/uploads/"+id+"/design").then(async r=>r.ok?await r.json():null),
      fetch("/api/uploads/"+id+"/doors").then(async r=>r.ok?await r.json():null)
    ]).then(([a,d,doorSaved])=>{
      if(a?.ok)setAnalysis(a.analysis);
      if(d?.ok)setDesign(d.design);
      if(Array.isArray(doorSaved?.doors?.doors))setDoors(doorSaved.doors.doors);
    }).finally(()=>setLoading(false));
  },[id]);

  if(loading)return <main className="immersive3d loading"><div className="immersiveLoader"><i/><b>نجهّز بيتك</b><span>قراءة الهندسة وبناء المشهد…</span></div></main>;
  if(!analysis?.ifcPlan)return <main className="immersive3d empty"><div className="immersiveEmpty"><span>◇</span><h1>الـ3D غير جاهز بعد</h1><p>ارجع للمشروع وأكمل استخراج IFC.</p><Link href={"/project/"+id} className="studioPrimaryBtn">العودة للمشروع</Link></div></main>;

  const sceneDesign=design?.design?design:{design:{style:"هندسة IFC فقط",items:[],lighting:[],airConditioning:[]}};
  const wallCount=analysis.ifcPlan.walls?.length||0;
  const providerOpenings=analysis.ifcPlan.openings?.length||0;
  const roomCount=analysis.inferredRooms?.length||0;
  const furnitureCount=sceneDesign.design.items?.length||0;

  return <main className={"immersive3d "+mode}>
    <RealHouse3D
      analysis={analysis}
      design={sceneDesign}
      detectedDoors={doors}
      mode={mode}
      autoplay={autoplay}
      onSelect={setSelected}
    />

    <header className="viewerTopRail">
      <Link href={"/project/"+id} className="viewerBrand">
        <span className="viewerBrandMark">⌂</span>
        <span><b>بيتي</b><small>3D Studio</small></span>
      </Link>

      <div className="viewerModeSwitch">
        <button className={mode==="overview"?"active":""} onClick={()=>{setMode("overview");setAutoplay(false)}}>
          <span>◇</span> منظور علوي
        </button>
        <button className={mode==="tour"&&!autoplay?"active":""} onClick={()=>{setMode("tour");setAutoplay(false)}}>
          <span>⊙</span> مستوى العين
        </button>
        <button className={autoplay?"active":""} onClick={()=>{setMode("tour");setAutoplay(v=>!v)}}>
          <span>▶</span> {autoplay?"إيقاف الجولة":"جولة تلقائية"}
        </button>
      </div>

      <div className="viewerTopActions">
        <button onClick={()=>setShowStats(v=>!v)} className={showStats?"active":""}>⌘</button>
        <Link href={"/project/"+id} className="viewerExit">المشروع ←</Link>
      </div>
    </header>

    <div className="viewerStatusChip">
      <i/>
      <span>{design?.design?"تصميم داخلي مفروش":"وضع التحقق الهندسي"}</span>
      <em>·</em>
      <small>{doors.length} باب مكتشف بصريًا</small>
    </div>

    {mode==="tour"&&<div className="viewerCrosshair"><span/><i/></div>}

    <div className="viewerHint">
      <span className="viewerMouseIcon">⌖</span>
      <div><b>{mode==="tour"?"انظر حولك واضغط أي سطح":"دوّر البيت ثم اضغط أي عنصر"}</b><small>جدار · نافذة · باب · أرضية · أثاث</small></div>
    </div>

    <aside className={"viewerInspector "+(selected?"open":"")}>
      {selected?<>
        <button className="viewerInspectorClose" onClick={()=>setSelected(null)}>×</button>
        <div className="inspectorType"><i/>{selected.category||"عنصر"}</div>
        <h2>{selected.name||"عنصر من المنزل"}</h2>
        <p className="inspectorSource">المصدر: {selected.source||"بيتي"}</p>

        <div className="inspectorPreview">
          <div className={"surfacePreview "+(selected.type||"generic")}/>
          <span>سيظهر هنا المنتج الحقيقي من مكتبتك</span>
        </div>

        <div className="inspectorRows">
          {selected.type==="wall"&&<>
            <div><span>الطول</span><b>{fmt(selected.lengthM)} م</b></div>
            <div><span>الارتفاع</span><b>{fmt(selected.heightM)} م</b></div>
            <div><span>السماكة</span><b>{fmt(selected.thicknessM,2)} م</b></div>
          </>}
          {selected.type==="floor"&&<>
            <div><span>المساحة</span><b>{fmt(selected.areaM2)} م²</b></div>
            <div><span>المحيط</span><b>{fmt(selected.perimeterM)} م</b></div>
          </>}
          {(selected.type==="door"||selected.type==="window")&&<>
            <div><span>العرض</span><b>{fmt(selected.widthM)} م</b></div>
            <div><span>الارتفاع</span><b>{fmt(selected.heightM)} م</b></div>
            {selected.confidence&&<div><span>الثقة</span><b>{Math.round(selected.confidence*100)}%</b></div>}
          </>}
          {selected.material&&<div className="full"><span>الخامة</span><b>{selected.material}</b></div>}
          {selected.color&&<div><span>اللون</span><b>{selected.color}</b></div>}
          {selected.details&&<div className="full"><span>التفاصيل</span><b>{selected.details}</b></div>}
        </div>

        <div className="futureProductCard">
          <div><span>مكتبة بيتي</span><b>المنتج + السعر + الكمية</b></div>
          <small>سيتم تفعيلها عند إضافة مكتبتك.</small>
        </div>
      </>:<>
        <div className="inspectorIdleIcon">⌖</div>
        <h3>اختر عنصرًا من البيت</h3>
        <p>اضغط جدارًا أو نافذة أو بابًا أو أرضية لتظهر معلوماته هنا.</p>
      </>}
    </aside>

    {showStats&&<div className="viewerMetricsDock">
      <div><span>الجدران</span><b>{wallCount}</b><small>IFC</small></div>
      <div><span>الفتحات</span><b>{providerOpenings+doors.length}</b><small>BIM + Vision</small></div>
      <div><span>الفراغات</span><b>{roomCount}</b><small>Topology</small></div>
      <div><span>الأثاث</span><b>{furnitureCount}</b><small>{furnitureCount?"Designed":"بعد OpenAI"}</small></div>
    </div>}

    <div className="viewerBottomTools">
      <button title="المواد"><span>◫</span><small>المواد</small></button>
      <button title="الإضاءة"><span>☼</span><small>الإنارة</small></button>
      <button title="معلومات العنصر" className={selected?"active":""}><span>ⓘ</span><small>المعلومات</small></button>
      <button title="مستوى العين" className={mode==="tour"?"active":""} onClick={()=>setMode("tour")}><span>⊙</span><small>امشِ</small></button>
    </div>
  </main>;
}
