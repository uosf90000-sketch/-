"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import StudioSidebar from "@/components/StudioSidebar";

const cards=[
  {type:"كنبة",name:"كنبة زاوية",tag:"أثاث",tone:"sofa"},
  {type:"طاولة",name:"طاولة قهوة",tag:"أثاث",tone:"table"},
  {type:"سجادة",name:"سجادة ناعمة",tag:"منسوجات",tone:"rug"},
  {type:"كرسي",name:"كرسي مفرد",tag:"أثاث",tone:"chair"},
  {type:"إضاءة",name:"إضاءة معلقة",tag:"إنارة",tone:"lamp"},
  {type:"ستارة",name:"ستارة شفافة",tag:"منسوجات",tone:"curtain"},
  {type:"لوحة",name:"لوحة جدارية",tag:"إكسسوارات",tone:"art"},
  {type:"ديكور",name:"قطعة ديكور",tag:"إكسسوارات",tone:"decor"}
];

export default function MaterialsPage(){
  const params=useParams<{id:string}>();
  const id=params?.id;

  return <main className="approvedAppShell">
    <StudioSidebar projectId={id}/>

    <section className="approvedMain">
      <header className="approvedTopbar">
        <div className="approvedProjectCrumb"><Link href={"/project/"+id}>المخطط</Link><span>‹</span><b>المواد والمنتجات</b></div>
        <div className="approvedPlanTopActions">
          <Link href={"/project/"+id+"/3d"} className="approvedSoftBtn">عرض داخل 3D</Link>
          <button className="approvedGoldBtn">حفظ الاختيارات</button>
        </div>
      </header>

      <div className="approvedMaterialsPage">
        <section className="approvedMaterialsHero">
          <div>
            <span>اختر ما يناسب ذوقك</span>
            <h1>المواد والمنتجات</h1>
            <p>المكتبة جاهزة للربط بمنتجاتك الحقيقية لاحقًا، مع الأسعار والمقاسات والمخزون.</p>
          </div>
          <div className="approvedMaterialHeroArt">
            <span className="matBlock wood"/>
            <span className="matBlock stone"/>
            <span className="matBlock fabric"/>
          </div>
        </section>

        <section className="approvedMaterialsTools">
          <div className="approvedMaterialSearch">⌕ <span>ابحث عن منتج أو خامة…</span></div>
          <div className="approvedMaterialFilters">
            {["الكل","الأثاث","الإضاءة","السجاد","الستائر","الإكسسوارات"].map((x,i)=><button className={i===0?"active":""} key={x}>{x}</button>)}
          </div>
        </section>

        <section className="approvedProductGrid">
          {cards.map((p,i)=><article className="approvedProductCard" key={i}>
            <div className={"approvedProductVisual "+p.tone}>
              <span>{p.type}</span>
              <button>♡</button>
            </div>
            <div className="approvedProductInfo">
              <small>{p.tag}</small><b>{p.name}</b>
              <span>بانتظار ربط مكتبتك</span>
            </div>
          </article>)}
        </section>

        <section className="approvedPaletteSection">
          <div className="approvedSectionTitle"><h2>خيارات التشطيب والألوان</h2><span>اقتراحات أولية</span></div>
          <div className="approvedPaletteGrid">
            <div><span className="paletteSample wood"/><b>خشب طبيعي</b><small>دافئ · هادئ</small></div>
            <div><span className="paletteSample marble"/><b>رخام فاتح</b><small>حمامات · جدران</small></div>
            <div><span className="paletteSample concrete"/><b>رمادي حجري</b><small>أرضيات · مطابخ</small></div>
            <div><span className="paletteSample walnut"/><b>خشب جوز</b><small>أبواب · خزائن</small></div>
            <div><span className="paletteSample brass"/><b>نحاسي مطفي</b><small>إضاءة · إكسسوارات</small></div>
            <div><span className="paletteSample linen"/><b>كتان بيج</b><small>ستائر · أثاث</small></div>
          </div>
        </section>

        <section className="approvedMaterialsFoot">
          <div><b>مكتبتك الخاصة</b><span>عند إرفاق المكتبة، تستبدل هذه البطاقات تلقائيًا بالمنتجات الحقيقية.</span></div>
          <Link href={"/project/"+id+"/3d"} className="approvedGoldBtn">العودة إلى 3D ←</Link>
        </section>
      </div>
    </section>
  </main>;
}
