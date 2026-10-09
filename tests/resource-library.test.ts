import test from 'node:test';
import assert from 'node:assert/strict';
import { ResourceLibrary } from '../src/resource-library';
import { blank, Store, node } from '../src/model';
import { sanitizeSVG } from '../src/motion';
import type { ResourceCandidate, ResourcePreview, ResourceReviewVerdict, ResourceServices } from '../src/contracts';

const svg = sanitizeSVG('<svg viewBox="0 0 24 24"><rect id="play" width="24" height="24" fill="#123456"/></svg>');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const drawing = (patch: Partial<ResourceCandidate> = {}): ResourceCandidate => ({name:'Play',kind:'icon',purpose:'Iniciar reproducción',svg,width:1,height:1,...patch});
const approved: ResourceReviewVerdict = {status:'approved',reasons:['Legible y sin recortes'],evaluator:{provider:'test-double',model:'contract-fixture'},checks:{appearance:'pass',readability:'pass',clipping:'pass',style:'pass',fidelity:'not_applicable',animation:'not_applicable'}};
const render: NonNullable<ResourceServices['render']> = async (_, revision) => (['actual','small'] as const).map(role => ({revision,dataURL:png,width:1,height:1,role}));
// These callbacks test the host contract only. They are deliberately not represented as real AI review.
function library(services: ResourceServices = {}) { const store = new Store(blank()); return {store,lib:new ResourceLibrary({document:()=>store.project,services})}; }

test('same filenames preserve distinct drawings; same content in document deduplicates with node identities', async () => {
 const {store,lib} = library();
 store.commit(p => p.nodes.push(node('vector',{id:'a',name:'App icon',svg,aruSource:{version:1,filename:'icon.aru',text:'one'}}),node('vector',{id:'b',name:'App icon',svg,aruSource:{version:1,filename:'icon.aru',text:'two'}}),node('vector',{id:'copy',name:'App icon copy',svg,aruSource:{version:1,filename:'icon.aru',text:'one'}})));
 const rows = await lib.list(); assert.equal(rows.length,2); assert.equal(rows[0].status,'pending'); assert.deepEqual(rows[0].nodeIds,['a','copy']); assert.notEqual(rows[0].id,rows[1].id);
 const data=await lib.get(rows[0].id); data!.resource.source!.text='outside'; assert.equal((await lib.get(rows[0].id))!.resource.source!.text,'one');
});

test('external claims of approval and absent evaluators never admit a candidate', async () => {
 const {lib} = library(); const id=await lib.stage({...drawing(),status:'approved',review:approved} as ResourceCandidate);
 assert.equal((await lib.list())[0].status,'pending'); assert.equal((await lib.review(id)).status,'pending');
 await assert.rejects(lib.requireApproved(id),/aprobación/);
 const other=library(); assert.equal((await other.lib.list()).length,0);
});

test('source/render mismatch and stale or fake rasters stop before AI evaluation', async () => {
 let calls=0;
 const {lib}=library({compile:async()=>svg.replace('#123456','#654321'),render,evaluate:async()=>{calls++;return approved;}});
 const id=await lib.stage(drawing({source:{version:1,filename:'play.aru',text:'source'}}));
 assert.equal((await lib.review(id)).status,'pending'); assert.equal(calls,0);
 lib.setServices({compile:async()=>svg,render:async()=>[{revision:'old',role:'actual',dataURL:png,width:1,height:1}],evaluate:async()=>{calls++;return approved;}});
 assert.equal((await lib.review(id)).status,'pending'); assert.equal(calls,0);
 lib.setServices({compile:async()=>svg,render:async(_,revision)=>(['actual','small'] as const).map(role=>({revision,role,dataURL:'data:image/png;base64,ZmFrZQ==',width:1,height:1})),evaluate:async()=>{calls++;return approved;}});
 assert.equal((await lib.review(id)).status,'pending'); assert.equal(calls,0);
});

test('only the current rendered version can be approved; edits revoke approval', async () => {
 let seen: unknown;
 const {lib}=library({compile:async()=>svg,render,evaluate:async request=>{seen=request;return approved;}});
 const id=await lib.stage(drawing({id:'play',source:{version:1,filename:'play.aru',text:'one'}}));
 assert.equal((await lib.review(id)).status,'approved'); assert.equal((await lib.requireApproved(id)).id,id);
 assert.equal((seen as any).technical.sourceMatches,true); assert.equal((seen as any).previews[0].dataURL,png);
 await lib.stage(drawing({id,source:{version:1,filename:'play.aru',text:'two'}}));
 await assert.rejects(lib.requireApproved(id),/aprobación/);
 let finish!: (v: ResourceReviewVerdict)=>void;
 lib.setServices({compile:async()=>svg,render,evaluate:()=>new Promise(resolve=>{finish=resolve;})});
 const pending=lib.review(id); while(!finish)await new Promise(resolve=>setTimeout(resolve,0));
 await lib.stage(drawing({id,purpose:'Nueva intención'})); finish(approved);
 await assert.rejects(pending,/cambiaron/); assert.equal((await lib.get(id))!.status,'pending');
});

test('a failed visual check cannot be approved and correction/rejection reasons are retained', async () => {
 const {lib}=library({render,evaluate:async()=>({...approved,checks:{...approved.checks,readability:'fail'}})});
 const id=await lib.stage(drawing()); assert.equal((await lib.review(id)).status,'pending');
 lib.setServices({render,evaluate:async()=>({...approved,status:'changes_requested',reasons:['El triángulo pierde lectura a 24 px']})});
 const result=await lib.review(id); assert.equal(result.status,'changes_requested'); assert.match(result.reasons[0],/24 px/);
});

test('animated drawings require temporal raster evidence and explicit animation approval', async () => {
 const {lib}=library({render,evaluate:async()=>approved});
 const id=await lib.stage(drawing({animations:[{id:'pulse',name:'Pulso',target:'play',duration:1000,delay:0,iterations:1,trigger:'load',alternate:false,easing:'linear',keyframes:[{at:0,opacity:0},{at:100,opacity:100}]}]}));
 const result=await lib.review(id); assert.equal(result.status,'pending'); assert.match(result.reasons[0],/tres instantes/);
});

test('review concurrency is bounded, host replacement interrupts admission and editing receives a defensive source',async()=>{
 let finish!: (v:ResourceReviewVerdict)=>void, received:any;
 const {lib}=library({compile:async()=>svg,render,evaluate:()=>new Promise(resolve=>finish=resolve),edit:async request=>{received=request;request.source.text='outside';}});
 const id=await lib.stage(drawing({source:{version:1,filename:'play.aru',text:'inside'}}));
 await lib.requestEdit(id);assert.equal(received.resourceId,id);assert.equal((await lib.get(id))?.resource.source?.text,'inside');
 const pending=lib.review(id);while(!finish)await new Promise(resolve=>setTimeout(resolve,0));
 await assert.rejects(lib.review(id),/revisión/);
 lib.setServices({render,evaluate:async()=>approved});finish(approved);
 await assert.rejects(pending,/cambiaron/);await assert.rejects(lib.requireApproved(id),/aprobación/);
});
