import { access } from "node:fs/promises";
import path from "node:path";
import { GET as processOnce } from "@/app/api/internal/process-once-a937/route";

const ROOT=process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";
const CURRENT_UPLOAD="672fa7f6-801c-4691-b2eb-50339afa600f";
let started=false;

async function processCurrentOnce(){
  if(started)return;
  started=true;
  try{
    await access(path.join(ROOT,"uploads",CURRENT_UPLOAD,"design.json"));
    console.log("[BAYTI_AUTO_PROCESS] design already exists; skipping");
    return;
  }catch{}
  try{
    const response=await processOnce(new Request("http://localhost/api/internal/process-once-a937"));
    const body=await response.json().catch(()=>({}));
    console.log("[BAYTI_AUTO_PROCESS]",JSON.stringify(body));
  }catch(error){
    console.error("[BAYTI_AUTO_PROCESS_ERROR]",error instanceof Error?error.message:String(error));
  }
}

export async function GET(){
  void processCurrentOnce();
  const token=Boolean(process.env.BIMY_API_TOKEN);
  const baseUrl=process.env.BIMY_API_BASE_URL||"https://bimy.app";
  return Response.json({
    ok:true,
    service:"bayti-experimental",
    demo:process.env.BAYTI_DEMO_MODE!=="false",
    bimyTokenPresent:token,
    bimyBaseUrl:baseUrl,
    bimyConfigured:token,
    bimyIntegrationPending:!token,
    openaiConfigured:Boolean(process.env.OPENAI_API_KEY),
    aiStageEnabled:process.env.BAYTI_AI_STAGE_ENABLED==="true"
  });
}
