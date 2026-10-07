import { Store, clone, node, updateNode, remove, createComponent, instantiate, group, ungroup, detach, children, tokens, defineVariant, createVariant, switchVariant, setDesignSystemNotes, setComponentDoc, removeComponent, docStale, designSystemStale, type Project, type DesignNode, type Kind, pagesOf, activePage, addPage, renamePage, removePage, movePage, buildVersion, addVersion, removeVersion, applyVersion, unpackVersion, compareVersion, type Version, pageView, roleOf, screens, frameRoles, type FrameRole, rootIds, frameOf, rootsOnPage } from './model';
import { effectiveTheme, type DesignTheme } from './themes';
import { kits, getKitItems, insertKitItem, ensureKitVariant, type KitId, type KitVariant } from './kits';
import { iconPacks, getIconItems, insertIcon } from './icon-library';
import { exportHTML, exportSVG } from './render';
import { sanitizeSVG, vectorLayers, vectorSize } from './motion';
import { devicePresets, deviceSkins } from './devices';
import { importFigma } from './figma-import';
import { importDOM } from './dom-import';
import { lintProject, lintRules, lintSummary } from './lint';

export interface AgentHost {
  project: () => Project;
  selection: () => string[];
  scope: () => string | null;
  busy: () => boolean;
  commit: (edit: (p: Project) => void) => void;
  select: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
}
export interface AgentRequest { command: string; params?: Record<string, unknown>; }
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
function describe(p: Project,n: DesignNode) {
  const theme=effectiveTheme(p,n);
  return {id:n.id,type:n.type,name:n.name,parentId:n.parentId,bounds:{x:n.x,y:n.y,width:n.width,height:n.height},
    ...(n.text?{text:n.text.slice(0,240),...(n.text.length>240?{textTruncated:true}:{})}:{}),
    ...(children(p,n.id).length?{childCount:children(p,n.id).length,layout:n.layout,padding:n.paddingSides??n.padding,gap:n.gap,...(n.justify?{justify:n.justify}:{}),...(n.align?{align:n.align}:{}),...(n.wrap?{wrap:true}:{}),...(n.hugWidth?{hugWidth:true}:{}),...(n.hugHeight?{hugHeight:true}:{})}:{}),
    appearance:{fill:n.fill,color:n.color,radius:n.radius,...(n.strokeWidth?{stroke:n.stroke,strokeWidth:n.strokeWidth}:{}),...(n.opacity!==100?{opacity:n.opacity}:{}),...(n.fillToken?{fillToken:n.fillToken}:{}),...(n.materialToken?{materialToken:n.materialToken}:{}),...(n.typographyToken?{typographyToken:n.typographyToken}:{}),...(n.radiusToken?{radiusToken:n.radiusToken}:{})},
    theme:{id:theme.id,mode:theme.mode},...(n.instanceOf?{instanceOf:n.instanceOf,...variantOf(p,n.instanceOf)}:{}),...(n.componentId?{componentId:n.componentId,...variantOf(p,n.componentId)}:{}),
    ...(n.targetId?{targetId:n.targetId,...(n.transition?{transition:n.transition}:{})}:{}),...(n.svg?layerSummary(n.svg):{}),...(n.device?{device:n.device}:{}),...(n.fold?{fold:n.fold}:{}),...(n.foldPair?{foldPair:n.foldPair}:{}),...(n.safeArea?{safeArea:n.safeArea}:{}),...(n.skin?{skin:n.skin}:{}),...(n.animations?.length?{animations:n.animations}:{}),...(n.iconPack?{icon:{pack:n.iconPack,name:n.iconName}}:{}),...(n.hidden?{hidden:true}:{}),...(n.locked?{locked:true}:{})};
}
export async function context(host: AgentHost,params: Record<string,unknown> = {},document=host.project()) {
  const p=clone(document), selection=host.selection().filter(id=>p.nodes.some(n=>n.id===id));
  const scope=typeof params.scope==='string'?params.scope:selection.length&&typeof params.page!=='string'?'selection':host.scope()&&typeof params.page!=='string'?host.scope()!:'workspace';
  const depth=Math.max(0,Math.min(4,number(params.depth,1)));
  let roots: DesignNode[];
  const page=typeof params.page==='string'?params.page:undefined;if(page!==undefined&&!pagesOf(p).some(x=>x.id===page))fail('Página no encontrada.');
  if(scope==='selection')roots=selection.map(id=>existing(p,id));
  else if(['workspace','document'].includes(scope))roots=page?rootsOnPage(p,page):children(p,null);
  else roots=[existing(p,scope)];
  const seen=new Set<string>(), nodes:ReturnType<typeof describe>[]=[], limit=100;
  let truncated=false;
  const visit=(n:DesignNode,level:number)=>{if(seen.has(n.id))return;if(nodes.length>=limit){truncated=true;return;}seen.add(n.id);nodes.push(describe(p,n));if(level<depth)for(const child of children(p,n.id))visit(child,level+1);};
  for(const root of roots)visit(root,0);
  const flows=p.nodes.filter(n=>n.targetId).map(n=>({from:n.id,to:n.targetId,trigger:'click',label:n.text||n.name}));
  return {revision:await revision(p),name:p.name,formatVersion:p.version,selection,selectionScope:host.scope(),scope,depth,
    coordinates:'Píxeles relativos al padre. Los frames raíz usan coordenadas del workspace.',busy:host.busy(),
    counts:{nodes:p.nodes.length,frames:p.nodes.filter(n=>n.type==='frame').length,components:p.components.length},
    pages:pagesOf(p).map(page=>{const view=pageView(p,page.id);return {id:page.id,name:page.name,frames:view.nodes.filter(n=>n.type==='frame'&&n.parentId===null).length,nodes:view.nodes.length};}),activePageId:activePage(p).id,versions:(p.versions??[]).map(v=>({id:v.id,name:v.name,at:v.at,note:v.note,screens:v.screens})),
    frames:p.nodes.filter(n=>n.type==='frame').map(n=>({id:n.id,name:n.name,themeId:effectiveTheme(p,n).id,mode:effectiveTheme(p,n).mode,page:n.parentId===null?(n.page??pagesOf(p)[0].id):undefined,role:roleOf(p,n)})),
    themes:Object.values(p.designThemes).map(t=>({id:t.id,name:t.name})),activeThemeId:p.activeThemeId,mode:p.theme,
    components:p.components.slice(0,100).map(c=>({id:c.id,name:c.name,masterId:c.masterId,...(c.set?{set:c.set,setName:c.setName,variant:c.variant}:{}),documented:!!c.doc,...(docStale(c)?{docStale:true}:{})})),...(p.components.length>100?{componentsTruncated:true}:{}),
    designSystem:p.designSystem?Object.fromEntries(Object.entries(p.designSystem).map(([k,v])=>[k,String(v).slice(0,600)])):null,...(designSystemStale(p)?{designSystemStale:true}:{}),
    docsToReview:[...(designSystemStale(p)?['designSystem']:[]),...p.components.filter(docStale).map(c=>c.id)],
    nodes,flows:flows.slice(0,100),flowsTruncated:flows.length>100,truncated,
    next:truncated?'Acota con codaru context --scope ID --depth 1.':'Usa los IDs y revision de este contexto en codaru apply. Consulta codaru schema o codaru catalog para descubrir operaciones y recursos.'};
}

