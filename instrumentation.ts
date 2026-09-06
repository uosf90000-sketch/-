export async function register(){
  if(process.env.NEXT_RUNTIME!=="nodejs") return;
  const g=globalThis as typeof globalThis & {__baytiCurrentProjectStarted?:boolean};
  if(g.__baytiCurrentProjectStarted) return;
  g.__baytiCurrentProjectStarted=true;

  setTimeout(async()=>{
    try{
      const mod=await import("./app/api/internal/process-once-a937/route");
      const response=await mod.GET(new Request("http://localhost/api/internal/process-once-a937"));
      const body=await response.json().catch(()=>({}));
      console.log("[BAYTI_STARTUP_PROCESS]",JSON.stringify(body));
    }catch(error){
      console.error("[BAYTI_STARTUP_PROCESS_ERROR]",error instanceof Error?error.message:String(error));
    }
  },1500);
}
