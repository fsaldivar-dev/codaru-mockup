import {experienceReport,setExperience} from './experience';
import {applyCommentOperation,captureCommentAnchor,getCommentContext} from './comments';
import { applyIdentityOperation, identityIssues, identityTargetRevision } from './identity';
import { importStylePackage, applyStylePackage, styleSummaries } from './style-package';
import type { CodaruEditor } from './editor-core';
import { sameData } from './content-cache';
import { applyAruAsset } from './aru';
import { getComponentImplementations, setComponentImplementation } from './implementations';
import type { ImplementationReference } from './contracts';
import { defineComponentProperty, removeComponentProperty, getComponentProperties, setComponentProperty, type ComponentProperty, type ComponentPropertyValue } from './component-properties';
import { Store, clone, type PreparedTransaction, node, updateNode, remove, createComponent, instantiate, group, ungroup, detach, children, tokens, defineVariant, createVariant, switchVariant, setDesignSystemNotes, setComponentDoc, removeComponent, docStale, designSystemStale, type Project, type DesignNode, type Kind, pagesOf, activePage, addPage, renamePage, removePage, movePage, buildVersion, addVersion, removeVersion, applyVersion, unpackVersion, compareVersion, type Version, pageView, roleOf, frameRoles, type FrameRole, rootIds, frameOf, rootsOnPage } from './model';
import { effectiveTheme, type DesignTheme } from './themes';
import { kits, getKitItems, insertKitItem, ensureKitVariant, type KitId, type KitVariant } from './kits';
import { iconPacks, getIconItems, insertIcon } from './icon-library';
import { exportHTML, exportSVG } from './render';
import { sanitizeSVG, vectorLayers, vectorSize } from './motion';
import { devicePresets, deviceSkins } from './devices';
import { importFigma } from './figma-import';
import { importDOM } from './dom-import';
import { lintProject, lintRules, lintSummary } from './lint';
import { localizationState, resolveText, type LocalizationConfig, type LocalizationState, type LocalizationIssue } from './localization';
import type { AgentRequest } from './contracts';
export type { AgentRequest } from './contracts';

export interface AgentHost {
  resourceLibrary?: CodaruEditor['getResourceLibrary'];
  resource?: CodaruEditor['getResource'];
  exportResource?: CodaruEditor['exportResource'];
  project: () => Project;
  selection: () => string[];
  scope: () => string | null;
  busy: () => boolean;
  commit: (edit: (p: Project) => void) => void;
  commitPrepared?: (prepared: PreparedTransaction) => void;
  select: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  localization?: () => LocalizationConfig | null;
  previewProject?: () => Project;
  setLocale?: (locale: string | null) => void;
  localizationIssues?: () => LocalizationIssue[];
  localizationState?: () => LocalizationState;
}
class AgentError extends Error { constructor(public code: string, message: string) { super(message); } }
const fail = (message: string): never => { throw new AgentError('invalid_request', message); };
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Se esperaba un objeto JSON. Consulta codaru schema.'); return value as Record<string, unknown>; }
function string(value: unknown, label: string): string { if(typeof value!=='string'||!value.trim())return fail(`Falta ${label}. Consulta codaru schema.`);return value; }
function number(value: unknown, fallback: number): number { if(value===undefined)return fallback;if(typeof value!=='number'||!Number.isFinite(value))return fail('Las coordenadas y tamaños deben ser números finitos.');return value; }
function ids(value: unknown): string[] { if(!Array.isArray(value)||!value.length||value.some(v=>typeof v!=='string'))return fail('ids debe ser una lista no vacía de identificadores.');return value; }
function existing(p: Project,id: string) { const n=p.nodes.find(n=>n.id===id);if(!n)throw new AgentError('not_found',`No existe el elemento ${id}. Vuelve a leer codaru context.`);return n; }
function parent(value: unknown): string | null { if(value===null||value===undefined)return null;return string(value,'parentId'); }

