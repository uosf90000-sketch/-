"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Header from "@/components/Header";
const House3D=dynamic(()=>import("@/components/House3D"),{ssr:false});

export default function Home(){
  return <main>
    <Header/>
    <section className="hero">
      <div className="heroCopy">
        <span className="kicker">من مخطط… إلى منزل أحلامك</span>
        <h1>ارفع مخطط منزلك<br/>لنحوّله إلى منزل ثلاثي الأبعاد<br/><em>مصمّم ومفروش بالكامل</em></h1>
        <p>بيتي يحلل مخططك، يبني النموذج ثلاثي الأبعاد، ثم يستخدم الذكاء الاصطناعي لتصميم كل غرفة: الأثاث، البوية، البلاط، المطبخ، الحمام، الإنارة والتكييف.</p>
        <Link href="/project/demo" className="uploadCard"><span className="uploadIcon">⇧</span><div><b>ارفع مخطط منزلك الآن</b><small>PDF · JPG · PNG · DXF</small><small>أو افتح المنزل التجريبي</small></div></Link>
        <div className="heroActions"><Link className="btn gold" href="/project/demo">جرّب منزلًا تجريبيًا</Link><Link className="btn ghost" href="/tour/demo">شاهد الجولة التفاعلية</Link></div>
      </div>
      <div className="heroScene">
        <House3D mode="overview"/>
        <div className="sceneStat stat1"><b>240 م²</b><small>المساحة</small></div>
        <div className="sceneStat stat2"><b>5</b><small>غرف</small></div>
        <Link href="/tour/demo" className="tourPill">▶ جولة بمستوى العين</Link>
      </div>
    </section>
    <section className="features" id="features">
      {[
        ["⌕","تحليل ذكي للمخطط","BIMy"],
        ["◇","نموذج 3D","هندسة دقيقة"],
        ["✦","تصميم داخلي","OpenAI"],
        ["▣","أثاث وديكور","مفروش بالكامل"],
        ["☼","إضاءة واقعية","توزيع ذكي"],
        ["▤","مواد وتشطيبات","كل عنصر معروف"],
        ["360°","تجربة تفاعلية","مستوى العين"]
      ].map(([i,t,s])=><div className="feature" key={t}><i>{i}</i><b>{t}</b><small>{s}</small></div>)}
    </section>
    <section className="how" id="how"><h2>من المخطط إلى التجربة</h2><div className="steps">
      <div><span>1</span><b>ارفع المخطط</b><p>ارفع ملفك كما هو.</p></div>
      <div><span>2</span><b>تحليل BIMy</b><p>غرف، جدران، أبواب ونوافذ.</p></div>
      <div><span>3</span><b>OpenAI يصمم</b><p>أثاث، خامات وإنارة.</p></div>
      <div><span>4</span><b>عِش البيت</b><p>جولة 3D تفاعلية بمستوى العين.</p></div>
    </div></section>
  </main>;
}
