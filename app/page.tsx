"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
    if(!ext||!["pdf","jpg","jpeg","png","webp","dxf","dwg"].includes(ext)){
      setError("صيغة الملف غير مدعومة.");e.target.value="";setFile(null);return;
    }
    if(picked.size>MAX_FILE_SIZE){
      setError("حجم الملف أكبر من 25MB.");e.target.value="";setFile(null);return;
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

  return <main className="approvedLanding">
    <header className="approvedLandingNav">
      <Link href="/" className="approvedLandingBrand">
        <span className="approvedLogoMark">⌂</span>
        <span><b>BAYTI</b><small>LIVING TWIN</small></span>
      </Link>

      <nav>
        <a href="#how">المفهوم</a>
        <a href="#features">التصميم</a>
        <a href="#library">المكتبة</a>
        <a href="#support">الدعم</a>
      </nav>

      <div className="approvedLandingActions">
        <Link href="/dashboard">لوحة التحكم</Link>
        <button>☰</button>
      </div>
    </header>

    <section className="approvedLandingHero">
      <div className="approvedLandingBackdrop"/>
      <div className="approvedLandingHeroCopy">
        <span className="approvedHeroEyebrow">من صورة إلى منزل قابل للاستكشاف</span>
        <h1>حوّل مخططك إلى <em>Living Twin</em></h1>
        <p>من صورة إلى نموذج ثلاثي الأبعاد، ثم تصميم داخلي وتجربة تفاعلية كاملة.</p>

        <input ref={inputRef} className="fileInput" type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.dxf,.dwg,application/pdf,image/jpeg,image/png,image/webp"
          onChange={onFileChange}/>

        <div className="approvedHeroUpload">
          <button type="button" className="approvedHeroUploadMain" onClick={chooseFile}>
            <span className="approvedHeroUploadText">
              <b>{file?file.name:"ارفع مخططك الآن"}</b>
              <small>{file?(file.size/1024/1024).toFixed(2)+" MB":"JPG · PNG · PDF · DXF · IFC"}</small>
            </span>
            <span className="approvedUploadIcon">↥</span>
          </button>
          {file&&<button className="approvedAnalyzeBtn" onClick={uploadPlan} disabled={uploading}>
            {uploading?"جاري إنشاء المشروع…":"ابدأ التحليل ←"}
          </button>}
        </div>
        {error&&<div className="approvedHeroError">{error}</div>}
      </div>

      <div className="approvedHeroDollhouse">
        <div className="approvedBlueprintSheet"/>
        <div className="approvedDollhouseFrame"><House3D mode="overview"/></div>
      </div>

      <div className="approvedHeroStats">
        <span><b>دقائق</b><small>من المخطط إلى التوأم</small></span>
        <span><b>3D حي</b><small>قابل للدوران والمشي</small></span>
        <span><b>مواد حقيقية</b><small>تربط لاحقًا بمكتبتك</small></span>
      </div>
    </section>

    <section className="approvedLandingFeatures" id="features">
      <div><i>01</i><b>افهم المخطط</b><small>BIMy + IFC + محاذاة حقيقية</small></div>
      <div><i>02</i><b>صمّم المساحات</b><small>OpenAI يختار التوزيع والمواد</small></div>
      <div><i>03</i><b>استكشف البيت</b><small>Dollhouse + Walk + Orbit</small></div>
      <div><i>04</i><b>جهّزه</b><small>الأثاث والإنارة والتكييف والتشطيبات</small></div>
    </section>
  </main>;
}
