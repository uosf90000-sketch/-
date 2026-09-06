export type ElementInfo = {
  id:string;
  category:"wall"|"floor"|"sofa"|"table"|"light"|"ac"|"kitchen"|"bathroom"|"door"|"window";
  name:string;
  color:string;
  material:string;
  size?:string;
  quantity?:string;
  price?:string;
};

export const demoElements: ElementInfo[] = [
  {id:"wall-main",category:"wall",name:"دهان حائط فاخر",color:"بيج رملي دافئ",material:"دهان مطفي فاخر",quantity:"32 م²",price:"2,400 ريال"},
  {id:"floor-main",category:"floor",name:"بورسلان رخامي",color:"Greige",material:"بورسلان مطفي",size:"120 × 120 سم",quantity:"42 م²",price:"4,998 ريال"},
  {id:"sofa-main",category:"sofa",name:"كنبة مودرن فاخرة",color:"رمادي دافئ",material:"قماش كتّان فاخر",size:"320 × 100 × 85 سم",quantity:"1",price:"9,800 ريال"},
  {id:"table-main",category:"table",name:"طاولة قهوة",color:"رخامي فاتح",material:"رخام صناعي + خشب",size:"140 سم",quantity:"1",price:"2,150 ريال"},
  {id:"light-main",category:"light",name:"إنارة خطية مخفية",color:"3000K",material:"LED CRI 90+",quantity:"18 م طولي",price:"1,950 ريال"},
  {id:"ac-main",category:"ac",name:"تكييف مخفي",color:"أبيض",material:"Ducted Split",size:"2.5 طن",quantity:"1",price:"8,500 ريال"},
  {id:"kitchen-main",category:"kitchen",name:"مطبخ كامل",color:"خشب جوز + كشمير",material:"MDF مقاوم للرطوبة + كوارتز",size:"9.8 م طولي",price:"38,000 ريال"},
  {id:"window-main",category:"window",name:"نافذة بانورامية",color:"أسود مطفي",material:"ألمنيوم + زجاج مزدوج",size:"240 × 220 سم",quantity:"2",price:"7,600 ريال"}
];

export const rooms = [
  {id:"majlis",name:"المجلس"},
  {id:"kitchen",name:"المطبخ"},
  {id:"bedroom",name:"غرفة النوم"},
  {id:"bathroom",name:"الحمام"}
];
