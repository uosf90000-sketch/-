import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const ROOT=process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";

const MIME:Record<string,string>={
  pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",
  dxf:"application/dxf",dwg:"application/acad"
};

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    const raw=await readFile(path.join(ROOT,"uploads",id,"meta.json"),"utf8");
    const meta=JSON.parse(raw);
    const bytes=await readFile(path.join(ROOT,"uploads",id,meta.storedName));
    return new Response(bytes,{
      headers:{
        "content-type":MIME[meta.extension]||meta.type||"application/octet-stream",
        "content-disposition":`inline; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
        "cache-control":"private, max-age=3600"
      }
    });
  }catch{
    return Response.json({ok:false,error:"الملف غير موجود."},{status:404});
  }
}
