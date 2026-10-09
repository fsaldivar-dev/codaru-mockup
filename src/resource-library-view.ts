import type { CodaruEditor } from './editor-core';
import type { Project } from './model';
import type { ResourceRecord, ResourceSummary } from './contracts';
import { escape } from './screen-svg';

const statusText = {pending:'Pendiente de IA',reviewing:'En revisión',approved:'Aprobado por IA',changes_requested:'Necesita correcciones',rejected:'Rechazado'};
export function createResourceLibraryPanel(options: {editor:CodaruEditor; project:()=>Project; refresh:()=>void; insert:(id:string)=>Promise<void>; save:(content:string,filename:string,extension:string,encoding?:'utf8'|'base64')=>Promise<unknown>; error:(message:string)=>void}) {
  let rows:ResourceSummary[] = [], loading=false, error='', current:Project|undefined, selected='', filter:'document'|'approved'|'pending'='document', query='', limit=24, disposed=false, version=0;
  const details = new Map<string, ResourceRecord>();
  const thumbnails = new Set<string>();
  let target:HTMLElement|undefined;
  function invalidate() { current=undefined; details.clear(); thumbnails.clear(); version++; refresh(); }
  // The library owns the active tab. An async resource response must not replace
  // another panel that has since taken over the same connected container.
  function refresh() { if (!disposed && target?.isConnected) options.refresh(); }
  async function load() {
    if (loading || disposed) return;
    const document = options.project(), requestVersion=version; loading=true;
    try {
      const next = await options.editor.getResourceLibrary();
      if (disposed) return;
      if (requestVersion!==version || options.project()!==document) return;
      rows=next; current=document; error='';
      for (const row of rows.slice(0,limit)) { const entry=await options.editor.getResource(row.id); if (disposed) return; if (entry) details.set(row.id,entry); }
    } catch(e) { error=e instanceof Error?e.message:String(e); current=document; }
    finally { loading=false; refresh(); }
  }
  function render(element:HTMLElement, prefix:string) {
    if (disposed) return; target=element;
    if (current!==options.project() && !loading) void load();
    const matching=rows.filter(r=>(filter==='document'?r.nodeIds.length>0:filter==='approved'?r.status==='approved':r.status!=='approved') && `${r.name} ${r.purpose} ${r.tags.join(' ')} ${r.kind}`.toLowerCase().includes(query.toLowerCase()));
    const visible=matching.slice(0,limit);
    const missing=visible.filter(r=>!details.has(r.id) && !thumbnails.has(r.id));
    if(missing.length) { missing.forEach(r=>thumbnails.add(r.id)); void Promise.all(missing.map(r=>detail(r.id))).then(refresh).catch(e=>options.error(String(e))); }
    const chosen=rows.find(r=>r.id===selected), entry=selected?details.get(selected):undefined;
    const tile=(r:ResourceSummary)=>{const data=details.get(r.id);return `<button class="resource-tile vector" data-drawing="${escape(r.id)}" aria-pressed="${selected===r.id}" title="${escape(r.purpose)}">${data?`<img loading="lazy" decoding="async" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.resource.svg)}" alt=""/>`:'<span aria-hidden="true">◇</span>'}<span>${escape(r.name)}</span><small>${statusText[r.status]}</small></button>`;};
    element.innerHTML=prefix+`<div class="resource-row"><button class="text-button" data-drawing-bank>Banco externo ↗</button><button class="text-button" data-drawing-refresh>Actualizar</button></div><label class="full-field"><span>Colección</span><select aria-label="Colección de dibujos" data-drawing-filter><option value="document" ${filter==='document'?'selected':''}>Dibujos del proyecto</option><option value="approved" ${filter==='approved'?'selected':''}>Biblioteca aprobada</option><option value="pending" ${filter==='pending'?'selected':''}>Pendientes y correcciones</option></select></label><input aria-label="Buscar dibujos propios" data-drawing-query value="${escape(query)}" placeholder="Nombre, uso o etiquetas…"/><p class="field-note">${loading?'Preparando miniaturas…':`${matching.length} dibujos · ${rows.filter(r=>r.status==='approved').length} aprobados`}</p>${error?`<p class="empty-note resource-error">${escape(error)}</p>`:''}${chosen?`<section class="inspector-section"><div class="section-heading"><span>${escape(chosen.name)}</span><button class="text-button" data-drawing-close>×</button></div><p class="field-note">${statusText[chosen.status]} · ${Math.round(chosen.width)} × ${Math.round(chosen.height)}</p><p>${escape(chosen.purpose)}</p><p class="field-note">${chosen.tags.map(escape).join(' · ')}</p>${chosen.reasons.map(r=>`<p class="field-note">${escape(r)}</p>`).join('')}<button class="wide-button" data-drawing-action="review" ${chosen.status==='reviewing'?'disabled':''}>${chosen.status==='approved'?'Volver a revisar con IA':'Validar con IA'}</button><button class="wide-button" data-drawing-action="insert" ${chosen.status!=='approved'?'disabled':''}>Insertar en el diseño</button><div class="resource-row">${['svg','png','ios','android'].map(format=>`<button class="text-button" data-drawing-action="${format}" ${chosen.status!=='approved'?'disabled':''}>${format.toUpperCase()}</button>`).join('')}</div>${entry?.resource.source?`<button class="wide-button" data-drawing-action="edit" ${chosen.canEdit?'':'disabled'}>Editar fuente en el IDE ↗</button><button class="wide-button" data-drawing-action="aru">Exportar fuente ARU</button>`:''}${chosen.nodeIds.length?'<button class="wide-button" data-drawing-action="locate">Seleccionar en el lienzo</button>':''}<p class="field-note">La IA del IDE revisa renders reales antes de admitir el dibujo. El fuente puede descargarse para corregirlo.</p></section>`:''}<div class="resource-grid">${matching.slice(0,limit).map(tile).join('')}</div>${matching.length>limit?'<button class="wide-button" data-drawing-more>Mostrar más</button>':''}${!loading&&!matching.length?'<p class="empty-note">Las ilustraciones y los iconos vectoriales del lienzo aparecen aquí. Se conservan como candidatos hasta ser revisados.</p>':''}<button class="wide-button" data-action="image">Importar recurso ARU</button>`;
  }
  async function detail(id:string) { const entry=await options.editor.getResource(id); if (disposed) return; if(entry)details.set(id,entry); }
  async function action(name:string) {
    if (!selected) return;
    if (name==='review') {
      const id=selected, row=rows.find(r=>r.id===id); if(row)row.status='reviewing'; refresh();
      try { await options.editor.reviewResource(id); } finally { invalidate(); }
    } else if (name==='edit') await options.editor.requestResourceEdit(selected);
    else if(name==='locate') { const row=rows.find(r=>r.id===selected); if(row?.nodeIds[0])options.editor.select([row.nodeIds[0]]); }
    else if (name==='insert') await options.insert(selected);
    else if(name==='aru') { const data=await options.editor.getResource(selected); if(data?.resource.source)await options.save(data.resource.source.text,data.resource.source.filename,'aru'); }
    else {
      const exported=await options.editor.exportResource(selected,{format:name==='svg'?'svg':name==='png'?'png':'assets',platform:name==='ios'?'ios':name==='android'?'android':'all'});
      await options.save(exported.content,exported.filename,name==='svg'?'svg':name==='png'?'png':'zip',exported.encoding);
    }
  }
  function click(el:HTMLElement): boolean {
    if (el.dataset.drawing) { selected=el.dataset.drawing; void detail(selected).then(refresh).catch(e=>options.error(String(e))); refresh(); return true; }
    if (el.hasAttribute('data-drawing-close')) {selected='';refresh();return true;}
    if (el.hasAttribute('data-drawing-refresh')) {invalidate();return true;}
    if (el.hasAttribute('data-drawing-more')) {limit+=24; current=undefined;void load();refresh();return true;}
    if(el.dataset.drawingAction) {void action(el.dataset.drawingAction).catch(e=>options.error(e instanceof Error?e.message:String(e)));return true;}
    return false;
  }
  function input(el:HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement) {
    if(el.hasAttribute('data-drawing-filter')) { filter=el.value as typeof filter; limit=24;refresh();return true; }
    if(el.hasAttribute('data-drawing-query')) { const pos=(el as HTMLInputElement).selectionStart; query=el.value;refresh();const input=target?.querySelector<HTMLInputElement>('[data-drawing-query]');input?.focus();if(pos!==null)input?.setSelectionRange(pos,pos);return true; }
    return false;
  }
  return {render,invalidate,click,input,dispose:()=>{disposed=true;version++;target=undefined;details.clear();rows=[];}};
}
