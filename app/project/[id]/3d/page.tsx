"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const RealHouse3D=dynamic(()=>import("@/components/RealHouse3D"),{ssr:false});

function fmt(n:any,d=1){
  return typeof n==="number"&&Number.isFinite(n)?n.toFixed(d):"—";
}

export default function Approved3DPage(){
  const params=useParams<{id:string}>();
  const id=params?.id;
  const [analysis,setAnalysis]=useState<any>(null);
  const [design,setDesign]=useState<any>(null);
  const [doors,setDoors]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [mode,setMode]=useState<"overview"|"tour">("overview");
  const [autoplay,setAutoplay]=useState(false);
  const [selected,setSelected]=useState<any>(null);
  const [day,setDay]=useState(true);

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

  if(loading)return <main className="approved3dLoading"><i/><b>نجهّز التوأم ثلاثي الأبعاد…</b></main>;
  if(!analysis?.ifcPlan)return <main className="approved3dLoading"><b>الـ3D غير جاهز بعد</b><Link href={"/project/"+id}>العودة للمخطط</Link></main>;

  const sceneDesign=design?.design?design:{design:{style:"هندسة IFC",items:[],lighting:[],airConditioning:[]}};
  const rooms=Array.isArray(analysis?.inferredRooms)?analysis.inferredRooms:[];
  const walls=analysis?.ifcPlan?.walls?.length||0;
  const openings=(analysis?.ifcPlan?.openings?.length||0)+doors.length;
  const furniture=sceneDesign.design.items?.length||0;

  return <main className={"approved3dStudio "+(day?"day":"night")}>
    <RealHouse3D analysis={analysis} design={sceneDesign} detectedDoors={doors}
      mode={mode} autoplay={autoplay} onSelect={setSelected}/>

    <header className="approved3dTopbar">
      <Link href="/" className="approved3dBrand">
        <span className="approvedLogoMark">⌂</span>
        <span><b>BAYTI</b><small>LIVING TWIN</small></span>
      </Link>

      <div className="approved3dProjectSelect">الدور الأرضي⌄</div>

      <div className="approved3dModes">
        <button className={mode==="tour"&&!autoplay?"active":""} onClick={()=>{setMode("tour");setAutoplay(false)}}>🚶 Walk</button>
        <button className={mode==="overview"?"active":""} onClick={()=>{setMode("overview");setAutoplay(false)}}>⟳ Orbit</button>
        <button className={mode==="overview"?"active doll":""} onClick={()=>{setMode("overview");setAutoplay(false)}}>⌂ Dollhouse</button>
      </div>

      <div className="approved3dTopActions">
        <button onClick={()=>setDay(true)} className={day?"active":""}>☼ نهار</button>
        <button onClick={()=>setDay(false)} className={!day?"active":""}>◐ ليل</button>
        <Link href={"/project/"+id}>↗</Link>
      </div>
    </header>

    <aside className="approved3dLeftPanel">
      <div className="approvedMiniPlanHead"><b>المخطط</b><span>الدور الأرضي⌄</span></div>
      <div className="approvedMiniPlan">
        <img src={"/api/uploads/"+id+"/file"} alt="المخطط"/>
        <span className="approvedMiniPosition"/>
      </div>
      <div className="approvedMiniZoom"><button>＋</button><button>−</button><button>⌖</button></div>

      <nav className="approved3dToolNav">
        <button className={mode==="tour"?"active":""} onClick={()=>setMode("tour")}>🚶 <span>المشي</span></button>
        <button className={mode==="overview"?"active":""} onClick={()=>setMode("overview")}>⟳ <span>الدوران الحر</span></button>
        <button onClick={()=>setMode("overview")}>⌂ <span>منظور مصغر</span></button>
        <Link href={"/project/"+id}>⌗ <span>المخطط</span></Link>
        <Link href={"/project/"+id+"/materials"}>▦ <span>المواد</span></Link>
        <Link href={"/project/"+id+"/materials"}>▣ <span>المنتجات</span></Link>
        <button>☼ <span>الإضاءة</span></button>
        <button>⌁ <span>القياس</span></button>
      </nav>
    </aside>

    <aside className="approved3dRightPanel">
      <div className="approvedDetailHead"><b>تفاصيل العنصر</b><button onClick={()=>setSelected(null)}>×</button></div>

      {selected?<>
        <div className={"approvedDetailVisual "+(selected.type||"generic")}>
          <span>{selected.category||"عنصر"}</span>
        </div>
        <div className="approvedDetailBody">
          <small>{selected.category||"عنصر"}</small>
          <h2>{selected.name||"عنصر من المنزل"}</h2>
          <div className="approvedDetailRows">
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
            </>}
            <div><span>المصدر</span><b>{selected.source||"BIMy / IFC"}</b></div>
          </div>
          <Link href={"/project/"+id+"/materials"} className="approvedGoldBtn wide">عرض المواد والمنتجات</Link>
          <button className="approvedSoftBtn wide">استبدال ↔</button>
        </div>
      </>:<div className="approvedDetailEmpty">
        <i>⌖</i><h3>اختر عنصرًا</h3><p>اضغط جدارًا أو بابًا أو نافذة أو أرضية داخل المشهد.</p>
      </div>}

      <div className="approvedCostSummary">
        <h3>ملخص المشروع</h3>
        <div><span>الجدران</span><b>{walls}</b></div>
        <div><span>الفتحات</span><b>{openings}</b></div>
        <div><span>الفراغات</span><b>{rooms.length}</b></div>
        <div><span>عناصر الأثاث</span><b>{furniture}</b></div>
      </div>
    </aside>

    <div className="approvedHotspotHint">
      <span>●</span><b>{mode==="tour"?"اضغط العناصر أثناء المشي":"دوّر المشهد واضغط أي عنصر"}</b>
    </div>

    <div className="approvedCinematicControl">
      <button>‹</button>
      <button className="play" onClick={()=>{setMode("tour");setAutoplay(v=>!v)}}>{autoplay?"Ⅱ":"▶"}</button>
      <button>›</button>
      <span>جولة سينمائية</span>
      <small>{mode==="tour"?"W A S D للمشي":"اختر Walk للدخول"}</small>
    </div>

    <div className="approvedRoomStrip">
      {rooms.slice(0,6).map((room:any,i:number)=><button key={room.id||i}>
        <span className="approvedRoomThumb"><img src={"/api/uploads/"+id+"/file"} alt=""/></span>
        <b>{"فراغ "+(i+1)}</b><small>{fmt(room.areaM2)} م²</small>
      </button>)}
      <Link href={"/project/"+id}>▦<span>المزيد</span></Link>
    </div>

    <footer className="approved3dFooter">
      <div><span>إجمالي المساحة المقروءة</span><b>{fmt(rooms.reduce((s:number,r:any)=>s+(Number(r.areaM2)||0),0))} م²</b></div>
      <div><span>عدد الجدران</span><b>{walls}</b></div>
      <div><span>عدد الفتحات</span><b>{openings}</b></div>
      <nav>
        <Link href={"/project/"+id}>⌗ المخطط</Link>
        <Link href={"/project/"+id+"/materials"}>▦ المواد والتشطيبات</Link>
        <Link href={"/project/"+id+"/materials"}>▣ المنتجات</Link>
      </nav>
    </footer>
  </main>;
}
