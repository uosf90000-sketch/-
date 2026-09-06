"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import PlanReading from "@/components/PlanReading";

type UploadMeta={
  id:string;name:string;size:number;type:string;extension:string;uploadedAt:string;status:string;
};

export default function RealProjectPage(){
  const params=useParams<{id:string}>();
  const id=params?.id;
  const [upload,setUpload]=useState<UploadMeta|null>(null);
  const [loading,setLoading]=useState(true);
  const [analysis,setAnalysis]=useState<any>(null);
  const [analysisError,setAnalysisError]=useState("");
  const [analyzing,setAnalyzing]=useState(false);
  const [design,setDesign]=useState<any>(null);
  const [designError,setDesignError]=useState("");
  const [designing,setDesigning]=useState(false);
  const [integration,setIntegration]=useState<{bimyConfigured:boolean;openaiConfigured:boolean;aiStageEnabled:boolean}|null>(null);
  const [roomsData,setRoomsData]=useState<any[]>([]);
  const [roomsBusy,setRoomsBusy]=useState(false);
  const [roomsAttempted,setRoomsAttempted]=useState(false);
  const [autoBimyAttempted,setAutoBimyAttempted]=useState(false);
  const [autoDesignAttempted,setAutoDesignAttempted]=useState(false);

  useEffect(()=>{
    if(!id)return;
    Promise.all([
      fetch("/api/uploads/"+id).then(r=>r.json()),
      fetch("/api/health").then(r=>r.json()),
      fetch("/api/uploads/"+id+"/analysis").then(async r=>r.ok?await r.json():null),
      fetch("/api/uploads/"+id+"/rooms").then(async r=>r.ok?await r.json():null),
      fetch("/api/uploads/"+id+"/design").then(async r=>r.ok?await r.json():null)
    ]).then(([body,health,saved,roomSaved,designSaved])=>{
      if(body.ok)setUpload(body.upload);
      if(saved?.ok&&saved?.analysis)setAnalysis({ok:true,provider:"bimy",status:saved.analysis.status,result:saved.analysis});
      if(roomSaved?.ok&&Array.isArray(roomSaved?.rooms?.rooms)){setRoomsData(roomSaved.rooms.rooms);setRoomsAttempted(true)}
      if(designSaved?.ok&&designSaved?.design){setDesign(designSaved.design);setAutoDesignAttempted(true)}
      setIntegration({
        bimyConfigured:Boolean(health?.bimyConfigured),
        openaiConfigured:Boolean(health?.openaiConfigured),
        aiStageEnabled:Boolean(health?.aiStageEnabled)
      });
    }).finally(()=>setLoading(false));
  },[id]);

  async function detectRooms(){
    if(!upload||roomsBusy)return;
    setRoomsBusy(true);
    try{
      const r=await fetch("/api/rooms",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uploadId:upload.id})});
      const body=await r.json();
      if(r.ok&&body.ok&&Array.isArray(body.rooms))setRoomsData(body.rooms);
    }finally{setRoomsBusy(false);setRoomsAttempted(true)}
  }

  useEffect(()=>{
    const scanReady=analysis?.result?.scan?.project?.scanStatus==="ready"||analysis?.result?.scanStatus==="ready";
    if(upload&&integration?.openaiConfigured&&integration?.aiStageEnabled&&scanReady&&!roomsAttempted&&!roomsBusy)void detectRooms();
  },[upload,analysis,integration,roomsAttempted,roomsBusy]);

  useEffect(()=>{
    const scanReady=analysis?.result?.scan?.project?.scanStatus==="ready"||analysis?.result?.scanStatus==="ready";
    const hasIfc=Array.isArray(analysis?.result?.ifcPlan?.walls)&&analysis.result.ifcPlan.walls.length>0;
    if(upload&&integration?.bimyConfigured&&scanReady&&!hasIfc&&!analyzing&&!autoBimyAttempted){
      setAutoBimyAttempted(true);void runAnalysis();
    }
  },[upload,analysis,integration,analyzing,autoBimyAttempted]);

  useEffect(()=>{
    const hasIfc=Array.isArray(analysis?.result?.ifcPlan?.walls)&&analysis.result.ifcPlan.walls.length>0;
    if(upload&&integration?.openaiConfigured&&integration?.aiStageEnabled&&hasIfc&&roomsData.length>0&&!design&&!designing&&!autoDesignAttempted){
      setAutoDesignAttempted(true);void runDesign();
    }
  },[upload,analysis,integration,roomsData,design,designing,autoDesignAttempted]);

  async function runAnalysis(){
    if(!upload)return;
    setAnalyzing(true);setAnalysisError("");
    try{
      await fetch("/api/bimy/recover",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uploadId:upload.id})});
      const r=await fetch("/api/analyze",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uploadId:upload.id})});
      const body=await r.json();
      if(!r.ok||!body.ok)throw new Error(body.error||"فشل تحليل BIMy");
      setAnalysis(body);setRoomsAttempted(false);
    }catch(e){setAnalysisError(e instanceof Error?e.message:"فشل تحليل BIMy")}
    finally{setAnalyzing(false)}
  }

  async function runDesign(){
    if(!analysis?.result)return;
    setDesigning(true);setDesignError("");setDesign(null);
    try{
      const r=await fetch("/api/design",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uploadId:upload?.id,bim:analysis.result,style:"عصري دافئ"})});
      const body=await r.json();
      if(!r.ok||!body.ok)throw new Error(body.error||"فشل التصميم");
      setDesign(body);
    }catch(e){setDesignError(e instanceof Error?e.message:"فشل التصميم")}
    finally{setDesigning(false)}
  }

  if(loading)return <main><Header/><div className="studioPageLoading">جاري تجهيز الاستوديو…</div></main>;
  if(!upload)return <main><Header/><div className="studioPageLoading">المشروع غير موجود.</div></main>;

  const result=analysis?.result;
  const wallCount=result?.ifcPlan?.walls?.length||result?.scanCounts?.walls||0;
  const windowCount=(result?.ifcPlan?.openings||[]).filter((o:any)=>o.kind==="window").length||result?.scanCounts?.windows||0;
  const roomCount=result?.inferredRooms?.length||roomsData.length||0;
  const hasIfc=wallCount>0;

  return <main className="projectStudio">
    <Header/>

    <section className="projectStudioHero">
      <div className="projectTitleBlock">
        <div className="projectEyebrow"><span className="projectStatusDot"/> مشروع قيد التصميم</div>
        <h1>{upload.name}</h1>
        <p>{(upload.size/1024/1024).toFixed(2)} MB · {new Date(upload.uploadedAt).toLocaleDateString("ar-SA")} · هندسة BIMy/IFC</p>
      </div>

      <div className="projectHeroActions">
        <Link href="/" className="studioSecondaryBtn">مخطط جديد</Link>
        {hasIfc&&<Link href={"/project/"+upload.id+"/3d"} className="studioPrimaryBtn">
          <span>فتح الاستوديو 3D</span>
          <b>←</b>
        </Link>}
      </div>
    </section>

    <section className="projectPulse">
      <div className="pulseStep done"><i>✓</i><span><b>المخطط</b><small>محفوظ</small></span></div>
      <em/>
      <div className={analysis?"pulseStep done":"pulseStep active"}><i>{analysis?"✓":"2"}</i><span><b>الهندسة</b><small>{analysis?"BIMy + IFC":"جاري التحليل"}</small></span></div>
      <em/>
      <div className={hasIfc?"pulseStep done":"pulseStep"}><i>{hasIfc?"✓":"3"}</i><span><b>3D</b><small>{hasIfc?"جاهز للمعاينة":"بانتظار الهندسة"}</small></span></div>
      <em/>
      <div className={design?"pulseStep done":"pulseStep"}><i>{design?"✓":"4"}</i><span><b>التصميم الداخلي</b><small>{design?"مصمم":"موقوف مؤقتًا"}</small></span></div>
    </section>

    <section className="projectBento">
      <div className="projectCanvasCard">
        <div className="cardSectionHead">
          <div><span>قراءة المخطط</span><h2>الهندسة التي سيُبنى عليها التصميم</h2></div>
          <div className="geometryBadge"><i/> LIVE GEOMETRY</div>
        </div>

        {result?(
          <PlanReading
            imageUrl={"/api/uploads/"+upload.id+"/file"}
            analysis={result}
            rooms={roomsData}
            uploadId={upload.id}
          />
        ):(
          <div className="projectEmptyState">
            <div className="emptyPlanIcon">⌗</div>
            <h3>المخطط محفوظ وجاهز للتحليل</h3>
            <p>شغّل BIMy لاستخراج الجدران والفتحات والمقياس.</p>
            <button className="studioPrimaryBtn" onClick={runAnalysis} disabled={analyzing||!integration?.bimyConfigured}>
              {analyzing?"جاري التحليل…":"تحليل المخطط"}
            </button>
          </div>
        )}
      </div>

      <aside className="projectSideRail">
        <div className="metricCard21 metricPrimary">
          <div className="metricTop"><span>الهندسة</span><i className={hasIfc?"ok":""}/></div>
          <strong>{hasIfc?"جاهزة":"قيد التحليل"}</strong>
          <p>{wallCount} جدار · {windowCount} نافذة · {roomCount} فراغ</p>
          <div className="metricBar"><span style={{width:hasIfc?"100%":analysis?"72%":"28%"}}/></div>
        </div>

        <div className="metricGrid21">
          <div className="metricCard21 small"><span>الجدران</span><strong>{wallCount}</strong><small>IFC walls</small></div>
          <div className="metricCard21 small"><span>الفراغات</span><strong>{roomCount}</strong><small>Topology</small></div>
          <div className="metricCard21 small"><span>النوافذ</span><strong>{windowCount}</strong><small>Openings</small></div>
          <div className="metricCard21 small"><span>المقياس</span><strong>{result?.scan?.project?.scanScale?.confidence?Math.round(result.scan.project.scanScale.confidence*100)+"%":"—"}</strong><small>Confidence</small></div>
        </div>

        <div className="actionCard21">
          <div className="actionIcon">◇</div>
          <span>استوديو 3D</span>
          <h3>تحقق من البيت بالحجم والفراغ الحقيقي.</h3>
          <p>منظور علوي، مستوى العين، وجولة تلقائية. بدون OpenAI.</p>
          {hasIfc?<Link className="studioPrimaryBtn wide" href={"/project/"+upload.id+"/3d"}>فتح 3D <b>←</b></Link>:<button className="studioPrimaryBtn wide" disabled>بانتظار IFC</button>}
        </div>

        <div className="actionCard21 aiCard">
          <div className="actionIcon">✦</div>
          <div className="lockRow"><span>المصمم الداخلي</span><small>{integration?.aiStageEnabled?"متاح":"موقوف للتحقق"}</small></div>
          <h3>الأثاث، المواد، الإنارة والتكييف.</h3>
          <p>{integration?.aiStageEnabled?"جاهز للعمل من بيانات الهندسة الحالية.":"سنفعّله بعد اعتماد الأبواب والـ3D الهندسي."}</p>
          <button className="studioSecondaryBtn wide" onClick={runDesign} disabled={!result||designing||!integration?.aiStageEnabled}>
            {designing?"جاري التصميم…":design?"إعادة التصميم":"تشغيل لاحقًا"}
          </button>
        </div>

        {analysisError&&<div className="studioInlineError">{analysisError}</div>}
        {designError&&<div className="studioInlineError">{designError}</div>}
      </aside>
    </section>
  </main>;
}
