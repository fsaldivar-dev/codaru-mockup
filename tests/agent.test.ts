import test from 'node:test';
import assert from 'node:assert/strict';
import { blank, clone, Store, node } from '../src/model';
import { handleAgentRequest, revision, type AgentHost } from '../src/agent';

function harness(){
  const store=new Store(blank());let selected:string[]=[],busy=false;
  const host:AgentHost={project:()=>store.project,selection:()=>selected,scope:()=>null,busy:()=>busy,commit:fn=>store.commit(fn),select:ids=>{selected=ids;},undo:()=>store.undo(),redo:()=>store.redo()};
  return {store,host,setBusy:(value:boolean)=>{busy=value;},call:(command:string,params:Record<string,unknown>={})=>handleAgentRequest(host,{command,params}) as Promise<any>};
}

test('agent applies a complete design transaction, returns useful context and undoes once',async()=>{
  const h=harness(),initial=await h.call('context');
  const result=await h.call('apply',{expectedRevision:initial.context.revision,operations:[
    {op:'add',node:{id:'home',type:'frame',name:'Inicio',width:390,height:844}},
    {op:'add',node:{id:'detail',type:'frame',name:'Detalle',x:500}},
    {op:'kit',kit:'ios',item:'button',parentId:'home',x:32,y:120},
    {op:'icon',pack:'web',name:'home',parentId:'home',x:32,y:32,color:'@primary'},
    {op:'add',node:{id:'next',type:'button',parentId:'home',text:'Abrir detalle',y:220}},
    {op:'flow',from:'next',to:'detail'},
  ]});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.context.scope,'home');assert.equal(result.revision,await revision(h.store.project));assert.equal(result.context.flows[0].to,'detail');
  assert(result.changes.added.some((n:any)=>n.type==='icon'));assert.equal(h.store.undoStack.length,1);
  assert.equal((await h.call('undo')).ok,true);assert.equal(h.store.project.nodes.length,0);
  assert.equal((await h.call('redo')).ok,true);assert.equal(h.store.project.nodes.find(n=>n.id==='next')?.targetId,'detail');
});

test('dry runs have no side effects; stale revisions and invalid batches roll back',async()=>{
  const h=harness(),rev=await revision(h.store.project),before=clone(h.store.project);
  const operations=[{op:'add',node:{id:'card',type:'rect'}}];
  const dry=await h.call('apply',{expectedRevision:rev,operations,dryRun:true});
  assert.equal(dry.ok,true);assert.equal(dry.dryRun,true);assert.deepEqual(h.store.project,before);assert.equal(h.store.undoStack.length,0);
  const invalid=await h.call('apply',{expectedRevision:rev,operations:[...operations,{op:'update',id:'missing',patch:{x:5}}]});
  assert.equal(invalid.ok,false);assert.deepEqual(h.store.project,before);
  const unknown=await h.call('apply',{expectedRevision:rev,operations:[...operations,{op:'run-javascript',source:'anything'}]});assert.equal(unknown.ok,false);
  await h.call('apply',{expectedRevision:rev,operations});
  const stale=await h.call('apply',{expectedRevision:rev,operations});assert.equal(stale.error.code,'revision_conflict');assert.equal(h.store.project.nodes.length,1);
});

test('context respects selection, limits size, names navigation and catalog is discoverable',async()=>{
  const h=harness();h.store.commit(p=>{p.nodes.push(node('frame',{id:'frame'}));for(let i=0;i<110;i++)p.nodes.push(node('text',{id:`text-${i}`,parentId:'frame',text:`Text ${i}`}));});
  const ctx=await h.call('context',{scope:'document',depth:2});assert.equal(ctx.context.nodes.length,100);assert.equal(ctx.context.truncated,true);
  await h.call('select',{ids:['text-3']});const selection=await h.call('context');assert.equal(selection.context.scope,'selection');assert.equal(selection.context.nodes[0].text,'Text 3');
  const catalog=await h.call('catalog');assert.equal(catalog.kits.length,5);assert.equal(catalog.icons.length,4);assert.equal(catalog.icons[0].items,undefined);
  const items=await h.call('catalog',{kind:'icons',kit:'web',query:'home'});assert(items.icons[0].items.some((i:any)=>i.id==='home'));
  assert((await h.call('schema')).operations.flow);assert((await h.call('export',{format:'json'})).content.includes('text-109'));
});

test('busy editor blocks writes and clearing a binding is available through JSON null',async()=>{
  const h=harness();h.store.commit(p=>p.nodes.push(node('rect',{id:'rect',fillToken:'brand'})));
  h.setBusy(true);let result=await h.call('apply',{expectedRevision:await revision(h.store.project),operations:[{op:'update',id:'rect',patch:{fillToken:null}}]});assert.equal(result.error.code,'editor_busy');
  assert.equal((await h.call('context')).context.busy,true);h.setBusy(false);
  result=await h.call('apply',{expectedRevision:await revision(h.store.project),operations:[{op:'update',id:'rect',patch:{fillToken:null}}]});assert.equal(result.ok,true);assert.equal(h.store.project.nodes[0].fillToken,undefined);
});

test('a user change during revision calculation is not overwritten',async()=>{
  const h=harness(),rev=await revision(h.store.project);
  const pending=h.call('apply',{expectedRevision:rev,operations:[{op:'add',node:{id:'agent',type:'frame'}}]});
  h.store.commit(p=>{p.name='Cambio humano';});
  const result=await pending;assert.equal(result.error.code,'revision_conflict');assert.equal(h.store.project.name,'Cambio humano');assert.equal(h.store.project.nodes.length,0);
});
