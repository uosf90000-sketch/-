"use client";

type RoomBox={
  name:string;
  type:string;
  confidence:number;
  bbox:{x:number;y:number;width:number;height:number};
};

function num(v:any){return typeof v==="number"&&Number.isFinite(v)?v:0}

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
  const imageWidth=num(scale.imageWidth)||1000;
  const imageHeight=num(scale.imageHeight)||1400;
  const plan=analysis?.ifcPlan||null;
  const walls=Array.isArray(plan?.walls)?plan.walls:[];
  const openings=Array.isArray(plan?.openings)?plan.openings:[];
  const scanCounts=analysis?.scanCounts||scanProject?.scanProgress?.counts||{};
  const ifcCounts=analysis?.ifcCounts||{};
  const inferredRooms=Array.isArray(analysis?.inferredRooms)?analysis.inferredRooms:[];

  const doorCount=openings.filter((o:any)=>o.kind==="door").length || num(ifcCounts.doors) || num(scanCounts.doors);
  const windowCount=openings.filter((o:any)=>o.kind==="window").length || num(ifcCounts.windows) || num(scanCounts.windows);
  const wallCount=walls.length || num(ifcCounts.walls) || num(scanCounts.walls);
  const roomCount=rooms.length || inferredRooms.length || num(ifcCounts.spaces);

  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const w of walls){
    for(const x of [num(w.x1),num(w.x2)]){minX=Math.min(minX,x);maxX=Math.max(maxX,x)}
    for(const y of [num(w.y1),num(w.y2)]){minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
  }
  const hasIfc=walls.length>0&&Number.isFinite(minX)&&maxX>minX&&maxY>minY;
  const padX=imageWidth*.065;
  const padY=imageHeight*.055;
  const sx=hasIfc?(imageWidth-padX*2)/(maxX-minX):1;
  const sy=hasIfc?(imageHeight-padY*2)/(maxY-minY):1;
  const fit=hasIfc?Math.min(sx,sy):1;
  const modelW=hasIfc?(maxX-minX)*fit:0;
  const modelH=hasIfc?(maxY-minY)*fit:0;
  const ox=(imageWidth-modelW)/2;
  const oy=(imageHeight-modelH)/2;
  const tx=(x:number)=>ox+(x-minX)*fit;
  const ty=(y:number)=>imageHeight-(oy+(y-minY)*fit);

  const wallById=new Map<number,any>();
  walls.forEach((w:any)=>wallById.set(w.entityId,w));

  return <section className="readingCard">
    <div className="readingHead">
      <div>
        <span className="kicker">قراءة المخطط</span>
        <h2>ما الذي فهمه بيتي من المخطط؟</h2>
        <p>الجدران والفتحات من BIMy/IFC، وأسماء الغرف من قراءة OpenAI للمخطط نفسه.</p>
      </div>
      <div className="readingStatus">{analysis?.scanStatus==="ready"?"✓ التحليل الهندسي جاهز":"قيد استكمال الهندسة"}</div>
    </div>

    <div className="readingStats">
      <div><span>الغرف</span><b>{roomCount}</b></div>
      <div><span>الجدران</span><b>{wallCount}</b></div>
      <div><span>الأبواب</span><b>{doorCount}</b></div>
      <div><span>النوافذ</span><b>{windowCount}</b></div>
    </div>

    <div className="planOverlayWrap">
      <svg viewBox={`0 0 ${imageWidth} ${imageHeight}`} className="planOverlaySvg" preserveAspectRatio="xMidYMid meet">
        <image href={imageUrl} x="0" y="0" width={imageWidth} height={imageHeight} opacity="0.58"/>

        {rooms.length===0&&hasIfc&&inferredRooms.map((room:any,i:number)=>{
          const points=Array.isArray(room?.polygon)?room.polygon:[];
          if(points.length<3)return null;
          const pts=points.map((p:any)=>String(tx(num(p.x)))+","+String(ty(num(p.y)))).join(" ");
          const cx=tx(num(room?.center?.x));
          const cy=ty(num(room?.center?.y));
          return <g key={room.id||i}>
            <polygon points={pts} fill="rgba(89,180,221,.10)" stroke="rgba(89,180,221,.48)" strokeWidth={2}/>
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

        {hasIfc&&walls.map((wall:any)=>{
          const width=Math.max(4,num(wall.thickness)*fit*.55);
          return <line key={wall.entityId}
            x1={tx(num(wall.x1))} y1={ty(num(wall.y1))}
            x2={tx(num(wall.x2))} y2={ty(num(wall.y2))}
            stroke="#69c7ee" strokeWidth={width} strokeLinecap="square"/>;
        })}

        {hasIfc&&openings.map((opening:any,i:number)=>{
          const host=wallById.get(opening.wallEntityId);
          if(!host)return null;
          const t=Math.max(0,Math.min(1,num(opening.position)));
          const x=num(host.x1)+(num(host.x2)-num(host.x1))*t;
          const y=num(host.y1)+(num(host.y2)-num(host.y1))*t;
          const color=opening.kind==="door"?"#f1d28f":opening.kind==="window"?"#071729":"#f4c95d";
          const radius=Math.max(5,imageWidth*.008);
          return <circle key={i} cx={tx(x)} cy={ty(y)} r={radius} fill={color} stroke="#fff" strokeWidth={1.5}/>;
        })}
      </svg>
    </div>

    <div className="readingLegend">
      <span><i className="legendWall"/>جدار BIM/IFC</span>
      <span><i className="legendDoor"/>باب</span>
      <span><i className="legendWindow"/>نافذة</span>
      <span><i className="legendRoom"/>غرفة/فراغ هندسي</span>
    </div>

    <div className="readingFoot">
      <span>المقياس: {scale?.metresPerPixel?Number(scale.metresPerPixel).toFixed(4)+" م/بكسل":"غير متوفر"}</span>
      <span>الثقة: {typeof scale?.confidence==="number"?Math.round(scale.confidence*100)+"%":"—"}</span>
      <span>المصدر: BIMy + OpenAI</span>
    </div>
  </section>;
}