/** Version over document data, independent of selection and camera. */
export async function revision(p: Project) {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(p)));
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
/** Author-named layers come first: generated capa-N ids are only useful once the artwork is known. */
function layerSummary(svg: string) {
  const all=vectorLayers(svg),named=all.filter(l=>!/^capa-\d+$/.test(l.id)),ordered=[...named,...all.filter(l=>!named.includes(l))];
  return {layers:ordered.slice(0,250).map(l=>`${l.id}:${l.tag}`),...(ordered.length>250?{layersTruncated:true,layerCount:ordered.length}:{})};
}
function variantOf(p: Project,componentId: string) { const c=p.components.find(c=>c.id===componentId); return c?.set?{set:c.set,setName:c.setName,variant:c.variant}:{}; }
function describe(p: Project,n: DesignNode,localization: LocalizationConfig | null = null) {
  const theme=effectiveTheme(p,n),implementation=getComponentImplementations(p,n.id);
  return {id:n.id,type:n.type,name:n.name,parentId:n.parentId,bounds:{x:n.x,y:n.y,width:n.width,height:n.height},
    ...(n.text?{text:n.text.slice(0,240),...(n.text.length>240?{textTruncated:true}:{})}:{}),
    ...(n.textKey?{textKey:n.textKey,translation:(()=>{const value=resolveText(n,localization);return {...value,text:value.text.slice(0,240),...(value.text.length>240?{textTruncated:true}:{})};})()}:{}),
    ...(children(p,n.id).length?{childCount:children(p,n.id).length,layout:n.layout,padding:n.paddingSides??n.padding,gap:n.gap,...(n.justify?{justify:n.justify}:{}),...(n.align?{align:n.align}:{}),...(n.wrap?{wrap:true}:{}),...(n.hugWidth?{hugWidth:true}:{}),...(n.hugHeight?{hugHeight:true}:{})}:{}),
    ...((n.componentId||n.instanceOf)?{properties:getComponentProperties(p,n.id).map(prop=>({...prop,...(typeof prop.value==='string'&&prop.value.length>240?{value:prop.value.slice(0,240),textTruncated:true}:{})}))}:{}),
    ...(implementation ? {implementation} : {}),
    ...(n.experience?{experience:{testId:n.experience.testId,accessibility:n.experience.accessibility?{role:n.experience.accessibility.role,name:n.experience.accessibility.name?.slice(0,240),nameKey:n.experience.accessibility.nameKey?.slice(0,240),focus:n.experience.accessibility.focus,decorative:n.experience.accessibility.decorative}:undefined,analytics:n.experience.analytics?.slice(0,5).map(e=>({name:e.name,trigger:e.trigger,purpose:e.purpose.slice(0,240)})),truncated:!!(n.experience.analytics?.length&&n.experience.analytics.length>5)||[n.experience.accessibility?.name,n.experience.accessibility?.nameKey,...(n.experience.analytics??[]).slice(0,5).map(e=>e.purpose)].some(s=>!!s&&s.length>240),next:'experience --ids '+n.id+' devuelve el contrato completo'}}:{}),
    appearance:{fill:n.fill,color:n.color,radius:n.radius,...(n.strokeWidth?{stroke:n.stroke,strokeWidth:n.strokeWidth}:{}),...(n.opacity!==100?{opacity:n.opacity}:{}),...(n.fillToken?{fillToken:n.fillToken}:{}),...(n.materialToken?{materialToken:n.materialToken}:{}),...(n.typographyToken?{typographyToken:n.typographyToken}:{}),...(n.radiusToken?{radiusToken:n.radiusToken}:{})},
    theme:{id:theme.id,mode:theme.mode},...(n.instanceOf?{instanceOf:n.instanceOf,...variantOf(p,n.instanceOf)}:{}),...(n.componentId?{componentId:n.componentId,...variantOf(p,n.componentId)}:{}),
    ...(n.targetId?{targetId:n.targetId,...(n.transition?{transition:n.transition}:{})}:{}),...(n.svg?layerSummary(n.svg):{}),...(n.aruSource?{illustration:{format:"aru",filename:n.aruSource.filename,sourceLength:n.aruSource.text.length,editable:true}}:{}),...(n.device?{device:n.device}:{}),...(n.fold?{fold:n.fold}:{}),...(n.foldPair?{foldPair:n.foldPair}:{}),...(n.safeArea?{safeArea:n.safeArea}:{}),...(n.skin?{skin:n.skin}:{}),...(n.animations?.length?{animations:n.animations}:{}),...(n.iconPack?{icon:{pack:n.iconPack,name:n.iconName}}:{}),...(n.hidden?{hidden:true}:{}),...(n.locked?{locked:true}:{})};
}
export async function context(host: AgentHost,params: Record<string,unknown> = {},document=host.project(), knownRevision?: string) {
  const p=document, revisionPromise=knownRevision === undefined ? revision(document) : Promise.resolve(knownRevision), selection=host.selection().filter(id=>p.nodes.some(n=>n.id===id)), localization=host.localization?.()??null;
  const scope=typeof params.scope==='string'?params.scope:selection.length&&typeof params.page!=='string'?'selection':host.scope()&&typeof params.page!=='string'?host.scope()!:'workspace';
  const depth=Math.max(0,Math.min(4,number(params.depth,1)));
  let roots: DesignNode[];
  const page=typeof params.page==='string'?params.page:undefined;if(page!==undefined&&!pagesOf(p).some(x=>x.id===page))fail('Página no encontrada.');
  if(scope==='selection')roots=selection.map(id=>existing(p,id));
  else if(['workspace','document'].includes(scope))roots=page?rootsOnPage(p,page):children(p,null);
  else roots=[existing(p,scope)];
  const seen=new Set<string>(), nodes:ReturnType<typeof describe>[]=[], limit=100;
  let truncated=false;
  const visit=(n:DesignNode,level:number)=>{if(seen.has(n.id))return;if(nodes.length>=limit){truncated=true;return;}seen.add(n.id);nodes.push(describe(p,n,localization));if(level<depth)for(const child of children(p,n.id))visit(child,level+1);};
  for(const root of roots)visit(root,0);
  const textIssues=localization?(host.localizationIssues?.()??[]).filter(issue=>seen.has(issue.node)):[];
  const flows=p.nodes.filter(n=>n.targetId).map(n=>({from:n.id,to:n.targetId,trigger:'click',label:n.text||n.name}));
  const styleId=effectiveTheme(p,roots[0]).id, fullGuidance=Object.values(p.stylePackages??{}).find(s=>`style-${s.id}`===styleId)?.guidance;
  const styleGuidance=fullGuidance?Object.fromEntries(Object.entries(fullGuidance).map(([key,lines])=>[key,lines.slice(0,4).map(line=>line.slice(0,240))])):null;
  const styleGuidanceTruncated=!!fullGuidance && Object.values(fullGuidance).some(lines=>lines.length>4 || lines.some(line=>line.length>240));
  const result = clone({revision:knownRevision ?? '',name:p.name,formatVersion:p.version,selection,selectionScope:host.scope(),scope,depth,
    coordinates:'Píxeles relativos al padre. Los frames raíz usan coordenadas del workspace.',busy:host.busy(),
    ...(localization?{localization:host.localizationState?.()??localizationState(localization),localizationIssues:textIssues.slice(0,100),localizationIssuesTruncated:textIssues.length>100}:{}),
    counts:{nodes:p.nodes.length,frames:p.nodes.filter(n=>n.type==='frame').length,components:p.components.length},
    pages:pagesOf(p).map(page=>{const view=pageView(p,page.id);return {id:page.id,name:page.name,frames:view.nodes.filter(n=>n.type==='frame'&&n.parentId===null).length,nodes:view.nodes.length};}),activePageId:activePage(p).id,versions:(p.versions??[]).map(v=>({id:v.id,name:v.name,at:v.at,note:v.note,screens:v.screens})),
    frames:p.nodes.filter(n=>n.type==='frame').map(n=>({id:n.id,name:n.name,themeId:effectiveTheme(p,n).id,mode:effectiveTheme(p,n).mode,page:n.parentId===null?(n.page??pagesOf(p)[0].id):undefined,role:roleOf(p,n)})),
    comments:{count:p.comments?.threads.length??0,open:p.comments?.threads.filter(t=>t.status==='open').length??0,threads:(p.comments?.threads??[]).filter(t=>t.anchor.nodeIds.some(id=>seen.has(id))||roots.some(n=>n.id===t.anchor.frameId)).slice(0,50).map(t=>({id:t.id,nodeIds:t.anchor.nodeIds,frameId:t.anchor.frameId,status:t.status,text:t.messages.at(-1)!.text.slice(0,240),textTruncated:t.messages.at(-1)!.text.length>240})),next:'codaru comments --id ID devuelve contexto del ancla; subscribeComments entrega hooks al IDE.'},
    identity:p.identityLab?{brief:{intent:p.identityLab.brief.intent.slice(0,600),qualities:p.identityLab.brief.qualities.slice(0,10).map(s=>s.slice(0,240)),avoid:p.identityLab.brief.avoid.slice(0,10).map(s=>s.slice(0,240))},counts:{references:p.identityLab.references.length,directions:p.identityLab.directions.length,critiques:p.identityLab.critiques.length,decisions:p.identityLab.decisions.length,refinements:p.identityLab.refinements.length},directions:p.identityLab.directions.map(d=>({id:d.id,name:d.name,frameIds:d.frameIds,styleIds:d.styleIds,status:d.status,targetRevision:identityTargetRevision(p,d)})),issues:identityIssues(p).slice(0,100),next:'El JSON exportado contiene el laboratorio completo; aplica identity.* con expectedRevision.'}:null,
    styles:styleSummaries(p).map(style=>({...style,description:style.description.slice(0,160),...(style.description.length>160?{textTruncated:true}:{})})),styleGuidance,styleGuidanceTruncated,
    themes:Object.values(p.designThemes).map(t=>({id:t.id,name:t.name})),activeThemeId:p.activeThemeId,mode:p.theme,
    components:p.components.slice(0,100).map(c=>({id:c.id,name:c.name,masterId:c.masterId,...(c.set?{set:c.set,setName:c.setName,variant:c.variant}:{}),documented:!!c.doc,...(docStale(c)?{docStale:true}:{})})),...(p.components.length>100?{componentsTruncated:true}:{}),
    designSystem:p.designSystem?Object.fromEntries(Object.entries(p.designSystem).map(([k,v])=>[k,String(v).slice(0,600)])):null,...(designSystemStale(p)?{designSystemStale:true}:{}),
    docsToReview:[...(designSystemStale(p)?['designSystem']:[]),...p.components.filter(docStale).map(c=>c.id)],
    nodes,flows:flows.slice(0,100),flowsTruncated:flows.length>100,truncated,
    next:truncated?'Acota con codaru context --scope ID --depth 1.':'Usa los IDs y revision de este contexto en codaru apply. Consulta codaru schema o codaru catalog para descubrir operaciones y recursos.'});
  // Snapshot only the bounded response before yielding, never copy every embedded image/source.
  result.revision = await revisionPromise; return result;
}

