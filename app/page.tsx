"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";

const House3D=dynamic(()=>import("@/components/House3D"),{ssr:false});
const MAX_FILE_SIZE=25*1024*1024;

export default function Home(){
  const router=useRouter();
  const inputRef=useRef<HTMLInputElement>(null);
  const [file,setFile]=useState<File|null>(null);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState("");

  function chooseFile(){ inputRef.current?.click(); }

  function onFileChange(e:React.ChangeEvent<HTMLInputElement>){
    const picked=e.target.files?.[0]||null;
    setError("");
    if(!picked){setFile(null);return;}
    const ext=picked.name.split(".").pop()?.toLowerCase();
    const allowed=["pdf","jpg","jpeg","png","webp","dxf","dwg"];
    if(!ext || !allowed.includes(ext)){
      setError("صيغة الملف غير مدعومة. استخدم PDF أو JPG أو PNG أو WEBP أو DXF أو DWG.");
      e.target.value="";
      setFile(null);
      return;
    }
    if(picked.size>MAX_FILE_SIZE){
      setError("حجم الملف أكبر من 25MB.");
      e.target.value="";
      setFile(null);
      return;
    }
    setFile(picked);
  }

  async function uploadPlan(){
    if(!file){chooseFile();return;}
    setUploading(true);
    setError("");
    try{
      const form=new FormData();
      form.append("plan",file);
      const r=await fetch("/api/upload",{method:"POST",body:form});
      const body=await r.json();
      if(!r.ok || !body.ok) throw new Error(body.error||"فشل رفع المخطط");
      router.push(body.projectUrl);
    }catch(err){
      setError(err instanceof Error?err.message:"تعذر رفع المخطط");
    }finally{
      setUploading(false);
    }
  }

  return <main>
    <Header/>
    <section className="hero">
      <div className="heroCopy">
        <span className="kicker">من مخطط… إلى منزل أحلامك</span>
        <h1>ارفع مخطط منزلك<br/>لنحوّله إلى منزل ثلاثي الأبعاد<br/><em>مصمّم ومفروش بالكامل</em></h1>
        <p>بيتي يحلل مخططك، يبني النموذج ثلاثي الأبعاد، ثم يستخدم الذكاء الاصطناعي لتصميم كل غرفة: الأثاث، البوية، البلاط، المطبخ، الحمام، الإنارة والتكييف.</p>

        <input ref={inputRef} className="fileInput" type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.dxf,.dwg,application/pdf,image/jpeg,image/png,image/webp"
          onChange={onFileChange}/>

        <button type="button" className="uploadCard uploadButton" onClick={chooseFile}>
          <span className="uploadIcon">⇧</span>
          <div>
            <b>{file?"تم اختيار المخطط":"ارفع مخطط منزلك الآن"}</b>
            <small>{file?file.name:"PDF · JPG · PNG · WEBP · DXF · DWG"}</small>
            <small>{file?`${(file.size/1024/1024).toFixed(2)} MB`:"حد أقصى 25MB"}</small>
          </div>
        </button>

        {file&&<button type="button" className="btn gold uploadSubmit" disabled={uploading} onClick={uploadPlan}>
          {uploading?"جاري رفع وحفظ المخطط…":"رفع المخطط وبدء المشروع"}
        </button>}
        {error&&<p className="uploadError">{error}</p>}

        <div className="heroActions">
          <Link className="btn ghost" href="/project/demo">عرض تجريبي منفصل</Link>
          <Link className="btn ghost" href="/tour/demo">شاهد الجولة التفاعلية</Link>
        </div>
      </div>

      <div className="heroScene">
        <House3D mode="overview"/>
        <div className="sceneStat stat1"><b>3D</b><small>مع أثاث وخامات</small></div>
        <div className="sceneStat stat2"><b>360°</b><small>جولة بمستوى العين</small></div>
        <Link href="/tour/demo" className="tourPill">▶ شاهد نموذج الجولة</Link>
      </div>
    </section>

    <section className="features" id="features">
      {[
        ["⌕","تحليل ذكي للمخطط","BIMy"],
        ["◇","نموذج 3D","من هندسة المخطط"],
        ["✦","تصميم داخلي","OpenAI"],
        ["▣","أثاث وديكور","مفروش بالكامل"],
        ["☼","إضاءة واقعية","توزيع ذكي"],
        ["▤","مواد وتشطيبات","كل عنصر معروف"],
        ["360°","تجربة تفاعلية","مستوى العين"]
      ].map(([i,t,s])=><div className="feature" key={t}><i>{i}</i><b>{t}</b><small>{s}</small></div>)}
    </section>

    <section className="how" id="how"><h2>من المخطط إلى التجربة</h2><div className="steps">
      <div><span>1</span><b>ارفع المخطط</b><p>يحفظ فعليًا في مشروعك.</p></div>
      <div><span>2</span><b>تحليل BIMy</b><p>من الـAPI الحقيقي بعد الربط.</p></div>
      <div><span>3</span><b>OpenAI يصمم</b><p>من بيانات المخطط الحقيقية.</p></div>
      <div><span>4</span><b>عِش البيت</b><p>جولة 3D تفاعلية بمستوى العين.</p></div>
    </div></section>
  </main>;
}
