"use client";

import { useEffect, useMemo, useState } from "react";

type RoomBox={
  name:string;
  type:string;
  confidence:number;
  bbox:{x:number;y:number;width:number;height:number};
};

type Alignment={
  left:number;
  top:number;
  width:number;
  height:number;
  score:number;
};

function num(v:any){return typeof v==="number"&&Number.isFinite(v)?v:0}
function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v))}

function buildWallSamples(walls:any[],minX:number,minY:number,maxX:number,maxY:number){
  const dx=maxX-minX,dy=maxY-minY;
  if(!(dx>0&&dy>0))return [] as {u:number;v:number}[];
  const samples:{u:number;v:number}[]=[];
  for(const wall of walls){
    const x1=num(wall.x1),y1=num(wall.y1),x2=num(wall.x2),y2=num(wall.y2);
    const length=Math.hypot(x2-x1,y2-y1);
    const steps=clamp(Math.ceil(length*3.2),4,28);
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      samples.push({
        u:(x1+(x2-x1)*t-minX)/dx,
        v:1-(y1+(y2-y1)*t-minY)/dy
      });
    }
  }
  return samples;
}

function localDarknessField(data:Uint8ClampedArray,w:number,h:number){
  const src=new Uint8Array(w*h);
  for(let i=0,p=0;i<data.length;i+=4,p++){
    const r=data[i],g=data[i+1],b=data[i+2];
    const lum=.2126*r+.7152*g+.0722*b;
    src[p]=Math.round(clamp((205-lum)/165,0,1)*255);
  }
  const tmp=new Uint8Array(w*h);
  const out=new Uint8Array(w*h);
  const radius=2;
  for(let y=0;y<h;y++){
    const row=y*w;
    for(let x=0;x<w;x++){
      let m=0;
      for(let k=-radius;k<=radius;k++){
        const xx=x+k;
        if(xx>=0&&xx<w)m=Math.max(m,src[row+xx]);
      }
      tmp[row+x]=m;
    }
  }
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let m=0;
      for(let k=-radius;k<=radius;k++){
        const yy=y+k;
        if(yy>=0&&yy<h)m=Math.max(m,tmp[yy*w+x]);
      }
      out[y*w+x]=m;
    }
  }
  return out;
}

function scoreAlignment(
  field:Uint8Array,w:number,h:number,
  samples:{u:number;v:number}[],
  a:{left:number;top:number;width:number;height:number}
){
  let sum=0,inside=0;
  for(const s of samples){
    const x=Math.round((a.left+s.u*a.width)*w);
    const y=Math.round((a.top+s.v*a.height)*h);
    if(x<0||x>=w||y<0||y>=h)continue;
    sum+=field[y*w+x];
    inside++;
  }
  if(inside<samples.length*.82)return -1;
  return sum/inside;
}

function autoAlign(
  field:Uint8Array,w:number,h:number,
  samples:{u:number;v:number}[]
):Alignment|null{
  if(samples.length<20)return null;

  let best={left:.055,top:.045,width:.89,height:.91,score:-1};

  // بحث أول واسع: مستقل في X/Y حتى يصحّح القصّ أو اختلاف نسبة الصورة.
  for(let left=-.01;left<=.161;left+=.028){
    for(let top=-.01;top<=.161;top+=.028){
      for(let width=.76;width<=1.001;width+=.04){
        for(let height=.76;height<=1.001;height+=.04){
          const score=scoreAlignment(field,w,h,samples,{left,top,width,height});
          if(score>best.score)best={left,top,width,height,score};
        }
      }
    }
  }

  // تحسين دقيق حول أفضل حل.
  for(const step of [.012,.004]){
    const start={...best};
    for(let dl=-3;dl<=3;dl++){
      for(let dt=-3;dt<=3;dt++){
        for(let dw=-3;dw<=3;dw++){
          for(let dh=-3;dh<=3;dh++){
            const candidate={
              left:start.left+dl*step,
              top:start.top+dt*step,
              width:start.width+dw*step,
              height:start.height+dh*step
            };
            if(candidate.width<.62||candidate.width>1.08||candidate.height<.62||candidate.height>1.08)continue;
            const score=scoreAlignment(field,w,h,samples,candidate);
            if(score>best.score)best={...candidate,score};
          }
        }
      }
    }
  }

  return best.score>18?best:null;
}