export const agentSchema = {
  protocol:'codaru-agent/1',transport:'CLI local conectado a la aplicación abierta',
  experience:{read:'codaru experience [--ids ID,ID] [--frame ID]: contratos, instrumentación y plan de pruebas',scope:'getExperienceReport({ids,frameId}); revision del documento, hallazgos por capa y verificaciones manuales',runtime:'El IDE implementa accesibilidad, test IDs y envío de eventos. Codaru no registra uso ni incluye proveedores.'},
  workflow:['codaru context: leer selección, pantallas, vínculos y revision','codaru find --query TEXTO [--page ID] [--type TIPO]: localizar elementos por nombre o texto sin leer todo el contexto','codaru catalog --kind kits|icons: descubrir recursos por id','codaru apply --file cambios.json --dry-run: validar sin modificar; errors lista cada operación que falla con índice, campo y valor esperado','codaru apply --file cambios.json: aplicar un lote atómico y recibir contexto actualizado','codaru lint [--frame ID] [--page ID]: revisar contraste en claro y oscuro, zonas táctiles, recortes, área segura, pliegue y coherencia; corregir y repetir','codaru export --format svg --frame ID --output vista.svg: revisar visualmente; JSON/HTML también disponibles','codaru export --format assets --ids ID --platform all --output assets.zip: exportar una pieza para iOS y Android (SVG fuente + PNG por densidad); png y svg también admiten --ids'],
  components:{composition:'Una definición puede contener instancias de otras definiciones; no maestros anidados. Las referencias cíclicas se rechazan antes de confirmar.',editing:'Edita propiedades y variantes en cada instancia. Para añadir o quitar capas, edita el maestro. Desvincular una instancia exterior conserva los componentes interiores.',identity:'Los IDs se conservan al propagar cambios; los textos y estilos locales prevalecen sobre los heredados.'},
  implementation:{binding:'component.implementation.set {componentId,platform,reference:{symbol,path?,module?}}; reference:null desvincula. Máximo 16 plataformas por definición.',context:'Cada nodo devuelto resuelve el componente más cercano. implementation incluye solo sus referencias, sin código fuente. Las instancias y los slots siguen su definición actual.',navigation:'El host configura onImplementationRequest; Abrir implementación emite la intención. El CLI no abre ni lee archivos de código.'},
  resources:{discovery:'catalog --kind resources [--query TEXTO]: candidatos del documento y biblioteca del IDE, con estado, revision e IDs de origen. Máximo 100; respeta truncated.',approval:'No existe una operación JSON que apruebe. El host proporciona compilación, renders PNG reales y un evaluador IA. Un cambio de fuente, SVG, uso o animación invalida el dictamen.',export:'export --resource ID --format svg|png|assets|aru --output ARCHIVO. SVG/PNG/ZIP requieren aprobación. El fuente ARU puede descargarse para corregirlo.'},
  illustration:{authoring:'ARU 0.7.0 es un helper opcional. Crea el fuente .aru; codaru-aru fuente.aru --out recurso.aru.codaru.json compila SVG estático y conserva el fuente.',import:'aru {data:{format:codaru-aru/1,source,svg,filename},id?,parentId?,x?,y?,width?}; con id existente actualiza el vector.',context:'illustration contiene nombre y tamaño del fuente; layers contiene los IDs animables. Consulta ARU context para la jerarquía original. SVG saneado; CSS, filtros y scripts de ARU no se ejecutan.',animation:'Usa animate con targets de layers. Los IDs generados dependen del orden del SVG: tras redibujar revisa los targets. Presentar/HTML reproducen; SVG/PNG/ZIP son estáticos.',source:'export --format aru --ids ID --output archivo.aru. onIllustrationRequest delega la edición al IDE; el host aplica el resultado con revision actual.'},
  localization:{catalog:'codaru catalog --kind texts --query PREFIJO',locale:'codaru locale [IDIOMA|source]: vista previa, no modifica el documento',binding:'update {id,patch:{textKey:CLAVE}}; text conserva el respaldo; null desvincula. El IDE es dueño de las traducciones.'},
  export:{format:'json|html|svg|png|assets|aru',ids:'IDs de un elemento, grupo o selección; sin ids usa la selección actual para assets/PNG',frame:'Pantalla (SVG anterior)',platform:'ios|android|all (assets)',name:'Nombre del recurso; se normaliza para ambas plataformas',width:'Ancho lógico pt/dp opcional',padding:'Margen transparente adicional 0..1024',scale:'PNG: 0.25..4',output:'PNG/ZIP: archivo local obligatorio en CLI; no imprime base64'},
  apply:{expectedRevision:'revision devuelta por context',operations:[
    {op:'component.property.define',componentId:'ID',key:'titulo',property:{type:'text',targetId:'ID_CAPA_MAESTRO',label:'Título'}},
    {op:'component.property.remove',componentId:'ID',key:'titulo'},
    {op:'component.property.set',id:'ID de maestro o instancia',key:'titulo',value:'Mi proyecto'},{op:'add',node:{id:'screen-example',type:'frame',name:'Inicio',x:80,y:80,width:390,height:844}},{op:'icon',pack:'web',name:'home',parentId:'screen-example',x:24,y:24,size:24}]},
  stylePackages:{format:'codaru-style/1',import:'style.import {data:paquete}',apply:'style.apply {id,frameId?,mode?}: aplica tokens; conserva geometría y controles',discover:'catalog --kind styles --kit ID devuelve tokens y guías independientes para móvil, composición y controles. ARU recibe paleta e instrucciones; no registra este estilo automáticamente.'},
  operations:{
    'style.import':{data:'DesignStylePackage codaru-style/1 con theme y guidance; sin scripts ni plantillas de layout'},
    'style.apply':{id:'ID de estilo importado',frameId:'Pantalla opcional; sin ella cambia el tema del proyecto',mode:'light|dark opcional'},
    'experience.set':{id:'ID de capa; hereda del maestro y permite sobrescrituras locales',spec:'{accessibility?:{role,name,nameKey,description,decorative,keyboard,focus,focusOrder,live,reducedMotion,states},analytics?:[{name,trigger:press|view|change|submit|success|failure,purpose,consent:required|not-required,properties?:{key:{type:string|number|boolean,source,sensitive?}}}],testId?,acceptance?:string[]}; null elimina. No incluye valores de usuario ni envía datos.'},
    'component.implementation.set':{componentId:'ID de definición',platform:'Clave a-z, dígitos y guion; 1..32 caracteres, por ejemplo ios, android, web',reference:'{symbol:1..200 caracteres,path?:ruta relativa al workspace hasta 512 caracteres,module?:paquete o módulo hasta 200 caracteres}; null elimina la referencia. No URLs, rutas absolutas ni ..'},
    'component.property.define':{componentId:'ID',key:'Clave estable de hasta 64 caracteres; hasta 32 propiedades',property:'{type:text|icon|visibility|variant|slot,targetId:ID de capa del maestro,label,axis?:eje para variante anidada,allowedComponents?:IDs permitidos para slot (1..32)}'},
    'component.property.remove':{componentId:'ID',key:'Clave; elimina el control sin borrar valores ni sobrescrituras'},
    'component.property.set':{id:'Maestro o instancia',key:'Clave de context.properties',value:'Texto | {pack,name} | boolean | opción de variante | ID de componente permitido para slot; null restablece esta propiedad'},
    add:{node:'Partial<DesignNode> con type; id opcional, útil para referenciarlo en el mismo lote'},
    update:{id:'ID existente',patch:'propiedades; null quita vínculos de tokens. No id/type/componentId/instanceOf/componentKey/overrides'},
    remove:{ids:['ID']},component:{id:'ID de un elemento o grupo'},instance:{componentId:'ID de definición',parentId:'Pantalla, grupo o componente maestro; ID o null. Para cambiar la estructura de una instancia, edita su maestro.',x:0,y:0},
    kit:{kit:'ios|macos|android|linux|web',item:'id obtenido de catalog',parentId:'ID o null',x:24,y:24,variant:'default|selected|disabled'},
    icon:{pack:'mac|material|linux|web',name:'id obtenido de catalog',parentId:'ID o null',x:24,y:24,size:24,color:'@primary'},
    flow:{from:'ID de origen',to:'ID de pantalla destino o null',transition:'opcional {type:fade|slide-left|slide-right|slide-up|slide-down|scale|unfold|fold,duration:ms,easing}; null la quita. unfold/fold animan la bisagra de la pantalla que tenga fold'},
    aru:{data:'{format:codaru-aru/1,source,svg,filename}; preparar con codaru-aru',id:'opcional; si existe reemplaza vector conservando geometría y animaciones compatibles',parentId:'ID o null',x:32,y:32,width:'opcional',name:'opcional'},
    vector:{svg:'texto SVG; se sanea y cada forma recibe un id de capa',parentId:'ID o null',x:24,y:24,width:'opcional; conserva la proporción',name:'opcional',id:'opcional'},
    figma:{data:'contenido del archivo .figma.codaru.json que escribe el plugin de Figma; añade sus pantallas, componentes y tokens al documento'},
    dom:{data:'instantánea codaru-dom-snapshot v1 de una página web (scripts/snapshot.js del skill codaru-clone); añade la página como pantalla, con un tema derivado de sus colores y tipografías, y capas vinculadas a esos tokens'},
    'comment.create':{id:'ID nuevo',anchor:'Obtén captureCommentAnchor o codaru comments con selección; revisión de layout exacta',message:'{id,text,author:{name,kind:human|ai},at:ISO}'},
    'comment.reply':{id:'ID de hilo abierto',message:'{id,text,author:{name,kind:human|ai},at:ISO}'},
    'comment.status':{id:'ID de hilo',status:'open|resolved'},
    'comment.draft.put':{draft:'{id,threadId?,anchor,text,author}; borrador persistido sin hooks de publicación'},
    'comment.draft.remove':{id:'ID de borrador'},
    'comment.queue.add':{id:'ID de hilo abierto',messageId:'ID de crítica humana; se conserva el orden'},
    'comment.queue.remove':{id:'ID de hilo',messageId:'ID exacto en cola; no elimina mensajes'},
    'comment.queue.move':{id:'ID de hilo en cola',index:'Posición desde cero'},
    'identity.brief.set':{patch:'{intent,audience,context,qualities:[],avoid:[],constraints:[]}; campos opcionales, texto hasta4000, listas40 elementos'},
    'identity.reference.put':{reference:'{id,title,source,author?,community?,license?,kind:cultural|visual|material|other,observations,interpretation?,status:proposed|accepted}'},
    'identity.reference.remove':{id:'ID; conserva el historial y señala referencias ausentes'},
    'identity.direction.put':{direction:'{id,name,intent,frameIds:[],styleIds:[],referenceIds?:[],status:exploring|selected|archived,proposal?}; IDs existentes, propuesta nunca altera geometría'},
    'identity.direction.remove':{id:'ID; conserva decisiones y críticas con aviso de dirección ausente'},
    'identity.decision.add':{decision:'{id,directionId?,criterion,observation,next,outcome:keep|revise|discard,author,at:ISO}; historial inmutable, añade otra para rectificar'},
    'identity.critique.add':{critique:'{id,directionId,targetRevision,summary,findings:[{criterion,assessment:pass|needs_work,reason,nodeIds:[]}],evaluator:{provider,model},evidence:[{revision:targetRevision,frameId,dataURL:PNG,width,height}]}; requiere renders reales de todas las pantallas; obtén targetRevision de context.identity.directions'},
    'identity.refinement.put':{refinement:'{id,directionId,nodeIds:[],instruction,targetRevision,proposal?,status:requested|proposed|resolved}; conserva propuesta sin aplicar cambios'},
    'designSystem.set':{summary:'qué es el producto, para quién y en qué negocio o nicho',brand:'por qué esta marca y esta dirección visual funcionan para ese producto',principles:'una regla por línea',color:'cómo se usa cada token y qué no se hace con el color',typography:'escala, jerarquía y usos de cada estilo',spacing:'escala de espaciado, márgenes y radios',motion:'cuándo se anima y cómo',voice:'tono y reglas de contenido; cada campo texto de hasta 4000 caracteres, null lo borra. Es la pestaña Sistema'},
    'component.doc':{componentId:'ID de definición (en un conjunto se documenta el conjunto entero); un patch vacío {} marca la ficha como revisada tras un cambio',description:'qué es y qué hace, una frase',why:'por qué este y no otro parecido',when:'cuándo usarlo y cuándo no',how:'cómo se usa: opciones, contenido, comportamiento',do:'buenas prácticas, una por línea; termina una línea con [ejemplo: ID] para mostrar esa capa del documento al lado',dont:'malas prácticas, una por línea, mismo [ejemplo: ID]'},
    'component.remove':{componentId:'ID de definición sin instancias; la elimina junto con su maestro (y el contenedor de variantes si queda vacío). Con instancias se rechaza: sepáralas con detach o elimínalas antes'},
    page:{action:'create|rename|remove|move|activate',id:'ID de página',name:'para create y rename',index:'para move',moveTo:'para remove con contenido: página que recibe sus marcos'},
    'page.add':{name:'alias de page create',id:'opcional'},'page.rename':{id:'ID',name:'nuevo nombre'},'page.remove':{id:'ID de una página vacía'},'page.activate':{id:'ID'},'page.move':{id:'ID',index:'posición'},
    'version.save':{name:'nombre de la versión',note:'opcional; guarda una copia comprimida del diseño dentro del documento (máximo 30)'},'version.restore':{id:'ID de versión; sustituye el diseño por esa copia (reversible con undo) y conserva la lista de versiones'},'version.remove':{id:'ID de versión'},
    'variant.define':{componentId:'ID de definición',variant:'{eje:valor}; crea o amplía el conjunto de variantes de ese componente; los demás miembros reciben "Base" en los ejes nuevos',setName:'opcional, nombre del conjunto'},
    'variant.create':{componentId:'ID de definición existente',variant:'{eje:valor} de la variante nueva: duplica el maestro junto al original como otra definición del mismo conjunto'},
    'variant.switch':{id:'ID de instancia',variant:'{eje:valor}; cambia la instancia a la variante que coincida y conserva sus sobrescrituras por nombre de capa. En kits, Estado: Normal|Seleccionado|Deshabilitado'},
    animate:{id:'ID del elemento',animations:'lista completa que reemplaza la anterior; [] o null las quita'},group:{ids:['ID1','ID2']},ungroup:{id:'ID de grupo'},detach:{id:'ID de instancia'},
    theme:{theme:'Perfil completo {id,name,modes:{light:TokenSet,dark:TokenSet}}'},'theme.activate':{id:'ID de tema',mode:'light|dark (opcional)'},
  },
  node:{types:['frame','group','rect','ellipse','text','button','input','card','image','icon','vector (usa la operación vector)'],geometry:['parentId','x','y','width','height'],text:['text','textKey: clave del catálogo del IDE; null desvincula y conserva text','fontSize','fontWeight','fontFamily','lineHeight','textAlign'],style:['fill','color','stroke','strokeWidth','radius','opacity','shadow','gradient','gradientEnd','gradientAngle','gradientStops: [{color,position:0..100}] de 2 a 16 paradas; null vuelve a fill + gradientEnd'],tokens:['fillToken','materialToken','typographyToken','radiusToken','themeId','themeMode'],pages:['page: id de página, solo en nodos raíz','role: screen|annotation|library, solo en marcos raíz; por omisión screen si tiene device'],layout:['layout: free|vertical|horizontal','padding','paddingSides: {top,right,bottom,left} o null','gap','justify: start|center|end|between','align: stretch|start|center|end','wrap','hugWidth','hugHeight','sizing: fixed|fill (del hijo)','minWidth','maxWidth','minHeight','maxHeight'],visibility:['hidden','locked'],icons:['iconPack','iconName'],navigation:['targetId','transition'],screen:['device: id de devices','fold: {axis:vertical|horizontal,gap:0..200,panels:2|3} o null; solo pantallas (3 = tríptico con dos bisagras)','safeArea: {top,right,bottom,left} o null','skin: '+Object.keys(deviceSkins).join('|')+' o null','foldPair: id de la pantalla en la otra postura o null']},
  devices:devicePresets.map(d=>`${d.id} ${d.width}x${d.height}${d.fold?` pliegue ${d.fold.axis}${d.fold.panels===3?' x3':''}`:''}${d.approximate?' (aprox.)':''}`),
  motion:{note:'Las animaciones solo se reproducen en Presentar y en el HTML exportado; el lienzo y SVG son estáticos.',animation:{id:'único en el elemento',name:'texto',target:'id de capa de una ilustración (context lo lista en layers) o "" para el elemento entero',trigger:'load|click',duration:'1..20000 ms',delay:'0..20000 ms',easing:'linear|ease|ease-in|ease-out|ease-in-out|spring',iterations:'0 = infinito, hasta 100',alternate:'boolean',keyframes:'2..32 en orden creciente'},keyframe:{at:'0..100',x:'px',y:'px',scale:'0..20',rotate:'grados',opacity:'0..100',fill:'color',stroke:'color',draw:'0..100, parte visible del trazo',shine:'0..100, posición de un brillo de carga que cruza el elemento (no capas SVG)'}},
  tokens:{colors:'HEX, transparent o @alias',gradients:'{name,type:linear|radial,angle,stops:[{color,position:0..100}]}',materials:'{name,tint,opacity:0..100,blur:0..40,saturation:0..200,stroke,shadow:0..40}',typography:'{name,fontFamily:system|serif|mono,fontSize,fontWeight,lineHeight}',radii:'{id:number}'},
  slots:{binding:'Instancia directamente propiedad del maestro; un componente por espacio',default:'Contenido actual en el maestro',choices:'context.properties: type=slot, options y components {id,name}',constraints:'Solo IDs permitidos; se rechazan ciclos, pérdida de referencias y cambios de contrato con reemplazos incompatibles. Reutiliza component.property.define/set/remove.'},
  limits:{operationsPerBatch:250,contextNodes:100,contextDepth:4},
  guarantees:['No se ejecuta JavaScript recibido','Cada lote es una sola entrada de Deshacer','Una revision antigua se rechaza sin modificar el documento','El documento permanece en el borrador local; exporta JSON para conservar un archivo independiente'],
};

