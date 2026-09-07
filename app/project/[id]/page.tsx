"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PlanReading from "@/components/PlanReading";
import StudioSidebar from "@/components/StudioSidebar";

type UploadMeta={
  id:string;name:string;size:number;type:string;extension:string;uploadedAt:string;status:string;
};

export default function ProjectPlanPage(){
  const params=useParams<{id:string}>();
  const id=params?.id;
  const [upload,setUpload]=useState<UploadMeta|null>(null);
  const [analysis,setAnalysis]=useState<any>(null);
  const [roomsData,setRoomsData]=useState<any[]>([]);
  const [doors,setDoors]=useState<any[]>([]);
  const [integration,setIntegration]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [analyzing,setAnalyzing]=useState(false);
  const [error,setError]=useState("");
  const [tab,setTab]=useState<"plan"|"result">("plan");

  useEffect(()=>{
    if(!id)return;
    Promise.all([
      fetch("/api/uploads/"+id).then(async r=>r.ok?await r.json():null),
      fetch("/api/uploads/"+id+"/analysis").then(async r=>r.ok?await r.json():null),
      fetch("/api/uploads/"+id+"/rooms").then(async r=>r.ok?await r.json():null),
      fetch("/api/uploads/"+id+"/doors").then(async r=>r.ok?await r.json():null),
      fetch("/api/health").then(async r=>r.ok?await r.json():null)
    ]).then(([u,a,roomSaved,doorSaved,health])=>{
      if(u?.ok)setUpload(u.upload);
      if(a?.ok)setAnalysis({ok:true,result:a.analysis,status:a.analysis?.status});
      if(Array.isArray(roomSaved?.rooms?.rooms))setRoomsData(roomSaved.rooms.rooms);
      if(Array.isArray(doorSaved?.doors?.doors))setDoors(doorSaved.doors.doors);
      setIntegration(health);
    }).finally(()=>setLoading(false));
  },[id]);

  async function runAnalysis(){
    if(!upload)return;
    setAnalyzing(true);setError("");
    try{
      await fetch("/api/bimy/recover",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uploadId:upload.id})});
      const r=await fetch("/api/analyze",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uploadId:upload.id})});
      const body=await r.json();
      if(!r.ok||!body.ok)throw new Error(body.error||"فشل التحليل");
      setAnalysis(body);
    }catch(e){setError(e instanceof Error?e.message:"فشل التحليل")}
    finally{setAnalyzing(false)}
  }

  if(loading)return <main className="approvedLoading">جاري تحميل المشروع…</main>;
  if(!upload)return <main className="approvedLoading">المشروع غير موجود.</main>;

  const result=analysis?.result;
  const walls=result?.ifcPlan?.walls?.length||result?.scanCounts?.walls||0;
  const windows=(result?.ifcPlan?.openings||[]).filter((o:any)=>o.kind==="window").length||result?.scanCounts?.windows||0;
  const roomCount=result?.inferredRooms?.length||roomsData.length||0;
  const doorCount=Math.max(doors.length,(result?.ifcPlan?.openings||[]).filter((o:any)=>o.kind==="door").length);
  const scale=result?.scan?.project?.scanScale;
  const area=(result?.inferredRooms||[]).reduce((s:number,r:any)=>s+(Number(r.areaM2)||0),0);

  return <main className="approvedAppShell">
    <StudioSidebar projectId={upload.id}/>

    <section className="approvedMain">
      <header className="approvedTopbar">
        <div className="approvedProjectCrumb">
          <Link href="/dashboard">لوحة التحكم</Link><span>‹</span><b>{upload.name}</b>
        </div>
        <div className="approvedPlanTopActions">
          <Link href={"/project/"+upload.id+"/3d"} className="approvedSoftBtn">3D</Link>
          <Link href={"/project/"+upload.id+"/3d"} className="approvedGoldBtn">متابعة إلى النموذج ثلاثي الأبعاد ←</Link>
        </div>
      </header>

      <div className="approvedPlanWorkspace">
        <section className="approvedPlanCanvas">
          <div className="approvedPlanCanvasHead">
            <div><span>تحليل المخطط</span><h1>{upload.name}</h1></div>
            <div className="approvedFloorSelect">الطابق الأرضي⌄</div>
          </div>

          <div className="approvedPlanStage">
            {result?(
              <PlanReading imageUrl={"/api/uploads/"+upload.id+"/file"} analysis={result} rooms={roomsData} uploadId={upload.id}/>
            ):(
              <div className="approvedPlanEmpty">
                <img src={"/api/uploads/"+upload.id+"/file"} alt="المخطط"/>
                <div><h2>المخطط جاهز للتحليل</h2><p>شغّل BIMy لاستخراج الجدران والفتحات والمقياس.</p>
                  <button onClick={runAnalysis} className="approvedGoldBtn" disabled={analyzing||!integration?.bimyConfigured}>
                    {analyzing?"جاري التحليل…":"تحليل المخطط"}
                  </button>
                </div>
              </div>
            )}

            <div className="approvedPlanZoom">
              <button>＋</button><button>−</button><button>⌖</button>
            </div>
          </div>

          <div className="approvedPlanTabs">
            <button className={tab==="plan"?"active":""} onClick={()=>setTab("plan")}>المخطط</button>
            <button className={tab==="result"?"active":""} onClick={()=>setTab("result")}>النتيجة</button>
          </div>
          {error&&<div className="approvedError">{error}</div>}
        </section>

        <aside className="approvedPlanInspector">
          <div className="approvedInspectorSection">
            <div className="approvedInspectorTitle"><h3>طبقات المخطط</h3><span>◉</span></div>
            {[
              ["الجدران",true],["الأبواب",true],["النوافذ",true],["الأثاث",false],["الأبعاد",true],["النصوص",false],["الحديقة",false]
            ].map(([label,on])=><div className="approvedLayerRow" key={String(label)}>
              <span>{label}</span><i className={on?"on":""}><b/></i>
            </div>)}
          </div>

          <div className="approvedInspectorSection">
            <h3>نتائج التحليل</h3>
            <div className="approvedResultRows">
              <div><span>المساحة المقروءة</span><b>{area?area.toFixed(1)+" م²":"—"}</b></div>
              <div><span>عدد الفراغات</span><b>{roomCount||"—"}</b></div>
              <div><span>عدد الجدران</span><b>{walls||"—"}</b></div>
              <div><span>عدد الأبواب</span><b>{doorCount||"—"}</b></div>
              <div><span>عدد النوافذ</span><b>{windows||"—"}</b></div>
              <div><span>ثقة المقياس</span><b>{typeof scale?.confidence==="number"?Math.round(scale.confidence*100)+"%":"—"}</b></div>
            </div>
          </div>

          <div className="approvedInspectorSection approvedReadiness">
            <span>جاهزية المسار</span>
            <strong>{result?.ifcPlan?.walls?.length?"IFC جاهز":"بانتظار IFC"}</strong>
            <p>نتأكد من الهندسة أولًا، وبعد اعتمادها نفعل التصميم الداخلي.</p>
          </div>

          {result?.ifcPlan?.walls?.length&&<Link href={"/project/"+upload.id+"/3d"} className="approvedGoldBtn wide">فتح 3D ←</Link>}
        </aside>
      </div>
    </section>
  </main>;
}
