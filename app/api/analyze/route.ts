import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const ROOT=process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";

export async function POST(request:Request){
  const input=await request.json().catch(()=>({}));
  const uploadId=input?.uploadId;
  if(!uploadId) return Response.json({ok:false,error:"uploadId مطلوب."},{status:400});

  const url=process.env.BIMY_API_URL;
  const key=process.env.BIMY_API_KEY;
  if(!url || !key){
    return Response.json({
      ok:false,
      code:"BIMY_INTEGRATION_PENDING",
      error:"المخطط محفوظ فعليًا. تكامل BIMy المباشر لم يُفعّل بعد لهذا المشروع؛ لا تحتاج لإدخال عنوان API غير متوفر لديك."
    },{status:503});
  }

  try{
    const metaRaw=await readFile(path.join(ROOT,"uploads",uploadId,"meta.json"),"utf8");
    const meta=JSON.parse(metaRaw);
    const bytes=await readFile(path.join(ROOT,"uploads",uploadId,meta.storedName));

    const form=new FormData();
    const blob=new Blob([bytes],{type:meta.type||"application/octet-stream"});
    form.append("file",blob,meta.name);
    form.append("uploadId",uploadId);

    const r=await fetch(url,{
      method:"POST",
      headers:{authorization:`Bearer ${key}`},
      body:form
    });

    const contentType=r.headers.get("content-type")||"";
    const body=contentType.includes("application/json")
      ? await r.json().catch(()=>({}))
      : {raw:await r.text().catch(()=>"")};

    if(!r.ok){
      return Response.json({ok:false,provider:"bimy",error:body?.error||body?.message||`BIMy HTTP ${r.status}`,details:body},{status:502});
    }

    return Response.json({ok:true,provider:"bimy",uploadId,result:body});
  }catch(error){
    return Response.json({ok:false,error:error instanceof Error?error.message:"BIMy error"},{status:502});
  }
}
