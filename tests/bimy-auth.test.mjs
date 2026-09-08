import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { loadTs } from './helpers/load-ts.mjs';
test('BIMy authentication failure stops before upload and returns an actionable safe error',async()=>{
 const root=await mkdtemp(tmpdir()+'/bayti-auth-');
 const id='7446a74d-721e-4b34-97a9-2f6cecaca908';
 const oldRoot=process.env.RAILWAY_VOLUME_MOUNT_PATH,oldToken=process.env.BIMY_API_TOKEN,oldFetch=globalThis.fetch;
 process.env.RAILWAY_VOLUME_MOUNT_PATH=root;process.env.BIMY_API_TOKEN='test-only-token';
 let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;assert.ok(String(url).includes('/api/projects/list'));assert.notEqual(init.method,'POST');return Response.json({message:'untrusted secret-bearing provider error'},{status:401});};
 try{
  await mkdir(root+'/uploads/'+id,{recursive:true});
  await writeFile(root+'/uploads/'+id+'/meta.json',JSON.stringify({name:'plan.png',storedName:'plan.png'}));
  const route=await loadTs('app/api/analyze/route.ts');
  const response=await route.POST(new Request('http://localhost/api/analyze',{method:'POST',body:JSON.stringify({uploadId:id})}));
  const body=await response.json();assert.equal(response.status,502);assert.equal(body.code,'bimy_auth');assert.equal(calls,1);assert.ok(!JSON.stringify(body).includes('secret-bearing'));
 }finally{globalThis.fetch=oldFetch;for(const [key,value] of [['RAILWAY_VOLUME_MOUNT_PATH',oldRoot],['BIMY_API_TOKEN',oldToken]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}await rm(root,{recursive:true,force:true});}
});
