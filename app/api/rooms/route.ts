import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { preparePlanImage, restoreRoomCoordinates } from "@/lib/server/plan-image";

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
  if(typeof uploadId!=="string" || !/^[a-f0-9-]{36}$/i.test(uploadId)) return Response.json({ok:false,error:"uploadId مطلوب"},{status:400});

  const key=process.env.OPENAI_API_KEY;
  if(!key) return Response.json({ok:false,code:"not_configured",error:"خدمة قراءة الأسماء غير مفعّلة حاليًا. يمكنك تسمية الغرف بالضغط عليها."},{status:503});

  const dir=path.join(ROOT,"uploads",uploadId);
  try{
    const meta=JSON.parse(await readFile(path.join(dir,"meta.json"),"utf8"));
    if(!["jpg","jpeg","png","webp"].includes(meta.extension)){
      return Response.json({ok:false,error:"استخراج أسماء الغرف بصريًا متاح للصور حاليًا."},{status:415});
    }
    const bytes=await readFile(path.join(dir,meta.storedName));
    const prepared=await preparePlanImage(bytes);

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

    const prompt="اقرأ مخطط المنزل المرفق. استخرج المساحات الداخلية والخارجية، وصنّف الدرج stairs والمصعد elevator والحوش outdoor وموقف السيارة garage، ولا تصنفها كغرف سكنية، واسم كل غرفة كما يظهر أو أقرب تصنيف واضح. لكل غرفة أعط مربعًا يحيط بها بإحداثيات نسبية 0..1000 بالنسبة للصورة كاملة. لا تعد الممرات الصغيرة كغرفة إلا إذا كانت مساحة مستقلة، أدرج الحوش وموقف السيارة والدرج والمصعد بمربعاتها وتصنيفاتها الصحيحة. لا تخترع أسماء غير مدعومة؛ عند عدم وضوح الاسم استخدم تسمية عامة مثل غرفة أو مساحة مع confidence منخفض.";

    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      signal:AbortSignal.timeout(50000),
      headers:{"content-type":"application/json",authorization:`Bearer ${key}`},
      body:JSON.stringify({
        model:process.env.OPENAI_VISION_MODEL||process.env.OPENAI_MODEL||"gpt-5.5",
        max_output_tokens:8000,
        input:[{
          role:"user",
          content:[
            {type:"input_text",text:prompt},
            {type:"input_image",detail:"high",image_url:`data:image/png;base64,${prepared.buffer.toString("base64")}`}
          ]
        }],
        text:{format:{type:"json_schema",name:"bayti_rooms",strict:true,schema}}
      })
    });

    const body=await response.json();
    if(!response.ok) {
      const code=String(body?.error?.code||response.status);
      console.error("Room reading provider failure", {status:response.status,code});
      const error=response.status===429 ? "خدمة قراءة الأسماء بلغت حد الاستخدام. حاول لاحقًا أو سمّ الغرف يدويًا." : response.status===401||response.status===403||code==="model_not_found" ? "إعداد خدمة قراءة الأسماء يحتاج تحديثًا. يمكنك تسمية الغرف يدويًا الآن." : "خدمة قراءة الأسماء لم تستجب. حاول مرة أخرى أو سمّ الغرف يدويًا.";
      return Response.json({ok:false,code,error},{status:502});
    }
    if(body.status==="incomplete"||!outputText(body)) return Response.json({ok:false,code:"incomplete",error:"لم تكتمل قراءة الأسماء. حاول مرة أخرى أو سمّ الغرف يدويًا."},{status:502});
    const parsed=JSON.parse(outputText(body));
    if(!Array.isArray(parsed.rooms)||parsed.rooms.some((r:any)=>!r.bbox||![r.bbox.x,r.bbox.y,r.bbox.width,r.bbox.height].every(Number.isFinite))) throw new Error("invalid_rooms");
    if(!parsed.rooms.length) return Response.json({ok:false,code:"no_names",error:"لم نتمكن من تمييز الأسماء في هذه الصورة. اضغط على كل غرفة لتسميتها."},{status:422});
    parsed.rooms=restoreRoomCoordinates(parsed.rooms,prepared.crop);
    const a=input.alignment;
    const alignment=a&&[a.left,a.top,a.width,a.height].every(Number.isFinite)&&a.width>0&&a.height>0 ? {left:a.left,top:a.top,width:a.width,height:a.height}:undefined;
    const saved={alignment,provider:"openai",model:process.env.OPENAI_VISION_MODEL||process.env.OPENAI_MODEL||"gpt-5.5",uploadId,...parsed,createdAt:new Date().toISOString()};
    await writeFile(path.join(dir,"rooms.json"),JSON.stringify(saved,null,2),"utf8");
    return Response.json({ok:true,...saved});
  }catch(error:any){
    const timedOut=error?.name==="TimeoutError"||error?.name==="AbortError";
    console.error("Room reading failed", {code:timedOut?"timeout":"invalid_result"});
    return Response.json({ok:false,code:timedOut?"timeout":"invalid_result",error:timedOut?"استغرقت قراءة الأسماء وقتًا طويلًا. حاول مرة أخرى أو سمّ الغرف يدويًا.":"تعذر قراءة أسماء الغرف من هذه الصورة. جرّب نسخة أوضح أو سمّ الغرف يدويًا."},{status:502});
  }
}
