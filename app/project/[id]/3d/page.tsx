"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const RealHouse3D=dynamic(()=>import("@/components/RealHouse3D"),{ssr:false});

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

  useEffect(()=>{
    if(!id)return;
    Promise.all([
      fetch(`/api/uploads/${id}/analysis`).then(async r=>r.ok?await r.json():null),
      fetch(`/api/uploads/${id}/design`).then(async r=>r.ok?await r.json():null),
      fetch(`/api/uploads/${id}/doors`).then(async r=>r.ok?await r.json():null)
    ]).then(([a,d,doorSaved])=>{
      if(a?.ok)setAnalysis(a.analysis);
      if(d?.ok)setDesign(d.design);
      if(Array.isArray(doorSaved?.doors?.doors))setDoors(doorSaved.doors.doors);
    }).finally(()=>setLoading(false));
  },[id]);

  if(loading)return <main className="real3dPage"><div className="real3dLoading">جاري تجهيز المنزل ثلاثي الأبعاد…</div></main>;
  if(!analysis?.ifcPlan)return <main className="real3dPage"><div className="real3dEmpty"><h1>الهندسة ثلاثية الأبعاد غير جاهزة بعد</h1><p>أكمل تحليل BIMy واستخراج IFC أولًا.</p><Link href={`/project/${id}`} className="btn gold">العودة للمشروع</Link></div></main>;
  const sceneDesign=design?.design?design:{design:{style:"هندسة IFC فقط",items:[],lighting:[],airConditioning:[]}};

  return <main className="real3dPage">
    <div className="real3dTop">
      <Link href={`/project/${id}`} className="real3dBack">← المشروع</Link>
      <div className="real3dTitle"><b>بيتي 3D</b><small>{sceneDesign.design.style}</small></div>
      <div className="real3dModes">
        <button className={mode==="overview"?"active":""} onClick={()=>{setMode("overview");setAutoplay(false)}}>منظور علوي</button>
        <button className={mode==="tour"?"active":""} onClick={()=>setMode("tour")}>مستوى العين</button>
        <button className={autoplay?"active":""} onClick={()=>{setMode("tour");setAutoplay(v=>!v)}}>{autoplay?"إيقاف الجولة":"▶ جولة تلقائية"}</button>
      </div>
    </div>

    <RealHouse3D analysis={analysis} design={sceneDesign} detectedDoors={doors} mode={mode} autoplay={autoplay} onSelect={setSelected}/>

    <div className="real3dLegend">
      <span>اسحب بالماوس للدوران</span><span>قرّب للتفاصيل</span><span>اضغط أي عنصر للمعلومات</span>
    </div>

    {selected&&<aside className="real3dInfo">
      <button className="real3dClose" onClick={()=>setSelected(null)}>×</button>
      <span className="badge">{selected.category}</span>
      <h3>{selected.name}</h3>
      <p>{selected.room}</p>
      <dl>
        <div><dt>الخامة</dt><dd>{selected.material}</dd></div>
        <div><dt>اللون</dt><dd>{selected.color}</dd></div>
        <div><dt>المقاس</dt><dd>{selected.widthM} × {selected.depthM} × {selected.heightM} م</dd></div>
        <div><dt>التفاصيل</dt><dd>{selected.details}</dd></div>
      </dl>
    </aside>}

    <div className="real3dBottom">
      <div><small>الجدران</small><b>{analysis.ifcPlan.walls?.length||0}</b></div>
      <div><small>الفتحات</small><b>{(analysis.ifcPlan.openings?.length||0)+doors.length}</b></div>
      <div><small>الفراغات</small><b>{analysis.inferredRooms?.length||0}</b></div>
      <div><small>عناصر التصميم</small><b>{sceneDesign.design.items?.length||0}</b></div>
    </div>
  </main>;
}
