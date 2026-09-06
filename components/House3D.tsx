"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, OrbitControls, RoundedBox } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ElementInfo } from "@/lib/design";
import { demoElements } from "@/lib/design";

type Props={mode:"overview"|"tour";selected?:ElementInfo|null;onSelect?:(e:ElementInfo)=>void;autoplay?:boolean};

function Hotspot({position,item,onSelect}:{position:[number,number,number],item:ElementInfo,onSelect?:(e:ElementInfo)=>void}){
  return <Html position={position} center distanceFactor={8}>
    <button className="hotspot" aria-label={item.name} onClick={(e)=>{e.stopPropagation();onSelect?.(item)}}><span /></button>
  </Html>
}

function SelectableBox({position,args,item,onSelect,color="#d7cec1",roughness=.75}:{position:[number,number,number],args:[number,number,number],item:ElementInfo,onSelect?:(e:ElementInfo)=>void,color?:string,roughness?:number}){
  const [hover,setHover]=useState(false);
  return <mesh position={position} castShadow receiveShadow
    onPointerOver={(e)=>{e.stopPropagation();setHover(true)}} onPointerOut={()=>setHover(false)}
    onClick={(e)=>{e.stopPropagation();onSelect?.(item)}}>
    <boxGeometry args={args}/><meshStandardMaterial color={hover?"#b89662":color} roughness={roughness}/>
  </mesh>
}

function CameraRig({autoplay}:{autoplay:boolean}){
  const {camera}=useThree();
  const t=useRef(0);
  useEffect(()=>{ if(autoplay) t.current=0; },[autoplay]);
  useFrame((_,delta)=>{
    if(!autoplay)return;
    t.current=(t.current+delta*.055)%1;
    const p=t.current;
    const x=Math.sin(p*Math.PI*2)*1.9;
    const z=5.7-p*8.2;
    camera.position.lerp(new THREE.Vector3(x,1.62,z),.035);
    camera.lookAt(0,1.25,-1.3);
  });
  return null;
}

function Pendant({x,z}:{x:number,z:number}){
  return <group position={[x,0,z]}>
    <mesh position={[0,2.65,0]}><cylinderGeometry args={[.018,.018,.7,8]}/><meshStandardMaterial color="#29231e"/></mesh>
    <mesh position={[0,2.25,0]}><cylinderGeometry args={[.22,.32,.24,32]}/><meshStandardMaterial color="#c3a878" metalness={.2} roughness={.4}/></mesh>
    <pointLight position={[0,2.08,0]} intensity={18} distance={4} color="#ffdba1"/>
  </group>
}

