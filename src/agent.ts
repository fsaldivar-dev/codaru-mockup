import { Store, clone, node, updateNode, remove, createComponent, instantiate, group, ungroup, detach, children, tokens, type Project, type DesignNode, type Kind } from './model';
import { effectiveTheme, type DesignTheme } from './themes';
import { kits, getKitItems, insertKitItem, type KitId, type KitVariant } from './kits';
import { iconPacks, getIconItems, insertIcon } from './icon-library';
import { exportHTML, exportSVG } from './render';
import { sanitizeSVG, vectorLayers, vectorSize } from './motion';
import { devicePresets, deviceSkins } from './devices';
import { importFigma } from './figma-import';

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
function describe(p: Project,n: DesignNode) {
  const theme=effectiveTheme(p,n);
  return {id:n.id,type:n.type,name:n.name,parentId:n.parentId,bounds:{x:n.x,y:n.y,width:n.width,height:n.height},
    ...(n.text?{text:n.text.slice(0,240),...(n.text.length>240?{textTruncated:true}:{})}:{}),
    ...(children(p,n.id).length?{childCount:children(p,n.id).length,layout:n.layout,padding:n.padding,gap:n.gap}:{}),
    appearance:{fill:n.fill,color:n.color,radius:n.radius,...(n.strokeWidth?{stroke:n.stroke,strokeWidth:n.strokeWidth}:{}),...(n.opacity!==100?{opacity:n.opacity}:{}),...(n.fillToken?{fillToken:n.fillToken}:{}),...(n.materialToken?{materialToken:n.materialToken}:{}),...(n.typographyToken?{typographyToken:n.typographyToken}:{}),...(n.radiusToken?{radiusToken:n.radiusToken}:{})},
    theme:{id:theme.id,mode:theme.mode},...(n.instanceOf?{instanceOf:n.instanceOf}:{}),...(n.componentId?{componentId:n.componentId}:{}),
    ...(n.targetId?{targetId:n.targetId,...(n.transition?{transition:n.transition}:{})}:{}),...(n.svg?layerSummary(n.svg):{}),...(n.device?{device:n.device}:{}),...(n.fold?{fold:n.fold}:{}),...(n.foldPair?{foldPair:n.foldPair}:{}),...(n.safeArea?{safeArea:n.safeArea}:{}),...(n.skin?{skin:n.skin}:{}),...(n.animations?.length?{animations:n.animations}:{}),...(n.iconPack?{icon:{pack:n.iconPack,name:n.iconName}}:{}),...(n.hidden?{hidden:true}:{}),...(n.locked?{locked:true}:{})};
}
export async function context(host: AgentHost,params: Record<string,unknown> = {},document=host.project()) {
  const p=clone(document), selection=host.selection().filter(id=>p.nodes.some(n=>n.id===id));
  const scope=typeof params.scope==='string'?params.scope:selection.length?'selection':host.scope()??'workspace';
  const depth=Math.max(0,Math.min(4,number(params.depth,1)));
  let roots: DesignNode[];
  if(scope==='selection')roots=selection.map(id=>existing(p,id));
  else if(['workspace','document'].includes(scope))roots=children(p,null);
  else roots=[existing(p,scope)];
  const seen=new Set<string>(), nodes:ReturnType<typeof describe>[]=[], limit=100;
  let truncated=false;
  const visit=(n:DesignNode,level:number)=>{if(seen.has(n.id))return;if(nodes.length>=limit){truncated=true;return;}seen.add(n.id);nodes.push(describe(p,n));if(level<depth)for(const child of children(p,n.id))visit(child,level+1);};
  for(const root of roots)visit(root,0);
  const flows=p.nodes.filter(n=>n.targetId).map(n=>({from:n.id,to:n.targetId,trigger:'click',label:n.text||n.name}));
  return {revision:await revision(p),name:p.name,formatVersion:p.version,selection,selectionScope:host.scope(),scope,depth,
    coordinates:'Píxeles relativos al padre. Los frames raíz usan coordenadas del workspace.',busy:host.busy(),
    counts:{nodes:p.nodes.length,frames:p.nodes.filter(n=>n.type==='frame').length,components:p.components.length},
    frames:p.nodes.filter(n=>n.type==='frame').map(n=>({id:n.id,name:n.name,themeId:effectiveTheme(p,n).id,mode:effectiveTheme(p,n).mode})),
    themes:Object.values(p.designThemes).map(t=>({id:t.id,name:t.name})),activeThemeId:p.activeThemeId,mode:p.theme,
    nodes,flows:flows.slice(0,100),flowsTruncated:flows.length>100,truncated,
    next:truncated?'Acota con codaru context --scope ID --depth 1.':'Usa los IDs y revision de este contexto en codaru apply. Consulta codaru schema o codaru catalog para descubrir operaciones y recursos.'};
}

