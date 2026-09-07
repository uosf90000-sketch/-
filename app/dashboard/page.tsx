"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import StudioSidebar from "@/components/StudioSidebar";

const House3D=dynamic(()=>import("@/components/House3D"),{ssr:false});
const CURRENT_PROJECT="672fa7f6-801c-4691-b2eb-50339afa600f";

export default function DashboardPage(){
  const [analysis,setAnalysis]=useState<any>(null);
  const [upload,setUpload]=useState<any>(null);

  useEffect(()=>{
    Promise.all([
      fetch("/api/uploads/"+CURRENT_PROJECT).then(async r=>r.ok?await r.json():null),
      fetch("/api/uploads/"+CURRENT_PROJECT+"/analysis").then(async r=>r.ok?await r.json():null)
    ]).then(([u,a])=>{
      if(u?.ok)setUpload(u.upload);
      if(a?.ok)setAnalysis(a.analysis);
    }).catch(()=>{});
  },[]);

  const walls=analysis?.ifcPlan?.walls?.length||analysis?.scanCounts?.walls||0;
  const rooms=analysis?.inferredRooms?.length||0;
  const windows=(analysis?.ifcPlan?.openings||[]).filter((o:any)=>o.kind==="window").length||analysis?.scanCounts?.windows||0;
  const progress=analysis?.ifcPlan?.walls?.length?68:35;

  return <main className="approvedAppShell">
    <StudioSidebar projectId={CURRENT_PROJECT}/>

    <section className="approvedMain">
      <header className="approvedTopbar">
        <button className="approvedMenuBtn">☰</button>
        <div className="approvedSearch">⌕ <span>ابحث في مشاريعك…</span></div>
        <div className="approvedTopIdentity">
          <span className="approvedBell">♢</span>
          <div className="approvedAvatar">ي</div>
          <span><b>يوسف</b><small>مالك المشروع</small></span>
        </div>
      </header>

      <div className="approvedDashboardContent">
        <div className="approvedWelcome">
          <div><span>مرحبًا يوسف 👋</span><h1>هنا نظرة عامة على مشروعك الحالي</h1></div>
          <Link href="/" className="approvedGoldBtn">+ مشروع جديد</Link>
        </div>

        <section className="approvedDashHeroGrid">
          <article className="approvedProjectHeroCard">
            <div className="approvedProjectVisual">
              <House3D mode="overview"/>
              <div className="approvedProjectVisualShade"/>
              <div className="approvedProjectCopy">
                <span>المشروع الحالي</span>
                <h2>{upload?.name||"فيلا التجربة"}</h2>
                <small>تم الحفظ والتحليل الهندسي</small>
                <Link href={"/project/"+CURRENT_PROJECT+"/3d"}>عرض 3D ←</Link>
              </div>
            </div>
          </article>

          <article className="approvedProgressCard">
            <div className="approvedProgressTop"><span>تقدم المشروع</span><b>{progress}%</b></div>
            <div className="approvedRing" style={{"--p":progress} as React.CSSProperties}><span>{progress}%<small>مكتمل</small></span></div>
            <div className="approvedProgressList">
              <span className="done">✓ رفع المخطط</span>
              <span className="done">✓ تحليل المخطط</span>
              <span className="done">✓ النموذج ثلاثي الأبعاد</span>
              <span>○ التصميم الداخلي</span>
              <span>○ المواد والمنتجات</span>
              <span>○ التقرير النهائي</span>
            </div>
            <Link href={"/project/"+CURRENT_PROJECT} className="approvedGoldBtn wide">متابعة المشروع</Link>
          </article>
        </section>

        <section className="approvedQuickActions">
          <Link href="/" className="approvedQuickCard"><i>↥</i><b>رفع مخطط جديد</b><small>ابدأ مشروعًا من مخطط آخر</small></Link>
          <Link href={"/project/"+CURRENT_PROJECT} className="approvedQuickCard"><i>⌗</i><b>تحليل المخطط</b><small>راجع الجدران والفتحات</small></Link>
          <Link href={"/project/"+CURRENT_PROJECT+"/3d"} className="approvedQuickCard"><i>▶</i><b>جولة سينمائية</b><small>استكشف بيتك من الداخل</small></Link>
          <Link href={"/project/"+CURRENT_PROJECT+"/materials"} className="approvedQuickCard"><i>▤</i><b>المواد والمنتجات</b><small>راجع مكتبة التشطيبات</small></Link>
        </section>

        <section className="approvedStatsRow">
          <div><i>□</i><span><b>{rooms||"—"}</b><small>الفراغات</small></span></div>
          <div><i>⌗</i><span><b>{walls||"—"}</b><small>الجدران</small></span></div>
          <div><i>▣</i><span><b>{windows||"—"}</b><small>النوافذ</small></span></div>
          <div><i>◇</i><span><b>3D</b><small>جاهز للعرض</small></span></div>
        </section>

        <section className="approvedRecentProjects">
          <div className="approvedSectionTitle"><h2>مشاريعي الأخيرة</h2><span>عرض الكل</span></div>
          <div className="approvedRecentGrid">
            <Link href={"/project/"+CURRENT_PROJECT} className="approvedRecentCard">
              <div className="approvedRecentThumb"><img src={"/api/uploads/"+CURRENT_PROJECT+"/file"} alt="المخطط"/></div>
              <b>{upload?.name||"فيلا التجربة"}</b><small>{rooms||"—"} فراغ · {walls||"—"} جدار</small>
            </Link>
            <Link href="/" className="approvedRecentCard add"><span>＋</span><b>مشروع جديد</b><small>ابدأ من مخططك</small></Link>
          </div>
        </section>
      </div>
    </section>
  </main>;
}