function Interior({mode,onSelect}:{mode:"overview"|"tour";onSelect?:(e:ElementInfo)=>void}){
  const wall=demoElements[0], floor=demoElements[1], sofa=demoElements[2], table=demoElements[3], light=demoElements[4], ac=demoElements[5], kitchen=demoElements[6], window=demoElements[7];
  return <>
    <ambientLight intensity={.65}/>
    <directionalLight position={[4,8,5]} intensity={2.1} castShadow/>
    <pointLight position={[-3,2.4,1]} intensity={10} distance={6} color="#ffd5a0"/>
    <pointLight position={[3,2.4,-2]} intensity={12} distance={7} color="#ffe0b2"/>

    <SelectableBox position={[0,-.12,0]} args={[10,.22,10]} item={floor} onSelect={onSelect} color="#c9bfb1"/>
    <SelectableBox position={[0,1.5,-5]} args={[10,3,.22]} item={wall} onSelect={onSelect} color="#e4ddd1"/>
    <SelectableBox position={[-5,1.5,0]} args={[.22,3,10]} item={wall} onSelect={onSelect} color="#e7e0d5"/>
    <SelectableBox position={[5,1.5,-2.5]} args={[.22,3,5]} item={wall} onSelect={onSelect} color="#ddd4c8"/>

    <SelectableBox position={[-1.35,.58,1.35]} args={[3.8,.92,1.35]} item={sofa} onSelect={onSelect} color="#cfc3b3"/>
    <SelectableBox position={[-2.65,.5,.2]} args={[1.1,.9,1.05]} item={sofa} onSelect={onSelect} color="#716a49"/>
    <SelectableBox position={[.1,.34,.55]} args={[1.8,.18,1.25]} item={table} onSelect={onSelect} color="#e7dfd1" roughness={.25}/>
    <mesh position={[.1,.12,.55]}><cylinderGeometry args={[.72,.86,.38,32]}/><meshStandardMaterial color="#6c5746"/></mesh>

    <SelectableBox position={[0,.48,-2.0]} args={[4.3,.12,1.25]} item={table} onSelect={onSelect} color="#8f7867"/>
    {[-1.6,-.55,.55,1.6].map(x=><group key={x} position={[x,0,-1.18]}><mesh position={[0,.43,0]}><boxGeometry args={[.55,.1,.55]}/><meshStandardMaterial color="#958474"/></mesh><mesh position={[0,.23,.18]}><boxGeometry args={[.5,.48,.12]}/><meshStandardMaterial color="#8c7a68"/></mesh></group>)}

    <SelectableBox position={[1.6,.55,-4.25]} args={[5.9,1.05,.7]} item={kitchen} onSelect={onSelect} color="#665443"/>
    <SelectableBox position={[1.6,1.12,-3.87]} args={[5.9,.12,.82]} item={kitchen} onSelect={onSelect} color="#d8caba" roughness={.28}/>
    <SelectableBox position={[3.75,1.75,-4.35]} args={[1.15,2.3,.72]} item={kitchen} onSelect={onSelect} color="#3d3934"/>
    <SelectableBox position={[2.9,2.2,-4.84]} args={[2.2,.7,.16]} item={kitchen} onSelect={onSelect} color="#765f4a"/>

    <mesh position={[-4.86,1.45,-1]}><boxGeometry args={[.08,2.35,3.6]}/><meshPhysicalMaterial color="#9cc3cd" transparent opacity={.25} transmission={.7}/></mesh>
    <Hotspot position={[-4.55,1.55,-.5]} item={window} onSelect={onSelect}/>

    <SelectableBox position={[3.95,2.45,-1.2]} args={[1.35,.42,.3]} item={ac} onSelect={onSelect} color="#eceae4"/>

    <RoundedBox position={[0,2.83,-4.65]} args={[7.2,.06,.06]} radius={.02}><meshStandardMaterial emissive="#ffc977" emissiveIntensity={6} color="#fff1ce"/></RoundedBox>
    <RoundedBox position={[-4.65,2.78,-1]} args={[.06,.06,6.7]} radius={.02}><meshStandardMaterial emissive="#ffc977" emissiveIntensity={6} color="#fff1ce"/></RoundedBox>
    <Pendant x={-.7} z={-2}/><Pendant x={.7} z={-2}/>
    <Hotspot position={[0,2.1,-2]} item={light} onSelect={onSelect}/>

    <Hotspot position={[-1.1,.9,1.2]} item={sofa} onSelect={onSelect}/>
    <Hotspot position={[.2,.75,.45]} item={table} onSelect={onSelect}/>
    <Hotspot position={[2.2,1.2,-4]} item={kitchen} onSelect={onSelect}/>
    <Hotspot position={[4,2.45,-1]} item={ac} onSelect={onSelect}/>
    <Hotspot position={[4.7,1.45,-3.3]} item={wall} onSelect={onSelect}/>

    {mode==="overview" && <>
      <mesh position={[-3.65,.95,3.6]}><cylinderGeometry args={[.35,.35,1.9,16]}/><meshStandardMaterial color="#58614a"/></mesh>
      <mesh position={[-3.65,1.85,3.6]}><sphereGeometry args={[.65,16,16]}/><meshStandardMaterial color="#657052"/></mesh>
    </>}
  </>;
}

export default function House3D({mode,onSelect,autoplay=false}:Props){
  const camera=useMemo(()=>mode==="tour"?{position:[0,1.62,5.8] as [number,number,number],fov:58}:{position:[8.2,7.4,8.2] as [number,number,number],fov:43},[mode]);
  return <div className={`threeWrap ${mode}`}>
    <Canvas shadows camera={camera}>
      <color attach="background" args={[mode==="tour"?"#c9b9a6":"#ded9d0"]}/>
      <fog attach="fog" args={[mode==="tour"?"#b8a994":"#ded9d0",13,28]}/>
      <Interior mode={mode} onSelect={onSelect}/>
      <Environment preset="apartment"/>
      <CameraRig autoplay={autoplay}/>
      <OrbitControls enabled={!autoplay} makeDefault target={mode==="tour"?[0,1.25,-1.4]:[0,.7,-.4]} minDistance={mode==="tour"?1.2:5} maxDistance={mode==="tour"?8:18} maxPolarAngle={Math.PI/2.05} minPolarAngle={mode==="tour"?Math.PI*.28:0}/>
    </Canvas>
  </div>;
}
