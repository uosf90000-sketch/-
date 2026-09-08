export const runtime="nodejs";
export const dynamic="force-dynamic";

function bimyBase(value:string|undefined){ return (value??"https://bimy.app").trim().replace(/\/+$/,"").replace(/\/api$/i,""); }

function cleanToken(value:string|undefined){
  const token=(value??"").replace(/\s+/g,"");
  if((token.startsWith('"')&&token.endsWith('"'))||(token.startsWith("'")&&token.endsWith("'"))) return token.slice(1,-1);
  return token;
}

export async function GET(){
  const token=cleanToken(process.env.BIMY_API_TOKEN);
  const base=bimyBase(process.env.BIMY_API_BASE_URL);
  if(!token) return Response.json({ok:false,status:"not_configured",message:"BIMy غير مهيأ: أضف BIMY_API_TOKEN في Railway."},{status:503});
  try{
    const response=await fetch(`${base}/api/projects?limit=1&offset=0&sort=created&scope=all`,{
      headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},
      cache:"no-store",signal:AbortSignal.timeout(15000)
    });
    if(response.status===401||response.status===403) return Response.json({ok:false,status:"unauthorized",message:"BIMy رفض المفتاح أو أن المفتاح لا يملك صلاحية القراءة."},{status:502});
    if(!response.ok) return Response.json({ok:false,status:"provider_error",message:`BIMy أعاد استجابة غير متوقعة (${response.status}).`},{status:502});
    return Response.json({ok:true,status:"connected",message:"اتصال BIMy والمفتاح يعملان."});
  }catch{
    return Response.json({ok:false,status:"timeout",message:"BIMy لم يستجب خلال ١٥ ثانية."},{status:504});
  }
}