export const agentSchema = {
  protocol:'codaru-agent/1',transport:'CLI local conectado a la aplicación abierta',
  workflow:['codaru context: leer selección, pantallas, vínculos y revision','codaru catalog --kind kits|icons: descubrir recursos por id','codaru apply --file cambios.json --dry-run: validar sin modificar','codaru apply --file cambios.json: aplicar un lote atómico y recibir contexto actualizado','codaru export --format svg --frame ID --output vista.svg: revisar visualmente; JSON/HTML también disponibles'],
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
    animate:{id:'ID del elemento',animations:'lista completa que reemplaza la anterior; [] o null las quita'},group:{ids:['ID1','ID2']},ungroup:{id:'ID de grupo'},detach:{id:'ID de instancia'},
    theme:{theme:'Perfil completo {id,name,modes:{light:TokenSet,dark:TokenSet}}'},'theme.activate':{id:'ID de tema',mode:'light|dark (opcional)'},
  },
  node:{types:['frame','group','rect','ellipse','text','button','input','card','image','icon','vector (usa la operación vector)'],geometry:['parentId','x','y','width','height'],text:['text','fontSize','fontWeight','fontFamily','lineHeight','textAlign'],style:['fill','color','stroke','strokeWidth','radius','opacity','shadow','gradient','gradientEnd','gradientAngle','gradientStops: [{color,position:0..100}] de 2 a 16 paradas; null vuelve a fill + gradientEnd'],tokens:['fillToken','materialToken','typographyToken','radiusToken','themeId','themeMode'],layout:['layout','padding','gap','sizing'],visibility:['hidden','locked'],icons:['iconPack','iconName'],navigation:['targetId','transition'],screen:['device: id de devices','fold: {axis:vertical|horizontal,gap:0..200,panels:2|3} o null; solo pantallas (3 = tríptico con dos bisagras)','safeArea: {top,right,bottom,left} o null','skin: '+Object.keys(deviceSkins).join('|')+' o null','foldPair: id de la pantalla en la otra postura o null']},
  devices:devicePresets.map(d=>`${d.id} ${d.width}x${d.height}${d.fold?` pliegue ${d.fold.axis}${d.fold.panels===3?' x3':''}`:''}${d.approximate?' (aprox.)':''}`),
  motion:{note:'Las animaciones solo se reproducen en Presentar y en el HTML exportado; el lienzo y SVG son estáticos.',animation:{id:'único en el elemento',name:'texto',target:'id de capa de una ilustración (context lo lista en layers) o "" para el elemento entero',trigger:'load|click',duration:'1..20000 ms',delay:'0..20000 ms',easing:'linear|ease|ease-in|ease-out|ease-in-out|spring',iterations:'0 = infinito, hasta 100',alternate:'boolean',keyframes:'2..32 en orden creciente'},keyframe:{at:'0..100',x:'px',y:'px',scale:'0..20',rotate:'grados',opacity:'0..100',fill:'color',stroke:'color',draw:'0..100, parte visible del trazo',shine:'0..100, posición de un brillo de carga que cruza el elemento (no capas SVG)'}},
  tokens:{colors:'HEX, transparent o @alias',gradients:'{name,type:linear|radial,angle,stops:[{color,position:0..100}]}',materials:'{name,tint,opacity:0..100,blur:0..40,saturation:0..200,stroke,shadow:0..40}',typography:'{name,fontFamily:system|serif|mono,fontSize,fontWeight,lineHeight}',radii:'{id:number}'},
  limits:{operationsPerBatch:250,contextNodes:100,contextDepth:4},
  guarantees:['No se ejecuta JavaScript recibido','Cada lote es una sola entrada de Deshacer','Una revision antigua se rechaza sin modificar el documento','El documento permanece en el borrador local; exporta JSON para conservar un archivo independiente'],
};