export default function PlanReading({
  imageUrl,
  analysis,
  rooms
}:{
  imageUrl:string;
  analysis:any;
  rooms:RoomBox[];
}){
  const scanProject=analysis?.scan?.project||{};
  const scale=scanProject?.scanScale||{};
  const plan=analysis?.ifcPlan||null;
  const walls=Array.isArray(plan?.walls)?plan.walls:[];
  const openings=Array.isArray(plan?.openings)?plan.openings:[];
  const scanCounts=analysis?.scanCounts||scanProject?.scanProgress?.counts||{};
  const ifcCounts=analysis?.ifcCounts||{};
  const inferredRooms=Array.isArray(analysis?.inferredRooms)?analysis.inferredRooms:[];

  const [rasterSize,setRasterSize]=useState<{width:number;height:number}|null>(null);
  const [alignment,setAlignment]=useState<Alignment|null>(null);
  const [aligning,setAligning]=useState(walls.length>0);
  const [alignError,setAlignError]=useState(false);

  const imageWidth=rasterSize?.width||num(scale.imageWidth)||1000;
  const imageHeight=rasterSize?.height||num(scale.imageHeight)||1400;

  const doorCount=openings.filter((o:any)=>o.kind==="door").length || num(ifcCounts.doors) || num(scanCounts.doors);
  const windowCount=openings.filter((o:any)=>o.kind==="window").length || num(ifcCounts.windows) || num(scanCounts.windows);
  const wallCount=walls.length || num(ifcCounts.walls) || num(scanCounts.walls);
  const roomCount=rooms.length || inferredRooms.length || num(ifcCounts.spaces);

  const bounds=useMemo(()=>{
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const w of walls){
      for(const x of [num(w.x1),num(w.x2)]){minX=Math.min(minX,x);maxX=Math.max(maxX,x)}
      for(const y of [num(w.y1),num(w.y2)]){minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
    }
    return {minX,minY,maxX,maxY,valid:walls.length>0&&Number.isFinite(minX)&&maxX>minX&&maxY>minY};
  },[walls]);

  useEffect(()=>{
    let cancelled=false;
    if(!bounds.valid||!imageUrl){setAligning(false);return;}

    setAligning(true);
    setAlignError(false);
    setAlignment(null);

    const img=new Image();
    img.onload=()=>{
      if(cancelled)return;
      const naturalW=img.naturalWidth||num(scale.imageWidth)||1000;
      const naturalH=img.naturalHeight||num(scale.imageHeight)||1400;
      setRasterSize({width:naturalW,height:naturalH});

      const maxSide=720;
      const ratio=Math.min(1,maxSide/Math.max(naturalW,naturalH));
      const w=Math.max(1,Math.round(naturalW*ratio));
      const h=Math.max(1,Math.round(naturalH*ratio));
      const canvas=document.createElement("canvas");
      canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext("2d",{willReadFrequently:true});
      if(!ctx){setAlignError(true);setAligning(false);return;}
      ctx.drawImage(img,0,0,w,h);
      const pixels=ctx.getImageData(0,0,w,h).data;
      const field=localDarknessField(pixels,w,h);
      const samples=buildWallSamples(walls,bounds.minX,bounds.minY,bounds.maxX,bounds.maxY);

      setTimeout(()=>{
        if(cancelled)return;
        const result=autoAlign(field,w,h,samples);
        if(result){
          setAlignment(result);
          try{localStorage.setItem("bayti-overlay-v3:"+imageUrl,JSON.stringify(result))}catch{}
        }else{
          setAlignError(true);
        }
        setAligning(false);
      },20);
    };
    img.onerror=()=>{if(!cancelled){setAlignError(true);setAligning(false)}};
    img.src=imageUrl;

    try{
      const cached=localStorage.getItem("bayti-overlay-v3:"+imageUrl);
      if(cached){
        const parsed=JSON.parse(cached);
        if(parsed&&Number.isFinite(parsed.left)&&Number.isFinite(parsed.width))setAlignment(parsed);
      }
    }catch{}

    return()=>{cancelled=true};
  },[imageUrl,walls,bounds.valid,bounds.minX,bounds.minY,bounds.maxX,bounds.maxY,scale.imageWidth,scale.imageHeight]);

  const hasIfc=bounds.valid;
  const active=alignment;
  const tx=(x:number)=>{
    if(!active||!hasIfc)return 0;
    const u=(x-bounds.minX)/(bounds.maxX-bounds.minX);
    return (active.left+u*active.width)*imageWidth;
  };
  const ty=(y:number)=>{
    if(!active||!hasIfc)return 0;
    const v=1-(y-bounds.minY)/(bounds.maxY-bounds.minY);
    return (active.top+v*active.height)*imageHeight;
  };
  const pxPerMeter=active&&hasIfc
    ? ((active.width*imageWidth)/(bounds.maxX-bounds.minX)+(active.height*imageHeight)/(bounds.maxY-bounds.minY))/2
    : 0;

  const wallById=new Map<number,any>();
  walls.forEach((w:any)=>wallById.set(w.entityId,w));

  return <section className="readingCard">
    <div className="readingHead">
      <div>
        <span className="kicker">قراءة المخطط</span>
        <h2>ما الذي فهمه بيتي من المخطط؟</h2>
        <p>الـIFC للهندسة والـ3D، وبيتي يحاذي الجدران تلقائيًا مع صورة المخطط الأصلية قبل عرضها.</p>
      </div>
      <div className="readingStatus">
        {aligning?"جارٍ ضبط المحاذاة…":alignError?"المحاذاة تحتاج مراجعة":analysis?.scanStatus==="ready"?"✓ القراءة والمحاذاة جاهزة":"قيد استكمال الهندسة"}
      </div>
    </div>

    <div className="readingStats">
      <div><span>الغرف/الفراغات</span><b>{roomCount}</b></div>
      <div><span>الجدران</span><b>{wallCount}</b></div>
      <div><span>الأبواب</span><b>{doorCount}</b></div>
      <div><span>النوافذ</span><b>{windowCount}</b></div>
    </div>

    <div className="planOverlayWrap">
      <svg viewBox={`0 0 ${imageWidth} ${imageHeight}`} className="planOverlaySvg" preserveAspectRatio="xMidYMid meet">
        <image href={imageUrl} x="0" y="0" width={imageWidth} height={imageHeight} opacity="0.64"/>

        {active&&rooms.length===0&&hasIfc&&inferredRooms.map((room:any,i:number)=>{
          const points=Array.isArray(room?.polygon)?room.polygon:[];
          if(points.length<3)return null;
          const pts=points.map((p:any)=>String(tx(num(p.x)))+","+String(ty(num(p.y)))).join(" ");
          const cx=tx(num(room?.center?.x));
          const cy=ty(num(room?.center?.y));
          return <g key={room.id||i}>
            <polygon points={pts} fill="rgba(89,180,221,.07)" stroke="rgba(89,180,221,.38)" strokeWidth={1.5}/>
            <rect x={cx-42} y={cy-15} width={84} height={30} rx={9} fill="rgba(21,28,34,.82)"/>
            <text x={cx} y={cy+5} textAnchor="middle" fill="#fff" fontSize={13} fontWeight="700">
              {room?.areaM2 ? Number(room.areaM2).toFixed(1)+" م²" : "فراغ "+String(i+1)}
            </text>
          </g>;
        })}

        {rooms.map((room,i)=>{
          const x=room.bbox.x/1000*imageWidth;
          const y=room.bbox.y/1000*imageHeight;
          const w=room.bbox.width/1000*imageWidth;
          const h=room.bbox.height/1000*imageHeight;
          return <g key={`${room.name}-${i}`}>
            <rect x={x} y={y} width={w} height={h} rx={8}
              fill="rgba(89,180,221,.08)" stroke="rgba(89,180,221,.34)" strokeWidth={2}/>
            <rect x={x+5} y={y+5} width={Math.max(70,room.name.length*13)} height={28} rx={8}
              fill="rgba(21,28,34,.82)"/>
            <text x={x+13} y={y+24} fill="#fff" fontSize={15} fontWeight="700">{room.name}</text>
          </g>;
        })}

        {active&&hasIfc&&walls.map((wall:any)=>{
          const width=Math.max(3,num(wall.thickness)*pxPerMeter*.7);
          return <line key={wall.entityId}
            x1={tx(num(wall.x1))} y1={ty(num(wall.y1))}
            x2={tx(num(wall.x2))} y2={ty(num(wall.y2))}
            stroke="#58c5ef" strokeWidth={width} strokeLinecap="square" opacity=".92"/>;
        })}

        {active&&hasIfc&&openings.map((opening:any,i:number)=>{
          const host=wallById.get(opening.wallEntityId);
          if(!host)return null;
          const t=Math.max(0,Math.min(1,num(opening.position)));
          const x=num(host.x1)+(num(host.x2)-num(host.x1))*t;
          const y=num(host.y1)+(num(host.y2)-num(host.y1))*t;
          const color=opening.kind==="door"?"#f1d28f":opening.kind==="window"?"#071729":"#f4c95d";
          const radius=Math.max(4,imageWidth*.006);
          return <circle key={i} cx={tx(x)} cy={ty(y)} r={radius} fill={color} stroke="#fff" strokeWidth={1.5}/>;
        })}
      </svg>

      {aligning&&<div className="overlayAlignNotice">جارٍ مطابقة الجدران مع صورة المخطط…</div>}
      {alignError&&<div className="overlayAlignNotice error">لم أعرض خطوطًا مزيوطة. المحاذاة الآلية لم تتجاوز حد الثقة.</div>}
    </div>

    <div className="readingLegend">
      <span><i className="legendWall"/>جدار BIM/IFC بعد المحاذاة</span>
      <span><i className="legendDoor"/>باب</span>
      <span><i className="legendWindow"/>نافذة</span>
      <span><i className="legendRoom"/>غرفة/فراغ هندسي</span>
    </div>

    <div className="readingFoot">
      <span>المقياس: {scale?.metresPerPixel?Number(scale.metresPerPixel).toFixed(4)+" م/بكسل":"غير متوفر"}</span>
      <span>الثقة BIMy: {typeof scale?.confidence==="number"?Math.round(scale.confidence*100)+"%":"—"}</span>
      <span>المحاذاة: {active?Math.round(active.score/255*100)+"%":"—"}</span>
      <span>المصدر الهندسي: BIMy/IFC</span>
    </div>
  </section>;
}
