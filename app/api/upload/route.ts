import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const ROOT=process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";
const MAX=25*1024*1024;
const ALLOWED=new Set(["pdf","jpg","jpeg","png","webp","dxf","dwg"]);

export async function POST(request:Request){
  try{
    const form=await request.formData();
    const file=form.get("plan");
    if(!(file instanceof File)){
      return Response.json({ok:false,error:"لم يتم اختيار ملف."},{status:400});
    }
    if(file.size<=0) return Response.json({ok:false,error:"الملف فارغ."},{status:400});
    if(file.size>MAX) return Response.json({ok:false,error:"حجم الملف أكبر من 25MB."},{status:413});

    const original=file.name || "plan";
    const ext=original.split(".").pop()?.toLowerCase() || "";
    if(!ALLOWED.has(ext)){
      return Response.json({ok:false,error:"صيغة غير مدعومة. استخدم PDF أو JPG أو PNG أو WEBP أو DXF أو DWG."},{status:415});
    }

    const id=randomUUID();
    const dir=path.join(ROOT,"uploads",id);
    await mkdir(dir,{recursive:true});
    const bytes=Buffer.from(await file.arrayBuffer());
    const storedName=`plan.${ext}`;
    const filePath=path.join(dir,storedName);
    await writeFile(filePath,bytes);

    const meta={
      id,
      name:original,
      storedName,
      size:file.size,
      type:file.type || "application/octet-stream",
      extension:ext,
      uploadedAt:new Date().toISOString(),
      status:"uploaded"
    };
    await writeFile(path.join(dir,"meta.json"),JSON.stringify(meta,null,2),"utf8");

    return Response.json({
      ok:true,
      upload:meta,
      fileUrl:`/api/uploads/${id}/file`,
      projectUrl:`/project/${id}`
    });
  }catch(error){
    console.error("upload failed",error);
    return Response.json({ok:false,error:"تعذر حفظ المخطط على الخادم."},{status:500});
  }
}
