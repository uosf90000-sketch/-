import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=90;

const ROOT=process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";

function outputText(body:any){
  if(typeof body?.output_text==="string") return body.output_text;
  const parts:string[]=[];
  for(const item of body?.output||[]) for(const c of item?.content||[]){
    if(c?.type==="output_text"&&typeof c?.text==="string") parts.push(c.text);
  }
  return parts.join("\n");
}

export async function POST(request:Request){
  const input=await request.json().catch(()=>({}));
  const uploadId=input?.uploadId;
  const key=process.env.OPENAI_API_KEY;
  if(!uploadId) return Response.json({ok:false,error:"uploadId مطلوب"},{status:400});
  if(!key) return Response.json({ok:false,error:"OPENAI_API_KEY غير مضاف"},{status:503});

  const dir=path.join(ROOT,"uploads",uploadId);
  try{
    const meta=JSON.parse(await readFile(path.join(dir,"meta.json"),"utf8"));
    const analysis=input?.bim||JSON.parse(await readFile(path.join(dir,"analysis.json"),"utf8"));
    let roomReading:any={rooms:[]};
    try{roomReading=JSON.parse(await readFile(path.join(dir,"rooms.json"),"utf8"))}catch{}

    const scanReady=analysis?.scan?.project?.scanStatus==="ready"||analysis?.scanStatus==="ready";
    if(!scanReady) return Response.json({ok:false,error:"تحليل BIMy لم يكتمل بعد."},{status:409});

    const itemSchema={
      type:"object",additionalProperties:false,
      required:["category","name","room","planX","planY","widthM","depthM","heightM","rotationDeg","color","material","details"],
      properties:{
        category:{type:"string"},
        name:{type:"string"},
        room:{type:"string"},
        planX:{type:"number",minimum:0,maximum:1000},
        planY:{type:"number",minimum:0,maximum:1000},
        widthM:{type:"number",minimum:0.1,maximum:12},
        depthM:{type:"number",minimum:0.1,maximum:12},
        heightM:{type:"number",minimum:0.05,maximum:5},
        rotationDeg:{type:"number",minimum:0,maximum:359},
        color:{type:"string"},
        material:{type:"string"},
        details:{type:"string"}
      }
    };
    const schema={
      type:"object",additionalProperties:false,
      required:["style","concept","palette","roomFinishes","items","lighting","airConditioning","notes"],
      properties:{
        style:{type:"string"},
        concept:{type:"string"},
        palette:{type:"array",items:{type:"string"}},
        roomFinishes:{type:"array",items:{
          type:"object",additionalProperties:false,
          required:["room","wallPaint","flooring","ceiling","accent"],
          properties:{room:{type:"string"},wallPaint:{type:"string"},flooring:{type:"string"},ceiling:{type:"string"},accent:{type:"string"}}
        }},
        items:{type:"array",items:itemSchema},
        lighting:{type:"array",items:itemSchema},
        airConditioning:{type:"array",items:itemSchema},
        notes:{type:"array",items:{type:"string"}}
      }
    };

    const prompt=[
      "أنت المصمم الداخلي لمنصة بيتي. صمم المنزل كاملًا اعتمادًا على المخطط الحقيقي ونتيجة BIMy وأسماء الغرف المرسلة.",
      "يشمل المطلوب: الأثاث، المطبخ، الحمامات، البوية، البلاط، الأسقف، الإنارة، التكييف، الأبواب والنوافذ عند الحاجة.",
      "لكل عنصر أعط planX وplanY من 0 إلى 1000 بالنسبة للصورة الأصلية كاملة حتى نضعه في 3D.",
      "لا تضع أثاثًا داخل الجدران أو الممرات، ولا تخترع أبعادًا للمنزل نفسه. أبعاد الأثاث يمكن أن تكون مقاسات سوقية واقعية.",
      "اجعل التصميم عصريًا دافئًا ومناسبًا لمنزل سعودي، وراعي الخصوصية ومسارات الحركة.",
      `BIMy: ${JSON.stringify({scan:analysis?.scan?.project,ifcCounts:analysis?.ifcCounts,ifcPlan:analysis?.ifcPlan})}`,
      `الغرف: ${JSON.stringify(roomReading?.rooms||[])}`
    ].join("\n");

    const content:any[]=[{type:"input_text",text:prompt}];
    if(["jpg","jpeg","png","webp"].includes(meta.extension)){
      const bytes=await readFile(path.join(dir,meta.storedName));
      content.push({type:"input_image",image_url:`data:${meta.type||"image/jpeg"};base64,${bytes.toString("base64")}`});
    }

    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"content-type":"application/json",authorization:`Bearer ${key}`},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL||"gpt-5.5",
        input:[{role:"user",content}],
        text:{format:{type:"json_schema",name:"bayti_interior_design",strict:true,schema}}
      })
    });
    const body=await response.json();
    if(!response.ok) return Response.json({ok:false,error:body?.error?.message||`OpenAI HTTP ${response.status}`},{status:502});

    const design=JSON.parse(outputText(body));
    const saved={provider:"openai",model:process.env.OPENAI_MODEL||"gpt-5.5",uploadId,design,createdAt:new Date().toISOString()};
    await writeFile(path.join(dir,"design.json"),JSON.stringify(saved,null,2),"utf8");
    return Response.json({ok:true,...saved});
  }catch(error:any){
    return Response.json({ok:false,error:error?.message||"فشل التصميم الداخلي"},{status:500});
  }
}