export function applyOperations(p: Project,operations: unknown) {
  if(!Array.isArray(operations)||!operations.length||operations.length>250)fail('operations debe contener entre 1 y 250 operaciones.');
  (operations as unknown[]).forEach((input,index)=>{
    const op=object(input),name=string(op.op,'op');
    try { applyOne(p,op,name); }
    catch(error){ const message=error instanceof Error?error.message:String(error); throw new AgentError(error instanceof AgentError?error.code:'validation_error',/^op \d+ /.test(message)?message:`op ${index} (${name}): ${message}`); }
  });
}
const COLOR=/^(?:#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8}|transparent|@[A-Za-z0-9][A-Za-z0-9_-]{0,127})$/i;
const ENUMS:Record<string,string[]>={layout:['free','vertical','horizontal'],sizing:['fixed','fill'],textAlign:['left','center','right'],fontFamily:['system','serif','mono'],gradient:['none','linear','radial'],justify:['start','center','end','between'],align:['stretch','start','center','end'],themeMode:['inherit','light','dark'],role:['screen','annotation','library']};
const NUMBERS=['x','y','width','height','strokeWidth','radius','radiusTR','radiusBR','radiusBL','opacity','gradientAngle','fontSize','fontWeight','lineHeight','padding','gap','minWidth','maxWidth','minHeight','maxHeight'];
/** Field-level checks so a rejected batch names the field and what it expected. */
function checkFields(fields:Record<string,unknown>,prefix:string){
  for(const [key,value] of Object.entries(fields)){
    if(value===undefined||value===null)continue;
    if(['fill','color','stroke','gradientEnd'].includes(key)&&(typeof value!=='string'||!COLOR.test(value)))fail(`${prefix}.${key} debe ser HEX, "transparent" o "@alias"; llegó ${JSON.stringify(value)}`);
    if(NUMBERS.includes(key)&&(typeof value!=='number'||!Number.isFinite(value)))fail(`${prefix}.${key} debe ser un número; llegó ${JSON.stringify(value)}`);
    if(ENUMS[key]&&(typeof value!=='string'||!ENUMS[key].includes(value)))fail(`${prefix}.${key} debe ser ${ENUMS[key].join('|')}; llegó ${JSON.stringify(value)}`);
    if(['text','textKey','name','image','svg','page','themeId','kitId','device','skin','iconPack','iconName'].includes(key)&&typeof value!=='string')fail(`${prefix}.${key} debe ser texto; llegó ${JSON.stringify(value)}`);
    if(['hidden','locked','shadow','wrap','hugWidth','hugHeight'].includes(key)&&typeof value!=='boolean')fail(`${prefix}.${key} debe ser true o false; llegó ${JSON.stringify(value)}`);
  }
}
function applyOne(p: Project,op: Record<string,unknown>,name: string) {
  if(name.startsWith('comment.')){applyCommentOperation(p,op as unknown as import('./contracts').CommentOperation);return;}
    switch(name){
      case 'identity.brief.set': case 'identity.reference.put': case 'identity.reference.remove': case 'identity.direction.put': case 'identity.direction.remove': case 'identity.decision.add': case 'identity.refinement.put': case 'identity.critique.add': applyIdentityOperation(p,op as unknown as import('./contracts').IdentityOperation);break;
      case 'aru': applyAruAsset(p,op as unknown as Extract<import('./contracts').EditorOperation,{op:'aru'}>);break;
      case 'add':{const draft={...object(op.node)},type=string(draft.type,'node.type') as Kind;checkFields(draft,'node');if(type==='frame'&&!draft.parentId&&draft.role===undefined&&draft.device===undefined)draft.role='screen';if(typeof draft.svg==='string')draft.svg=sanitizeSVG(draft.svg);p.nodes.push(node(type,draft as Partial<DesignNode>));break;}
      case 'experience.set':setExperience(p,string(op.id,'id'),op.spec===null?null:object(op.spec));break;
      case 'update':{const id=string(op.id,'id');existing(p,id);const patch={...object(op.patch)};checkFields(patch,'patch');for(const key of ['experience','aruSource','textKey','fillToken','materialToken','typographyToken','radiusToken','themeId','themeMode','radiusTR','radiusBR','radiusBL'])if(patch[key]===null)patch[key]=undefined;if(['id','type','componentId','instanceOf','componentKey','overrides'].some(key=>key in patch))fail('La estructura de componentes requiere operaciones explícitas.');if(typeof patch.svg==='string')patch.svg=sanitizeSVG(patch.svg);for(const key of ['transition','animations','gradientStops','device','fold','foldPair','safeArea','skin','paddingSides','justify','align','wrap','hugWidth','hugHeight','minWidth','maxWidth','minHeight','maxHeight'])if(patch[key]===null)patch[key]=undefined;updateNode(p,id,patch);break;}
      case 'remove':{const list=ids(op.ids);list.forEach(id=>existing(p,id));remove(p,list);break;}
      case 'component.implementation.set':setComponentImplementation(p,string(op.componentId,'componentId'),string(op.platform,'platform'),op.reference===null?null:object(op.reference) as unknown as ImplementationReference);break;
      case 'component.property.define':defineComponentProperty(p,string(op.componentId,'componentId'),string(op.key,'key'),object(op.property) as unknown as ComponentProperty);break;
      case 'component.property.remove':removeComponentProperty(p,string(op.componentId,'componentId'),string(op.key,'key'));break;
      case 'component.property.set':setComponentProperty(p,string(op.id,'id'),string(op.key,'key'),op.value as ComponentPropertyValue|null);break;
      case 'component':createComponent(p,string(op.id,'id'));break;
      case 'instance':instantiate(p,string(op.componentId,'componentId'),parent(op.parentId),number(op.x,0),number(op.y,0));break;
      case 'kit':insertKitItem(p,string(op.kit,'kit') as KitId,string(op.item,'item'),parent(op.parentId),number(op.x,0),number(op.y,0),(op.variant??'default') as KitVariant);break;
      case 'icon':{const id=insertIcon(p,string(op.pack,'pack'),string(op.name,'name'),parent(op.parentId),number(op.x,0),number(op.y,0),number(op.size,24));if(op.color!==undefined)updateNode(p,id,{color:string(op.color,'color')});break;}
      case 'flow':{const id=string(op.from,'from');existing(p,id);updateNode(p,id,{targetId:op.to===null?null:string(op.to,'to'),...(op.transition!==undefined?{transition:op.transition===null?undefined:object(op.transition) as unknown as DesignNode['transition']}:{})});break;}
      case 'vector':{const svg=sanitizeSVG(string(op.svg,'svg')),size=vectorSize(svg),width=op.width===undefined?Math.min(size.width,320):number(op.width,160);p.nodes.push(node('vector',{...(op.id!==undefined?{id:string(op.id,'id')}:{}),name:op.name===undefined?'Ilustración':string(op.name,'name'),parentId:parent(op.parentId),x:number(op.x,0),y:number(op.y,0),width,height:Math.max(1,Math.round(width*size.height/size.width*100)/100),svg}));break;}
      case 'figma':importFigma(p,object(op.data));break;
      case 'dom':importDOM(p,object(op.data));break;
      case 'animate':{const id=string(op.id,'id');existing(p,id);updateNode(p,id,{animations:op.animations===null||(Array.isArray(op.animations)&&!op.animations.length)?undefined:op.animations as DesignNode['animations']});break;}
      case 'group':group(p,ids(op.ids));break;
      case 'ungroup':{const id=string(op.id,'id');existing(p,id);ungroup(p,id);break;}
      case 'detach':{const id=string(op.id,'id');existing(p,id);detach(p,id);break;}
      case 'designSystem.set':{const {op:_name,notes,...rest}=op;setDesignSystemNotes(p,object(notes??rest));break;}
      case 'component.doc':{const {op:_name,componentId,doc,...rest}=op;setComponentDoc(p,string(componentId,'componentId'),object(doc??rest));break;}
      case 'component.remove':removeComponent(p,string(op.componentId,'componentId'));break;
      case 'page':{const action=string(op.action,'action');if(action==='create')addPage(p,string(op.name,'name'),op.id===undefined?undefined:string(op.id,'id'));else if(action==='rename')renamePage(p,string(op.id,'id'),string(op.name,'name'));else if(action==='remove')removePage(p,string(op.id,'id'),op.moveTo===undefined?undefined:string(op.moveTo,'moveTo'));else if(action==='move')movePage(p,string(op.id,'id'),number(op.index,0));else if(action==='activate'){const id=string(op.id,'id');if(!pagesOf(p).some(page=>page.id===id))fail('Página no encontrada.');p.activePageId=id;}else fail('action debe ser create, rename, remove, move o activate.');break;}
      case 'page.add':addPage(p,string(op.name,'name'),op.id===undefined?undefined:string(op.id,'id'));break;
      case 'page.rename':renamePage(p,string(op.id,'id'),string(op.name,'name'));break;
      case 'page.remove':removePage(p,string(op.id,'id'),op.moveTo===undefined?undefined:string(op.moveTo,'moveTo'));break;
      case 'page.activate':{const id=string(op.id,'id');if(!pagesOf(p).some(page=>page.id===id))fail('Página no encontrada.');p.activePageId=id;break;}
      case 'page.move':movePage(p,string(op.id,'id'),number(op.index,0));break;
      case 'version.push':addVersion(p,op.version as Version);break;
      case 'version.apply':applyVersion(p,object(op.payload) as Partial<Project>);break;
      case 'version.remove':removeVersion(p,string(op.id,'id'));break;
      case 'version.save':case 'version.restore':fail('Las operaciones de versión se resuelven antes del lote; usa codaru apply.');break;
      case 'variant.define':defineVariant(p,string(op.componentId,'componentId'),object(op.variant) as Record<string,string>,op.setName===undefined?undefined:string(op.setName,'setName'));break;
      case 'variant.create':createVariant(p,string(op.componentId,'componentId'),object(op.variant) as Record<string,string>);break;
      case 'variant.switch':{const id=string(op.id,'id');existing(p,id);const inst=p.nodes.find(n=>n.id===id)!,c=p.components.find(c=>c.id===inst.instanceOf);const values=object(op.variant) as Record<string,string>;if(c?.set)ensureKitVariant(p,c.set,{...(c.variant??{}),...values});switchVariant(p,id,values);break;}
      case 'theme':{const theme=clone(object(op.theme)) as unknown as DesignTheme;const id=string(theme.id,'theme.id');if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)||['constructor','prototype','__proto__'].includes(id))fail('ID de tema inválido.');p.designThemes[id]=theme;if(id==='project')for(const m of ['light','dark'] as const)for(const key of tokens)p.themes[m][key]=theme.modes[m].colors[key];break;}
      case 'style.import':importStylePackage(p,op.data);break;
      case 'style.apply':applyStylePackage(p,string(op.id,'id'),op.frameId===undefined?undefined:string(op.frameId,'frameId'),op.mode as Project['theme']|undefined);break;
      case 'theme.activate':p.activeThemeId=string(op.id,'id');if(op.mode!==undefined)p.theme=string(op.mode,'mode') as Project['theme'];break;
      default:fail(`Operación desconocida: ${name}. Consulta codaru schema.`);
    }
}

