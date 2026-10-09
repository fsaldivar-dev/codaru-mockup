import test from 'node:test';import assert from 'node:assert/strict';
import {createEditor} from '../src/editor-core';import {blank,node} from '../src/model';
const doc=()=>{const p=blank();p.nodes=[node('frame',{id:'screen',x:10,y:20,width:400,height:600}),node('button',{id:'cta',parentId:'screen',x:20,y:40,width:100,height:40,text:'Continuar'})];return p;};
const msg=(id='message',text='Este control se pierde con esta skin.')=>({id,text,author:{name:'Persona',kind:'human' as const},at:'2026-10-09T15:00:00.000Z'});
test('anchors, hooks, history and drafts remain isolated and portable',()=>{
 const a=createEditor({document:doc()}),b=createEditor({document:doc()}),events:any[]=[];a.subscribeComments(e=>{events.push(e);e.message&&(e.message.text='No mutar');});
 const anchor=a.captureCommentAnchor(['cta']);assert.deepEqual(anchor.bounds,{x:30,y:60,width:100,height:40});
 a.apply([{op:'comment.draft.put',draft:{id:'draft',anchor,text:'Sin enviar',author:msg().author}}]);assert.equal(events.length,0);
 a.apply([{op:'comment.create',id:'thread',anchor,message:msg()}]);assert.equal(events[0].type,'comment.created');assert.equal(a.getComments().threads[0].messages[0].text,msg().text);assert.equal(b.getComments().threads.length,0);
 for(let i=0;i<50;i++)a.setViewport({zoom:1+i/100});assert.equal(events.length,1);assert.equal(a.getCommentContext('thread').stale,false);
 a.apply([{op:'comment.reply',id:'thread',message:msg('response','Revisemos la jerarquía.')}]);assert.equal(events[1].type,'comment.replied');a.undo();a.redo();assert.equal(events[2].type,'comments.restored');assert.equal(events[3].type,'comments.restored');
 const imported=createEditor({document:a.getDocument()});assert.equal(imported.getComments().threads[0].messages.length,2);assert.equal(imported.getComments().drafts[0].text,'Sin enviar');imported.importDocument(doc());assert.equal(imported.getComments().threads.length,0);
});
test('layout changes stale the anchor; missing objects never silently retarget',()=>{
 const e=createEditor({document:doc()});e.apply([{op:'comment.create',id:'t',anchor:e.captureCommentAnchor(['cta']),message:msg()}]);e.apply([{op:'update',id:'cta',patch:{x:80}}]);assert.equal(e.getCommentContext('t').stale,true);assert.equal(e.getCommentContext('t').bounds.x,90);
 e.apply([{op:'remove',ids:['cta']}]);assert.deepEqual(e.getCommentContext('t').missingIds,['cta']);assert.equal(e.getCommentContext('t').thread.anchor.labels[0],'Botón');e.undo();assert.deepEqual(e.getCommentContext('t').missingIds,[]);
});
test('resolved threads reject replies and invalid batches preserve history',()=>{
 const e=createEditor({document:doc()}),anchor=e.captureCommentAnchor(['cta']);e.apply([{op:'comment.create',id:'t',anchor,message:msg()},{op:'comment.status',id:'t',status:'resolved'}]);assert.throws(()=>e.apply([{op:'comment.reply',id:'t',message:msg('reply')}]),/Reabre/);
 e.apply([{op:'comment.status',id:'t',status:'open'}]);assert.throws(()=>e.apply([{op:'update',id:'cta',patch:{x:70}},{op:'comment.create',id:'bad',anchor,message:msg('new')}]),/obsoleta/);assert.equal(e.getDocument().nodes[1].x,20);
 assert.throws(()=>e.apply([{op:'comment.reply',id:'t',message:msg()}]),/repetido/);
});
test('CLI discovers anchors, supports dry-run and emits hooks only on committed batches',async()=>{
 const e=createEditor({document:doc()}),events:any[]=[];e.select(['cta']);e.subscribeComments(v=>events.push(v));const c=await e.agent('comments');assert.equal(c.ok,true);const ops=[{op:'comment.create',id:'t',anchor:c.anchor,message:msg()}];
 assert.equal((await e.agent('apply',{expectedRevision:c.revision,operations:ops,dryRun:true})).ok,true);assert.equal(events.length,0);assert.equal((await e.agent('apply',{expectedRevision:c.revision,operations:ops})).ok,true);assert.equal(events.length,1);assert.equal((await e.agent('comments',{id:'t'})).ok,true);
 assert.equal((await e.agent('apply',{expectedRevision:c.revision,operations:ops})).error?.code,'revision_conflict');
});
