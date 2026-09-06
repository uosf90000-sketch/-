const demoAnalysis = {
  provider:"demo",
  confidence:0.93,
  rooms:[
    {id:"majlis",name:"المجلس",area:34},
    {id:"kitchen",name:"المطبخ",area:22},
    {id:"bedroom",name:"غرفة النوم",area:20},
    {id:"bathroom",name:"الحمام",area:7}
  ],
  geometry:{walls:22,doors:8,windows:10}
};

export async function POST(request:Request){
  const input=await request.json().catch(()=>({}));
  const url=process.env.BIMY_API_URL;
  const key=process.env.BIMY_API_KEY;
  if(!url || !key) return Response.json({ok:true,...demoAnalysis,note:"BIMy adapter ready; add BIMY_API_URL and BIMY_API_KEY on Railway.",input});
  try{
    const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${key}`},body:JSON.stringify(input)});
    const body=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(`BIMy HTTP ${r.status}`);
    return Response.json({ok:true,provider:"bimy",result:body});
  }catch(error){
    return Response.json({ok:false,error:error instanceof Error?error.message:"BIMy error"},{status:502});
  }
}
