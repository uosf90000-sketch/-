"use client";

import { useEffect, useMemo, useState } from "react";
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
      fetch(`/api/uploads/${id}`).then(r=>r.json()),
      fetch("/api/health").then(r=>r.json()),
      fetch(`/api/uploads/${id}/analysis`).then(async r=>r.ok?await r.json():null),
      fetch(`/api/uploads/${id}/rooms`).then(async r=>r.ok?await r.json():null),
      fetch(`/api/uploads/${id}/design`).then(async r=>r.ok?await r.json():null)
    ]).then(([body,health,saved,roomSaved,designSaved])=>{
      if(body.ok)setUpload(body.upload);
      if(saved?.ok&&saved?.analysis){
        setAnalysis({ok:true,provider:"bimy",status:saved.analysis.status,result:saved.analysis});
      }
      if(roomSaved?.ok&&Array.isArray(roomSaved?.rooms?.rooms)){
        setRoomsData(roomSaved.rooms.rooms);
        setRoomsAttempted(true);
      }
      if(designSaved?.ok&&designSaved?.design){
        setDesign(designSaved.design);
        setAutoDesignAttempted(true);
      }
      setIntegration({bimyConfigured:Boolean(health?.bimyConfigured),openaiConfigured:Boolean(health?.openaiConfigured),aiStageEnabled:Boolean(health?.aiStageEnabled)});
    }).finally(()=>setLoading(false));
  },[id]);

  async function detectRooms(){
    if(!upload||roomsBusy)return;
    setRoomsBusy(true);
    try{
      const r=await fetch("/api/rooms",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uploadId:upload.id})});
      const body=await r.json();
      if(r.ok&&body.ok&&Array.isArray(body.rooms)) setRoomsData(body.rooms);
    }finally{
      setRoomsBusy(false);
      setRoomsAttempted(true);
    }
  }

  useEffect(()=>{
    const scanReady=analysis?.result?.scan?.project?.scanStatus==="ready" || analysis?.result?.scanStatus==="ready";
    if(upload&&integration?.openaiConfigured&&integration?.aiStageEnabled&&scanReady&&!roomsAttempted&&!roomsBusy){
      void detectRooms();
    }
  },[upload,analysis,integration,roomsAttempted,roomsBusy]);

  useEffect(()=>{
    const scanReady=analysis?.result?.scan?.project?.scanStatus==="ready" || analysis?.result?.scanStatus==="ready";
    const hasIfc=Array.isArray(analysis?.result?.ifcPlan?.walls)&&analysis.result.ifcPlan.walls.length>0;
    if(upload&&integration?.bimyConfigured&&scanReady&&!hasIfc&&!analyzing&&!autoBimyAttempted){
      setAutoBimyAttempted(true);
      void runAnalysis();
    }
  },[upload,analysis,integration,analyzing,autoBimyAttempted]);

  useEffect(()=>{
    const hasIfc=Array.isArray(analysis?.result?.ifcPlan?.walls)&&analysis.result.ifcPlan.walls.length>0;
    if(upload&&integration?.openaiConfigured&&integration?.aiStageEnabled&&hasIfc&&roomsData.length>0&&!design&&!designing&&!autoDesignAttempted){
      setAutoDesignAttempted(true);
      void runDesign();
    }
  },[upload,analysis,integration,roomsData,design,designing,autoDesignAttempted]);

  const preview=useMemo(()=>{
    if(!upload)return null;
    const url=`/api/uploads/${upload.id}/file`;
    if(["jpg","jpeg","png","webp"].includes(upload.extension)) return <img className="realPlanImage" src={url} alt={upload.name}/>;
    if(upload.extension==="pdf") return <iframe className="realPlanPdf" src={url} title={upload.name}/>;
    return <div className="noPreview"><b>{upload.extension.toUpperCase()}</b><p>تم حفظ الملف فعليًا. المعاينة البصرية لهذه الصيغة ستظهر بعد تحويلها عبر BIMy.</p><a className="btn ghost" href={url}>فتح الملف الأصلي</a></div>;
  },[upload]);

  async function runAnalysis(){
    if(!upload)return;
    setAnalyzing(true);setAnalysisError("");
    try{
      await fetch("/api/bimy/recover",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uploadId:upload.id})});
      const r=await fetch("/api/analyze",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uploadId:upload.id})});
      const body=await r.json();
      if(!r.ok||!body.ok) throw new Error(body.error||"فشل تحليل BIMy");
      setAnalysis(body);
      setRoomsAttempted(false);
    }catch(e){setAnalysisError(e instanceof Error?e.message:"فشل تحليل BIMy");}
    finally{setAnalyzing(false);}
  }

  async function runDesign(){
    if(!analysis?.result)return;
    setDesigning(true);setDesignError("");setDesign(null);
    try{
      const r=await fetch("/api/design",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uploadId:upload?.id,bim:analysis.result,style:"عصري دافئ"})});
      const body=await r.json();
      if(!r.ok||!body.ok) throw new Error(body.error||"فشل التصميم");
      setDesign(body);
    }catch(e){setDesignError(e instanceof Error?e.message:"فشل التصميم");}
    finally{setDesigning(false);}
  }

  if(loading)return <main><Header/><div className="realProjectLoading">جاري فتح المشروع…</div></main>;
  if(!upload)return <main><Header/><div className="realProjectLoading">المخطط غير موجود.</div></main>;

  return <main className="realProject">
    <Header/>
    <section className="realProjectHead">
      <div><span className="kicker">مشروع حقيقي</span><h1>{upload.name}</h1><p>تم الرفع {new Date(upload.uploadedAt).toLocaleString("ar-SA")} · {(upload.size/1024/1024).toFixed(2)} MB</p></div>
      <Link className="btn ghost" href="/">رفع مخطط آخر</Link>
    </section>

    <section className="realPipeline">
      <div className="stage ready"><span>✓</span><b>رفع وحفظ المخطط</b><small>مكتمل فعليًا</small></div>
      <div className={analysis?"stage ready":"stage"}><span>{analysis?"✓":"2"}</span><b>تحليل BIMy</b><small>{analysis?"تم من BIMy":integration?.bimyConfigured?"جاهز للتشغيل":"بانتظار تفعيل التكامل"}</small></div>
      <div className={design?"stage ready":"stage"}><span>{design?"✓":"3"}</span><b>التصميم الداخلي</b><small>{design?"تم من OpenAI":"بعد اكتمال BIMy"}</small></div>
      <div className={analysis?.result?.ifcPlan?.walls?.length?"stage ready":"stage"}><span>{analysis?.result?.ifcPlan?.walls?.length?"✓":"4"}</span><b>3D الحقيقي</b><small>{analysis?.result?.ifcPlan?.walls?.length?"هندسة IFC جاهزة":"يبنى من هندسة BIM"}</small></div>
      <div className={design?.design&&analysis?.result?.ifcPlan?.walls?.length?"stage ready":"stage"}><span>{design?.design&&analysis?.result?.ifcPlan?.walls?.length?"✓":"5"}</span><b>الجولة التفاعلية</b><small>{design?.design&&analysis?.result?.ifcPlan?.walls?.length?"جاهزة للفتح":"بعد اكتمال 3D"}</small></div>
    </section>

    <section className="realProjectGrid">
      <div>
        {analysis?.result ? (
          <PlanReading
            imageUrl={`/api/uploads/${upload.id}/file`}
            analysis={analysis.result}
            rooms={roomsData}
          />
        ) : (
          <div className="realPreviewCard">
            <div className="cardHead"><div><b>المخطط الأصلي</b><small>الملف المحفوظ على Railway</small></div><a href={`/api/uploads/${upload.id}/file`} className="btn ghost">فتح الأصلي</a></div>
            <div className="realPreview">{preview}</div>
          </div>
        )}
        {analysis?.result&&roomsBusy&&<div className="roomsReadingNotice">جاري تحديد الغرف وأسمائها من المخطط الحقيقي…</div>}
      </div>

      <aside className="realStatus">
        <div className="statusCard good"><h3>رفع الملف</h3><p>تم الحفظ على تخزين دائم، وليس ملفًا مؤقتًا.</p><b>✓ مكتمل</b></div>

        <div className="statusCard">
          <h3>BIMy</h3>
          <p>{integration?.bimyConfigured
            ?"التكامل جاهز. عند التشغيل سيرسل بيتي المخطط الحقيقي إلى BIMy."
            :"تم حفظ المخطط. تكامل BIMy المباشر ما زال بانتظار التفعيل الرسمي، ولن نطلب منك عنوان API غير متوفر لديك."}</p>
          <button className="btn gold wide" onClick={runAnalysis} disabled={analyzing||!integration?.bimyConfigured}>
            {analyzing?"جاري إرسال المخطط إلى BIMy…":integration?.bimyConfigured?"تشغيل تحليل BIMy":"بانتظار تفعيل BIMy"}
          </button>
          {analysisError&&<div className="realError">{analysisError}</div>}
          {analysis&&<div className="realSuccess">✓ وصلت قراءة BIMy الحقيقية. {analysis?.result?.scanCounts?.walls??analysis?.result?.scan?.project?.scanProgress?.counts?.walls??0} جدار · {analysis?.result?.scanCounts?.doors??analysis?.result?.scan?.project?.scanProgress?.counts?.doors??0} باب · {analysis?.result?.scanCounts?.windows??analysis?.result?.scan?.project?.scanProgress?.counts?.windows??0} نافذة.</div>}
        </div>

        <div className="statusCard">
          <h3>OpenAI — المصمم الداخلي</h3>
          <p>{!integration?.aiStageEnabled?"مرحلة OpenAI موقوفة مؤقتًا إلى أن نعتمد المسار الهندسي بالكامل.":analysis?.result?"نتيجة BIMy الحقيقية موجودة. يمكنك تشغيل المصمم الداخلي الآن.":"يعمل فقط بعد وصول بيانات BIM الحقيقية."}</p>
          <button className="btn gold wide" onClick={runDesign} disabled={!analysis?.result||designing||!integration?.openaiConfigured||!integration?.aiStageEnabled}>{designing?"جاري التصميم…":!integration?.aiStageEnabled?"موقوف حتى اعتماد المسار":integration?.openaiConfigured?"تشغيل التصميم الداخلي":"بانتظار ربط OpenAI"}</button>
          {designError&&<div className="realError">{designError}</div>}
          {design&&<div className="realSuccess">✓ تم إنشاء التصميم بواسطة OpenAI.</div>}
        </div>

        <div className="statusCard mutedCard">
          <h3>3D</h3>
          <p>{analysis?.result?.ifcPlan?.walls?.length
            ?"تم استخراج هندسة IFC الحقيقية. عند اكتمال تصميم OpenAI يمكنك فتح المنزل المفروش."
            :"بيتي يكمل استخراج IFC الحقيقي من BIMy، ولن يستخدم نموذج البيت التجريبي."}</p>
          {analysis?.result?.ifcPlan?.walls?.length&&design?.design&&(
            <Link className="btn gold wide" href={`/project/${upload.id}/3d`}>فتح المنزل ثلاثي الأبعاد</Link>
          )}
        </div>
      </aside>
    </section>
  </main>;
}
