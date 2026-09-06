import { reconstructRooms, MIN_ROOM_AREA_M2, type GraphWall, type Point } from "./wall-graph";

export type WallLike={
  id?:string;
  entityId?:number;
  x1:number;
  y1:number;
  x2:number;
  y2:number;
  thickness?:number|null;
};

export type Point2={x:number;y:number};

export type InferredRoom={
  id:string;
  polygon:Point2[];
  areaM2:number;
  perimeterM:number;
  center:Point2;
  wallIds:string[];
};

function centroid(polygon:readonly Point[]):Point2{
  if(polygon.length===0)return {x:0,y:0};
  let signed=0,cx=0,cy=0;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i,i++){
    const k=polygon[j].x*polygon[i].y-polygon[i].x*polygon[j].y;
    signed+=k;
    cx+=(polygon[j].x+polygon[i].x)*k;
    cy+=(polygon[j].y+polygon[i].y)*k;
  }
  const area=signed/2;
  if(Math.abs(area)<1e-9){
    return {
      x:polygon.reduce((s,p)=>s+p.x,0)/polygon.length,
      y:polygon.reduce((s,p)=>s+p.y,0)/polygon.length
    };
  }
  return {x:cx/(6*area),y:cy/(6*area)};
}

export function inferRoomsFromWalls(input:WallLike[],minAreaM2=MIN_ROOM_AREA_M2):InferredRoom[]{
  const walls:GraphWall[]=input
    .filter(w=>
      Number.isFinite(w.x1)&&Number.isFinite(w.y1)&&
      Number.isFinite(w.x2)&&Number.isFinite(w.y2)&&
      Math.hypot(w.x2-w.x1,w.y2-w.y1)>.08
    )
    .map((w,index)=>({
      id:w.id??(w.entityId!==undefined?String(w.entityId):`wall-${index+1}`),
      x1:w.x1,
      y1:w.y1,
      x2:w.x2,
      y2:w.y2,
      thickness:typeof w.thickness==="number"&&Number.isFinite(w.thickness)?w.thickness:null
    }));

  if(walls.length<3)return [];

  const rebuilt=reconstructRooms(walls,{
    minArea:minAreaM2,
    maxBridgeGap:2.5,
    maxEndExtension:1
  });

  return rebuilt.rooms.map((room,index)=>({
    id:`space-${index+1}`,
    polygon:room.polygon,
    areaM2:room.area,
    perimeterM:room.perimeter,
    center:centroid(room.polygon),
    wallIds:room.wallIds
  }));
}
