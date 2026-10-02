import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../src/demo';
import { Store, clone, node, validate, updateNode, createComponent, instantiate, remove, group, ungroup, layoutProject } from '../src/model';

test('master changes reach instances, preserve overrides and undo atomically', () => {
  const s = new Store(demo());
  const instanceId = s.project.nodes.find(n=>n.instanceOf)!.id;
  const before = clone(s.project.nodes.find(n=>n.id===instanceId)!);
  s.commit(p=>updateNode(p,'primary-button',{fill:'#226699',text:'Changed',radius:18}));
  const instance = s.project.nodes.find(n=>n.id===instanceId)!;
  assert.equal(instance.fill,'#226699'); assert.equal(instance.radius,18);
  assert.equal(instance.text,before.text); assert.equal(instance.width,before.width); assert.equal(instance.targetId,before.targetId);
  s.undo(); assert.deepEqual(s.project.nodes.find(n=>n.id===instanceId),before);
  s.redo(); assert.equal(s.project.nodes.find(n=>n.id===instanceId)!.fill,'#226699');
});
test('group component synchronizes descendants and local text overrides', () => {
  const s = new Store(demo()); let groupId = '', componentId = '', instanceId = '';
  s.commit(p=>{ groupId=group(p,p.nodes.filter(n=>['Label · Correo','Correo'].includes(n.name)).map(n=>n.id)); componentId=createComponent(p,groupId).id; instanceId=instantiate(p,componentId,'screen-dashboard',300,20); });
  const originalChild = s.project.nodes.find(n=>n.parentId===groupId&&n.type==='text')!;
  const copiedChild = s.project.nodes.find(n=>n.parentId===instanceId&&n.type==='text')!;
  s.commit(p=>updateNode(p,copiedChild.id,{text:'Personalizado'}));
  s.commit(p=>updateNode(p,originalChild.id,{text:'Maestro',fontSize:18}));
  assert.equal(s.project.nodes.find(n=>n.id===copiedChild.id)!.text,'Personalizado');
  assert.equal(s.project.nodes.find(n=>n.id===copiedChild.id)!.fontSize,18);
  s.commit(p=>p.nodes.push(node('rect',{parentId:groupId,name:'Nuevo hijo'})));
  assert.ok(s.project.nodes.some(n=>n.parentId===instanceId&&n.name==='Nuevo hijo'));
});
test('invalid imports and transactions do not corrupt the document', () => {
  const s = new Store(demo()); const before=clone(s.project);
  assert.throws(()=>s.commit(p=>updateNode(p,'primary-button',{parentId:'missing'})),/Contenedor/);
  assert.deepEqual(s.project,before); assert.equal(s.undoStack.length,0);
  const bad=clone(before); bad.nodes[0].parentId=bad.nodes[0].id; assert.throws(()=>validate(bad));
  bad.nodes[0].parentId=null; bad.nodes[0].fill='url(https://example.com/tracker)'; assert.throws(()=>validate(bad));
  const roundtrip=validate(JSON.parse(JSON.stringify(before))); assert.deepEqual(roundtrip,before);
});
test('deleting a destination removes dangling navigation and undo restores it', () => {
  const s=new Store(demo());s.commit(p=>remove(p,['screen-dashboard']));
  assert.equal(s.project.nodes.find(n=>n.id==='primary-button')!.targetId,null);
  s.undo(); assert.equal(s.project.nodes.find(n=>n.id==='primary-button')!.targetId,'screen-dashboard');
});
test('group and ungroup preserve element positions', () => {
  const s=new Store(demo());const original=s.project.nodes.filter(n=>['Label · Correo','Correo'].includes(n.name)).map(clone);let id='';
  s.commit(p=>id=group(p,original.map(n=>n.id)));s.commit(p=>ungroup(p,id));
  for(const old of original){const n=s.project.nodes.find(n=>n.id===old.id)!;assert.equal(n.x,old.x);assert.equal(n.y,old.y);assert.equal(n.parentId,old.parentId);}
});
test('auto layout distributes available space and honors padding and gap', () => {
  const p=demo();const card=node('card',{parentId:'screen-dashboard',width:300,height:100,layout:'horizontal',padding:10,gap:20});
  const a=node('rect',{parentId:card.id,width:50}),b=node('rect',{parentId:card.id,sizing:'fill'});p.nodes.push(card,a,b);layoutProject(p);
  assert.equal(a.x,10);assert.equal(a.height,80);assert.equal(b.x,80);assert.equal(b.width,210);
});
