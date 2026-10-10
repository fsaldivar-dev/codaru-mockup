import type {CodaruEditor} from './editor-core';
import {getEditorSession} from './editor-core';
import type {ExperienceSpec,ExperienceReport,AnalyticsEventSpec} from './contracts';
import {accessibilityRoles,analyticsTriggers,experienceReport,suggestedExperience} from './experience';
import {applyAppearance,type EditorAppearance} from './ui-theme';
import chrome from './chrome-style.css?inline';
import styles from './experience-view.css?inline';
export {experienceReport,validateExperienceSpec} from './experience';
export type {ExperienceSpec,ExperienceReport,AccessibilitySpec,AnalyticsEventSpec,ExperienceIssue,ExperienceEntry} from './contracts';
export type ExperiencePart='accessibility'|'analytics'|'tests';
export interface ExperienceViewOptions {
 appearance?:EditorAppearance;ownerDocument?:Document;styleNonce?:string;
 /** Adapter for an editor-owned modal. Must commit one validated transaction and notify persistence. */
 commit?:(updates:Array<{id:string;spec:ExperienceSpec|null}>)=>void;
 /** Explicit IDE handoff, never a telemetry collector. */
 onHandoff?:(report:ExperienceReport)=>Promise<void>;
 onExport?:(report:ExperienceReport)=>void|Promise<void>;
 onError?:(error:Error)=>void;
}
export interface ExperienceFragment {element:HTMLElement;setAppearance(a:EditorAppearance):void;destroy():void;}
export interface ExperienceView {mount(part:ExperiencePart,container:HTMLElement):ExperienceFragment;flush():void;setAppearance(a:EditorAppearance):void;destroy():void;}
const titles={accessibility:'Accesibilidad',analytics:'Analítica',tests:'Pruebas y usabilidad'};
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
/** Independently mounted panels sharing only the editor session. */
export function createExperienceView(editor:CodaruEditor,options:ExperienceViewOptions={}):ExperienceView {
 const session=getEditorSession(editor),owner=options.ownerDocument??document;
 const mounted=new Map<ExperiencePart,{handle:ExperienceFragment;root:HTMLElement;shadow:ShadowRoot}>();
 let disposed=false,appearance=options.appearance??{},error='',working=false,lastProject=session.store.project,lastSelection='',flushing=false;
 let cachedProject:unknown,cachedSelection='',cachedReport:ExperienceReport;
 const invalidInputs=new Set<string>();
 const drafts=new Map<string,{base:ExperienceSpec|undefined;spec:ExperienceSpec}>();
 function active(){if(disposed)throw new Error('El panel de experiencia fue desmontado.');session.assertActive();}
 function pendingControls(){for(const m of mounted.values()){const b=m.root.querySelector<HTMLButtonElement>('[data-discard]');if(b)b.hidden=!drafts.size;}}
 function fail(cause:unknown){pendingControls();error=cause instanceof Error?cause.message:String(cause);for(const m of mounted.values()){const alert=m.root.querySelector('[role=alert]');if(alert)alert.textContent=error;}options.onError?.(new Error(error));}
 function selected(){return session.state.selected.length===1?session.store.project.nodes.find(n=>n.id===session.state.selected[0]):undefined;}
 function flush(){
  if(disposed||flushing||!drafts.size)return;
  if(invalidInputs.size)throw new Error('Corrige el esquema JSON antes de guardar. El borrador sigue en el panel.');
  const pending=[...drafts];
  for(const [id,d] of pending){const n=session.store.project.nodes.find(n=>n.id===id);if(!n||JSON.stringify(n.experience)!==JSON.stringify(d.base))throw new Error('El elemento cambió mientras editabas. Conserva el borrador y vuelve a revisar.');}
  drafts.clear();flushing=true;
  try{const updates=pending.map(([id,d])=>({id,spec:d.spec}));if(options.commit)options.commit(updates);else editor.apply(updates.map(u=>({op:'experience.set' as const,...u})));error='';}
  catch(cause){for(const [id,d] of pending)drafts.set(id,d);throw cause;}finally{flushing=false;pendingControls();}
 }
 function content(part:ExperiencePart){
  const n=selected();if(!n)return '<p class="empty">Selecciona un elemento para definir su contrato.</p>';
  const spec=drafts.get(n.id)?.spec??n.experience??{},a=spec.accessibility??{},suggested=suggestedExperience(n);
  if(cachedProject!==session.store.project||cachedSelection!==n.id){cachedReport=experienceReport(session.store.project,{ids:[n.id]});cachedProject=session.store.project;cachedSelection=n.id;}
  const report=cachedReport,entry=report.entries[0];
  const choices=(items:readonly string[],value:unknown)=>items.map(k=>`<option value="${k}" ${k===value?'selected':''}>${k}</option>`).join('');
  const field=(label:string,key:string,value:unknown,placeholder='')=>`<label>${label}<input data-field="${key}" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="500" part="experience-field"></label>`;
  const label=`<div class="selected"><strong>${esc(n.name)}</strong><code>${esc(n.id)}</code></div>`;
  const findings=`<section class="findings" part="experience-findings"><h3>Por revisar</h3>${report.issues.filter(i=>part==='analytics'?i.rule.startsWith('analytics'):part==='accessibility'?!i.rule.startsWith('analytics')&&i.rule!=='test-id-duplicate':true).map(i=>`<article><span class="badge ${i.severity}">${i.verification==='implementation'?'En la app':'En el diseño'}</span><p>${esc(i.message)}</p><small>${esc(i.fix)}</small></article>`).join('')||'<p class="muted">Sin hallazgos en este contrato. Verifica el producto en ejecución.</p>'}</section>`;
  if(part==='accessibility')return label+`<p class="muted">Define qué comunica el control y cómo se usa sin ratón.</p><label>Rol<select data-field="role" part="experience-field"><option value="">Sin definir${suggested.role?' · sugerido '+suggested.role:''}</option>${choices(accessibilityRoles,a.role)}</select></label>${field('Nombre accesible','name',a.name,suggested.name??'Etiqueta clara, independiente del placeholder')}${field('Clave de traducción','nameKey',a.nameKey,'player.play')}${field('Descripción','description',a.description)}<label class="check"><input type="checkbox" data-field="decorative" ${a.decorative?'checked':''}>Decorativo · ocultar del lector de pantalla</label>${field('Teclas admitidas','keyboard',a.keyboard?.join(', '),'Enter, Space')}<label>Foco<select data-field="focus"><option value="">Sin definir</option>${choices(['visible','not-focusable'],a.focus)}</select></label><label>Orden de foco<input type="number" min="0" max="3000" data-field="focusOrder" value="${a.focusOrder??''}"></label><label>Anunciar cambios<select data-field="live"><option value="">Sin definir</option>${choices(['off','polite','assertive'],a.live)}</select></label>${field('Estados expuestos','states',a.states?.join(', '),'disabled, busy')}<label class="check"><input type="checkbox" data-field="reducedMotion" ${a.reducedMotion?'checked':''}>Alternativa con movimiento reducido</label>`+findings;
  if(part==='analytics')return label+`<p class="muted">Eventos del producto y puntos de instrumentación. Codaru no envía datos.</p><div class="actions"><button data-add-event part="experience-action">+ Evento</button><button data-no-events>Sin analítica</button></div>${(spec.analytics??[]).map((e,index)=>`<article class="event" data-event="${index}"><div class="row"><strong>Evento ${index+1}</strong><button data-remove-event="${index}" aria-label="Quitar evento ${index+1}">Quitar</button></div><label>Nombre del evento<input data-event-field="name" value="${esc(e.name)}" maxlength="128"></label><label>Cuándo emitir<select data-event-field="trigger">${choices(analyticsTriggers,e.trigger)}</select></label><label>Propósito<input data-event-field="purpose" value="${esc(e.purpose)}" maxlength="500"></label><label>Consentimiento<select data-event-field="consent"><option value="">Pendiente</option>${choices(['required','not-required'],e.consent)}</select></label><label>Propiedades · esquema JSON<textarea data-event-field="properties" rows="4" spellcheck="false">${esc(JSON.stringify(e.properties??{},null,2))}</textarea></label><small>Solo tipos y fuentes: {"track_id":{"type":"string","source":"track.id"}}. Evita datos reales.</small>${entry.instrumentation[index]?`<p class="instruction">${esc(entry.instrumentation[index].where)}</p>`:''}</article>`).join('')||'<p class="empty">No hay eventos definidos.</p>'}`+findings;
  return label+field('Identificador de prueba','testId',spec.testId,suggested.testId)+`<label>Criterios de aceptación<textarea data-field="acceptance" rows="4" maxlength="10000" placeholder="Un comportamiento esperado por línea">${esc(spec.acceptance?.join('\n'))}</textarea></label><h3>Conectar al código</h3><dl>${Object.entries(entry.tests.bindings).map(([platform,binding])=>`<dt>${platform}</dt><dd><code>${esc(binding)}</code></dd>`).join('')}</dl><h3>Plan de pruebas</h3>${entry.tests.assertions.map(t=>`<article><span class="badge">${t.verification==='automated'?'Automatizable':'Verificar en la app'}</span><p>${esc(t.expected)}</p></article>`).join('')}<details><summary>Comprobaciones en ejecución</summary>${report.runtimeChecks.map(s=>`<p class="muted">${esc(s)}</p>`).join('')}</details>`+findings;
 }
 function render(){if(disposed||flushing)return;for(const [part,m] of mounted){if(drafts.size||m.shadow.activeElement?.matches('input,textarea,select'))continue;m.root.innerHTML=`<header part="experience-heading"><span class="eyebrow">CONTRATO DEL PRODUCTO</span><h2>${titles[part]}</h2></header><p role="alert" class="error">${esc(error)}</p><button data-discard hidden title="Descarta solo cambios sin guardar">Descartar borrador</button>${content(part)}<footer class="actions"><button data-export part="experience-export">Exportar plan JSON</button><button data-handoff part="experience-handoff" ${!options.onHandoff||working?'disabled':''}>${working?'Enviando…':'Enviar al IDE'}</button></footer>`;for(const field of m.root.querySelectorAll('input,select,textarea'))field.setAttribute('part','experience-field');for(const button of m.root.querySelectorAll('button:not([part])'))button.setAttribute('part','experience-action');}}
 function draft(id:string){let d=drafts.get(id);if(!d){const n=session.store.project.nodes.find(n=>n.id===id)!;d={base:n.experience?copy(n.experience):undefined,spec:copy(n.experience??{})};drafts.set(id,d);}return d;}
 function input(event:Event){
  const target=event.target as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement,n=selected();if(!n)return;
  const field=target.dataset.field,eventField=target.dataset.eventField;if(!field&&!eventField)return;
  const d=draft(n.id);pendingControls();const value=target.value.trim(),inputKey=n.id+':'+target.closest<HTMLElement>('[data-event]')?.dataset.event+':'+eventField;
  try{
   if(eventField){invalidInputs.delete(inputKey);const index=Number(target.closest<HTMLElement>('[data-event]')!.dataset.event),e=d.spec.analytics![index];if(eventField==='properties')e.properties=value?JSON.parse(value):{};else if(value)(e as any)[eventField]=value;else delete (e as any)[eventField];}
   else if(field==='testId'){if(value)d.spec.testId=value;else delete d.spec.testId;}
   else if(field==='acceptance')d.spec.acceptance=value.split('\n').map(s=>s.trim()).filter(Boolean);
   else{const a=d.spec.accessibility??={};if(['decorative','reducedMotion'].includes(field!))(a as any)[field!]=(target as HTMLInputElement).checked;else if(['keyboard','states'].includes(field!))(a as any)[field!]=value.split(',').map(s=>s.trim()).filter(Boolean);else if(value)(a as any)[field!]=field==='focusOrder'?Number(value):value;else delete (a as any)[field!];}
   error='';
  }catch(cause){invalidInputs.add(inputKey);fail(cause);}
 }
 async function deliver(handoff:boolean){try{flush();const ids=session.state.selected;const report=editor.getExperienceReport(ids.length?{ids}:{});if(handoff){working=true;render();await options.onHandoff!(report);}else if(options.onExport)await options.onExport(report);else{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=owner.createElement('a');a.href=url;a.download='experience.codaru.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}catch(cause){if(!disposed)fail(cause);}finally{working=false;render();}}
 function click(event:Event){const b=(event.target as Element).closest<HTMLButtonElement>('button');if(!b||b.disabled)return;try{if(b.hasAttribute('data-discard')){drafts.clear();invalidInputs.clear();error='';render();return;}if(b.hasAttribute('data-export')){void deliver(false);return;}if(b.hasAttribute('data-handoff')){void deliver(true);return;}flush();const n=selected();if(!n)return;const spec=copy(n.experience??{});if(b.hasAttribute('data-add-event')){const events=spec.analytics??=[],name='ui.'+n.id.replace(/[^a-zA-Z0-9_.-]/g,'_')+'.press';let unique=name;for(let i=2;events.some(e=>e.name===unique);i++)unique=name+'.'+i;events.push({name:unique.slice(0,128),trigger:'press',purpose:'Medir la activación de '+n.name.slice(0,450),consent:'required'});spec.analytics=events;}else if(b.hasAttribute('data-no-events'))spec.analytics=[];else if(b.dataset.removeEvent!==undefined)spec.analytics?.splice(Number(b.dataset.removeEvent),1);else return;if(options.commit)options.commit([{id:n.id,spec}]);else editor.setExperience(n.id,spec);render();}catch(cause){fail(cause);}}
 function invalidate(){if(disposed)return;const selection=session.state.selected.join('|');if(session.store.project!==lastProject||selection!==lastSelection){lastProject=session.store.project;lastSelection=selection;render();}}
 function destroy(){if(disposed)return;flush();disposed=true;unbind();for(const m of mounted.values())m.handle.destroy();mounted.clear();}
 const unbind=session.bindExtension({flush,dispose:destroy,notify:invalidate,isBusy:()=>drafts.size>0});
 return {mount(part,container){active();if(!Object.hasOwn(titles,part)||mounted.has(part))throw new Error('Panel desconocido o ya montado.');if(container.ownerDocument!==owner)throw new Error('El panel debe pertenecer al documento propietario.');const element=owner.createElement('div');element.dataset.codaruExperiencePart=part;element.style.cssText='height:100%;min-height:0';applyAppearance(element,appearance);const shadow=element.attachShadow({mode:'open'}),css=owner.createElement('style'),root=owner.createElement('section');root.className='experience-panel';root.setAttribute('part','experience-panel '+part);css.textContent=chrome+'\n'+styles;const nonce=options.styleNonce??owner.querySelector<HTMLStyleElement>('style[nonce]')?.nonce;if(nonce)css.nonce=nonce;shadow.append(css,root);container.append(element);
 const change=()=>{try{flush();}catch(cause){fail(cause);}};
 // WebKit may omit relatedTarget when native accessibility clicks move focus.
 // Keep the controls intact until the action/selection supplies a safe redraw.
 const blur=(event:FocusEvent)=>{try{flush();const next=event.relatedTarget as HTMLElement|null;if(!next||root.contains(next)||next.tagName==='BUTTON')return;queueMicrotask(render);}catch(cause){fail(cause);}};
 const key=(e:Event)=>e.stopPropagation();root.addEventListener('input',input);root.addEventListener('change',change);root.addEventListener('focusout',blur);root.addEventListener('click',click);root.addEventListener('keydown',key);
 let removed=false;const handle:ExperienceFragment={element,setAppearance(a){if(!removed)applyAppearance(element,a);},destroy(){if(removed)return;flush();removed=true;root.removeEventListener('input',input);root.removeEventListener('change',change);root.removeEventListener('focusout',blur);root.removeEventListener('click',click);root.removeEventListener('keydown',key);element.remove();mounted.delete(part);}};mounted.set(part,{handle,root,shadow});render();return handle;},flush,setAppearance(a){active();appearance={...appearance,...a,tokens:{...appearance.tokens,...a.tokens}};for(const m of mounted.values())m.handle.setAppearance(a);},destroy};
}
