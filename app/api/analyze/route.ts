import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseIfc, ifcLengthToMeters, entitiesOfType } from "@/lib/ifc/parse";
import { ifcToPlan } from "@/lib/ifc/to-plan";
import { inferRoomsFromWalls } from "@/lib/geometry/infer-rooms";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

const ROOT=process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";

function bimyBase(value:string|undefined){ return (value??"https://bimy.app").trim().replace(/\/+$/,"").replace(/\/api$/i,""); }

function cleanToken(value:string|undefined){
  const token=(value??"").replace(/\s+/g,"");
  if((token.startsWith('"')&&token.endsWith('"'))||(token.startsWith("'")&&token.endsWith("'"))) return token.slice(1,-1);
  return token;
}
function record(value:any){
  return value&&typeof value==="object"&&!Array.isArray(value)?value:null;
}
function itemsOf(value:any):any[]{
  const root=record(value);
  if(Array.isArray(value)) return value;
  if(Array.isArray(root?.items)) return root.items;
  if(Array.isArray(root?.data)) return root.data;
  if(Array.isArray(root?.results)) return root.results;
  return [];
}
function projectIdOf(value:any):string|null{
  const root=record(value);
  const project=record(root?.project);
  for(const candidate of [project?._id,project?.id,root?.projectId,root?._id,root?.id]){
    if(typeof candidate==="string"&&candidate.trim()) return candidate.trim();
  }
  return null;
}
function projectName(value:any):string|null{
  const root=record(value);
  return typeof root?.name==="string"?root.name:null;
}
function statusFromScan(value:any):string|null{
  const root=record(value);
  const project=record(root?.project);
  const progress=record(root?.scanProgress);
  for(const candidate of [project?.scanStatus,project?.status,root?.scanStatus,root?.status,progress?.status]){
    if(typeof candidate==="string"&&candidate.trim()) return candidate.trim().toLowerCase();
  }
  return null;
}
function sleep(ms:number){return new Promise(r=>setTimeout(r,ms))}
async function jsonRequest(base:string,token:string,endpoint:string,init:RequestInit={}){
  const headers=new Headers(init.headers);
  headers.set("Authorization",`Bearer ${token}`);
  if(!headers.has("Accept")) headers.set("Accept","application/json");
  let response: Response;
  try { response=await fetch(`${base}${endpoint}`,{...init,headers,cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(15000)}); }
  catch(error:any) { const err:any=new Error("BIMy لم يستجب خلال ١٥ ثانية."); err.code="bimy_timeout"; throw err; }
  const ct=response.headers.get("content-type")||"";
  const body=ct.includes("application/json")?await response.json().catch(()=>null):{text:(await response.text().catch(()=>"")).slice(0,1000)};
  if(!response.ok){
    const r=record(body);
    const message=typeof r?.message==="string"?r.message:typeof r?.error==="string"?r.error:`BIMy HTTP ${response.status}`;
    const err:any=new Error(message); err.status=response.status; err.body=body; throw err;
  }
  return body;
}
async function getResource(base:string,token:string,projectId:string,resource:string){
  try{
    const body=await jsonRequest(base,token,`/api/bim/projects/${encodeURIComponent(projectId)}/${resource}?limit=500&offset=0`);
    return {ok:true,count:itemsOf(body).length,items:itemsOf(body)};
  }catch(error:any){
    return {ok:false,count:null,error:error?.message||"resource error"};
  }
}
function scanCounts(scan:any){
  const project=record(record(scan)?.project);
  const progress=record(project?.scanProgress);
  const counts=record(progress?.counts);
  return {
    walls:typeof counts?.walls==="number"?counts.walls:0,
    doors:typeof counts?.doors==="number"?counts.doors:0,
    windows:typeof counts?.windows==="number"?counts.windows:0,
    openings:typeof counts?.openings==="number"?counts.openings:0,
    lines:typeof counts?.lines==="number"?counts.lines:0
  };
}

