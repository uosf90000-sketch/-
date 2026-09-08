import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';
const { fuseTectlyPlan } = await loadTs('lib/tectly/fuse.ts');
const { applyPlanReview, emptyReview } = await loadTs('lib/plan-review.ts');
const section = {left:0,top:0,width:1,height:1};
const walls = [{entityId:1,x1:0,y1:0,x2:10,y2:0,thickness:.2},{entityId:2,x1:10,y1:0,x2:10,y2:10,thickness:.2}];
const analysis = {ifcPlan:{walls,openings:[{kind:'window',wallEntityId:1,position:.2,widthM:1}]},inferredRooms:[]};
const opening = (id, from, to, kind='door') => ({id,kind,from:[from,1],to:[to,1]});
const plan = {id:'test',section,openings:[opening('new',.6,.7)],rooms:[]};
test('complements BIMy windows with Tectly doors; repeated fusion is idempotent',()=>{
 const first=fuseTectlyPlan(plan,section,analysis,emptyReview);
 assert.equal(first.report.added,1);
 assert.deepEqual(applyPlanReview(analysis,first.review).ifcPlan.openings.map(o=>o.kind).sort(),['door','window']);
 const second=fuseTectlyPlan(plan,section,analysis,first.review);
 assert.equal(second.report.added,0); assert.equal(second.report.matched,1);
 assert.deepEqual(second.review,first.review);
});
test('conflicting type or narrower leaf cannot overwrite the existing opening',()=>{
 const result=fuseTectlyPlan({...plan,openings:[opening('wrong-type',.15,.25),opening('narrow',.17,.23,'window')]},section,analysis,emptyReview);
 assert.equal(result.report.added,0);assert.equal(result.report.review.length,2);
 assert.deepEqual(applyPlanReview(analysis,result.review).ifcPlan.openings,analysis.ifcPlan.openings);
});
test('preserves raster doors and skips off-wall geometry',()=>{
 const doors=[{kind:'door',wallEntityId:1,position:.65,widthM:1}];
 const result=fuseTectlyPlan({...plan,openings:[...plan.openings,{id:'off',kind:'door',from:[.4,.5],to:[.5,.5]}]},section,analysis,emptyReview,doors);
 assert.equal(result.report.matched,1);assert.equal(result.report.added,0);assert.equal(result.report.review.length,1);
});
test('requires a valid alignment and refuses absent BIMy geometry',()=>{
 assert.throws(()=>fuseTectlyPlan(plan,null,analysis,emptyReview));
 assert.throws(()=>fuseTectlyPlan(plan,section,{},emptyReview));
});
