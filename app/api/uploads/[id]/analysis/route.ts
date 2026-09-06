import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const ROOT=process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const raw=await readFile(path.join(ROOT,"uploads",id,"analysis.json"),"utf8");
    return Response.json({ok:true,analysis:JSON.parse(raw)});
  }catch{
    return Response.json({ok:false,error:"لا توجد نتيجة BIMy محفوظة بعد."},{status:404});
  }
}