export const agentSchema = {
  protocol:'codaru-agent/1',transport:'CLI local conectado a la aplicación abierta',
  workflow:['codaru context: leer selección, pantallas, vínculos y revision','codaru find --query TEXTO [--page ID] [--type TIPO]: localizar elementos por nombre o texto sin leer todo el contexto','codaru catalog --kind kits|icons: descubrir recursos por id','codaru apply --file cambios.json --dry-run: validar sin modificar; errors lista cada operación que falla con índice, campo y valor esperado','codaru apply --file cambios.json: aplicar un lote atómico y recibir contexto actualizado','codaru lint [--frame ID] [--page ID]: revisar contraste en claro y oscuro, zonas táctiles, recortes, área segura, pliegue y coherencia; corregir y repetir','codaru export --format svg --frame ID --output vista.svg: revisar visualmente; JSON/HTML también disponibles'],
  apply:{expectedRevision:'revision devuelta por context',operations:[{op:'add',node:{id:'screen-example',type:'frame',name:'Inicio',x:80,y:80,width:390,height:844}},{op:'icon',pack:'web',name:'home',parentId:'screen-example',x:24,y:24,size:24}]},
  operations:{
    add:{node:'Partial<DesignNode> con type; id opcional, útil para referenciarlo en el mismo lote'},
    update:{id:'ID existente',patch:'propiedades; null quita vínculos de tokens. No id/type/componentId/instanceOf/componentKey/overrides'},
    remove:{ids:['ID']},component:{id:'ID de un elemento o grupo'},instance:{componentId:'ID de definición',parentId:'ID o null',x:0,y:0},
    kit:{kit:'ios|macos|android|linux|web',item:'id obtenido de catalog',parentId:'ID o null',x:24,y:24,variant:'default|selected|disabled'},
    icon:{pack:'mac|material|linux|web',name:'id obtenido de catalog',parentId:'ID o null',x:24,y:24,size:24,color:'@primary'},
    flow:{from:'ID de origen',to:'ID de pantalla destino o null',transition:'opcional {type:fade|slide-left|slide-right|slide-up|slide-down|scale|unfold|fold,duration:ms,easing}; null la quita. unfold/fold animan la bisagra de la pantalla que tenga fold'},
    vector:{svg:'texto SVG; se sanea y cada forma recibe un id de capa',parentId:'ID o null',x:24,y:24,width:'opcional; conserva la proporción',name:'opcional',id:'opcional'},
    figma:{data:'contenido del archivo .figma.codaru.json que escribe el plugin de Figma; añade sus pantallas, componentes y tokens al documento'},
    dom:{data:'instantánea codaru-dom-snapshot v1 de una página web (scripts/snapshot.js del skill codaru-clone); añade la página como pantalla, con un tema derivado de sus colores y tipografías, y capas vinculadas a esos tokens'},
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
  node:{types:['frame','group','rect','ellipse','text','button','input','card','image','icon','vector (usa la operación vector)'],geometry:['parentId','x','y','width','height'],text:['text','fontSize','fontWeight','fontFamily','lineHeight','textAlign'],style:['fill','color','stroke','strokeWidth','radius','opacity','shadow','gradient','gradientEnd','gradientAngle','gradientStops: [{color,position:0..100}] de 2 a 16 paradas; null vuelve a fill + gradientEnd'],tokens:['fillToken','materialToken','typographyToken','radiusToken','themeId','themeMode'],pages:['page: id de página, solo en nodos raíz','role: screen|annotation|library, solo en marcos raíz; por omisión screen si tiene device'],layout:['layout: free|vertical|horizontal','padding','paddingSides: {top,right,bottom,left} o null','gap','justify: start|center|end|between','align: stretch|start|center|end','wrap','hugWidth','hugHeight','sizing: fixed|fill (del hijo)','minWidth','maxWidth','minHeight','maxHeight'],visibility:['hidden','locked'],icons:['iconPack','iconName'],navigation:['targetId','transition'],screen:['device: id de devices','fold: {axis:vertical|horizontal,gap:0..200,panels:2|3} o null; solo pantallas (3 = tríptico con dos bisagras)','safeArea: {top,right,bottom,left} o null','skin: '+Object.keys(deviceSkins).join('|')+' o null','foldPair: id de la pantalla en la otra postura o null']},
  devices:devicePresets.map(d=>`${d.id} ${d.width}x${d.height}${d.fold?` pliegue ${d.fold.axis}${d.fold.panels===3?' x3':''}`:''}${d.approximate?' (aprox.)':''}`),
  motion:{note:'Las animaciones solo se reproducen en Presentar y en el HTML exportado; el lienzo y SVG son estáticos.',animation:{id:'único en el elemento',name:'texto',target:'id de capa de una ilustración (context lo lista en layers) o "" para el elemento entero',trigger:'load|click',duration:'1..20000 ms',delay:'0..20000 ms',easing:'linear|ease|ease-in|ease-out|ease-in-out|spring',iterations:'0 = infinito, hasta 100',alternate:'boolean',keyframes:'2..32 en orden creciente'},keyframe:{at:'0..100',x:'px',y:'px',scale:'0..20',rotate:'grados',opacity:'0..100',fill:'color',stroke:'color',draw:'0..100, parte visible del trazo',shine:'0..100, posición de un brillo de carga que cruza el elemento (no capas SVG)'}},
  tokens:{colors:'HEX, transparent o @alias',gradients:'{name,type:linear|radial,angle,stops:[{color,position:0..100}]}',materials:'{name,tint,opacity:0..100,blur:0..40,saturation:0..200,stroke,shadow:0..40}',typography:'{name,fontFamily:system|serif|mono,fontSize,fontWeight,lineHeight}',radii:'{id:number}'},
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
    if(['text','name','image','svg','page','themeId','kitId','device','skin','iconPack','iconName'].includes(key)&&typeof value!=='string')fail(`${prefix}.${key} debe ser texto; llegó ${JSON.stringify(value)}`);
    if(['hidden','locked','shadow','wrap','hugWidth','hugHeight'].includes(key)&&typeof value!=='boolean')fail(`${prefix}.${key} debe ser true o false; llegó ${JSON.stringify(value)}`);
  }
}
function applyOne(p: Project,op: Record<string,unknown>,name: string) {
    switch(name){
      case 'add':{const draft={...object(op.node)},type=string(draft.type,'node.type') as Kind;checkFields(draft,'node');if(type==='frame'&&!draft.parentId&&draft.role===undefined&&draft.device===undefined)draft.role='screen';if(typeof draft.svg==='string')draft.svg=sanitizeSVG(draft.svg);p.nodes.push(node(type,draft as Partial<DesignNode>));break;}
      case 'update':{const id=string(op.id,'id');existing(p,id);const patch={...object(op.patch)};checkFields(patch,'patch');for(const key of ['fillToken','materialToken','typographyToken','radiusToken','themeId','themeMode','radiusTR','radiusBR','radiusBL'])if(patch[key]===null)patch[key]=undefined;if(['id','type','componentId','instanceOf','componentKey','overrides'].some(key=>key in patch))fail('La estructura de componentes requiere operaciones explícitas.');if(typeof patch.svg==='string')patch.svg=sanitizeSVG(patch.svg);for(const key of ['transition','animations','gradientStops','device','fold','foldPair','safeArea','skin','paddingSides','justify','align','wrap','hugWidth','hugHeight','minWidth','maxWidth','minHeight','maxHeight'])if(patch[key]===null)patch[key]=undefined;updateNode(p,id,patch);break;}
      case 'remove':{const list=ids(op.ids);list.forEach(id=>existing(p,id));remove(p,list);break;}
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
      case 'theme.activate':p.activeThemeId=string(op.id,'id');if(op.mode!==undefined)p.theme=string(op.mode,'mode') as Project['theme'];break;
      default:fail(`Operación desconocida: ${name}. Consulta codaru schema.`);
    }
}