export async function handleAgentRequest(host: AgentHost,request: AgentRequest):Promise<Record<string,unknown>> {
  try {
    const params=object(request.params??{});
    if(request.command==='schema')return {ok:true,...agentSchema};
    if(request.command==='context')return {ok:true,context:await context(host,params)};
    if(request.command==='experience'){const p=host.project();return {ok:true,revision:await revision(p),report:experienceReport(p,{...(params.ids!==undefined?{ids:ids(params.ids)}:{}),...(params.frame!==undefined?{frameId:string(params.frame,'frame')}:{})}),next:'experience.set con expectedRevision. El IDE conecta estos contratos a implementación y pruebas; no es una certificación ni analítica en ejecución.'};}
    if(request.command==='comments'){const p=host.project();return {ok:true,revision:await revision(p),...(params.id?{context:getCommentContext(p,string(params.id,'id'))}:{threads:clone(p.comments?.threads??[]),drafts:clone(p.comments?.drafts??[]),queue:clone(p.comments?.queue??[]),anchor:host.selection().length?(()=>{try{return captureCommentAnchor(p,host.selection());}catch{return null;}})():null}),next:'comment.create/reply/status mediante apply con expectedRevision. El IDE recibe hooks con subscribeComments; no hay modelo integrado.'};}
    if(request.command==='locale'){
      if(params.locale!==undefined){
        if(host.busy())throw new AgentError('editor_busy','Termina la interacción antes de cambiar el idioma.');
        if(!host.setLocale)fail('Este host no ofrece un selector de idioma.');
        host.setLocale!(params.locale===null?null:string(params.locale,'locale'));
      }
      return {ok:true,localization:host.localizationState?.()??localizationState(host.localization?.()??null),next:'Los catálogos los proporciona el IDE. Descubre claves con catalog --kind texts. Cambia textKey mediante apply; locale no modifica el documento.'};
    }
    if(request.command==='catalog'){
      const kind=params.kind??'all',query=String(params.query??'').toLocaleLowerCase(),kit=params.kit;
      if(kind==='styles'){
        const p=host.project(), rows=styleSummaries(p).filter(s=>`${s.id} ${s.name} ${s.description}`.toLocaleLowerCase().includes(query));
        if (typeof kit==='string') { const style=p.stylePackages?.[kit]; if (!style) fail('Estilo no encontrado.'); return {ok:true,style:clone(style),next:'style.apply importa tokens a una pantalla. La composición se diseña siguiendo guidance; no hay layouts fijos. aru contiene solo paleta y guías, no una instalación en ARU.'}; }
        return {ok:true,styles:rows,next:'Usa --kit ID para leer tokens y guías. Importa codaru-style/1 con style.import; aplica tokens con style.apply.'};
      }
      if(kind==='resources'){
        if (!host.resourceLibrary) fail('Este host no ofrece una biblioteca de recursos.');
        const rows=(await host.resourceLibrary!()).filter(r=>`${r.id} ${r.name} ${r.purpose} ${r.tags.join(' ')}`.toLocaleLowerCase().includes(query));
        return {ok:true,resources:rows.slice(0,100),truncated:rows.length>100,next:rows.length>100?'Acota con --query.':'Solo los aprobados se reutilizan desde la biblioteca. El IDE proporciona compilación ARU y evaluación visual por IA; export --resource ID --format svg|png|assets|aru.'};
      }
      if(kind==='texts'){
        const config=host.localization?.()??null, keys=[...new Set(Object.values(config?.messages??{}).flatMap(entries=>Object.keys(entries)))].filter(key=>key.toLocaleLowerCase().includes(query)).sort();
        return {ok:true,localization:host.localizationState?.()??localizationState(config),keys:keys.slice(0,100).map(key=>{const value=resolveText({text:'',textKey:key},config);return {key,text:value.text.slice(0,160),source:value.source,missing:value.missing,...(value.text.length>160?{textTruncated:true}:{})};}),truncated:keys.length>100,next:keys.length>100?'Acota con --query prefijo.':'Vincula una clave con update {id,patch:{textKey:CLAVE}}. Los archivos de traducción pertenecen al IDE.'};
      }
      if(!['all','kits','icons'].includes(String(kind)))fail('kind debe ser kits, icons, texts, resources, styles o all.');
      if(kit!==undefined&&!kits.some(k=>k.id===kit)&&!iconPacks.some(k=>k.id===kit))fail('Kit desconocido. Consulta codaru catalog.');
      if(!kit&&!query)return {ok:true,kits:kind==='icons'?undefined:kits.map(k=>({...k,count:getKitItems(k.id).length})),icons:kind==='kits'?undefined:iconPacks.map(k=>({...k,count:getIconItems(k.id).length})),next:'Añade --kit ID para ver los elementos; --query TEXTO filtra por nombre.'};
      return {ok:true,...(kind!=='icons'?{kits:kits.filter(k=>!kit||k.id===kit).map(k=>({...k,items:getKitItems(k.id).filter(i=>`${i.id} ${i.name} ${i.category}`.toLocaleLowerCase().includes(query))}))}:{}),...(kind!=='kits'?{icons:iconPacks.filter(k=>!kit||k.id===kit).map(k=>({...k,items:getIconItems(k.id).filter(i=>`${i.id} ${i.name} ${i.tags.join(' ')}`.toLocaleLowerCase().includes(query))}))}:{})};
    }
    if(request.command==='find'){
      const p=host.project(),query=String(params.query??'').trim().toLocaleLowerCase();if(!query)fail('find requiere query.');
      const limit=Math.max(1,Math.min(200,number(params.limit,50))),type=params.type===undefined?undefined:string(params.type,'type'),page=params.page===undefined?undefined:string(params.page,'page'),frame=params.frame===undefined?undefined:existing(p,string(params.frame,'frame')).id;
      const scopeNodes=page?pageView(p,page).nodes:p.nodes,tops=rootIds(p),pageOf=(n:DesignNode)=>{const root=p.nodes.find(x=>x.id===tops.get(n.id));return root?.page??pagesOf(p)[0].id;};
      const hits=scopeNodes.filter(n=>(!type||n.type===type)&&(!frame||n.id===frame||frameOf(p,n.id)?.id===frame)&&(n.name.toLocaleLowerCase().includes(query)||(n.text??'').toLocaleLowerCase().includes(query)||(n.textKey??'').toLocaleLowerCase().includes(query))).slice(0,limit);
      return {ok:true,query,count:hits.length,results:hits.map(n=>({id:n.id,name:n.name,type:n.type,frame:frameOf(p,n.id)?.id??null,page:pageOf(n),...(n.text?{text:n.text.slice(0,120)}:{})})),next:hits.length?'Usa los ids en codaru apply; context --scope ID para ver un elemento.':'Prueba otra palabra o sin frame/page.'};
    }
    if(request.command==='lint'){
      const p=host.project(),frame=params.frame===undefined?undefined:existing(p,string(params.frame,'frame')).id,page=params.page===undefined?undefined:string(params.page,'page');if(page!==undefined&&!pagesOf(p).some(x=>x.id===page))fail('Página no encontrada.');const issues=lintProject(p,{frame,page});
      return {ok:true,revision:await revision(p),summary:lintSummary(issues),issues:issues.slice(0,200),...(issues.length>200?{truncated:true}:{}),rules:lintRules,next:'Corrige con codaru apply usando node y fix de cada hallazgo; vuelve a ejecutar codaru lint para comprobar.'};
    }
    if(request.command==='export'){
      if (params.resource !== undefined) {
        if (params.ids !== undefined || params.frame !== undefined || params.page !== undefined) fail('resource no se combina con ids, frame o page.');
        if (!host.resource || !host.exportResource) fail('Este host no ofrece exportación de biblioteca.');
        const id=string(params.resource,'resource'), resource=await host.resource!(id); if (!resource) fail('Recurso no encontrado. Consulta catalog --kind resources.');
        if (params.format==='aru') { const source=resource!.resource.source; if (!source) fail('El recurso no tiene fuente ARU.'); return {ok:true,format:'aru',filename:source!.filename,mime:'text/plain',encoding:'utf8',content:source!.text,revision:resource!.revision,status:resource!.status,next:'Fuente editable. Exportarlo para corregir no implica aprobación visual.'}; }
        if (!['svg','png','assets'].includes(String(params.format))) fail('Para recursos usa svg, png, assets o aru.');
        const exported=await host.exportResource!(id,{format:params.format as 'svg'|'png'|'assets',platform:params.platform as never,name:params.name as string|undefined,width:params.width as number|undefined,padding:params.padding as number|undefined,scale:params.scale as number|undefined});
        return {ok:true,...exported,revision:resource!.revision,status:'approved'};
      }
      const source=clone(host.project()),whole=params.format==='json'?source:clone(host.previewProject?.()??source),page=params.page===undefined?undefined:string(params.page,'page');if(page!==undefined&&!pagesOf(whole).some(x=>x.id===page))fail('Página no encontrada.');const p=page?pageView(whole,page):whole;const sourceRevision=await revision(page?pageView(source,page):source);let content:string;
      if (params.frame !== undefined && params.ids !== undefined) return fail('Usa frame o ids, no ambos.');
      if (params.format === 'aru') {
        if (host.busy()) throw new AgentError('editor_busy', 'Termina la interacción antes de exportar la fuente.');
        const targets = params.ids === undefined ? host.selection() : ids(params.ids);
        if (targets.length !== 1 || params.frame !== undefined) return fail('Selecciona una sola ilustración ARU.');
        const asset = existing(p,targets[0]).aruSource;
        if (!asset) return fail('La selección no tiene fuente ARU.');
        return {ok:true,format:'aru',filename:asset.filename,mime:'text/plain',content:asset.text,revision:sourceRevision};
      }
      if (params.format === 'assets' || params.format === 'png' || (params.format === 'svg' && params.frame === undefined)) {
        if (host.busy()) throw new AgentError('editor_busy', 'Termina la interacción antes de exportar assets.');
        const targets = params.ids === undefined ? params.frame === undefined ? host.selection() : [string(params.frame, 'frame')] : params.ids;
        const { exportAsset } = await import('./asset-export');
        const result = await exportAsset(p, { ids: targets as string[], format: params.format as 'svg' | 'png' | 'assets', platform: params.platform as never, name: params.name as string | undefined, width: params.width as number | undefined, padding: params.padding as number | undefined, scale: params.scale as number | undefined, theme: params.theme as never });
        return { ok: true, ...result, revision: sourceRevision, locale: host.localization?.()?.locale??null, next: result.format === 'assets' ? 'Descomprime el ZIP: importa el .imageset en Xcode o las carpetas drawable-* en Android. Conserva source/*.svg y revisa warnings.' : 'Asset estático exportado. Para obtener las densidades de iOS y Android, usa export --format assets con los mismos IDs. Revisa warnings.' };
      }
      if(params.format==='json')content=JSON.stringify(p,null,2);
      else if(params.format==='html')content=exportHTML(p);
      else if(params.format==='svg'){const frame=existing(p,string(params.frame,'frame'));if(frame.type!=='frame')fail('La exportación SVG requiere una pantalla.');content=exportSVG(p,frame);}
      else return fail('format debe ser json, html, svg, png, assets o aru.');
      return {ok:true,format:params.format,content,revision:sourceRevision,...(params.format!=='json'?{locale:host.localization?.()?.locale??null}:{})};
    }
    if(request.command==='versions'){const p=host.project(),list=(p.versions??[]).map(v=>({id:v.id,name:v.name,at:v.at,note:v.note,screens:v.screens,nodes:v.nodes,bytes:v.data.length}));if(typeof params.compare==='string'){const version=(p.versions??[]).find(v=>v.id===params.compare);if(!version)return fail('Versión no encontrada.');return {ok:true,versions:list,compare:{id:version.id,...compareVersion(p,await unpackVersion(version.data))}};}return {ok:true,versions:list};}
    if(!['apply','select','undo','redo'].includes(request.command))return fail('Comando desconocido. Ejecuta codaru --help.');
    if(host.busy())throw new AgentError('editor_busy','Termina la edición o cierra el diálogo del editor y vuelve a intentarlo.');
    if(request.command==='select'){const list=Array.isArray(params.ids)&&!params.ids.length?[]:ids(params.ids);list.forEach(id=>existing(host.project(),id));host.select(list);return {ok:true,context:await context(host)};}
    if(request.command==='undo'||request.command==='redo'){host[request.command]();return {ok:true,context:await context(host)};}
    const live=host.project(),before=live,currentRevision=await revision(before);
    if(params.expectedRevision!==currentRevision)throw new AgentError('revision_conflict','Falta expectedRevision o el documento cambió. Lee codaru context y prepara el lote con la nueva revision.');
    // Version operations need async (de)compression, so the batch runs in chunks on a draft: a version saved
    // mid-batch captures the operations before it, and the host still receives one atomic commit at the end.
    const draft=new Store(before);let pending:unknown[]=[];const flush=()=>{if(pending.length){const chunk=pending;pending=[];draft.commit(p=>applyOperations(p,chunk));}};
    if(!Array.isArray(params.operations)||!params.operations.length||params.operations.length>250)fail('operations debe contener entre 1 y 250 operaciones.');
    for(const raw of params.operations as unknown[]){
      const op=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
      if(op.op==='version.save'){flush();pending.push({op:'version.push',version:await buildVersion(draft.project,string(op.name,'name'),op.note===undefined?undefined:String(op.note))});continue;}
      if(op.op==='version.restore'){flush();const id=string(op.id,'id'),version=(draft.project.versions??[]).find(v=>v.id===id);if(!version)return fail('Versión no encontrada.');pending.push({op:'version.apply',payload:await unpackVersion(version.data)});continue;}
      pending.push(raw);
    }
    const prepared=draft.prepare(p=>applyOperations(p,pending));
    // The user may edit while the asynchronous hash is calculated.
    // Every commit produces a new document object, so identity tells whether the user edited meanwhile.
    if(host.project()!==live)throw new AgentError('revision_conflict','El documento cambió durante la validación. Lee codaru context y vuelve a intentarlo.');
    if(host.busy())throw new AgentError('editor_busy','El editor inició otra interacción. Termínala antes de aplicar el lote.');
    const after=prepared.getDocument(),beforeIds=new Set(before.nodes.map(n=>n.id)),afterIds=new Set(after.nodes.map(n=>n.id));
    const added=after.nodes.filter(n=>!beforeIds.has(n.id)),removed=before.nodes.filter(n=>!afterIds.has(n.id)).map(n=>n.id);
    const beforeById=new Map(before.nodes.map(n=>[n.id,n]));
    const updated=after.nodes.filter(n=>beforeIds.has(n.id)&&!sameData(n,beforeById.get(n.id))).map(n=>n.id);
    if(!params.dryRun) { if(host.commitPrepared)host.commitPrepared(prepared); else host.commit(p=>Object.assign(p,after)); }
    const focus=added.find(n=>n.type==='frame')??added.find(n=>!added.some(a=>a.id===n.parentId));
    const afterRevision=await revision(after);
    return {ok:true,dryRun:!!params.dryRun,baseRevision:currentRevision,revision:afterRevision,changes:{added:added.map(n=>({id:n.id,type:n.type,name:n.name})),updated,removed},context:await context(host,focus?{scope:focus.id,depth:2}:{},after,afterRevision)};
  } catch(error) {
    const params = request.params ?? {};
    if(request.command==='apply' && params.dryRun && Array.isArray(params.operations) && params.operations.length > 0 && params.operations.length <= 250 && !(error instanceof AgentError && ['revision_conflict','editor_busy'].includes(error.code))){
      // A dry run reports every failing operation, each checked on the batch as it stood before it.
      const errors:Array<{index:number;op:string;message:string}>=[];const draft=new Store(host.project());
      (params.operations as unknown[]).forEach((raw,index)=>{const name=raw&&typeof raw==='object'&&typeof (raw as Record<string,unknown>).op==='string'?String((raw as Record<string,unknown>).op):'?';if(name.startsWith('version.'))return;try{draft.commit(q=>applyOperations(q,[raw]));}catch(error){errors.push({index,op:name,message:(error instanceof Error?error.message:String(error)).replace(/^op \d+ \([^)]*\): /,'')});}});
      if(errors.length)return {ok:false,dryRun:true,error:{code:'validation_error',message:`${errors.length} ${errors.length===1?'operación falla':'operaciones fallan'}: ${errors.map(e=>`op ${e.index} (${e.op}): ${e.message}`).join(' · ')}`},errors,next:'Corrige cada operación indicada y vuelve a ejecutar apply.'};
    }
    return {ok:false,error:{code:error instanceof AgentError?error.code:'validation_error',message:error instanceof Error?error.message:String(error)},next:'codaru context para actualizar IDs/revision; codaru schema para ver el contrato.'};
  }
}
