"use client";

import dynamic from "next/dynamic";
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

  function chooseFile(){inputRef.current?.click()}
  function onFileChange(e:React.ChangeEvent<HTMLInputElement>){
    const picked=e.target.files?.[0]||null;
    setError("");
    if(!picked){setFile(null);return}
    const ext=picked.name.split(".").pop()?.toLowerCase();
    const allowed=["pdf","jpg","jpeg","png","webp","dxf","dwg"];
    if(!ext||!allowed.includes(ext)){
      setError("صيغة الملف غير مدعومة. استخدم PDF أو صورة أو DXF/DWG.");
      e.target.value="";setFile(null);return;
    }
    if(picked.size>MAX_FILE_SIZE){
      setError("حجم الملف أكبر من 25MB.");
      e.target.value="";setFile(null);return;
    }
    setFile(picked);
  }
  async function uploadPlan(){
    if(!file){chooseFile();return}
    setUploading(true);setError("");
    try{
      const form=new FormData();form.append("plan",file);
      const r=await fetch("/api/upload",{method:"POST",body:form});
      const body=await r.json();
      if(!r.ok||!body.ok)throw new Error(body.error||"فشل رفع المخطط");
      router.push(body.projectUrl);
    }catch(err){setError(err instanceof Error?err.message:"تعذر رفع المخطط")}
    finally{setUploading(false)}
  }

  return <main className="baytiHome">
    <Header/>

    <section className="studioHero">
      <div className="studioHeroCopy">
        <div className="studioEyebrow"><span/> منصة تصميم داخلي مبنية على هندسة منزلك</div>
        <h1>من مخطط ثنائي الأبعاد<br/><em>إلى منزل يمكنك أن تعيشه.</em></h1>
        <p>بيتي يحوّل المخطط الحقيقي إلى هندسة 3D، ثم يضيف التصميم الداخلي والأثاث والمواد والإنارة، ويمنحك جولة تفاعلية بمستوى العين.</p>

        <input ref={inputRef} className="fileInput" type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.dxf,.dwg,application/pdf,image/jpeg,image/png,image/webp"
          onChange={onFileChange}/>

        <div className="studioUploadCard">
          <button className="studioUploadDrop" type="button" onClick={chooseFile}>
            <span className="studioUploadGlyph">
              <svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/></svg>
            </span>
            <span className="studioUploadText">
              <b>{file?file.name:"اسحب مخططك هنا أو اختر ملفًا"}</b>
              <small>{file?(file.size/1024/1024).toFixed(2)+" MB":"PDF · JPG · PNG · DXF · DWG — حتى 25MB"}</small>
            </span>
            <span className="studioUploadBrowse">{file?"تغيير":"اختيار"}</span>
          </button>

          <button className="studioPrimaryCta" type="button" disabled={uploading} onClick={uploadPlan}>
            {uploading?"جاري إنشاء المشروع…":file?"ابدأ تحليل هذا المخطط":"اختر مخططًا للبدء"}
            <span>←</span>
          </button>
        </div>

        {error&&<div className="studioError">{error}</div>}

        <div className="studioTrustRow">
          <span><i>01</i><b>BIMy</b><small>هندسة حقيقية</small></span>
          <span><i>02</i><b>OpenAI</b><small>مصمم داخلي</small></span>
          <span><i>03</i><b>Interactive 3D</b><small>جولة بمستوى العين</small></span>
        </div>
      </div>

      <div className="studioHeroVisual">
        <div className="studioSceneFrame">
          <House3D mode="overview"/>
          <div className="studioSceneTop">
            <span className="studioSceneLabel"><i/> LIVE 3D</span>
            <span>منظور معماري</span>
          </div>
          <div className="studioSceneDock">
            <div><small>الجدران</small><b>IFC</b></div>
            <div><small>الخامات</small><b>Real-time</b></div>
            <div><small>الجولة</small><b>Eye-level</b></div>
          </div>
        </div>

        <div className="studioFloatCard cardA">
          <span className="floatIcon">✦</span>
          <div><small>المصمم الداخلي</small><b>كل غرفة لها قرار تصميم</b></div>
        </div>
        <div className="studioFloatCard cardB">
          <span className="floatIcon">⌖</span>
          <div><small>تجربة تفاعلية</small><b>اضغط أي عنصر واعرف تفاصيله</b></div>
        </div>
      </div>
    </section>

    <section className="studioBento" id="features">
      <article className="bentoCard bentoLarge">
        <span className="bentoIndex">01 / فهم المخطط</span>
        <h2>بيتي لا يرسم فوق الصورة فقط.<br/>يبني هندسة يمكن الاعتماد عليها.</h2>
        <p>BIMy يقرأ الجدران والفتحات والمقياس، وبيتي يحاذيها مع المخطط الأصلي ويحوّلها إلى IFC و3D.</p>
        <div className="bentoMetrics">
          <span><small>Wall geometry</small><b>IFC</b></span>
          <span><small>Overlay</small><b>Aligned</b></span>
          <span><small>Scale</small><b>Measured</b></span>
        </div>
      </article>

      <article className="bentoCard bentoMetric">
        <span className="bentoPill">3D</span>
        <strong>منظور علوي</strong>
        <p>تحقق سريع من الجدران والفراغات قبل التصميم.</p>
      </article>

      <article className="bentoCard bentoMetric">
        <span className="bentoPill">EYE</span>
        <strong>مستوى العين</strong>
        <p>تدخل البيت كأنك تمشي داخله.</p>
      </article>

      <article className="bentoCard bentoInteractive" id="experience">
        <div>
          <span className="bentoIndex">02 / التجربة التفاعلية</span>
          <h3>المؤشر يتحول إلى أداة استكشاف.</h3>
          <p>مرّ على الجدار أو البلاط أو قطعة الأثاث؛ العنصر يضيء. اضغط عليه لتظهر بطاقة المنتج والخامة واللون والمقاس والسعر والكمية.</p>
        </div>
        <div className="interactionDemo">
          <div className="demoRoom">
            <span className="demoWall"/>
            <span className="demoSofa"/>
            <span className="demoCursor">⌖</span>
            <div className="demoCard"><small>دهان الجدار</small><b>Warm Limestone</b><span>12.4 م² · معلومات المنتج ←</span></div>
          </div>
        </div>
      </article>
    </section>

    <section className="studioHow" id="how">
      <div className="studioHowHead">
        <span>من المخطط إلى التجربة</span>
        <h2>مسار واحد واضح، بدون قفزات وهمية.</h2>
      </div>
      <div className="studioSteps">
        {[
          ["01","ارفع المخطط","يحفظ داخل مشروعك ويرتبط بنتيجة التحليل."],
          ["02","نثبت الهندسة","BIMy + IFC + قراءة الأبواب والمحاذاة."],
          ["03","نصمم الداخل","OpenAI يختار الأسلوب والتوزيع والمواد."],
          ["04","تعيش البيت","3D + مستوى العين + عناصر قابلة للنقر."]
        ].map(([n,t,p])=><div className="studioStep" key={n}><span>{n}</span><b>{t}</b><p>{p}</p></div>)}
      </div>
    </section>

    <section className="studioFinalCta">
      <div><span>بيتك قبل أن يُبنى</span><h2>شاهده. غيّره. عِشه.</h2></div>
      <button className="studioPrimaryCta" onClick={chooseFile}>ابدأ بمخططك <span>←</span></button>
    </section>
  </main>;
}
