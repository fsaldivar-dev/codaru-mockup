import type {Project,DesignNode} from './model';
import type {CommentAnchor,CommentContext,CommentOperation,LayoutComments,CommentEvent,CorrectionRequest} from './contracts';
import {identityHash} from './identity';
import {effectiveTheme} from './themes';
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const validId=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
function check(v:unknown,message:string):asserts v {if(!v)throw new Error(message);}
function object(v:unknown,keys:string[]):asserts v is Record<string,unknown>{check(v&&typeof v==='object'&&!Array.isArray(v),'Comentario inválido.');check(Object.keys(v as object).every(k=>keys.includes(k)),'Campo de comentario desconocido.');}
function text(v:unknown,max=4000){check(typeof v==='string'&&v.trim()&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v),'Texto de comentario inválido.');}
function author(v:unknown){object(v,['name','kind']);text(v.name,160);check(v.kind==='human'||v.kind==='ai','Autoría inválida.');}
function anchor(v:unknown):asserts v is CommentAnchor{object(v,['nodeIds','frameId','revision','labels','theme','bounds']);check(Array.isArray(v.nodeIds)&&v.nodeIds.length>0&&v.nodeIds.length<=100&&v.nodeIds.every(validId)&&new Set(v.nodeIds).size===v.nodeIds.length,'Ancla requiere IDs únicos.');check(validId(v.frameId)&&typeof v.revision==='string'&&/^[a-f0-9]{64}$/.test(v.revision),'Revisión de ancla inválida.');check(Array.isArray(v.labels)&&v.labels.length===v.nodeIds.length,'Nombres de ancla inválidos.');v.labels.forEach(s=>text(s,240));object(v.theme,['id','mode']);text(v.theme.id,160);check(['light','dark'].includes(String(v.theme.mode)),'Tema de ancla inválido.');object(v.bounds,['x','y','width','height']);for(const k of ['x','y','width','height'])check(typeof v.bounds[k]==='number'&&Number.isFinite(v.bounds[k])&&Math.abs(v.bounds[k] as number)<=1e8,'Geometría de ancla inválida.');check((v.bounds.width as number)>0&&(v.bounds.height as number)>0,'Tamaño de ancla inválido.');}
function message(v:unknown){object(v,['id','text','author','at']);check(validId(v.id),'ID de mensaje inválido.');text(v.text);author(v.author);check(typeof v.at==='string'&&/^\d{4}-\d\d-\d\dT/.test(v.at)&&Number.isFinite(Date.parse(v.at)),'Fecha de comentario inválida.');}
export const emptyComments=():LayoutComments=>({format:'codaru-comments/1',threads:[],drafts:[]});
export function validateComments(v:unknown):asserts v is LayoutComments{
 object(v,['format','threads','drafts','queue']);check(v.format==='codaru-comments/1','Formato de comentarios inválido.');
 check(Array.isArray(v.threads)&&v.threads.length<=200&&Array.isArray(v.drafts)&&v.drafts.length<=20,'Demasiados comentarios o borradores.');
 const threadIds=new Set<string>(),messageIds=new Set<string>(),draftIds=new Set<string>();
 for(const t of v.threads){object(t,['id','anchor','messages','status']);check(validId(t.id)&&!threadIds.has(t.id as string),'ID de hilo repetido.');threadIds.add(t.id as string);anchor(t.anchor);check(t.status==='open'||t.status==='resolved','Estado de hilo inválido.');check(Array.isArray(t.messages)&&t.messages.length>0&&t.messages.length<=100,'Mensajes de hilo inválidos.');for(const m of t.messages){message(m);check(!messageIds.has(m.id as string),'ID de mensaje repetido.');messageIds.add(m.id as string);}}
 for(const d of v.drafts){object(d,['id','threadId','anchor','text','author']);check(validId(d.id)&&!draftIds.has(d.id as string),'ID de borrador repetido.');draftIds.add(d.id as string);if(d.threadId!==undefined)check(validId(d.threadId),'ID de hilo inválido.');anchor(d.anchor);text(d.text);author(d.author);}
 if(v.queue!==undefined){check(Array.isArray(v.queue)&&v.queue.length<=200,'Cola de correcciones inválida.');const queued=new Set<string>();for(const item of v.queue){object(item,['threadId','messageId']);check(validId(item.threadId)&&validId(item.messageId)&&!queued.has(item.threadId as string),'Corrección repetida o inválida.');queued.add(item.threadId as string);const thread=v.threads.find(t=>t.id===item.threadId);check(thread&&thread.messages.some((m:any)=>m.id===item.messageId&&m.author.kind==='human'),'La corrección debe referenciar un mensaje humano existente.');}}
 check(JSON.stringify(v).length<=2_000_000,'Máximo 2 MB de comentarios por documento.');
}
function root(p:Project,id:string){let n=p.nodes.find(n=>n.id===id);const seen=new Set<string>();while(n?.parentId&&!seen.has(n.id)){seen.add(n.id);n=p.nodes.find(v=>v.id===n!.parentId);}return n;}
function descendants(p:Project,id:string){const set=new Set([id]);let changed=true;while(changed){changed=false;for(const n of p.nodes)if(n.parentId&&set.has(n.parentId)&&!set.has(n.id)){set.add(n.id);changed=true;}}return p.nodes.filter(n=>set.has(n.id));}
function bounds(p:Project,nodes:DesignNode[]):CommentAnchor['bounds']{const boxes=nodes.map(n=>{let x=n.x,y=n.y,up=n.parentId;const seen=new Set<string>();while(up&&!seen.has(up)){seen.add(up);const parent=p.nodes.find(n=>n.id===up);if(!parent)break;x+=parent.x;y+=parent.y;up=parent.parentId;}return {x,y,width:n.width,height:n.height};});const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return {x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};}
export function commentTargetRevision(p:Project,frameId:string):string|null{const f=p.nodes.find(n=>n.id===frameId&&n.type==='frame'&&!n.parentId);if(!f)return null;return identityHash(JSON.stringify({nodes:descendants(p,frameId),themes:p.designThemes,theme:p.theme,activeThemeId:p.activeThemeId,styles:p.stylePackages}));}
export function captureCommentAnchor(p:Project,ids:string[]):CommentAnchor{
 check(ids.length>0&&ids.length<=100&&new Set(ids).size===ids.length,'Selecciona uno o varios elementos de una misma pantalla.');
 const nodes=ids.map(id=>p.nodes.find(n=>n.id===id));check(nodes.every(Boolean),'Una capa del ancla ya no existe.');const roots=ids.map(id=>root(p,id));const frame=roots[0];check(frame?.type==='frame'&&roots.every(r=>r?.id===frame.id),'Los comentarios deben pertenecer a una misma pantalla.');const theme=effectiveTheme(p,frame);
 return {nodeIds:[...ids],frameId:frame.id,revision:commentTargetRevision(p,frame.id)!,labels:(nodes as DesignNode[]).map(n=>n.name.slice(0,240)||n.id),theme:{id:theme.id,mode:theme.mode},bounds:bounds(p,nodes as DesignNode[])};
}
export function commentBounds(p:Project,a:CommentAnchor){const nodes=p.nodes.filter(n=>a.nodeIds.includes(n.id)&&root(p,n.id)?.id===a.frameId);return nodes.length?bounds(p,nodes):a.bounds;}
export function getCommentContext(p:Project,id:string):CommentContext{
 const thread=p.comments?.threads.find(t=>t.id===id);check(thread,'Comentario no encontrado.');const currentRevision=commentTargetRevision(p,thread.anchor.frameId),missingIds=thread.anchor.nodeIds.filter(id=>!p.nodes.some(n=>n.id===id)||root(p,id)?.id!==thread.anchor.frameId);const nodes=descendants(p,thread.anchor.frameId);
 return copy({thread,currentRevision,stale:currentRevision!==thread.anchor.revision,missingIds,nodes:nodes.slice(0,200),truncated:nodes.length>200,bounds:commentBounds(p,thread.anchor)});
}
export function applyCommentOperation(p:Project,op:CommentOperation){const data=p.comments??emptyComments();
 const t=()=>{const thread=data.threads.find(t=>t.id===('id' in op?op.id:undefined));check(thread,'Comentario no encontrado.');return thread;};
 switch(op.op){
  case 'comment.create':{check(!data.threads.some(t=>t.id===op.id),'Hilo ya existente.');anchor(op.anchor);const actual=captureCommentAnchor(p,op.anchor.nodeIds);check(actual.revision===op.anchor.revision&&actual.frameId===op.anchor.frameId&&JSON.stringify(actual.labels)===JSON.stringify(op.anchor.labels)&&actual.theme.id===op.anchor.theme.id&&actual.theme.mode===op.anchor.theme.mode&&(['x','y','width','height'] as const).every(k=>actual.bounds[k]===op.anchor.bounds[k]),'El ancla quedó obsoleta. Revisa la selección antes de publicar.');data.threads.push(copy({id:op.id,anchor:op.anchor,messages:[op.message],status:'open'}));break;}
  case 'comment.reply':{const thread=t();check(thread.status==='open','Reabre el hilo antes de responder.');thread.messages.push(copy(op.message));break;}
  case 'comment.status':t().status=op.status;if(op.status==='resolved'&&data.queue)data.queue=data.queue.filter(i=>i.threadId!==op.id);break;
  case 'comment.queue.add':{const thread=t();check(thread.status==='open','Reabre el hilo antes de agregar una corrección.');check(thread.messages.some(m=>m.id===op.messageId&&m.author.kind==='human'),'Selecciona una crítica humana existente.');const item={threadId:op.id,messageId:op.messageId};const queue=data.queue??=[];const i=queue.findIndex(i=>i.threadId===op.id);if(i<0)queue.push(item);else queue[i]=item;break;}
  case 'comment.queue.remove':{data.queue=(data.queue??[]).filter(i=>i.threadId!==op.id||i.messageId!==op.messageId);break;}
  case 'comment.queue.move':{const queue=data.queue??[],i=queue.findIndex(i=>i.threadId===op.id);check(i>=0&&Number.isInteger(op.index)&&op.index>=0&&op.index<queue.length,'Posición de cola inválida.');queue.splice(op.index,0,queue.splice(i,1)[0]);break;}
  case 'comment.draft.put':{const i=data.drafts.findIndex(d=>d.id===op.draft.id);if(i<0)data.drafts.push(copy(op.draft));else data.drafts[i]=copy(op.draft);break;}
  case 'comment.draft.remove':check(data.drafts.some(d=>d.id===op.id),'Borrador no encontrado.');data.drafts=data.drafts.filter(d=>d.id!==op.id);break;
  default:throw new Error('Operación de comentario desconocida.');
 }
 validateComments(data);p.comments=data;
}
/** Only document changes produce hooks; camera gestures never clone comment context. */
export function commentChanges(before:LayoutComments|undefined,after:LayoutComments|undefined):Omit<CommentEvent,'sequence'>[]{const events:Omit<CommentEvent,'sequence'>[]=[];for(const t of after?.threads??[]){const old=before?.threads.find(v=>v.id===t.id);if(!old){events.push({type:'comment.created',threadId:t.id,message:copy(t.messages[0]),targetRevision:t.anchor.revision,...(after?.queue?.some(i=>i.threadId===t.id&&i.messageId===t.messages[0].id)?{queued:true}:{})});continue;}for(const m of t.messages)if(!old.messages.some(v=>v.id===m.id))events.push({type:'comment.replied',threadId:t.id,message:copy(m),targetRevision:t.anchor.revision,...(after?.queue?.some(i=>i.threadId===t.id&&i.messageId===m.id)?{queued:true}:{})});if(old.status!==t.status)events.push({type:t.status==='resolved'?'comment.resolved':'comment.reopened',threadId:t.id,targetRevision:t.anchor.revision});}return events;}

/** Capture once, retaining the exact queued human message and current layout evidence. */
export function getCorrectionRequest(p:Project):CorrectionRequest{
 const queue=p.comments?.queue??[];check(queue.length>0,'Agrega correcciones a la cola antes de enviarla.');
 const items=queue.map(item=>{const context=getCommentContext(p,item.threadId);check(context.thread.status==='open','Reabre la corrección antes de enviarla.');check(context.currentRevision&&!context.missingIds.length,'Una corrección apunta a capas ausentes. Retírala de la cola o revisa su ancla.');const last=context.thread.messages.findIndex(m=>m.id===item.messageId);check(last>=0,'Mensaje de corrección ausente.');context.thread.messages=context.thread.messages.slice(0,last+1);return {item:copy(item),context};});
 const document=copy(p);return {id:'corrections-'+identityHash(JSON.stringify({queue,document})),items,document};
}
