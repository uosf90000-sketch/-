import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const ROOT=process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";

function cleanToken(value:string|undefined){
  const token=(value??"").replace(/\s+/g,"");
  if((token.startsWith('"')&&token.endsWith('"'))||(token.startsWith("'")&&token.endsWith("'"))){
    return token.slice(1,-1);
  }
  return token;
}
function object(v:any){return v&&typeof v==="object"&&!Array.isArray(v)?v:null}
function extractProjectId(body:any):string|null{
  const candidates=[
    body?._id,body?.id,body?.projectId,
    body?.project?._id,body?.project?.id,body?.project?.projectId,
    body?.data?._id,body?.data?.id,body?.data?.projectId
  ];
  for(const value of candidates) if(typeof value==="string"&&value.trim()) return value.trim();
  return null;
}
function items(body:any):any[]{
  const o=object(body);
  if(Array.isArray(body)) return body;
  if(Array.isArray(o?.items)) return o.items;
  if(Array.isArray(o?.data)) return o.data;
  if(Array.isArray(o?.results)) return o.results;
  return [];
}
function scanStatus(scan:any){
  const o=object(scan);
  const vals=[o?.status,o?.state,o?.processingStatus,o?.projectStatus,o?.data?.status,o?.data?.state];
  return vals.find(v=>typeof v==="string")?.toLowerCase()||"unknown";
}
function looksPending(status:string){
  return ["queued","pending","processing","running","working","created","uploaded","analyzing"].some(x=>status.includes(x));
}
function sleep(ms:number){return new Promise(r=>setTimeout(r,ms))}

async function bimyJson(baseUrl:string,token:string,endpoint:string,init:RequestInit={}){
  const headers=new Headers(init.headers);
  headers.set("Authorization",`Bearer ${token}`);
  if(!headers.has("Accept")) headers.set("Accept","application/json");
  const r=await fetch(`${baseUrl}${endpoint}`,{...init,headers,cache:"no-store",redirect:"manual"});
  const ct=r.headers.get("content-type")||"";
  const body=ct.includes("application/json")?await r.json().catch(()=>null):{text:(await r.text().catch(()=>"")).slice(0,1000)};
  if(!r.ok){
    const message=object(body)?.message||object(body)?.error||`BIMy HTTP ${r.status}`;
    const err:any=new Error(String(message)); err.status=r.status; err.body=body; throw err;
  }
  return body;
}

async function getResource(baseUrl:string,token:string,projectId:string,candidates:string[]){
  let last:any=null;
  for(const type of candidates){
    try{
      const body=await bimyJson(baseUrl,token,`/api/bim/projects/${encodeURIComponent(projectId)}/${encodeURIComponent(type)}?limit=500&offset=0`);
      const arr=items(body);
      if(arr.length>0) return {type,items:arr,raw:body};
      last={type,items:arr,raw:body};
    }catch(e:any){ last={type,error:e?.message||"request failed"}; }
  }
  return last||{type:candidates[0],items:[]};
}

