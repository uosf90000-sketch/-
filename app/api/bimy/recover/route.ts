import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const ROOT=process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";

function cleanToken(value:string|undefined){
  const token=(value??"").replace(/\s+/g,"");
  if((token.startsWith('"')&&token.endsWith('"'))||(token.startsWith("'")&&token.endsWith("'"))) return token.slice(1,-1);
  return token;
}
function obj(v:any){return v&&typeof v==="object"&&!Array.isArray(v)?v:null}
function rows(body:any):any[]{
  const o=obj(body);
  if(Array.isArray(body)) return body;
  if(Array.isArray(o?.items)) return o.items;
  if(Array.isArray(o?.data)) return o.data;
  if(Array.isArray(o?.results)) return o.results;
  return [];
}
function idOf(p:any):string|null{
  const o=obj(p);
  for(const v of [o?._id,o?.id,o?.projectId]) if(typeof v==="string"&&v.trim()) return v.trim();
  return null;
}

export async function POST(request:Request){
  const input=await request.json().catch(()=>({}));
  const uploadId=input?.uploadId;
  if(!uploadId) return Response.json({ok:false,error:"uploadId مطلوب"},{status:400});

  const token=cleanToken(process.env.BIMY_API_TOKEN);
  const base=(process.env.BIMY_API_BASE_URL??"https://bimy.app").replace(/\/+$/,"");
  if(!token) return Response.json({ok:false,error:"BIMY_API_TOKEN غير مضاف"},{status:503});

  const dir=path.join(ROOT,"uploads",uploadId);
  try{
    const meta=JSON.parse(await readFile(path.join(dir,"meta.json"),"utf8"));
    try{
      const current=JSON.parse(await readFile(path.join(dir,"bimy-state.json"),"utf8"));
      if(current?.bimyProjectId) return Response.json({ok:true,recovered:false,bimyProjectId:current.bimyProjectId});
    }catch{}

    const projectName=input?.name||`Bayti ${meta.name}`;
    const r=await fetch(`${base}/api/projects/list?limit=50&offset=0&sort=created&scope=all`,{
      headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},
      cache:"no-store",redirect:"manual"
    });
    if(!r.ok) return Response.json({ok:false,error:`BIMy list HTTP ${r.status}`},{status:502});
    const body=await r.json().catch(()=>null);
    const match=rows(body).find((p:any)=>typeof obj(p)?.name==="string"&&obj(p)?.name.trim()===projectName);
    const id=idOf(match);
    if(!id) return Response.json({ok:true,recovered:false,bimyProjectId:null});

    const state={bimyProjectId:id,uploadResponse:null,status:"project-recovered",updatedAt:new Date().toISOString()};
    await writeFile(path.join(dir,"bimy-state.json"),JSON.stringify(state,null,2),"utf8");
    return Response.json({ok:true,recovered:true,bimyProjectId:id});
  }catch(error:any){
    return Response.json({ok:false,error:error?.message||"تعذر استرجاع مشروع BIMy"},{status:500});
  }
}
