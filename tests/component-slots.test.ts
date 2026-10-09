import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank, node, createComponent, instantiate, subtree, updateNode, Store, createVariant, switchVariant, validate, clone, duplicate, detach, remove, removeComponent, syncComponents, type Project } from '../src/model';
import { defineComponentProperty as define, getComponentProperties as props, setComponentProperty as set, removeComponentProperty as unbind } from '../src/component-properties';
import { createEditor } from '../src/editor-core';
function fixture() {
  const p = blank();
  for (const [id, text, fill, width] of [['avatar', 'Alex', '#7955e8', 72], ['status', 'Disponible', '#228866', 120]] as const) {
    p.nodes.push(node('group', { id, name: id, width, height: 50, fill }), node('text', { id: id+'-text', parentId: id, name: 'Label', text, textKey: 'profile.name', width: 80, height: 20 }));
  }
  const avatar=createComponent(p,'avatar').id, status=createComponent(p,'status').id;
  p.nodes.push(node('group', { id:'card', width:300, height:200, layout:'vertical', padding:12, gap:8 }), node('text', { id:'title', parentId:'card', name:'Title', text:'Mi tarjeta' }));
  const slot=instantiate(p,avatar,'card',12,30);updateNode(p,slot,{name:'Cabecera',width:260,height:58,sizing:'fixed'});
  const card=createComponent(p,'card').id;
  define(p,card,'cabecera',{type:'slot',targetId:slot,label:'Cabecera',allowedComponents:[avatar,status]});
  define(p,card,'titulo',{type:'text',targetId:'title',label:'Título'});
  const first=instantiate(p,card,null,400,0),second=instantiate(p,card,null,750,0);
  const s=new Store(p);s.commit(()=>{});return {s,card,avatar,status,slot,first,second};
}
const slotState=(p:Project,id:string)=>props(p,id).find(prop=>prop.key==='cabecera')!;
const text=(p:Project,id:string)=>subtree(p,id).find(n=>n.name==='Label')!;

test('slot swaps one instance, preserves the box, compatible edits, textKey and sibling values',()=>{
  const {s,first,second,avatar,status}=fixture(),state=slotState(s.project,first),id=state.resolvedTargetId!,before=s.project.nodes.find(n=>n.id===id)!;
  s.commit(p=>{set(p,first,'titulo','Local');updateNode(p,text(p,id).id,{text:'Personalizado'});set(p,first,'cabecera',status);});
  const after=s.project.nodes.find(n=>n.id===id)!;
  for(const field of ['x','y','width','height','sizing','parentId','name'] as const) assert.equal(after[field],before[field],field);
  assert.equal(after.fill,'#228866');assert.equal(text(s.project,id).text,'Personalizado');assert.equal(text(s.project,id).textKey,'profile.name');
  assert.equal(slotState(s.project,first).value,status);assert.equal(slotState(s.project,second).value,avatar);assert.equal(props(s.project,first)[1].value,'Local');
  s.undo();assert.equal(slotState(s.project,first).value,avatar);s.redo();assert.equal(slotState(s.project,first).value,status);
});

test('a replacement inherits master geometry and changes from its own definition',()=>{
  const {s,first,status,slot}=fixture();s.commit(p=>set(p,first,'cabecera',status));const id=slotState(s.project,first).resolvedTargetId!;
  s.commit(p=>{updateNode(p,'status',{fill:'#123456'});updateNode(p,slot,{height:82});updateNode(p,'card',{width:360});});
  const actual=s.project.nodes.find(n=>n.id===id)!;assert.equal(actual.height,82);assert.equal(actual.width,336);assert.equal(actual.fill,'#123456');
});

test('changing a default preserves explicit choices; reset restores default and compatible text',()=>{
  const {s,first,second,status,avatar}=fixture();s.commit(p=>{set(p,first,'cabecera',avatar);set(p,'card','cabecera',status);});
  assert.equal(slotState(s.project,first).value,avatar);assert.equal(slotState(s.project,second).value,status);
  const id=slotState(s.project,first).resolvedTargetId!;s.commit(p=>{updateNode(p,text(p,id).id,{text:'Conservar'});set(p,first,'cabecera',null);});
  assert.equal(slotState(s.project,first).value,status);assert.equal(text(s.project,id).text,'Conservar');assert.equal(slotState(s.project,first).overridden,false);
  assert.equal(s.project.nodes.find(n=>n.id===id)!.width,276);
});

