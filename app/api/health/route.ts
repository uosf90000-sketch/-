export async function GET(){
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
    openaiConfigured:Boolean(process.env.OPENAI_API_KEY)
  });
}
