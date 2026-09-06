export async function GET(){
  return Response.json({ok:true,service:"bayti-experimental",demo:process.env.BAYTI_DEMO_MODE!=="false",bimyConfigured:Boolean(process.env.BIMY_API_KEY),openaiConfigured:Boolean(process.env.OPENAI_API_KEY)});
}