test('outer variants remap slots by public key and keep local replacements and inner overrides',()=>{
  const {s,card,first,status}=fixture();let other='';s.commit(p=>{other=createVariant(p,card,{Size:'Large'}).componentId;set(p,first,'cabecera',status);updateNode(p,text(p,slotState(p,first).resolvedTargetId!).id,{text:'Local en estado'});});
  const before=slotState(s.project,first).resolvedTargetId;
  s.commit(p=>switchVariant(p,first,{Size:'Large'}));assert.equal(slotState(s.project,first).value,status);assert.equal(slotState(s.project,first).resolvedTargetId,before);assert.equal(text(s.project,before!).text,'Local en estado');
  assert.ok(s.project.components.find(c=>c.id===other)!.properties!.cabecera.targetId!==s.project.components.find(c=>c.id===card)!.properties!.cabecera.targetId);
});

test('slots work at several component levels and in repeated nested instances without collisions',()=>{
  const {s,card,status}=fixture();let board='',copy='',first='',second='';
  s.commit(p=>{p.nodes.push(node('group',{id:'board'}));first=instantiate(p,card,'board',0,0);second=instantiate(p,card,'board',400,0);board=createComponent(p,'board').id;copy=instantiate(p,board,null,0,500);});
  const actual=s.project.nodes.find(n=>n.parentId===copy&&n.componentKey===first)!.id;
  s.commit(p=>set(p,actual,'cabecera',status));assert.equal(slotState(s.project,actual).value,status);assert.notEqual(slotState(s.project,second).value,status);
  s.commit(p=>updateNode(p,'status-text',{fontSize:24}));assert.equal(text(s.project,slotState(s.project,actual).resolvedTargetId!).fontSize,24);
});

test('serialization, orphan templates, duplicate and detach preserve chosen content',()=>{
  const {s,first,status}=fixture();let twin='';s.commit(p=>{set(p,first,'cabecera',status);twin=duplicate(p,[first])[0];});
  assert.equal(slotState(s.project,twin).value,status);s.commit(p=>remove(p,['card']));
  const persisted=new Store(JSON.parse(JSON.stringify(s.project)));assert.equal(slotState(persisted.project,twin).value,status);persisted.commit(p=>updateNode(p,'status',{fill:'#aa2244'}));
  const id=slotState(persisted.project,twin).resolvedTargetId!;
  persisted.commit(p=>detach(p,twin));assert.equal(persisted.project.nodes.find(n=>n.id===id)!.instanceOf,status);assert.equal(persisted.project.nodes.find(n=>n.id===id)!.fill,'#aa2244');
});

test('cycles, disallowed IDs, invalid contracts and removing an in-use choice reject atomically',()=>{
  const {s,card,slot,first,avatar,status}=fixture();s.commit(p=>set(p,first,'cabecera',status));const before=JSON.stringify(s.project);
  for(const allowed of [[avatar,card],[avatar,avatar],[avatar,'missing'],[]])assert.throws(()=>s.commit(p=>define(p,card,'cabecera',{type:'slot',targetId:slot,label:'Cabecera',allowedComponents:allowed})));
  assert.throws(()=>s.commit(p=>set(p,first,'cabecera',card)),/permitido/);
  assert.throws(()=>s.commit(p=>define(p,card,'cabecera',{type:'slot',targetId:slot,label:'Cabecera',allowedComponents:[avatar]})),/permitido/);
  assert.throws(()=>s.commit(p=>unbind(p,card,'cabecera')),/restablece/);
  assert.equal(JSON.stringify(s.project),before);
});

