"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import InfoCard from "@/components/InfoCard";
import { demoElements, rooms, type ElementInfo } from "@/lib/design";
const House3D=dynamic(()=>import("@/components/House3D"),{ssr:false});

export default function Tour(){
  const [selected,setSelected]=useState<ElementInfo|null>(demoElements[0]);
  const [autoplay,setAutoplay]=useState(true);
  const [elapsed,setElapsed]=useState(24);
  useEffect(()=>{const id=setInterval(()=>{if(autoplay)setElapsed(v=>v>=138?0:v+1)},1000);return()=>clearInterval(id)},[autoplay]);
  const pct=Math.round(elapsed/138*100);
  const mm=String(Math.floor(elapsed/60)).padStart(2,"0"),ss=String(elapsed%60).padStart(2,"0");
  return <main className="tourPage">
    <div className="tourTop">
      <Link href="/" className="brand light"><span className="brandIcon">⌂</span><span><b>بيتي</b><small>أكثر من منزل… حياة أجمل</small></span></Link>
      <div className="roomTabs glass">{rooms.map((r,i)=><button className={i===0?"active":""} key={r.id}>{r.name}</button>)}</div>
      <div className="tourActions"><Link href="/project/demo" className="darkPill">العودة للمشروع</Link><button className="darkPill" onClick={()=>setAutoplay(!autoplay)}>{autoplay?"❚❚ إيقاف الجولة":"▶ جولة تلقائية"}</button></div>
    </div>

    <House3D mode="tour" autoplay={autoplay} onSelect={setSelected}/>

    <aside className="miniMap"><b>الموقع الحالي</b><div className="miniPlan"><span className="cameraCone"/></div><small>المجلس · الدور الأرضي</small></aside>
    <aside className="tourTools"><button>↔<small>التنقل</small></button><button>◯<small>المشاهد</small></button><button>ⓘ<small>المعلومات</small></button><button>⚙<small>الإعدادات</small></button></aside>
    {selected&&<div className="floatingInfo"><InfoCard item={selected} compact onClose={()=>setSelected(null)}/><button className="btn gold wide">عرض التفاصيل</button></div>}

    <div className="cinemaBar">
      <div className="sceneNow"><div className="sceneThumb"/><span><small>المشهد الحالي</small><b>المجلس</b></span></div>
      <button className="playCircle" onClick={()=>setAutoplay(!autoplay)}>{autoplay?"Ⅱ":"▶"}</button>
      <span className="time">{mm}:{ss} / 02:18</span>
      <div className="timeline"><i style={{width:`${pct}%`}}/></div>
      <span className="mouseHint">◉ اسحب بالماوس لاستكشاف المكان</span>
      <button className="sound">◖))</button>
      <div className="nextScene"><span><small>المشهد التالي</small><b>المطبخ</b></span><div className="sceneThumb kitchenThumb"/></div>
    </div>
  </main>;
}
