import type { CodaruEditor } from './editor-core';
import { getEditorSession } from './editor-core';
import type { IdentityBrief, IdentityDirection, IdentityOperation, IdentityPackage, IdentityReference, IdentityRequestOptions } from './contracts';
import { applyAppearance, type EditorAppearance } from './ui-theme';
import chrome from './chrome-style.css?inline';
import styles from './identity-view.css?inline';
export type * from './contracts';
export { identityTargetRevision } from './identity';
export { renderIdentityEvidence } from './identity-preview';

export type IdentityPart = 'brief' | 'references' | 'directions' | 'reviews' | 'decisions' | 'handoff';
export interface IdentityViewOptions {
  appearance?: EditorAppearance;
  ownerDocument?: Document;
  styleNonce?: string;
  onExport?: (data:IdentityPackage)=>void|Promise<void>;
  onError?: (error:Error)=>void;
  /** The IDE can open a linked frame in its own editor layout. */
  onOpenFrame?: (id:string)=>void|Promise<void>;
}
export interface IdentityFragment {
  element:HTMLElement;
  setAppearance(appearance:EditorAppearance):void;
  destroy():void;
}
export interface IdentityLabView {
  mount(part:IdentityPart,container:HTMLElement,options?:{appearance?:EditorAppearance}):IdentityFragment;
  setAppearance(appearance:EditorAppearance):void;
  flush():void;
  destroy():void;
}
const titles:Record<IdentityPart,string>={brief:'Intención',references:'Referencias',directions:'Direcciones',reviews:'Revisión visual',decisions:'Decisiones',handoff:'Entrega'};
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const lines=(text:string)=>text.split('\n').map(s=>s.trim()).filter(Boolean);
const uid=(prefix:string)=>prefix+'-'+crypto.randomUUID();

