import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const ROOT=process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";

function outputText(body:any){
  if(typeof body?.output_text==="string") return body.output_text;
  const parts:string[]=[];
  for(const item of body?.output||[]){
    for(const c of item?.content||[]){
      if(c?.type==="output_text"&&typeof c?.text==="string") parts.push(c.text);
    }
  }
  return parts.join("\n");
}

export async function POST(request:Request){
  const input=await request.json().catch(()=>({}));
  const uploadId=input?.uploadId;
  if(!uploadId) return Response.json({ok:false,error:"uploadId مطلوب"},{status:400});

  const key=process.env.OPENAI_API_KEY;
  if(!key) return Response.json({ok:false,error:"OPENAI_API_KEY غير مضاف"},{status:503});

  const dir=path.join(ROOT,"uploads",uploadId);
  try{
    const meta=JSON.parse(await readFile(path.join(dir,"meta.json"),"utf8"));
    if(!["jpg","jpeg","png","webp"].includes(meta.extension)){
      return Response.json({ok:false,error:"استخراج أسماء الغرف بصريًا متاح للصور حاليًا."},{status:415});
    }
    const bytes=await readFile(path.join(dir,meta.storedName));
    const mime=meta.type||"image/jpeg";

    const schema={
      type:"object",
      additionalProperties:false,
      required:["rooms","notes"],
      properties:{
        rooms:{
          type:"array",
          items:{
            type:"object",
            additionalProperties:false,
            required:["name","type","bbox","confidence"],
            properties:{
              name:{type:"string"},
              type:{type:"string"},
              bbox:{
                type:"object",
                additionalProperties:false,
                required:["x","y","width","height"],
                properties:{
                  x:{type:"number",minimum:0,maximum:1000},
                  y:{type:"number",minimum:0,maximum:1000},
                  width:{type:"number",minimum:0,maximum:1000},
                  height:{type:"number",minimum:0,maximum:1000}
                }
              },
              confidence:{type:"number",minimum:0,maximum:1}
            }
          }
        },
        notes:{type:"array",items:{type:"string"}}
      }
    };

    const prompt="اقرأ مخطط المنزل المرفق. استخرج الفراغات/الغرف الداخلية الفعلية فقط، واسم كل غرفة كما يظهر أو أقرب تصنيف واضح. لكل غرفة أعط مربعًا يحيط بها بإحداثيات نسبية 0..1000 بالنسبة للصورة كاملة. لا تعد الممرات الصغيرة كغرفة إلا إذا كانت مساحة مستقلة، ولا تعد الحوش أو موقف السيارة كغرفة داخلية. لا تخترع أسماء غير مدعومة؛ عند عدم وضوح الاسم استخدم تسمية عامة مثل غرفة أو مساحة مع confidence منخفض.";

    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"content-type":"application/json",authorization:`Bearer ${key}`},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL||"gpt-5.5",
        input:[{
          role:"user",
          content:[
            {type:"input_text",text:prompt},
            {type:"input_image",image_url:`data:${mime};base64,${bytes.toString("base64")}`}
          ]
        }],
        text:{format:{type:"json_schema",name:"bayti_rooms",strict:true,schema}}
      })
    });

    const body=await response.json();
    if(!response.ok) return Response.json({ok:false,error:body?.error?.message||`OpenAI HTTP ${response.status}`},{status:502});
    const parsed=JSON.parse(outputText(body));
    const saved={provider:"openai",model:process.env.OPENAI_MODEL||"gpt-5.5",uploadId,...parsed,createdAt:new Date().toISOString()};
    await writeFile(path.join(dir,"rooms.json"),JSON.stringify(saved,null,2),"utf8");
    return Response.json({ok:true,...saved});
  }catch(error:any){
    return Response.json({ok:false,error:error?.message||"فشل استخراج الغرف"},{status:500});
  }
}