export async function POST(request:Request){
  const input=await request.json().catch(()=>({}));
  const uploadId=input?.uploadId;
  if(typeof uploadId !== "string" || !/^[a-f0-9-]{36}$/i.test(uploadId)) return Response.json({ok:false,error:"uploadId مطلوب."},{status:400});

  const base=bimyBase(process.env.BIMY_API_BASE_URL);
  const token=cleanToken(process.env.BIMY_API_TOKEN);
  if(!token) return Response.json({ok:false,error:"BIMY_API_TOKEN غير مضاف."},{status:503});

  const dir=path.join(ROOT,"uploads",uploadId);
  await mkdir(dir,{recursive:true});

  try{
    try {
      const saved=JSON.parse(await readFile(path.join(dir,"analysis.json"),"utf8"));
      if(saved?.ifcPlan?.walls?.length) {
        try {
          const doc=parseIfc(await readFile(path.join(dir,"model.ifc"),"utf8"));
          const units=ifcLengthToMeters(doc);
          if(units !== null) {
            const fresh=ifcToPlan(doc,units);
            // Reparse saved IFC only when the wall identities and geometry remain unchanged.
            if(JSON.stringify(fresh.walls) === JSON.stringify(saved.ifcPlan.walls)) {
              saved.ifcPlan=fresh;
              await writeFile(path.join(dir,"analysis.json"),JSON.stringify(saved,null,2));
            }
          }
        } catch {}
        return Response.json({ok:true,result:saved,status:saved.status});
      }
    } catch {}
    const meta=JSON.parse(await readFile(path.join(dir,"meta.json"),"utf8"));
    const projectNameWanted=input?.name||`Bayti ${meta.name}`;
    let state:any=null;
    try{state=JSON.parse(await readFile(path.join(dir,"bimy-state.json"),"utf8"))}catch{}

    let projectId:string|null=state?.bimyProjectId||null;
    let uploadResponse:any=state?.uploadResponse||null;

    if(!projectId){
      try{
        const listed=await jsonRequest(base,token,"/api/projects/list?limit=50&offset=0&sort=created&scope=all");
        const existing=itemsOf(listed).find((x:any)=>projectName(x)===projectNameWanted);
        projectId=projectIdOf(existing);
      }catch(error:any){
        if(error?.status === 401 || error?.status === 403) throw error;
      }
    }

    if(!projectId){
      const bytes=await readFile(path.join(dir,meta.storedName));
      const copy=new ArrayBuffer(bytes.byteLength); new Uint8Array(copy).set(bytes);
      const form=new FormData();
      form.set("file",new Blob([copy],{type:meta.type||"application/octet-stream"}),meta.name);
      form.set("name",projectNameWanted);
      uploadResponse=await jsonRequest(base,token,"/api/projects/from-plan",{method:"POST",body:form});
      projectId=projectIdOf(uploadResponse);
    }

    if(!projectId) return Response.json({ok:false,error:"BIMy استقبل المخطط لكن لم يرجع Project ID."},{status:502});

    state={bimyProjectId:projectId,uploadResponse,status:"processing",updatedAt:new Date().toISOString()};
    await writeFile(path.join(dir,"bimy-state.json"),JSON.stringify(state,null,2),"utf8");

    let scan:any=null;
    let status:string|null=null;
    let scaleApplied=Boolean(state?.scaleApplied);
    scan=await jsonRequest(base,token,`/api/projects/${encodeURIComponent(projectId)}/plan-scan`);
    status=statusFromScan(scan);
    if(status==="calibrating"&&!scaleApplied){
      try{
        const scaled=await jsonRequest(base,token,`/api/projects/${encodeURIComponent(projectId)}/plan-scan/scale`,{
          method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({useDetected:true})
        });
        scaleApplied=true;
        if(record(scaled)?.project) scan=scaled;
        status=statusFromScan(scan);
      }catch{}
    }

    const scanSummary=scanCounts(scan);
    if(["error","failed","cancelled","canceled"].includes(status||"")) throw new Error("BIMy تعذر عليه إكمال قراءة المخطط. أعد المحاولة بعد قليل.");
    if(status!=="ready") {
      const pending={provider:"bimy",uploadId,bimyProjectId:projectId,status:"processing",scanStatus:status,scaleApplied,scan,scanCounts:scanSummary,updatedAt:new Date().toISOString()};
      await writeFile(path.join(dir,"analysis.json"),JSON.stringify(pending,null,2),"utf8");
      await writeFile(path.join(dir,"bimy-state.json"),JSON.stringify({...state,...pending},null,2),"utf8");
      return Response.json({ok:true,pending:true,provider:"bimy",status:"processing",scanStatus:status,scanCounts:scanSummary,retryAfterMs:4000,result:pending});
    }
    const resources={
      wall:await getResource(base,token,projectId,"wall"),
      door:await getResource(base,token,projectId,"door"),
      window:await getResource(base,token,projectId,"window"),
      space:await getResource(base,token,projectId,"space")
    };

    let ifc:any={saved:false,name:null,bytes:0};
    let ifcPlan:any=null;
    let ifcCounts={walls:0,doors:0,windows:0,spaces:0,openings:0};
    let ifcError:string|null=null;

    if(status==="ready"){
      try{
        const response=await fetch(`${base}/api/export/revit-ifc/${encodeURIComponent(projectId)}`,{
          headers:{Authorization:`Bearer ${token}`,Accept:"application/x-step, application/octet-stream, */*"},
          cache:"no-store",redirect:"manual"
        });
        if(!response.ok) throw new Error(`BIMy IFC HTTP ${response.status}`);
        const bytes=Buffer.from(await response.arrayBuffer());
        if(bytes.length===0) throw new Error("BIMy IFC empty");
        await writeFile(path.join(dir,"model.ifc"),bytes);
        const text=bytes.toString("utf8");
        const doc=parseIfc(text);
        const metersPerUnit=ifcLengthToMeters(doc);
        ifcCounts={
          walls:entitiesOfType(doc,"IFCWALL","IFCWALLSTANDARDCASE").length,
          doors:entitiesOfType(doc,"IFCDOOR").length,
          windows:entitiesOfType(doc,"IFCWINDOW").length,
          spaces:entitiesOfType(doc,"IFCSPACE").length,
          openings:entitiesOfType(doc,"IFCOPENINGELEMENT").length
        };
        if(metersPerUnit!==null) ifcPlan=ifcToPlan(doc,metersPerUnit);
        ifc={saved:true,name:response.headers.get("x-ifc-name")||"model.ifc",bytes:bytes.length,metersPerUnit};
      }catch(error:any){
        ifcError=error?.message||"تعذر تنزيل IFC";
      }
    }

    const geometryReady=Boolean(ifcPlan&&Array.isArray(ifcPlan.walls)&&ifcPlan.walls.length>0);
    const inferredRooms=geometryReady?inferRoomsFromWalls(ifcPlan.walls):[];
    const analysis={
      provider:"bimy",
      uploadId,
      bimyProjectId:projectId,
      status:geometryReady?"geometry-ready":status==="ready"?"scan-ready":"processing",
      scanStatus:status,
      scaleApplied,
      scan,
      scanCounts:scanSummary,
      resources,
      ifc,
      ifcCounts,
      ifcPlan,
      inferredRooms,
      inferredRoomCount:inferredRooms.length,
      ifcError,
      updatedAt:new Date().toISOString()
    };

    await writeFile(path.join(dir,"analysis.json"),JSON.stringify(analysis,null,2),"utf8");
    await writeFile(path.join(dir,"bimy-state.json"),JSON.stringify({...state,status:analysis.status,updatedAt:analysis.updatedAt},null,2),"utf8");

    return Response.json({
      ok:true,
      provider:"bimy",
      status:analysis.status,
      bimyProjectId:projectId,
      scanStatus:status,
      scanCounts:scanSummary,
      ifcCounts,
      inferredRoomCount:inferredRooms.length,
      ifc,
      ifcError,
      result:analysis
    });
  }catch(error:any){
    if(error?.status === 401 || error?.status === 403) return Response.json({ok:false,code:"bimy_auth",error:"تعذر الاتصال بخدمة قراءة الجدران: مفتاح BIMy غير صالح أو لا يملك صلاحية القراءة. حدّث BIMY_API_TOKEN في إعدادات خدمة بيتي، ثم استكمل الطلب. ملفك محفوظ."},{status:502});
    if(error?.code === "bimy_timeout") return Response.json({ok:false,code:"bimy_timeout",error:"خدمة BIMy لم ترد خلال ١٥ ثانية. لم نبدأ تحليلًا جديدًا؛ أعد المحاولة بعد قليل."},{status:504});
    return Response.json({ok:false,error:"تعذر استكمال قراءة الجدران. ملفك محفوظ ويمكنك استكمال الطلب لاحقًا."},{status:502});
  }
}