export function applyOperations(p: Project,operations: unknown) {
  if(!Array.isArray(operations)||!operations.length||operations.length>250)fail('operations debe contener entre 1 y 250 operaciones.');
  for(const input of operations as unknown[]) {
    const op=object(input),name=string(op.op,'op');
    switch(name){
      case 'add':{const draft={...object(op.node)},type=string(draft.type,'node.type') as Kind;if(typeof draft.svg==='string')draft.svg=sanitizeSVG(draft.svg);p.nodes.push(node(type,draft as Partial<DesignNode>));break;}
      case 'update':{const id=string(op.id,'id');existing(p,id);const patch={...object(op.patch)};for(const key of ['fillToken','materialToken','typographyToken','radiusToken','themeId','themeMode','radiusTR','radiusBR','radiusBL'])if(patch[key]===null)patch[key]=undefined;if(['id','type','componentId','instanceOf','componentKey','overrides'].some(key=>key in patch))fail('La estructura de componentes requiere operaciones explícitas.');if(typeof patch.svg==='string')patch.svg=sanitizeSVG(patch.svg);for(const key of ['transition','animations','gradientStops','device','fold','foldPair','safeArea','skin'])if(patch[key]===null)patch[key]=undefined;updateNode(p,id,patch);break;}
      case 'remove':{const list=ids(op.ids);list.forEach(id=>existing(p,id));remove(p,list);break;}
      case 'component':createComponent(p,string(op.id,'id'));break;
      case 'instance':instantiate(p,string(op.componentId,'componentId'),parent(op.parentId),number(op.x,0),number(op.y,0));break;
      case 'kit':insertKitItem(p,string(op.kit,'kit') as KitId,string(op.item,'item'),parent(op.parentId),number(op.x,0),number(op.y,0),(op.variant??'default') as KitVariant);break;
      case 'icon':{const id=insertIcon(p,string(op.pack,'pack'),string(op.name,'name'),parent(op.parentId),number(op.x,0),number(op.y,0),number(op.size,24));if(op.color!==undefined)updateNode(p,id,{color:string(op.color,'color')});break;}
      case 'flow':{const id=string(op.from,'from');existing(p,id);updateNode(p,id,{targetId:op.to===null?null:string(op.to,'to'),...(op.transition!==undefined?{transition:op.transition===null?undefined:object(op.transition) as unknown as DesignNode['transition']}:{})});break;}
      case 'vector':{const svg=sanitizeSVG(string(op.svg,'svg')),size=vectorSize(svg),width=op.width===undefined?Math.min(size.width,320):number(op.width,160);p.nodes.push(node('vector',{...(op.id!==undefined?{id:string(op.id,'id')}:{}),name:op.name===undefined?'Ilustración':string(op.name,'name'),parentId:parent(op.parentId),x:number(op.x,0),y:number(op.y,0),width,height:Math.max(1,Math.round(width*size.height/size.width*100)/100),svg}));break;}
      case 'figma':importFigma(p,object(op.data));break;
      case 'animate':{const id=string(op.id,'id');existing(p,id);updateNode(p,id,{animations:op.animations===null||(Array.isArray(op.animations)&&!op.animations.length)?undefined:op.animations as DesignNode['animations']});break;}
      case 'group':group(p,ids(op.ids));break;
      case 'ungroup':{const id=string(op.id,'id');existing(p,id);ungroup(p,id);break;}
      case 'detach':{const id=string(op.id,'id');existing(p,id);detach(p,id);break;}
      case 'theme':{const theme=clone(object(op.theme)) as unknown as DesignTheme;const id=string(theme.id,'theme.id');if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)||['constructor','prototype','__proto__'].includes(id))fail('ID de tema inválido.');p.designThemes[id]=theme;if(id==='project')for(const m of ['light','dark'] as const)for(const key of tokens)p.themes[m][key]=theme.modes[m].colors[key];break;}
      case 'theme.activate':p.activeThemeId=string(op.id,'id');if(op.mode!==undefined)p.theme=string(op.mode,'mode') as Project['theme'];break;
      default:fail(`Operación desconocida: ${name}. Consulta codaru schema.`);
    }
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
    if(request.command==='export'){
      const p=host.project();let content:string;
      if(params.format==='json')content=JSON.stringify(p,null,2);
      else if(params.format==='html')content=exportHTML(p);
      else if(params.format==='svg'){const frame=existing(p,string(params.frame,'frame'));if(frame.type!=='frame')fail('La exportación SVG requiere una pantalla.');content=exportSVG(p,frame);}
      else return fail('format debe ser json, html o svg.');
      return {ok:true,format:params.format,content,revision:await revision(p)};
    }
    if(!['apply','select','undo','redo'].includes(request.command))return fail('Comando desconocido. Ejecuta codaru --help.');
    if(host.busy())throw new AgentError('editor_busy','Termina la edición o cierra el diálogo del editor y vuelve a intentarlo.');
    if(request.command==='select'){const list=Array.isArray(params.ids)&&!params.ids.length?[]:ids(params.ids);list.forEach(id=>existing(host.project(),id));host.select(list);return {ok:true,context:await context(host)};}
    if(request.command==='undo'||request.command==='redo'){host[request.command]();return {ok:true,context:await context(host)};}
    const before=clone(host.project()),currentRevision=await revision(before);
    if(params.expectedRevision!==currentRevision)throw new AgentError('revision_conflict','Falta expectedRevision o el documento cambió. Lee codaru context y prepara el lote con la nueva revision.');
    const draft=new Store(before);draft.commit(p=>applyOperations(p,params.operations));
    // The user may edit while the asynchronous hash is calculated.
    if(JSON.stringify(host.project())!==JSON.stringify(before))throw new AgentError('revision_conflict','El documento cambió durante la validación. Lee codaru context y vuelve a intentarlo.');
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
