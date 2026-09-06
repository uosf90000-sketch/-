import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const ROOT=process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";

function cleanToken(value:string|undefined){
  const token=(value??"").replace(/\s+/g,"");
  if((token.startsWith('"')&&token.endsWith('"'))||(token.startsWith("'")&&token.endsWith("'"))){
    return token.slice(1,-1);
  }
  return token;
}

function extractProjectId(body:any):string|null{
  const candidates=[
    body?._id,
    body?.id,
    body?.projectId,
    body?.project?._id,
    body?.project?.id,
    body?.project?.projectId,
    body?.data?._id,
    body?.data?.id,
    body?.data?.projectId
  ];
  for(const value of candidates){
    if(typeof value==="string"&&value.trim()) return value.trim();
  }
  return null;
}

export async function POST(request:Request){
  const input=await request.json().catch(()=>({}));
  const uploadId=input?.uploadId;
  if(!uploadId) return Response.json({ok:false,error:"uploadId مطلوب."},{status:400});

  const baseUrl=(process.env.BIMY_API_BASE_URL??"https://bimy.app").replace(/\/+$/,"");
  const token=cleanToken(process.env.BIMY_API_TOKEN);

  if(!token){
    return Response.json({
      ok:false,
      code:"BIMY_TOKEN_MISSING",
      error:"المخطط محفوظ فعليًا، لكن BIMY_API_TOKEN غير مضاف في مشروع بيتي الجديد."
    },{status:503});
  }

  try{
    const metaRaw=await readFile(path.join(ROOT,"uploads",uploadId,"meta.json"),"utf8");
    const meta=JSON.parse(metaRaw);
    const bytes=await readFile(path.join(ROOT,"uploads",uploadId,meta.storedName));

    const form=new FormData();
    const copy=new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    form.set("file",new Blob([copy],{type:meta.type||"application/octet-stream"}),meta.name);
    form.set("name",input?.name||`Bayti ${meta.name}`);

    const r=await fetch(`${baseUrl}/api/projects/from-plan`,{
      method:"POST",
      headers:{
        Authorization:`Bearer ${token}`,
        Accept:"application/json"
      },
      body:form,
      cache:"no-store",
      redirect:"manual"
    });

    const contentType=r.headers.get("content-type")||"";
    const body=contentType.includes("application/json")
      ? await r.json().catch(()=>null)
      : {text:(await r.text().catch(()=>"")).slice(0,1000)};

    if(!r.ok){
      const message=body&&typeof body==="object"
        ? (body.message||body.error||`BIMy HTTP ${r.status}`)
        : `BIMy HTTP ${r.status}`;
      return Response.json({ok:false,provider:"bimy",endpoint:"/api/projects/from-plan",error:message,details:body},{status:502});
    }

    const bimyProjectId=extractProjectId(body);
    return Response.json({
      ok:true,
      provider:"bimy",
      endpoint:"/api/projects/from-plan",
      uploadId,
      bimyProjectId,
      result:body
    });
  }catch(error){
    return Response.json({ok:false,error:error instanceof Error?error.message:"BIMy error"},{status:502});
  }
}
