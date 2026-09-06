export async function GET(){
  const key=Boolean(process.env.BIMY_API_KEY);
  const url=Boolean(process.env.BIMY_API_URL);
  return Response.json({
    ok:true,
    service:"bayti-experimental",
    demo:process.env.BAYTI_DEMO_MODE!=="false",
    bimyTokenPresent:key,
    bimyConfigured:key&&url,
    bimyIntegrationPending:!(key&&url),
    openaiConfigured:Boolean(process.env.OPENAI_API_KEY)
  });
}
