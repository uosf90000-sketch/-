"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";

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
  const [integration,setIntegration]=useState<{bimyConfigured:boolean;openaiConfigured:boolean}|null>(null);

  useEffect(()=>{
    if(!id)return;
    Promise.all([
      fetch(`/api/uploads/${id}`).then(r=>r.json()),
      fetch("/api/health").then(r=>r.json())
    ]).then(([body,health])=>{
      if(body.ok)setUpload(body.upload);
      setIntegration({bimyConfigured:Boolean(health?.bimyConfigured),openaiConfigured:Boolean(health?.openaiConfigured)});
    }).finally(()=>setLoading(false));
  },[id]);

  const preview=useMemo(()=>{
    if(!upload)return null;
    const url=`/api/uploads/${upload.id}/file`;
    if(["jpg","jpeg","png","webp"].includes(upload.extension)) return <img className="realPlanImage" src={url} alt={upload.name}/>;
    if(upload.extension==="pdf") return <iframe className="realPlanPdf" src={url} title={upload.name}/>;
    return <div className="noPreview"><b>{upload.extension.toUpperCase()}</b><p>تم حفظ الملف فعليًا. المعاينة البصرية لهذه الصيغة ستظهر بعد تحويلها عبر BIMy.</p><a className="btn ghost" href={url}>فتح الملف الأصلي</a></div>;
  },[upload]);

  async function runAnalysis(){
    if(!upload)return;
    setAnalyzing(true);setAnalysisError("");setAnalysis(null);
    try{
      await fetch("/api/bimy/recover",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uploadId:upload.id})});
      const r=await fetch("/api/analyze",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({uploadId:upload.id})});
      const body=await r.json();
      if(!r.ok||!body.ok) throw new Error(body.error||"فشل تحليل BIMy");
      setAnalysis(body);
    }catch(e){setAnalysisError(e instanceof Error?e.message:"فشل تحليل BIMy");}
    finally{setAnalyzing(false);}
  }

  async function runDesign(){
    if(!analysis?.result)return;
    setDesigning(true);setDesignError("");setDesign(null);
    try{
      const r=await fetch("/api/design",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({bim:analysis.result,style:"عصري دافئ"})});
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
      <div className="stage"><span>4</span><b>3D الحقيقي</b><small>يبنى من هندسة BIM</small></div>
      <div className="stage"><span>5</span><b>الجولة التفاعلية</b><small>بعد اكتمال 3D</small></div>
    </section>

    <section className="realProjectGrid">
      <div className="realPreviewCard">
        <div className="cardHead"><div><b>المخطط الأصلي</b><small>الملف المحفوظ على Railway</small></div><a href={`/api/uploads/${upload.id}/file`} className="btn ghost">فتح الأصلي</a></div>
        <div className="realPreview">{preview}</div>
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
          {analysis&&<div className="realSuccess">✓ رجعت نتيجة حقيقية من BIMy.</div>}
        </div>

        <div className="statusCard">
          <h3>OpenAI — المصمم الداخلي</h3>
          <p>يعمل فقط بعد وصول بيانات BIM الحقيقية.</p>
          <button className="btn gold wide" onClick={runDesign} disabled={!analysis?.result||designing||!integration?.openaiConfigured}>{designing?"جاري التصميم…":integration?.openaiConfigured?"تشغيل التصميم الداخلي":"بانتظار ربط OpenAI"}</button>
          {designError&&<div className="realError">{designError}</div>}
          {design&&<div className="realSuccess">✓ تم إنشاء التصميم بواسطة OpenAI.</div>}
        </div>

        <div className="statusCard mutedCard"><h3>3D</h3><p>لن أستخدم نموذج البيت التجريبي لهذا المشروع. عند توفر هندسة BIMy سأحوّلها إلى المشهد ثلاثي الأبعاد الحقيقي، ثم نضيف الأثاث والتشطيبات.</p></div>
      </aside>
    </section>
  </main>;
}