export async function POST(request:Request){
  const input=await request.json().catch(()=>({}));
  const uploadId=input?.uploadId;
  if(!uploadId) return Response.json({ok:false,error:"uploadId مطلوب."},{status:400});

  const baseUrl=(process.env.BIMY_API_BASE_URL??"https://bimy.app").replace(/\/+$/,"");
  const token=cleanToken(process.env.BIMY_API_TOKEN);
  if(!token) return Response.json({ok:false,code:"BIMY_TOKEN_MISSING",error:"BIMY_API_TOKEN غير مضاف."},{status:503});

  const dir=path.join(ROOT,"uploads",uploadId);
  await mkdir(dir,{recursive:true});

  try{
    const meta=JSON.parse(await readFile(path.join(dir,"meta.json"),"utf8"));
    let state:any=null;
    try{ state=JSON.parse(await readFile(path.join(dir,"bimy-state.json"),"utf8")); }catch{}

    let bimyProjectId:string|null=state?.bimyProjectId||null;
    let uploadResponse:any=state?.uploadResponse||null;

    if(!bimyProjectId){
      const bytes=await readFile(path.join(dir,meta.storedName));
      const form=new FormData();
      const copy=new ArrayBuffer(bytes.byteLength); new Uint8Array(copy).set(bytes);
      form.set("file",new Blob([copy],{type:meta.type||"application/octet-stream"}),meta.name);
      form.set("name",input?.name||`Bayti ${meta.name}`);

      uploadResponse=await bimyJson(baseUrl,token,"/api/projects/from-plan",{method:"POST",body:form});
      bimyProjectId=extractProjectId(uploadResponse);
      if(!bimyProjectId){
        await writeFile(path.join(dir,"bimy-state.json"),JSON.stringify({uploadResponse,status:"project-created-id-missing",updatedAt:new Date().toISOString()},null,2));
        return Response.json({ok:false,code:"BIMY_PROJECT_ID_MISSING",error:"BIMy استقبل المخطط لكن لم أجد Project ID في الاستجابة.",details:uploadResponse},{status:502});
      }
      state={bimyProjectId,uploadResponse,status:"project-created",updatedAt:new Date().toISOString()};
      await writeFile(path.join(dir,"bimy-state.json"),JSON.stringify(state,null,2));
    }

    let scan:any=null;
    let status="unknown";
    for(let attempt=0;attempt<6;attempt++){
      try{
        scan=await bimyJson(baseUrl,token,`/api/projects/${encodeURIComponent(bimyProjectId)}/plan-scan`);
        status=scanStatus(scan);
        if(!looksPending(status)) break;
      }catch(e:any){
        if(e?.status===404 || e?.status===409 || e?.status===425){
          status="processing";
        }else throw e;
      }
      await sleep(1800);
    }

    // BIMy old production flow uses this endpoint to accept its detected scale.
    let scaleApplied=false;
    try{
      await bimyJson(baseUrl,token,`/api/projects/${encodeURIComponent(bimyProjectId)}/plan-scan/scale`,{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({useDetected:true})
      });
      scaleApplied=true;
    }catch{}

    const resources={
      walls:await getResource(baseUrl,token,bimyProjectId,["IfcWall","IFCWALL","walls","wall"]),
      doors:await getResource(baseUrl,token,bimyProjectId,["IfcDoor","IFCDOOR","doors","door"]),
      windows:await getResource(baseUrl,token,bimyProjectId,["IfcWindow","IFCWINDOW","windows","window"]),
      spaces:await getResource(baseUrl,token,bimyProjectId,["IfcSpace","IFCSPACE","spaces","space"])
    };
    const counts={
      walls:resources.walls?.items?.length||0,
      doors:resources.doors?.items?.length||0,
      windows:resources.windows?.items?.length||0,
      spaces:resources.spaces?.items?.length||0
    };
    const geometryReady=counts.walls>0 || counts.spaces>0;

    let ifcSaved=false;
    let ifcName:string|null=null;
    if(geometryReady){
      try{
        const r=await fetch(`${baseUrl}/api/ifc/${encodeURIComponent(bimyProjectId)}`,{
          headers:{Authorization:`Bearer ${token}`,Accept:"application/x-step, application/octet-stream, */*"},
          cache:"no-store",redirect:"manual"
        });
        if(r.ok){
          const bytes=Buffer.from(await r.arrayBuffer());
          if(bytes.length>0){
            ifcName=r.headers.get("x-ifc-name")||"model.ifc";
            await writeFile(path.join(dir,"model.ifc"),bytes);
            ifcSaved=true;
          }
        }
      }catch{}
    }

    const analysis={
      provider:"bimy",
      uploadId,
      bimyProjectId,
      status:geometryReady?"geometry-ready":"processing",
      scanStatus:status,
      scaleApplied,
      counts,
      scan,
      resources,
      ifc:{saved:ifcSaved,name:ifcName},
      updatedAt:new Date().toISOString()
    };
    await writeFile(path.join(dir,"analysis.json"),JSON.stringify(analysis,null,2),"utf8");
    await writeFile(path.join(dir,"bimy-state.json"),JSON.stringify({...state,status:analysis.status,updatedAt:analysis.updatedAt},null,2),"utf8");

    if(!geometryReady){
      return Response.json({
        ok:true,provider:"bimy",uploadId,bimyProjectId,
        status:"processing",scanStatus:status,counts,
        message:"BIMy استقبل المخطط وما زال يجهز الهندسة. أعد الفحص بعد قليل."
      });
    }

    return Response.json({
      ok:true,provider:"bimy",uploadId,bimyProjectId,
      status:"geometry-ready",scanStatus:status,scaleApplied,counts,
      ifc:{saved:ifcSaved,name:ifcName},
      result:analysis
    });
  }catch(error:any){
    return Response.json({ok:false,error:error?.message||"BIMy error"},{status:502});
  }
}
