"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Header from "@/components/Header";
import InfoCard from "@/components/InfoCard";
import { demoElements, rooms, type ElementInfo } from "@/lib/design";
import { useState } from "react";
const House3D=dynamic(()=>import("@/components/House3D"),{ssr:false});

export default function ProjectDemo(){
  const [selected,setSelected]=useState<ElementInfo>(demoElements[0]);
  const [room,setRoom]=useState("majlis");
  return <main className="workspace">
    <Header/>
    <div className="progress"><span className="done">✓<small>رفع المخطط</small></span><b/><span className="done">✓<small>تحليل BIMy</small></span><b/><span className="done">✓<small>إنشاء 3D</small></span><b/><span className="active">4<small>تصميم OpenAI</small></span><b/><span>5<small>تجربة تفاعلية</small></span></div>
    <div className="workspaceGrid">
      <aside className="projectSide">
        <h2>فيلا العائلة</h2><p>الرياض، المملكة العربية السعودية</p>
        <div className="planCard"><div className="planTabs"><button className="active">المخطط 2D</button><button>النموذج 3D</button></div>
          <div className="fakePlan">
            <div className="pr living">الصالة<br/><small>34 م²</small></div><div className="pr kitchen">المطبخ<br/><small>22 م²</small></div><div className="pr bed">غرفة النوم<br/><small>20 م²</small></div><div className="pr bath">الحمام<br/><small>7 م²</small></div>
          </div>
        </div>
        <div className="detected"><h3>الغرف المكتشفة</h3>{rooms.map(r=><button className={room===r.id?"active":""} onClick={()=>setRoom(r.id)} key={r.id}>{r.name}</button>)}</div>
      </aside>

      <section className="modelArea">
        <div className="roomTabs">{rooms.map(r=><button className={room===r.id?"active":""} onClick={()=>setRoom(r.id)} key={r.id}>{r.name}</button>)}</div>
        <div className="overviewStage"><House3D mode="overview" onSelect={setSelected}/><div className="viewMenu"><button>منظور حر</button><button>منظور علوي</button><button>إخفاء السقف</button></div></div>
        <div className="materialBar"><b>المواد والعناصر</b>{["الدهانات","البلاط","الأثاث","الإضاءة","التكييف","الأبواب","النوافذ"].map(x=><button key={x}>{x}</button>)}</div>
      </section>

      <aside className="designSide">
        <div className="panel"><h3>معلومات المشروع</h3><label>اسم المشروع</label><b>فيلا العائلة</b><label>الأسلوب</label><b>عصري دافئ</b><label>الميزانية</label><b>150,000 – 200,000 ريال</b></div>
        <div className="panel status"><h3>حالة المشروع</h3><p>✓ تم رفع المخطط</p><p>✓ اكتمل تحليل BIMy</p><p>✓ تم إنشاء 3D</p><p>✓ التصميم الداخلي جاهز</p></div>
        <InfoCard item={selected}/>
        <Link className="btn gold wide" href="/tour/demo">فتح الجولة التفاعلية ←</Link>
      </aside>
    </div>
  </main>;
}
