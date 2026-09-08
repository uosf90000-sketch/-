import { tectlyConfig } from "@/lib/server/tectly/client";
export async function GET(){
  const tectly=tectlyConfig();
  const token=Boolean(process.env.BIMY_API_TOKEN);
  const configuredBase=process.env.BIMY_API_BASE_URL||"https://bimy.app";
  const baseUrl=configuredBase.trim().replace(/\/+$/,"").replace(/\/api$/i,"");
  return Response.json({
    ok:true,
    service:"bayti-experimental",
    build:process.env.RAILWAY_GIT_COMMIT_SHA || null,
    tectlyConfigured:tectly.configured,
    tectlyDisabled:tectly.disabled,
    tectlyCredentialsPresent:Boolean(tectly.clientId && tectly.clientSecret),
    demo:process.env.BAYTI_DEMO_MODE!=="false",
    bimyTokenPresent:token,
    bimyBaseUrl:baseUrl,
    bimyConfigured:token,
    bimyIntegrationPending:!token,
    openaiConfigured:Boolean(process.env.OPENAI_API_KEY),
    aiStageEnabled:process.env.BAYTI_AI_STAGE_ENABLED==="true"
  });
}
