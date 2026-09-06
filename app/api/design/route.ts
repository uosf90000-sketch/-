function responseText(payload:any){
  if(typeof payload?.output_text==="string") return payload.output_text;
  const chunks:string[]=[];
  for(const item of payload?.output||[]) for(const c of item?.content||[]) if(c?.type==="output_text"&&typeof c?.text==="string") chunks.push(c.text);
  return chunks.join("\n");
}

export async function POST(request:Request){
  const input=await request.json().catch(()=>({}));
  const key=process.env.OPENAI_API_KEY;
  if(!key){
    return Response.json({
      ok:false,
      code:"OPENAI_NOT_CONFIGURED",
      error:"OpenAI API غير مربوط حتى الآن. لن يتم إنشاء تصميم داخلي وهمي."
    },{status:503});
  }

  const schema={
    type:"object",
    additionalProperties:false,
    required:["style","concept","elements"],
    properties:{
      style:{type:"string"},
      concept:{type:"string"},
      elements:{type:"array",items:{type:"object",additionalProperties:false,required:["category","room","name","color","material","placement","reason"],properties:{
        category:{type:"string"},room:{type:"string"},name:{type:"string"},color:{type:"string"},material:{type:"string"},placement:{type:"string"},reason:{type:"string"}
      }}}
    }
  };

  const prompt=`أنت المصمم الداخلي لمنصة بيتي. استخدم فقط بيانات المنزل الحقيقية المرسلة لك. صمم المنزل بالكامل بما يشمل الأثاث، البوية، البلاط، المطبخ، الحمامات، الأبواب، الشبابيك، التكييف، وتوزيع الإنارة. لا تخترع أبعادًا هندسية غير موجودة في البيانات. أعد قرارات قابلة للتحويل إلى مشهد 3D. بيانات المشروع: ${JSON.stringify(input)}`;

  try{
    const r=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"content-type":"application/json","authorization":`Bearer ${key}`},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL||"gpt-5.4",
        input:prompt,
        text:{format:{type:"json_schema",name:"bayti_interior_design",strict:true,schema}}
      })
    });
    const body=await r.json();
    if(!r.ok) return Response.json({ok:false,error:body?.error?.message||`OpenAI HTTP ${r.status}`},{status:502});
    const text=responseText(body);
    return Response.json({ok:true,provider:"openai",design:JSON.parse(text)});
  }catch(error){
    return Response.json({ok:false,error:error instanceof Error?error.message:"OpenAI error"},{status:502});
  }
}