export async function handleAgentRequest(host: AgentHost,request: AgentRequest):Promise<Record<string,unknown>> {
  try {
    const params=object(request.params??{});
    if(request.command==='schema')return {ok:true,...agentSchema};
    if(request.command==='context')return {ok:true,context:await context(host,params)};
    if(request.command==='catalog'){
      const kind=params.kind??'all',query=String(params.query??'').toLocaleLowerCase(),kit=params.kit;
      if(!['all','kits','icons'].includes(String(kind)))fail('kind debe ser kits, icons o all.');
      if(kit!==undefined&&!kits.some(k=>k.id===kit)&&!iconPacks.some(k=>k.id===kit))fail('Kit desconocido. Consulta codaru catalog.');
      if(!kit&&!query)return {ok:true,kits:kind==='icons'?undefined:kits.map(k=>({...k,count:getKitItems(k.id).length})),icons:kind==='kits'?undefined:iconPacks.map(k=>({...k,count:getIconItems(k.id).length})),next:'Añade --kit ID para ver los elementos; --query TEXTO filtra por nombre.'};
      return {ok:true,...(kind!=='icons'?{kits:kits.filter(k=>!kit||k.id===kit).map(k=>({...k,items:getKitItems(k.id).filter(i=>`${i.id} ${i.name} ${i.category}`.toLocaleLowerCase().includes(query))}))}:{}),...(kind!=='kits'?{icons:iconPacks.filter(k=>!kit||k.id===kit).map(k=>({...k,items:getIconItems(k.id).filter(i=>`${i.id} ${i.name} ${i.tags.join(' ')}`.toLocaleLowerCase().includes(query))}))}:{})};
    }
    if(request.command==='find'){
      const p=host.project(),query=String(params.query??'').trim().toLocaleLowerCase();if(!query)fail('find requiere query.');
      const limit=Math.max(1,Math.min(200,number(params.limit,50))),type=params.type===undefined?undefined:string(params.type,'type'),page=params.page===undefined?undefined:string(params.page,'page'),frame=params.frame===undefined?undefined:existing(p,string(params.frame,'frame')).id;
      const scopeNodes=page?pageView(p,page).nodes:p.nodes,tops=rootIds(p),pageOf=(n:DesignNode)=>{const root=p.nodes.find(x=>x.id===tops.get(n.id));return root?.page??pagesOf(p)[0].id;};
      const hits=scopeNodes.filter(n=>(!type||n.type===type)&&(!frame||n.id===frame||frameOf(p,n.id)?.id===frame)&&(n.name.toLocaleLowerCase().includes(query)||(n.text??'').toLocaleLowerCase().includes(query))).slice(0,limit);
      return {ok:true,query,count:hits.length,results:hits.map(n=>({id:n.id,name:n.name,type:n.type,frame:frameOf(p,n.id)?.id??null,page:pageOf(n),...(n.text?{text:n.text.slice(0,120)}:{})})),next:hits.length?'Usa los ids en codaru apply; context --scope ID para ver un elemento.':'Prueba otra palabra o sin frame/page.'};
    }
    if(request.command==='lint'){
      const p=host.project(),frame=params.frame===undefined?undefined:existing(p,string(params.frame,'frame')).id,page=params.page===undefined?undefined:string(params.page,'page');if(page!==undefined&&!pagesOf(p).some(x=>x.id===page))fail('Página no encontrada.');const issues=lintProject(p,{frame,page});
      return {ok:true,revision:await revision(p),summary:lintSummary(issues),issues:issues.slice(0,200),...(issues.length>200?{truncated:true}:{}),rules:lintRules,next:'Corrige con codaru apply usando node y fix de cada hallazgo; vuelve a ejecutar codaru lint para comprobar.'};
    }
    if(request.command==='export'){
      const whole=host.project(),page=params.page===undefined?undefined:string(params.page,'page');if(page!==undefined&&!pagesOf(whole).some(x=>x.id===page))fail('Página no encontrada.');const p=page?pageView(whole,page):whole;let content:string;
      if(params.format==='json')content=JSON.stringify(p,null,2);
      else if(params.format==='html')content=exportHTML(p);
      else if(params.format==='svg'){const frame=existing(p,string(params.frame,'frame'));if(frame.type!=='frame')fail('La exportación SVG requiere una pantalla.');content=exportSVG(p,frame);}
      else return fail('format debe ser json, html o svg.');
      return {ok:true,format:params.format,content,revision:await revision(p)};
    }
    if(request.command==='versions'){const p=host.project(),list=(p.versions??[]).map(v=>({id:v.id,name:v.name,at:v.at,note:v.note,screens:v.screens,nodes:v.nodes,bytes:v.data.length}));if(typeof params.compare==='string'){const version=(p.versions??[]).find(v=>v.id===params.compare);if(!version)return fail('Versión no encontrada.');return {ok:true,versions:list,compare:{id:version.id,...compareVersion(p,await unpackVersion(version.data))}};}return {ok:true,versions:list};}
    if(!['apply','select','undo','redo'].includes(request.command))return fail('Comando desconocido. Ejecuta codaru --help.');
    if(request.command==='apply'&&params.dryRun&&Array.isArray(params.operations)){
      // A dry run reports every failing operation, each checked on the batch as it stood before it.
      const errors:Array<{index:number;op:string;message:string}>=[];const draft=new Store(host.project());
      (params.operations as unknown[]).forEach((raw,index)=>{const name=raw&&typeof raw==='object'&&typeof (raw as Record<string,unknown>).op==='string'?String((raw as Record<string,unknown>).op):'?';if(name.startsWith('version.'))return;try{draft.commit(q=>applyOperations(q,[raw]));}catch(error){errors.push({index,op:name,message:(error instanceof Error?error.message:String(error)).replace(/^op \d+ \([^)]*\): /,'')});}});
      if(errors.length)return {ok:false,dryRun:true,error:{code:'validation_error',message:`${errors.length} ${errors.length===1?'operación falla':'operaciones fallan'}: ${errors.map(e=>`op ${e.index} (${e.op}): ${e.message}`).join(' · ')}`},errors,next:'Corrige cada operación indicada y vuelve a ejecutar apply.'};
    }
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
    flush();
    // The user may edit while the asynchronous hash is calculated.
    // Every commit produces a new document object, so identity tells whether the user edited meanwhile.
    if(host.project()!==live)throw new AgentError('revision_conflict','El documento cambió durante la validación. Lee codaru context y vuelve a intentarlo.');
    if(host.busy())throw new AgentError('editor_busy','El editor inició otra interacción. Termínala antes de aplicar el lote.');
    const after=draft.project,beforeIds=new Set(before.nodes.map(n=>n.id)),afterIds=new Set(after.nodes.map(n=>n.id));
    const added=after.nodes.filter(n=>!beforeIds.has(n.id)),removed=before.nodes.filter(n=>!afterIds.has(n.id)).map(n=>n.id);
    const updated=after.nodes.filter(n=>beforeIds.has(n.id)&&JSON.stringify(n)!==JSON.stringify(before.nodes.find(old=>old.id===n.id))).map(n=>n.id);
    if(!params.dryRun)host.commit(p=>Object.assign(p,after));
    const focus=added.find(n=>n.type==='frame')??added.find(n=>!added.some(a=>a.id===n.parentId));
    return {ok:true,dryRun:!!params.dryRun,baseRevision:currentRevision,revision:await revision(after),changes:{added:added.map(n=>({id:n.id,type:n.type,name:n.name})),updated,removed},context:await context(host,focus?{scope:focus.id,depth:2}:{},after)};
  } catch(error) {
    return {ok:false,error:{code:error instanceof AgentError?error.code:'validation_error',message:error instanceof Error?error.message:String(error)},next:'codaru context para actualizar IDs/revision; codaru schema para ver el contrato.'};
  }
}
