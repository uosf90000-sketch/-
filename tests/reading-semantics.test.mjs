import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';
const { parseIfc } = await loadTs('lib/ifc/parse.ts');
const { doorOperation, extractSpaces } = await loadTs('lib/ifc/to-plan.ts');
const { spaceType, applyPlanReview, emptyReview } = await loadTs('lib/plan-review.ts');
const { designPreferences } = await loadTs('lib/design-scope.ts');
test('preserves declared double-leaf operation and does not invent a missing operation',()=>{
 const doc=parseIfc("ISO-10303-21; HEADER; FILE_SCHEMA(('IFC4')); ENDSEC; DATA; #1=IFCDOOR('id',$,'Door',$,$,$,$,$,2100.,1800.,.DOOR.,.DOUBLE_DOOR_SINGLE_SWING.,$); #2=IFCDOOR('other',$,'Door',$,$,$,$,$,2100.,1800.,.DOOR.,$,$); ENDSEC; END-ISO-10303-21;");
 assert.equal(doorOperation(doc,doc.entities.get(1)),'DOUBLE_DOOR_SINGLE_SWING');
 assert.equal(doorOperation(doc,doc.entities.get(2)),undefined);
});
test('extracts explicit space label, transformed polygon and area from saved IFC',()=>{
 const doc=parseIfc("ISO-10303-21; HEADER; FILE_SCHEMA(('IFC4')); ENDSEC; DATA; #1=IFCSPACE('id',$,'Space',$,$,$,#2,$,'Stairs',.ELEMENT.,.INTERNAL.,$); #2=IFCPRODUCTDEFINITIONSHAPE($,$,(#3)); #3=IFCSHAPEREPRESENTATION($,'Body','SweptSolid',(#4)); #4=IFCEXTRUDEDAREASOLID(#5,$,$,3.); #5=IFCRECTANGLEPROFILEDEF(.AREA.,$,$,4.,2.); ENDSEC; END-ISO-10303-21;");
 const spaces=extractSpaces(doc,1); assert.equal(spaces.length,1); assert.equal(spaces[0].name,'Stairs');assert.equal(spaces[0].areaM2,8);
 const result=applyPlanReview({ifcPlan:{walls:[],openings:[],spaces},inferredRooms:[{id:'r',center:{x:0,y:0}}]},emptyReview);
 assert.equal(result.inferredRooms[0].type,'stairs');
 assert.throws(()=>designPreferences({roomIndex:0},result),/مساحة/);
});
test('classifies stairs, elevator and exterior separately; unnamed spaces remain unknown',()=>{
 assert.equal(spaceType('درج'),'stairs');assert.equal(spaceType('مصعد'),'elevator');assert.equal(spaceType('موقف السيارة'),'garage');assert.equal(spaceType('مساحة'),'unknown');
});
