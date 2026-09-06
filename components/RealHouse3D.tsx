"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, OrbitControls, RoundedBox } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

type DesignItem={
  category:string;name:string;room:string;planX:number;planY:number;
  widthM:number;depthM:number;heightM:number;rotationDeg:number;
  color:string;material:string;details:string;
};

function wallTransform(w:any){
  const dx=Number(w.x2)-Number(w.x1);
  const dz=-(Number(w.y2)-Number(w.y1));
  const length=Math.hypot(dx,dz);
  const angle=-Math.atan2(dz,dx);
  const x=(Number(w.x1)+Number(w.x2))/2;
  const z=-(Number(w.y1)+Number(w.y2))/2;
  return {length,angle,x,z};
}

function WallMesh({wall,openings}:{wall:any;openings:any[]}){
  const {length,angle,x,z}=wallTransform(wall);
  const h=Number(wall.heightM)||2.8;
  const thick=Math.max(.08,Number(wall.thickness)||.18);
  const intervals=openings
    .map(o=>{
      const width=Math.min(length*.9,Math.max(.55,Number(o.widthM)||.9));
      const center=Math.max(0,Math.min(length,length*(Number(o.position)||0)));
      return {...o,start:Math.max(0,center-width/2),end:Math.min(length,center+width/2),width};
    })
    .sort((a,b)=>a.start-b.start);

  const segments:{start:number;end:number}[]=[];
  let cursor=0;
  for(const o of intervals){
    if(o.start>cursor+.02) segments.push({start:cursor,end:o.start});
    cursor=Math.max(cursor,o.end);
  }
  if(cursor<length-.02) segments.push({start:cursor,end:length});

  const localToWorld=(along:number,y:number)=>{
    const lx=along-length/2;
    return {
      x:x+lx*Math.cos(-angle),
      z:z-lx*Math.sin(-angle),
      y
    };
  };

  return <group>
    {segments.map((s,i)=>{
      const segLen=s.end-s.start;
      const center=(s.start+s.end)/2;
      const p=localToWorld(center,h/2);
      return <mesh key={i} position={[p.x,p.y,p.z]} rotation={[0,angle,0]} castShadow receiveShadow>
        <boxGeometry args={[segLen,h,thick]}/>
        <meshStandardMaterial color="#d8d0c4" roughness={.82}/>
      </mesh>;
    })}

    {intervals.map((o,i)=>{
      const openH=Math.max(.8,Math.min(h-.15,Number(o.heightM)|| (o.kind==="window"?1.25:2.15)));
      const sill=o.kind==="window"?Math.min(.95,h-openH-.1):0;
      const top=sill+openH;
      const center=(o.start+o.end)/2;
      const p=localToWorld(center,0);

      const pieces:any[]=[];
      if(sill>.05) pieces.push({key:"sill",y:sill/2,height:sill});
      if(h-top>.05) pieces.push({key:"lintel",y:top+(h-top)/2,height:h-top});

      return <group key={i}>
        {pieces.map(piece=><mesh key={piece.key}
          position={[p.x,piece.y,p.z]} rotation={[0,angle,0]} castShadow receiveShadow>
          <boxGeometry args={[o.end-o.start,piece.height,thick]}/>
          <meshStandardMaterial color="#d8d0c4" roughness={.82}/>
        </mesh>)}
        <mesh position={[p.x,sill+openH/2,p.z]} rotation={[0,angle,0]}>
          <boxGeometry args={[Math.max(.5,o.end-o.start),openH,Math.max(.025,thick*.18)]}/>
          <meshPhysicalMaterial
            color={o.kind==="window"?"#8eb9c7":"#6f5847"}
            transparent={o.kind==="window"} opacity={o.kind==="window" ? .28 : 1}
            transmission={o.kind==="window" ? .55 : 0} roughness={o.kind==="window" ? .18 : .65}
          />
        </mesh>
      </group>;
    })}
  </group>;
}

