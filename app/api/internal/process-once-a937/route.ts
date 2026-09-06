import { POST as analyze } from "@/app/api/analyze/route";
import { POST as rooms } from "@/app/api/rooms/route";
import { POST as design } from "@/app/api/design/route";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

const UPLOAD_ID="672fa7f6-801c-4691-b2eb-50339afa600f";

async function jsonOf(response:Response){
  return response.json().catch(()=>({ok:false,error:"invalid response"}));
}

export async function GET(req:Request){
  const base=new URL(req.url);

  const analysisRes=await analyze(new Request(new URL("/api/analyze",base),{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({uploadId:UPLOAD_ID})
  }));
  const analysis=await jsonOf(analysisRes);
  if(!analysisRes.ok||!analysis?.ok){
    return Response.json({ok:false,stage:"bimy",analysis},{status:502});
  }

  const aiEnabled=process.env.BAYTI_AI_STAGE_ENABLED==="true";
  let roomsRes:Response|null=null;
  let roomResult:any={ok:false,error:"AI_STAGE_DISABLED"};
  let designResult:any=null;

  if(aiEnabled){
    roomsRes=await rooms(new Request(new URL("/api/rooms",base),{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({uploadId:UPLOAD_ID})
    }));
    roomResult=await jsonOf(roomsRes);

    if(analysis?.result?.ifcPlan?.walls?.length>0 && roomsRes.ok && roomResult?.ok){
      const designRes=await design(new Request(new URL("/api/design",base),{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({uploadId:UPLOAD_ID,bim:analysis.result,style:"عصري دافئ"})
      }));
      designResult=await jsonOf(designRes);
    }
  }

  return Response.json({
    ok:true,
    uploadId:UPLOAD_ID,
    bimy:{
      status:analysis.status,
      scanStatus:analysis.scanStatus,
      scanCounts:analysis.scanCounts,
      ifcCounts:analysis.ifcCounts,
      inferredRoomCount:analysis.inferredRoomCount??analysis?.result?.inferredRoomCount??null,
      inferredRooms:Array.isArray(analysis?.result?.inferredRooms)?analysis.result.inferredRooms.map((r:any)=>({id:r.id,areaM2:r.areaM2,center:r.center})):[],
      ifc:analysis.ifc,
      ifcError:analysis.ifcError
    },
    rooms:{
      ok:Boolean(roomsRes?.ok&&roomResult?.ok),
      count:Array.isArray(roomResult?.rooms)?roomResult.rooms.length:null,
      error:roomResult?.error||null
    },
    design:{
      ok:Boolean(designResult?.ok),
      model:designResult?.model||null,
      style:designResult?.design?.style||null,
      items:Array.isArray(designResult?.design?.items)?designResult.design.items.length:null,
      error:designResult?.error||null
    }
  });
}
