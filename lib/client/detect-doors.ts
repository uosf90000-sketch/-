"use client";

import { findDoorArcsOnWalls, type WallBand } from "@/lib/geometry/door-arc";
import type { RasterMask } from "@/lib/geometry/raster-mask";

export type DoorAlignment={left:number;top:number;width:number;height:number};
export type DoorBounds={minX:number;minY:number;maxX:number;maxY:number};

export type DetectedDoor={
  wallEntityId:number;
  position:number;
  widthM:number;
  confidence:number;
  sweepDeg:number;
  votes:number;
};

function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v))}

function otsu(gray:Uint8Array){
  const hist=new Uint32Array(256);
  for(const v of gray)hist[v]++;
  const total=gray.length;
  let sum=0;
  for(let i=0;i<256;i++)sum+=i*hist[i];

  let sumB=0,wB=0,best=0,threshold=140;
  for(let t=0;t<256;t++){
    wB+=hist[t];
    if(wB===0)continue;
    const wF=total-wB;
    if(wF===0)break;
    sumB+=t*hist[t];
    const mB=sumB/wB;
    const mF=(sum-sumB)/wF;
    const between=wB*wF*(mB-mF)*(mB-mF);
    if(between>best){best=between;threshold=t}
  }
  return clamp(threshold,85,205);
}

function toMask(pixels:Uint8ClampedArray,width:number,height:number):RasterMask{
  const gray=new Uint8Array(width*height);
  for(let i=0,p=0;i<pixels.length;i+=4,p++){
    gray[p]=Math.round(.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2]);
  }
  const threshold=otsu(gray);
  const dark=new Uint8Array(gray.length);
  for(let i=0;i<gray.length;i++) dark[i]=gray[i]<threshold?1:0;
  return {dark,width,height};
}

function pixel(mask:RasterMask,x:number,y:number){
  const ix=Math.round(x),iy=Math.round(y);
  if(ix<0||iy<0||ix>=mask.width||iy>=mask.height)return 0;
  return mask.dark[iy*mask.width+ix];
}

function stripInk(
  mask:RasterMask,
  x:number,y:number,
  ux:number,uy:number,
  nx:number,ny:number,
  from:number,to:number,
  halfThickness:number
){
  const span=Math.max(1,Math.abs(to-from));
  const steps=Math.max(4,Math.round(span/2));
  let hits=0,total=0;
  for(let i=0;i<=steps;i++){
    const s=from+(to-from)*(i/steps);
    for(const n of [-.65,0,.65]){
      total++;
      hits+=pixel(mask,x+ux*s+nx*halfThickness*n,y+uy*s+ny*halfThickness*n);
    }
  }
  return total?hits/total:1;
}

export function detectDoorsFromAlignedRaster(args:{
  pixels:Uint8ClampedArray;
  width:number;
  height:number;
  alignment:DoorAlignment;
  bounds:DoorBounds;
  walls:any[];
  knownOpenings:any[];
}):DetectedDoor[]{
  const {pixels,width,height,alignment,bounds,walls,knownOpenings}=args;
  const dx=bounds.maxX-bounds.minX;
  const dy=bounds.maxY-bounds.minY;
  if(!(dx>0&&dy>0)||walls.length===0)return [];

  const mask=toMask(pixels,width,height);
  const pxPerMeter=((alignment.width*width)/dx+(alignment.height*height)/dy)/2;
  if(!(pxPerMeter>3))return [];

  const tx=(x:number)=>(alignment.left+(x-bounds.minX)/dx*alignment.width)*width;
  const ty=(y:number)=>(alignment.top+(1-(y-bounds.minY)/dy)*alignment.height)*height;

  const bands:WallBand[]=walls.map((wall:any)=>({
    id:String(wall.entityId),
    from:{x:tx(Number(wall.x1)),y:ty(Number(wall.y1))},
    to:{x:tx(Number(wall.x2)),y:ty(Number(wall.y2))},
    thicknessPx:Math.max(2,(Number(wall.thickness)||.18)*pxPerMeter)
  }));

  const arcs=findDoorArcsOnWalls(mask,bands,{
    minRadiusPx:Math.max(8,Math.round(pxPerMeter*.58)),
    maxRadiusPx:Math.max(12,Math.round(pxPerMeter*1.45)),
    radiusStepPx:2,
    alongStepPx:3,
    maxGapSamples:2,
    minSweepDeg:40,
    minVotes:2,
    maxSweptInk:.28
  });

  const wallById=new Map<string,any>();
  for(const wall of walls)wallById.set(String(wall.entityId),wall);

  const refined:DetectedDoor[]=[];
  for(const arc of arcs){
    const wall=wallById.get(arc.wallId);
    if(!wall)continue;

    const x1=tx(Number(wall.x1)),y1=ty(Number(wall.y1));
    const x2=tx(Number(wall.x2)),y2=ty(Number(wall.y2));
    const vx=x2-x1,vy=y2-y1;
    const lengthPx=Math.hypot(vx,vy);
    if(!(lengthPx>arc.radiusPx*1.15))continue;
    const ux=vx/lengthPx,uy=vy/lengthPx,nx=-uy,ny=ux;
    const halfT=Math.max(1,(Number(wall.thickness)||.18)*pxPerMeter/2);

    // القوس يعطي موضع المفصلة. الفتحة تكون على أحد جانبي المفصلة
    // على امتداد الجدار؛ نختار الجانب الذي يحمل حبرًا أقل داخل عرض الباب.
    const centerX=x1+vx*arc.position;
    const centerY=y1+vy*arc.position;
    const posInk=stripInk(mask,centerX,centerY,ux,uy,nx,ny,2,arc.radiusPx*.94,halfT);
    const negInk=stripInk(mask,centerX,centerY,ux,uy,nx,ny,-2,-arc.radiusPx*.94,halfT);
    const sign=posInk<=negInk?1:-1;
    const centerAlong=arc.position*lengthPx+sign*arc.radiusPx*.5;
    const position=clamp(centerAlong/lengthPx,0,1);
    const widthM=arc.radiusPx/pxPerMeter;
    if(widthM<.55||widthM>1.55)continue;

    const wallLengthM=Math.hypot(Number(wall.x2)-Number(wall.x1),Number(wall.y2)-Number(wall.y1));
    const overlapsWindow=knownOpenings.some((o:any)=>{
      if(o?.kind!=="window"||String(o?.wallEntityId)!==arc.wallId)return false;
      const otherWidth=Number(o.widthM)||1;
      const tol=wallLengthM>0?(otherWidth+widthM)/(2*wallLengthM)+.04:.12;
      return Math.abs(Number(o.position)-position)<=tol;
    });
    if(overlapsWindow)continue;

    const confidence=clamp(.56+Math.min(.18,arc.votes*.035)+Math.min(.14,Math.max(0,arc.sweepDeg-40)/300),.56,.94);
    refined.push({
      wallEntityId:Number(wall.entityId),
      position,
      widthM,
      confidence,
      sweepDeg:arc.sweepDeg,
      votes:arc.votes
    });
  }

  refined.sort((a,b)=>b.confidence-a.confidence);
  const kept:DetectedDoor[]=[];
  for(const candidate of refined){
    const duplicate=kept.some(d=>
      d.wallEntityId===candidate.wallEntityId&&
      Math.abs(d.position-candidate.position)<.085
    );
    if(!duplicate)kept.push(candidate);
  }

  return kept.slice(0,30);
}
