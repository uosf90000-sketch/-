import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const ROOT=process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const raw=await readFile(path.join(ROOT,"uploads",id,"doors.json"),"utf8");
    return Response.json({ok:true,doors:JSON.parse(raw)});
  }catch{
    return Response.json({ok:false,error:"لا توجد أبواب محفوظة بعد."},{status:404});
  }
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const body=await request.json().catch(()=>({}));
    const input=Array.isArray(body?.doors)?body.doors:[];
    const doors=input.slice(0,100).map((d:any)=>({
      wallEntityId:Number(d.wallEntityId),
      position:Math.max(0,Math.min(1,Number(d.position)||0)),
      widthM:Math.max(.55,Math.min(1.8,Number(d.widthM)||.9)),
      heightM:2.1,
      sillM:0,
      kind:"door",
      confidence:Math.max(0,Math.min(1,Number(d.confidence)||0)),
      sweepDeg:Number(d.sweepDeg)||0,
      votes:Number(d.votes)||0,
      source:"bayti-door-arc"
    })).filter((d:any)=>Number.isFinite(d.wallEntityId));

    const saved={doors,updatedAt:new Date().toISOString()};
    await writeFile(path.join(ROOT,"uploads",id,"doors.json"),JSON.stringify(saved,null,2),"utf8");
    return Response.json({ok:true,...saved});
  }catch(error:any){
    return Response.json({ok:false,error:error?.message||"تعذر حفظ الأبواب"},{status:500});
  }
}
