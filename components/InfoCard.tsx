import type { ElementInfo } from "@/lib/design";

export default function InfoCard({item,compact=false,onClose}:{item:ElementInfo;compact?:boolean;onClose?:()=>void}){
  return <div className={compact?"infoCard compact":"infoCard"}>
    {onClose&&<button className="close" onClick={onClose}>×</button>}
    <div className="swatch" style={{background:item.category==="sofa"?"#b9aa94":item.category==="wall"?"#d7c5ad":"#c6b7a1"}}/>
    <div className="infoBody">
      <span className="badge">{item.category}</span>
      <h3>{item.name}</h3>
      <dl><div><dt>اللون</dt><dd>{item.color}</dd></div><div><dt>الخامة</dt><dd>{item.material}</dd></div>{item.size&&<div><dt>المقاس</dt><dd>{item.size}</dd></div>}{item.quantity&&<div><dt>الكمية</dt><dd>{item.quantity}</dd></div>}{item.price&&<div><dt>السعر التقريبي</dt><dd>{item.price}</dd></div>}</dl>
      {!compact&&<><div className="alternatives"><span/><span/><span/><span/></div><button className="btn gold wide">عرض التفاصيل والبدائل</button></>}
    </div>
  </div>;
}
