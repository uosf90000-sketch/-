"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items=[
  {href:"/dashboard",label:"لوحة التحكم",icon:"⌂"},
  {href:"/dashboard",label:"المشاريع",icon:"▣"},
  {href:"/dashboard",label:"المخططات",icon:"⌗"},
  {href:"/dashboard",label:"التصميم",icon:"✣"},
  {href:"/dashboard",label:"المواد والمنتجات",icon:"▦"},
  {href:"/dashboard",label:"الإضاءة",icon:"☼"},
  {href:"/dashboard",label:"المكتبة",icon:"□"},
  {href:"/dashboard",label:"التقارير",icon:"▤"},
  {href:"/dashboard",label:"الإعدادات",icon:"⚙"}
];

export default function StudioSidebar({projectId}:{projectId?:string}){
  const path=usePathname();
  const resolved=items.map((item,index)=>{
    if(!projectId)return item;
    if(index===2)return {...item,href:"/project/"+projectId};
    if(index===3)return {...item,href:"/project/"+projectId+"/3d"};
    if(index===4)return {...item,href:"/project/"+projectId+"/materials"};
    return item;
  });

  return <aside className="approvedSidebar">
    <Link href="/" className="approvedSideBrand">
      <span className="approvedLogoMark">⌂</span>
      <span><b>BAYTI</b><small>LIVING TWIN</small></span>
    </Link>

    <nav className="approvedSideNav">
      {resolved.map((item,index)=>{
        const active=index===2
          ? path?.includes("/project/")&&!path?.includes("/3d")&&!path?.includes("/materials")
          : index===3
            ? path?.includes("/3d")
            : index===4
              ? path?.includes("/materials")
              : path===item.href&&index===0;
        return <Link key={index} href={item.href} className={active?"active":""}>
          <i>{item.icon}</i><span>{item.label}</span>
        </Link>
      })}
    </nav>

    <div className="approvedSideFoot">
      <span>بيتك يبدأ من فكرة</span>
      <b>ونحن نحوّلها إلى واقع</b>
    </div>
  </aside>;
}