function Furniture({item,position,onSelect}:{item:DesignItem;position:[number,number,number];onSelect:(i:DesignItem)=>void}){
  const [hover,setHover]=useState(false);
  const cat=(item.category+" "+item.name).toLowerCase();
  const w=Math.max(.25,Number(item.widthM)||1);
  const d=Math.max(.25,Number(item.depthM)||1);
  const h=Math.max(.15,Number(item.heightM)||.7);
  const rot=-(Number(item.rotationDeg)||0)*Math.PI/180;
  const common={onPointerOver:(e:any)=>{e.stopPropagation();setHover(true)},onPointerOut:()=>setHover(false),onClick:(e:any)=>{e.stopPropagation();onSelect(item)}};

  if(/sofa|كنب/.test(cat)){
    return <group position={position} rotation={[0,rot,0]} {...common}>
      <RoundedBox args={[w,.45,d]} position={[0,.23,0]} radius={.08}><meshStandardMaterial color={hover?"#b89566":"#b7aa98"}/></RoundedBox>
      <RoundedBox args={[w,.65,.22]} position={[0,.65,-d/2+.12]} radius={.06}><meshStandardMaterial color="#a99b88"/></RoundedBox>
    </group>;
  }
  if(/bed|سرير/.test(cat)){
    return <group position={position} rotation={[0,rot,0]} {...common}>
      <RoundedBox args={[w,.32,d]} position={[0,.25,0]} radius={.05}><meshStandardMaterial color={hover?"#c6aa83":"#d3c8b8"}/></RoundedBox>
      <RoundedBox args={[w,.85,.16]} position={[0,.55,-d/2]} radius={.04}><meshStandardMaterial color="#8f7259"/></RoundedBox>
    </group>;
  }
  if(/table|طاول/.test(cat)){
    return <group position={position} rotation={[0,rot,0]} {...common}>
      <mesh position={[0,h,0]}><boxGeometry args={[w,.08,d]}/><meshStandardMaterial color={hover?"#c3a77e":"#8b735c"}/></mesh>
      {[[-w*.4,-d*.4],[w*.4,-d*.4],[-w*.4,d*.4],[w*.4,d*.4]].map((p,i)=>
        <mesh key={i} position={[p[0],h/2,p[1]]}><boxGeometry args={[.06,h,.06]}/><meshStandardMaterial color="#51473f"/></mesh>)}
    </group>;
  }
  if(/light|إنار/.test(cat)){
    return <group position={[position[0],Math.max(2.45,position[1]+h),position[2]]} rotation={[0,rot,0]} {...common}>
      <mesh><cylinderGeometry args={[Math.max(.08,w*.16),Math.max(.12,w*.25),.22,24]}/><meshStandardMaterial color="#c6a46c" emissive="#ffda91" emissiveIntensity={hover?4:2}/></mesh>
      <pointLight intensity={12} distance={4} color="#ffd79b"/>
    </group>;
  }
  if(/ac|تكييف|مكيف/.test(cat)){
    return <mesh position={[position[0],2.35,position[2]]} rotation={[0,rot,0]} {...common}>
      <boxGeometry args={[Math.max(.7,w),Math.min(.4,h),Math.min(.35,d)]}/><meshStandardMaterial color={hover?"#d9c8aa":"#efeee9"}/>
    </mesh>;
  }
  if(/toilet|مرحاض|كرسي/.test(cat)){
    return <group position={position} rotation={[0,rot,0]} {...common}>
      <mesh position={[0,.22,0]}><cylinderGeometry args={[w*.28,w*.35,.42,24]}/><meshStandardMaterial color="#ece9e2"/></mesh>
      <mesh position={[0,.55,-d*.28]}><boxGeometry args={[w*.65,.55,.22]}/><meshStandardMaterial color="#ece9e2"/></mesh>
    </group>;
  }

  return <RoundedBox position={[position[0],h/2,position[2]]} rotation={[0,rot,0]} args={[w,h,d]} radius={.04} {...common}>
    <meshStandardMaterial color={hover?"#b99360":"#9a8873"} roughness={.7}/>
  </RoundedBox>;
}

function CameraTour({enabled,center,size}:{enabled:boolean;center:THREE.Vector3;size:number}){
  const t=useRef(0);
  useFrame(({camera},delta)=>{
    if(!enabled)return;
    t.current=(t.current+delta*.035)%1;
    const a=t.current*Math.PI*2;
    const r=Math.max(3,size*.2);
    const target=new THREE.Vector3(center.x,1.25,center.z);
    const desired=new THREE.Vector3(center.x+Math.cos(a)*r,1.62,center.z+Math.sin(a)*r);
    camera.position.lerp(desired,.025);
    camera.lookAt(target);
  });
  return null;
}