test('a slot cannot reach inside another instance or allow the deletion of a referenced definition',()=>{
  const {s,card,status,slot}=fixture();assert.throws(()=>s.commit(p=>define(p,card,'invalido',{type:'slot',targetId:text(p,slot).id,label:'No',allowedComponents:[status]})),/instancia/);
  assert.throws(()=>s.commit(p=>removeComponent(p,status)),/slots/);
  s.commit(p=>unbind(p,card,'cabecera'));s.commit(p=>removeComponent(p,status));assert.ok(!s.project.components.some(c=>c.id===status));
});

test('slot choices are explicit for variants too; contract removal succeeds after reset',()=>{
  const {s,avatar,card,first,status,slot}=fixture();let variant='';s.commit(p=>{variant=createVariant(p,avatar,{State:'Active'}).componentId;});
  const id=slotState(s.project,first).resolvedTargetId!;assert.throws(()=>s.commit(p=>switchVariant(p,id,{State:'Active'})),/permitida/);
  s.commit(p=>define(p,card,'cabecera',{type:'slot',targetId:slot,label:'Cabecera',allowedComponents:[avatar,status,variant]}));
  s.commit(p=>switchVariant(p,id,{State:'Active'}));assert.equal(slotState(s.project,first).value,variant);
  s.commit(p=>{set(p,first,'cabecera',null);unbind(p,card,'cabecera');});assert.equal(props(s.project,first).length,1);
});

test('missing slot layer is reported, legacy documents still load, saved choices cannot be forged',()=>{
  const {s,first,card,slot}=fixture();const bad=clone(s.project);(bad.components.find(c=>c.id===card)!.properties!.cabecera as any).allowedComponents=['missing'];assert.throws(()=>validate(bad));
  s.commit(p=>remove(p,[slot]));assert.equal(slotState(s.project,first).available,false);
  const legacy=blank() as any;legacy.version=1;delete legacy.designThemes;delete legacy.activeThemeId;assert.equal(validate(legacy).version,2);
});

test('host and agent use public-property slots with revision, snapshots, atomic history and no DOM',async()=>{
  const {s,first,status,avatar}=fixture(),editor=createEditor({document:s.project});
  const list=editor.getComponentProperties(first);list[0].options!.length=0;list[0].components![0].name='Mutated';assert.equal(editor.getComponentProperties(first)[0].options!.length,2);
  const ctx=await editor.agent('context',{scope:first,depth:0});const request={expectedRevision:ctx.context!.revision,operations:[{op:'component.property.set',id:first,key:'cabecera',value:status}]};
  assert.equal((await editor.agent('apply',{...request,dryRun:true})).ok,true);assert.equal(editor.getComponentProperties(first)[0].value,avatar);
  assert.equal((await editor.agent('apply',request)).ok,true);assert.equal((await editor.agent('apply',request)).error!.code,'revision_conflict');
  editor.undo();assert.equal(editor.getComponentProperties(first)[0].value,avatar);editor.redo();assert.equal(editor.getComponentProperties(first)[0].value,status);editor.destroy();
});

test('unrelated root types replace cleanly and reset without leaking incompatible textKey or children',()=>{
  const {s,card,slot,first,avatar}=fixture();let icon='';
  s.commit(p=>{p.nodes.push(node('icon',{id:'badge',iconPack:'web',iconName:'star',width:24,height:24}));icon=createComponent(p,'badge').id;define(p,card,'cabecera',{type:'slot',targetId:slot,label:'Cabecera',allowedComponents:[avatar,icon]});set(p,first,'cabecera',icon);});
  const id=slotState(s.project,first).resolvedTargetId!;assert.equal(subtree(s.project,id).length,1);assert.equal(s.project.nodes.find(n=>n.id===id)!.type,'icon');
  s.commit(p=>set(p,first,'cabecera',null));assert.equal(slotState(s.project,first).resolvedTargetId,id);assert.equal(subtree(s.project,id).length,2);assert.equal(text(s.project,id).textKey,'profile.name');
});

test('a default and allow-list can change atomically when instances inherit the previous default',()=>{
  const {s,card,slot,first,second,status}=fixture();s.commit(p=>{set(p,'card','cabecera',status);define(p,card,'cabecera',{type:'slot',targetId:slot,label:'Cabecera',allowedComponents:[status]});});
  assert.equal(slotState(s.project,first).value,status);assert.equal(slotState(s.project,second).value,status);
});
