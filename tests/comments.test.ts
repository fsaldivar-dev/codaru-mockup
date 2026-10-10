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

test('correction queue preserves exact human messages, order, portability and no layout edits',()=>{
 const e=createEditor({document:doc()}),b=createEditor({document:doc()}),anchor=e.captureCommentAnchor(['cta']),nodes=e.getDocument().nodes,events:any[]=[];e.subscribeComments(v=>events.push(v));
 e.apply([{op:'comment.create',id:'a',anchor,message:msg('a-msg','Este botón se pierde.')},{op:'comment.create',id:'b',anchor,message:msg('b-msg','Otra propuesta de interacción.')},{op:'comment.queue.add',id:'a',messageId:'a-msg'},{op:'comment.queue.add',id:'b',messageId:'b-msg'}]);
 assert.deepEqual(events.map(e=>e.queued),[true,true]);e.apply([{op:'comment.queue.move',id:'b',index:0}]);assert.equal(events.length,2);assert.deepEqual(e.getComments().queue?.map(i=>i.threadId),['b','a']);
 const batch=e.getCorrectionRequest();assert.deepEqual(batch.items.map(i=>i.item.messageId),['b-msg','a-msg']);assert.equal(batch.id,e.getCorrectionRequest().id);batch.document.nodes[1].x=999;assert.deepEqual(e.getDocument().nodes,nodes);assert.equal(b.getComments().queue,undefined);
 const restored=createEditor({document:e.getDocument()});assert.deepEqual(restored.getComments().queue,e.getComments().queue);
 e.apply([{op:'comment.reply',id:'a',message:msg('later','Una crítica posterior.')},{op:'comment.queue.add',id:'a',messageId:'later'}]);
 e.apply([{op:'comment.queue.remove',id:'a',messageId:'a-msg'}]);assert.equal(e.getComments().queue?.find(i=>i.threadId==='a')?.messageId,'later');
 e.undo();e.redo();assert.equal(e.getComments().queue?.length,2);assert.deepEqual(e.getDocument().nodes,nodes);
});
test('queued snapshot bounds replies, flags stale layout and rejects missing anchors or AI messages',()=>{
 const e=createEditor({document:doc()});e.apply([{op:'comment.create',id:'t',anchor:e.captureCommentAnchor(['cta']),message:msg()},{op:'comment.queue.add',id:'t',messageId:'message'},{op:'comment.reply',id:'t',message:{...msg('ai'),author:{name:'IA',kind:'ai'}}}]);
 assert.equal(e.getCorrectionRequest().items[0].context.thread.messages.length,1);assert.throws(()=>e.apply([{op:'comment.queue.add',id:'t',messageId:'ai'}]),/humana/);
 e.apply([{op:'update',id:'cta',patch:{x:90}}]);assert.equal(e.getCorrectionRequest().items[0].context.stale,true);assert.equal(e.getCorrectionRequest().items[0].context.bounds.x,100);
 e.apply([{op:'remove',ids:['cta']}]);assert.throws(()=>e.getCorrectionRequest(),/ausentes/);e.undo();e.apply([{op:'comment.status',id:'t',status:'resolved'}]);assert.equal(e.getComments().queue?.length,0);assert.throws(()=>e.getCorrectionRequest(),/Agrega/);e.undo();assert.equal(e.getComments().queue?.length,1);
});
test('queue CLI dry-run is atomic and invalid imported references are rejected',async()=>{
 const e=createEditor({document:doc()});e.apply([{op:'comment.create',id:'t',anchor:e.captureCommentAnchor(['cta']),message:msg()}]);const c=await e.agent('comments');const operations=[{op:'comment.queue.add',id:'t',messageId:'message'}];
 assert.equal((await e.agent('apply',{expectedRevision:c.revision,operations,dryRun:true})).ok,true);assert.equal(e.getComments().queue,undefined);
 assert.equal((await e.agent('apply',{expectedRevision:c.revision,operations})).ok,true);assert.deepEqual((await e.agent('comments')).queue,[{threadId:'t',messageId:'message'}]);
 const before=e.getDocument();assert.throws(()=>e.apply([{op:'comment.queue.move',id:'t',index:9}]),/Posición/);assert.deepEqual(e.getDocument(),before);
 before.comments!.queue=[{threadId:'missing',messageId:'message'}];assert.throws(()=>createEditor({document:before}),/existente/);
});