export default function RealHouse3D({
  analysis,design,mode="overview",autoplay=false,onSelect
}:{
  analysis:any;design:any;mode?:"overview"|"tour";autoplay?:boolean;onSelect?:(i:DesignItem)=>void
}){
  const walls=Array.isArray(analysis?.ifcPlan?.walls)?analysis.ifcPlan.walls:[];
  const openings=Array.isArray(analysis?.ifcPlan?.openings)?analysis.ifcPlan.openings:[];
  const items:DesignItem[]=Array.isArray(design?.design?.items)?design.design.items:[];
  const lights:DesignItem[]=Array.isArray(design?.design?.lighting)?design.design.lighting:[];
  const ac:DesignItem[]=Array.isArray(design?.design?.airConditioning)?design.design.airConditioning:[];
  const inferredRooms=Array.isArray(analysis?.inferredRooms)?analysis.inferredRooms:[];

  const bounds=useMemo(()=>{
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    walls.forEach((w:any)=>{
      minX=Math.min(minX,Number(w.x1),Number(w.x2));maxX=Math.max(maxX,Number(w.x1),Number(w.x2));
      minY=Math.min(minY,Number(w.y1),Number(w.y2));maxY=Math.max(maxY,Number(w.y1),Number(w.y2));
    });
    if(!Number.isFinite(minX)) return {minX:0,minY:0,maxX:12,maxY:12};
    return {minX,minY,maxX,maxY};
  },[walls]);
  const cx=(bounds.minX+bounds.maxX)/2;
  const cy=(bounds.minY+bounds.maxY)/2;
  const size=Math.max(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY);
  const center=new THREE.Vector3(cx,0,-cy);

  const openingByWall=useMemo(()=>{
    const map=new Map<number,any[]>();
    for(const o of openings){
      const arr=map.get(o.wallEntityId)||[];arr.push(o);map.set(o.wallEntityId,arr);
    }
    return map;
  },[openings]);

  function itemPos(item:DesignItem):[number,number,number]{
    const x=bounds.minX+(Math.max(0,Math.min(1000,item.planX))/1000)*(bounds.maxX-bounds.minX);
    const y=bounds.maxY-(Math.max(0,Math.min(1000,item.planY))/1000)*(bounds.maxY-bounds.minY);
    return [x,.02,-y];
  }

  const camera=mode==="tour"
    ? {position:[cx,1.62,-bounds.minY+1.5] as [number,number,number],fov:60}
    : {position:[cx+size*.72,Math.max(7,size*.58),-cy+size*.72] as [number,number,number],fov:45};

  return <div className={`real3dCanvas ${mode}`}>
    <Canvas shadows camera={camera}>
      <color attach="background" args={["#d8d2c9"]}/>
      <fog attach="fog" args={["#d8d2c9",Math.max(18,size*1.2),Math.max(35,size*2.5)]}/>
      <ambientLight intensity={.55}/>
      <directionalLight position={[cx+8,12,-cy+6]} intensity={2.2} castShadow/>
      <mesh position={[cx,-.08,-cy]} receiveShadow>
        <boxGeometry args={[Math.max(4,bounds.maxX-bounds.minX+2),.12,Math.max(4,bounds.maxY-bounds.minY+2)]}/>
        <meshStandardMaterial color="#c8bcae" roughness={.9}/>
      </mesh>

      {inferredRooms.map((room:any,i:number)=>{
        const points=Array.isArray(room?.polygon)?room.polygon:[];
        if(points.length<3)return null;
        const shape=new THREE.Shape();
        shape.moveTo(Number(points[0].x),Number(points[0].y));
        for(let j=1;j<points.length;j++)shape.lineTo(Number(points[j].x),Number(points[j].y));
        shape.closePath();
        return <mesh key={room.id||i} rotation={[-Math.PI/2,0,0]} position={[0,.015,0]} receiveShadow>
          <shapeGeometry args={[shape]}/>
          <meshStandardMaterial color={i%2===0?"#b9c5b7":"#c8bcae"} roughness={.95} side={THREE.DoubleSide}/>
        </mesh>;
      })}

      {walls.map((w:any)=><WallMesh key={w.entityId} wall={w} openings={openingByWall.get(w.entityId)||[]}/>)}
      {[...items,...lights,...ac].map((item,i)=>
        <Furniture key={`${item.category}-${item.name}-${i}`} item={item} position={itemPos(item)} onSelect={onSelect||(()=>{})}/>)}

      <Environment preset="apartment"/>
      <CameraTour enabled={autoplay} center={center} size={size}/>
      <OrbitControls
        enabled={!autoplay}
        makeDefault
        target={[cx,mode==="tour"?1.25:1,-cy]}
        minDistance={mode==="tour"?.8:4}
        maxDistance={Math.max(12,size*1.8)}
        maxPolarAngle={Math.PI/2.03}
      />
    </Canvas>
  </div>;
}