/** Optional, independently mounted creative panels. The IDE owns AI and persistence. */
export function createIdentityLabView(editor:CodaruEditor,options:IdentityViewOptions={}):IdentityLabView {
  const owner=options.ownerDocument??document,session=getEditorSession(editor);
  const mounted=new Map<IdentityPart,{handle:IdentityFragment;root:HTMLElement;shadow:ShadowRoot;cleanup:()=>void}>();
  let disposed=false,appearance=options.appearance??{},state=editor.getIdentityState(),selected='',working=false,error='',signature='',lastProject=session.store.project,instruction='',instructionDirty=false;
  const formDrafts=new Set<HTMLElement>();
  const pendingRender=new Set<HTMLElement>();
  const drafts=new Map<HTMLTextAreaElement|HTMLInputElement,{base:string;apply:()=>void}>();
  const empty:IdentityBrief={intent:'',audience:'',context:'',qualities:[],avoid:[],constraints:[]};
  function assertActive(){if(disposed)throw new Error('El laboratorio fue desmontado.');session.assertActive();}
  function report(cause:unknown){error=cause instanceof Error?cause.message:String(cause);try{options.onError?.(new Error(error));}catch{}render();}
  function transact(operation:IdentityOperation){editor.applyIdentity(operation);}
  function flush(){
    if(disposed)return;
    const pending=[...drafts];drafts.clear();
    for(let i=0;i<pending.length;i++){
      try{pending[i][1].apply();}catch(cause){for(const [input,draft] of pending.slice(i))drafts.set(input,draft);throw cause;}
    }
  }
  function direction(){return state.lab?.directions.find(d=>d.id===selected);}
  function choose(){if(!state.lab?.directions.some(d=>d.id===selected))selected=state.lab?.directions.find(d=>d.status==='selected')?.id??state.lab?.directions[0]?.id??'';}
  function selector(){return `<label>Dirección<select data-direction>${state.lab?.directions.map(d=>`<option value="${esc(d.id)}" ${d.id===selected?'selected':''}>${esc(d.name)}</option>`).join('')||'<option value="">Primero crea una dirección</option>'}</select></label>`;}
  function requestButton(action:IdentityRequestOptions['action'],label:string){return `<button data-request="${action}" ${working||!state.capabilities[action]?'disabled':''}>${label}</button>`;}
  function header(part:IdentityPart){return `<header><span class="eyebrow">IDENTITY LAB</span><h2>${titles[part]}</h2></header>${error?`<p class="error" role="alert">${esc(error)}</p>`:''}${working?'<p class="muted" role="status">Esperando respuesta del IDE…</p>':''}`;}
  function field(label:string,key:keyof IdentityBrief,array=false){const brief=state.lab?.brief??empty;return `<label>${label}<textarea rows="${array?3:4}" data-brief="${key}" placeholder="${array?'Una idea por línea':'Escribe con tus palabras'}">${esc(array?(brief[key] as string[]).join('\n'):brief[key])}</textarea></label>`;}
  function cardReference(r:IdentityReference){return `<article><div class="item-head"><strong>${esc(r.title)}</strong><span class="badge">${r.status==='accepted'?'Aceptada':'Propuesta'}</span></div><p>${esc(r.observations)}</p><dl><dt>Fuente</dt><dd>${esc(r.source)}</dd>${r.author?`<dt>Autoría</dt><dd>${esc(r.author)}</dd>`:''}${r.community?`<dt>Comunidad</dt><dd>${esc(r.community)}</dd>`:''}${r.license?`<dt>Uso / licencia</dt><dd>${esc(r.license)}</dd>`:''}</dl>${r.interpretation?`<p class="muted">Interpretación: ${esc(r.interpretation)}</p>`:''}<div class="actions">${r.status==='proposed'?`<button data-accept-reference="${esc(r.id)}">Aceptar referencia</button>`:''}<button data-remove-reference="${esc(r.id)}">Quitar</button></div></article>`;}
  function content(part:IdentityPart){
    const lab=state.lab,d=direction();
    if(part==='brief')return `<p class="muted">La intención acompaña cada propuesta. No necesitas vocabulario de diseño.</p>${field('Qué quieres transmitir','intent')}${field('Para quién','audience')}${field('Contexto y origen','context')}${field('Cualidades que buscamos','qualities',true)}${field('Qué queremos evitar','avoid',true)}${field('Restricciones','constraints',true)}`;
    if(part==='references')return `<p class="muted">Separa lo observado de tu interpretación. Conserva fuente, autoría y permisos.</p>${requestButton('research','Investigar con la IA del IDE')}${lab?.references.map(cardReference).join('')||'<p class="empty">Todavía no hay referencias.</p>'}<details><summary>Añadir referencia</summary><form data-form="reference"><label>Título<input name="title" required maxlength="160"></label><label>Fuente o ubicación<input name="source" required maxlength="2000"></label><label>Tipo<select name="kind"><option value="visual">Visual</option><option value="cultural">Cultural</option><option value="material">Material</option><option value="other">Otra</option></select></label><label>Autoría<input name="author"></label><label>Comunidad / procedencia<input name="community"></label><label>Uso / licencia<input name="license"></label><label>Qué observas<textarea name="observations" required></textarea></label><label>Tu interpretación<textarea name="interpretation"></textarea></label><button type="submit">Guardar referencia</button><button type="button" data-discard>Descartar borrador</button></form></details>`;
    if(part==='directions'){
      const doc=editor.getDocument();return `<p class="muted">Cada dirección reúne sus pantallas, lenguaje visual y propósito.</p>${requestButton('explore','Explorar con la IA del IDE')}${lab?.directions.map(item=>`<article><div class="item-head"><button class="item-title" data-choose="${esc(item.id)}" aria-pressed="${item.id===selected}">${esc(item.name)}</button><span class="badge">${item.status==='selected'?'Elegida':item.status==='archived'?'Archivada':'Exploración'}</span></div><p>${esc(item.intent)}</p>${item.proposal?`<p class="proposal">${esc(item.proposal)}</p>`:''}<div class="actions">${item.frameIds.map(id=>`<button data-frame="${esc(id)}">${esc(doc.nodes.find(n=>n.id===id)?.name??'Pantalla no disponible')}</button>`).join('')}</div><div class="actions"><button data-direction-status="selected" data-id="${esc(item.id)}">Elegir</button><button data-direction-status="archived" data-id="${esc(item.id)}">Archivar</button><button data-remove-direction="${esc(item.id)}">Quitar</button></div></article>`).join('')||'<p class="empty">Crea una dirección y vincula sus pantallas.</p>'}<details><summary>Nueva dirección</summary><form data-form="direction"><label>Nombre<input name="name" required maxlength="160"></label><label>Idea central<textarea name="intent" required></textarea></label><label>Pantallas<select name="frames" multiple size="4">${doc.nodes.filter(n=>n.type==='frame'&&n.parentId===null).map(n=>`<option value="${esc(n.id)}">${esc(n.name)}</option>`).join('')}</select></label><label>Lenguajes visuales<select name="styles" multiple size="3">${editor.getStyles().map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label><label>Referencias<select name="references" multiple size="3">${lab?.references.map(r=>`<option value="${esc(r.id)}">${esc(r.title)}</option>`).join('')??''}</select></label><button type="submit">Crear dirección</button><button type="button" data-discard>Descartar borrador</button></form></details>`;
    }
    if(part==='reviews')return `${selector()}<p class="muted">La IA del IDE revisa renders de esta dirección. Cada crítica conserva la evidencia exacta.</p>${requestButton('review','Solicitar crítica visual')}${lab?.critiques.filter(c=>c.directionId===selected).map(c=>`<article><div class="item-head"><strong>${esc(c.evaluator.provider)} / ${esc(c.evaluator.model)}</strong><span class="badge">${state.issues.some(i=>i.kind==='stale_review'&&i.id===c.id)?'Necesita nueva revisión':'Revisión vigente'}</span></div><p>${esc(c.summary)}</p>${c.findings.map(f=>`<section class="finding"><strong>${esc(f.criterion)} · ${f.assessment==='pass'?'Conservar':'Refinar'}</strong><p>${esc(f.reason)}</p>${f.nodeIds.length?`<button data-nodes="${esc(JSON.stringify(f.nodeIds))}">Ver elementos</button>`:''}</section>`).join('')}<details><summary>Ver evidencia renderizada</summary><div class="evidence">${c.evidence.map(e=>`<figure><img src="${esc(e.dataURL)}" alt="Render revisado de ${esc(e.frameId)}"><figcaption>${esc(e.frameId)} · ${e.width} × ${e.height}</figcaption></figure>`).join('')}</div></details></article>`).join('')||'<p class="empty">Todavía no hay una crítica para esta dirección.</p>'}<label>Qué quieres mejorar<textarea data-refinement-instruction rows="3" placeholder="Describe qué falla y qué quieres conservar">${esc(instruction)}</textarea></label><button data-refine ${working||!state.capabilities.refine||!d?'disabled':''}>Proponer ajuste de la selección</button><button data-discard-instruction>Limpiar instrucción</button>${lab?.refinements.filter(r=>r.directionId===selected).map(r=>`<article><strong>${esc(r.instruction)}</strong><p>${esc(r.proposal??'Solicitud pendiente')}</p><span class="badge">${state.issues.some(i=>i.kind==='stale_refinement'&&i.id===r.id)?'El diseño cambió':r.status==='resolved'?'Resuelta':'Propuesta'}</span>${r.status!=='resolved'?`<button data-resolve="${esc(r.id)}">Marcar como resuelta</button>`:''}</article>`).join('')||''}`;
    if(part==='decisions')return `<p class="muted">Conserva lo aprendido. Una observación concreta guía la siguiente iteración.</p>${lab?.decisions.map(item=>`<article><div class="item-head"><strong>${esc(item.criterion)}</strong><span class="badge">${{keep:'Conservar',revise:'Revisar',discard:'Descartar'}[item.outcome]}</span></div><p>${esc(item.observation)}</p><p class="muted">Siguiente paso: ${esc(item.next)}</p><small>${esc(item.author)} · ${esc(item.at)}</small></article>`).join('')||'<p class="empty">Todavía no hay decisiones registradas.</p>'}<form data-form="decision">${selector()}<label>Criterio<input name="criterion" required placeholder="Elegancia, claridad, personalidad…"></label><label>Observación<textarea name="observation" required></textarea></label><label>Siguiente paso<textarea name="next" required></textarea></label><label>Decisión<select name="outcome"><option value="revise">Revisar</option><option value="keep">Conservar</option><option value="discard">Descartar</option></select></label><label>Autoría<input name="author" required value="Equipo"></label><button type="submit">Registrar decisión</button><button type="button" data-discard>Descartar borrador</button></form>`;
    return `<p class="muted">Entrega el documento, la intención, las referencias, decisiones y evidencia de revisión al IDE.</p><dl><dt>Direcciones</dt><dd>${lab?.directions.length??0}</dd><dt>Referencias aceptadas</dt><dd>${lab?.references.filter(r=>r.status==='accepted').length??0}</dd><dt>Revisiones</dt><dd>${lab?.critiques.length??0}</dd><dt>Decisiones</dt><dd>${lab?.decisions.length??0}</dd></dl>${state.issues.length?`<section class="issues"><h3>Antes de entregar</h3>${state.issues.map(i=>`<p>${esc(i.message)}</p>`).join('')}</section>`:'<p class="muted">Sin vínculos pendientes de resolver.</p>'}<button data-export ${!lab?'disabled':''}>Exportar identidad</button><p class="muted">La IA, el guardado y la apertura de archivos pertenecen al IDE. El paquete no contiene claves ni servicios activos.</p>`;
  }
  function render(){
    if(disposed)return;choose();
    for(const [part,m] of mounted){
      if(formDrafts.has(m.root)||[...drafts.keys()].some(i=>m.root.contains(i)))continue;
      // Preserve unsaved forms and the user's cursor while another panel changes.
      if(m.shadow.activeElement?.matches('input,textarea,select')){pendingRender.add(m.root);continue;}
      pendingRender.delete(m.root);
      m.root.innerHTML=header(part)+content(part);
    }
  }
  function changed(){state=editor.getIdentityState();lastProject=session.store.project;signature=JSON.stringify(state.capabilities);render();}
  function invalidate(){const sig=JSON.stringify(session.identityCapabilities());if(session.store.project!==lastProject||sig!==signature){changed();}}
  async function request(action:IdentityRequestOptions['action'],root:HTMLElement){
    const refinement=action==='refine'?{nodeIds:editor.getSelection().map(n=>n.id),instruction:root.querySelector<HTMLTextAreaElement>('[data-refinement-instruction]')?.value??''}:{};
    try{flush();error='';working=true;if(action==='refine')instructionDirty=false;render();await editor.requestIdentity({action,...(selected?{directionId:selected}:{}),...refinement});}
    catch(cause){if(!disposed)report(cause);}finally{if(!disposed){working=false;changed();}}
  }
  async function exportData(){
    flush();const data=editor.exportIdentity();
    if(options.onExport){await options.onExport(data);return;}
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    try{const a=owner.createElement('a');a.href=url;a.download='identity.codaru.json';a.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }
  function click(event:Event,root:HTMLElement){
    const button=(event.target as Element).closest<HTMLButtonElement>('button');if(!button||button.disabled)return;
    try{
      if(button.hasAttribute('data-discard')){formDrafts.delete(root);button.closest('form')?.reset();error='';render();return;}
      if(button.hasAttribute('data-discard-instruction')){instruction='';instructionDirty=false;error='';render();return;}
      if(button.dataset.request){void request(button.dataset.request as IdentityRequestOptions['action'],root);return;}
      if(button.hasAttribute('data-refine')){void request('refine',root);return;}
      if(button.hasAttribute('data-export')){void exportData().catch(report);return;}
      if(button.dataset.frame){flush();const id=button.dataset.frame;if(options.onOpenFrame)void Promise.resolve(options.onOpenFrame(id)).catch(report);else{const target=editor.getDocument().nodes.find(n=>n.id===id);if(!target)throw new Error('La pantalla ya no existe.');editor.select([id]);}return;}
      if(button.dataset.nodes){flush();editor.select(JSON.parse(button.dataset.nodes));return;}
      flush();error='';
      if(button.dataset.choose){selected=button.dataset.choose;render();return;}
      if(button.dataset.acceptReference){const r=state.lab?.references.find(r=>r.id===button.dataset.acceptReference);if(r)transact({op:'identity.reference.put',reference:{...r,status:'accepted'}});}
      if(button.dataset.removeReference)transact({op:'identity.reference.remove',id:button.dataset.removeReference});
      if(button.dataset.removeDirection)transact({op:'identity.direction.remove',id:button.dataset.removeDirection});
      if(button.dataset.directionStatus){const d=state.lab?.directions.find(d=>d.id===button.dataset.id);if(d)transact({op:'identity.direction.put',direction:{...d,status:button.dataset.directionStatus as IdentityDirection['status']}});}
      if(button.dataset.resolve){const r=state.lab?.refinements.find(r=>r.id===button.dataset.resolve);if(r)transact({op:'identity.refinement.put',refinement:{...r,status:'resolved'}});}
    }catch(cause){report(cause);}
  }
  function submit(event:Event){
    const form=event.target as HTMLFormElement;if(!form.dataset.form)return;event.preventDefault();
    try{
      const values=new FormData(form);const panel=form.closest('.identity-panel') as HTMLElement;formDrafts.delete(panel);flush();const v=(key:string)=>String(values.get(key)??'').trim();
      if(form.dataset.form==='reference')editor.upsertIdentityReference({id:uid('reference'),title:v('title'),source:v('source'),kind:v('kind') as IdentityReference['kind'],observations:v('observations'),status:'accepted',...Object.fromEntries(['author','community','license','interpretation'].filter(k=>v(k)).map(k=>[k,v(k)]))});
      if(form.dataset.form==='direction')editor.upsertIdentityDirection({id:uid('direction'),name:v('name'),intent:v('intent'),frameIds:values.getAll('frames').map(String),styleIds:values.getAll('styles').map(String),referenceIds:values.getAll('references').map(String),status:'exploring'});
      if(form.dataset.form==='decision')editor.addIdentityDecision({id:uid('decision'),...(selected?{directionId:selected}:{}),criterion:v('criterion'),observation:v('observation'),next:v('next'),outcome:v('outcome') as 'keep'|'revise'|'discard',author:v('author'),at:new Date().toISOString()});
      form.reset();formDrafts.delete(form.closest('.identity-panel')! as HTMLElement);(form.getRootNode() as ShadowRoot).activeElement instanceof HTMLElement&&((form.getRootNode() as ShadowRoot).activeElement as HTMLElement).blur();error='';changed();
    }catch(cause){formDrafts.add(form.closest('.identity-panel') as HTMLElement);report(cause);}
  }
  function input(event:Event){
    const input=event.target as HTMLTextAreaElement;if(input.hasAttribute('data-refinement-instruction')){instruction=input.value;instructionDirty=!!instruction.trim();return;}if(!input.dataset.brief){if(input.closest('form'))formDrafts.add(input.closest('.identity-panel') as HTMLElement);return;}
    const key=input.dataset.brief as keyof IdentityBrief,brief=editor.getIdentityLab()?.brief??empty;
    if(!drafts.has(input)){
      const base=JSON.stringify(brief[key]);
      drafts.set(input,{base,apply:()=>{
        const current=editor.getIdentityLab()?.brief??empty;
        if(JSON.stringify(current[key])!==base)throw new Error('Este campo cambió mientras lo editabas. Conservamos tu texto; revisa la versión actual antes de guardarlo.');
        editor.updateIdentityBrief({[key]:Array.isArray(empty[key])?lines(input.value):input.value});
      }});
    }
  }
  function change(event:Event){
    const target=event.target as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;
    try{if(target.hasAttribute('data-direction')){flush();selected=target.value;render();}else if(target.hasAttribute('data-brief')){flush();error='';changed();}}catch(cause){report(cause);}
  }
  function destroy(){if(disposed)return;flush();disposed=true;unbind();for(const m of mounted.values()){m.cleanup();m.handle.element.remove();}mounted.clear();drafts.clear();formDrafts.clear();}
  const unbind=session.bindExtension({flush,dispose:destroy,notify:invalidate,isBusy:()=>drafts.size>0||formDrafts.size>0||instructionDirty});
  return {
    mount(part,container,config={}){
      assertActive();if(!Object.hasOwn(titles,part))throw new Error('Panel de identidad desconocido.');if(mounted.has(part))throw new Error('Este panel ya está montado.');if(container.ownerDocument!==owner)throw new Error('Los paneles deben pertenecer al mismo documento.');
      const element=owner.createElement('div');element.dataset.codaruIdentityPart=part;element.style.cssText='display:block;width:100%;height:100%;min-width:0;min-height:0';applyAppearance(element,appearance);if(config.appearance)applyAppearance(element,config.appearance);
      const shadow=element.attachShadow({mode:'open'}),css=owner.createElement('style'),root=owner.createElement('section');root.className='identity-panel';root.setAttribute('part',part);css.textContent=chrome+'\n'+styles;const nonce=options.styleNonce??owner.querySelector<HTMLStyleElement>('style[nonce]')?.nonce;if(nonce)css.nonce=nonce;shadow.append(css,root);container.append(element);
      const onClick=(e:Event)=>click(e,root);root.addEventListener('click',onClick);root.addEventListener('submit',submit);root.addEventListener('input',input);root.addEventListener('change',change);const onBlur=(e:FocusEvent)=>{if(pendingRender.has(root)&&!root.contains(e.relatedTarget as Node|null))queueMicrotask(render);};root.addEventListener('focusout',onBlur);
      const cleanup=()=>{root.removeEventListener('click',onClick);root.removeEventListener('submit',submit);root.removeEventListener('input',input);root.removeEventListener('change',change);root.removeEventListener('focusout',onBlur);};
      let removed=false;const handle:IdentityFragment={element,setAppearance(a){if(!removed)applyAppearance(element,a);},destroy(){if(removed)return;flush();removed=true;cleanup();formDrafts.delete(root);element.remove();mounted.delete(part);}};
      mounted.set(part,{handle,root,shadow,cleanup});render();return handle;
    },
    setAppearance(a){assertActive();appearance={...appearance,...a,tokens:{...appearance.tokens,...a.tokens}};for(const m of mounted.values())applyAppearance(m.handle.element,a);},flush,destroy,
  };
}
