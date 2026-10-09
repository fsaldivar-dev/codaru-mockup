import {createEditor,createEditorView,type CodaruInvoke} from '../../src/modular';
import {prepareAruAsset} from '../../src/aru-asset';
import type {AruAsset,ResourceReviewRequest,ResourceReviewVerdict} from '../../src/contracts';
import type {Project} from '../../src/model';
import design from './design.codaru.json';
import assets from './assets.json';
import culturalAssets from './cultural-assets.json';
import expansionAssets from './expansion-assets.json';
import expansionManifest from './expansion-manifest.json';
import reviews from './review.json';
import veneroAssets from './venero-assets.json';
import veneroManifest from './venero-manifest.json';
import luxeAssets from './venero-luxe-assets.json';
import luxeManifest from './venero-luxe-manifest.json';
import entrelazoAssets from './entrelazo-assets.json';
import entrelazoManifest from './entrelazo-manifest.json';
const el=(id:string)=>document.getElementById(id)!;
const evidence:ResourceReviewRequest[]=[];
const allAssets={...assets,...culturalAssets,...expansionAssets,...Object.fromEntries(Object.entries(veneroAssets).map(([k,v])=>['venero-'+k,v])),...Object.fromEntries(Object.entries(luxeAssets).map(([k,v])=>['v02-'+k,v])),...Object.fromEntries(Object.entries(entrelazoAssets).map(([k,v])=>['entrelazo-'+k,v]))};
let sourceText='',sourceName='',frame='jardin-desktop';
const editor=createEditor({document:design as unknown as Project,onIllustrationRequest:request=>{
 sourceText=request.source.text;sourceName=request.source.filename;el('source-title').textContent=sourceName;el('source-code').textContent=sourceText;(el('source') as HTMLDialogElement).showModal();
}});
const native=(window as unknown as {__TAURI_INTERNALS__?:{invoke:CodaruInvoke}}).__TAURI_INTERNALS__;
const view=createEditorView(editor,{appearance:{theme:'light',tokens:{accent:'#B51048',selection:'#E91E63',background:'#FDF7F5',surface:'#FFFFFF',fontSize:12}},invoke:native?.invoke.bind(native),nativeAgent:!!native});
for(const part of ['canvas','layers','inspector','library','toolbar','dialogs'] as const)view.mount(part,el(part+'-slot'));
// This demo replays only this session's explicit visual verdicts for unchanged candidates.
// It is not a live AI evaluator. Changed/new content stays pending for the IDE's evaluator.
editor.setResourceServices({edit:async({source})=>{sourceText=source.text;sourceName=source.filename;el('source-title').textContent=sourceName;el('source-code').textContent=sourceText;(el('source') as HTMLDialogElement).showModal();},compile:async source=>{
 const match=Object.values(allAssets).find(a=>a.source===source.text&&a.filename===source.filename);
 if(!match)throw new Error('El fuente cambió: vuelve a compilarlo con el CLI de ARU.');return match.svg;
},evaluate:async request=>{
 evidence.push(request);
 const audit=(reviews as Record<string,{revision:string;verdict:ResourceReviewVerdict}>)[request.resource.id];
 if(!audit||audit.revision!==request.revision)throw new Error('Pendiente de revisión visual por IA: recurso nuevo o modificado.');
 return audit.verdict;
}});
async function focus(id:string){
 const document=editor.getDocument(),target=document.nodes.find(n=>n.id===id);
 if(!target)throw new Error('Pantalla no encontrada.');
 if(target.page&&document.activePageId!==target.page){
  const context=await editor.agent('context',{scope:'workspace',depth:0});
  const result=await editor.agent('apply',{expectedRevision:context.context?.revision,operations:[{op:'page',action:'activate',id:target.page}]});
  if(!result.ok)throw new Error(result.error?.message??'No se pudo activar la página.');
 }
 frame=id;editor.select([id]);view.fit(true);el('layers-slot').hidden=false;el('library-slot').hidden=true;el('left-title').textContent='CAPAS EDITABLES';
 for(const button of documentButtons)el(button).setAttribute('aria-pressed',String(buttonFrames[button]===id));
 const moment=el('moment') as HTMLSelectElement;moment.value=[...moment.options].some(option=>option.value===id)?id:'';
}
const buttonFrames:Record<string,string>={entrelazo:'entrelazo-desktop',venero:'v02-desktop',original:'hilo-desktop',desktop:'jardin-desktop',welcome:'jardin-welcome',mobile:'jardin-player',collection:'jardin-empty',offline:'jardin-offline',queue:'jardin-downloads'};
const documentButtons=Object.keys(buttonFrames);
for(const [button,id] of Object.entries(buttonFrames))el(button).onclick=()=>{void focus(id);};
el('moment').onchange=()=>{const id=(el('moment') as HTMLSelectElement).value;if(id)void focus(id);};
el('resources').onclick=async()=>{await ready;const page=editor.getDocument().activePageId;await focus(page==='entrelazo'?'entrelazo-resources':page==='venero-02'?'v02-resources':page==='venero'?'venero-resources':'jardin-symbols');el('layers-slot').hidden=true;el('library-slot').hidden=false;el('left-title').textContent='RECURSOS ORIGINALES';el('library-slot').querySelector('[data-codaru-part="library"]')?.shadowRoot?.querySelector<HTMLButtonElement>('[data-library="resources"]')?.click();const select=el('library-slot').querySelector('[data-codaru-part="library"]')?.shadowRoot?.querySelector<HTMLSelectElement>('[data-drawing-filter]');if(select){select.value='approved';select.dispatchEvent(new Event('change',{bubbles:true}));}};
el('present').onclick=()=>{editor.select([frame==='entrelazo-resources'?'entrelazo-desktop':frame==='v02-resources'?'v02-desktop':frame==='venero-resources'?'venero-desktop':frame==='jardin-resources'||frame==='jardin-symbols'?'jardin-desktop':frame]);void editor.command('preview');};
el('close-source').onclick=()=>(el('source') as HTMLDialogElement).close();
el('save-source').onclick=()=>{const url=URL.createObjectURL(new Blob([sourceText],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download=sourceName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
const purposes:Record<string,string>={play:'Iniciar la reproducción',pause:'Pausar la reproducción',previous:'Canción anterior',next:'Canción siguiente',shuffle:'Escucha aleatoria',repeat:'Repetir la escucha',queue:'Abrir la cola de canciones',volume:'Control de volumen',heart:'Guardar como favorita',search:'Buscar música',collection:'Abrir la colección musical',radio:'Abrir una estación de radio',cast:'Elegir dispositivo de escucha',download:'Descargar para escuchar sin conexión',back:'Volver a la pantalla anterior',close:'Cerrar una vista',weave:'Monograma H de HILO', 'hilo-app':'Icono de aplicación HILO: monograma H entrelazado',resonancia:'Portada original de Resonancia: ondas de sonido entrelazadas'};
const ready=(async()=>{
 const culturalPurposes:Record<string,string>={encuentro:'Bienvenida HILO: dos voces que se encuentran, ilustración original para usar desde 280 px de ancho',canto:'Portada HILO Entre voces: un ave y una flor, ilustración original para usar desde 160 px de ancho','primer-brote':'Colección vacía HILO: un brote como comienzo, ilustración original para usar desde 160 px de ancho','un-respiro':'Modo sin conexión HILO: un ave en reposo, ilustración original para usar desde 160 px de ancho','semilla-inicio':'Inicio de HILO: semilla de trazo fino, acompañada de etiqueta','ala-descubrir':'Descubrir música en HILO: ala de listones, acompañada de etiqueta','brote-coleccion':'Colección personal de HILO: brote de trazo fino, acompañado de etiqueta','flor-radio':'Estaciones de HILO: flor de trazo fino, acompañada de etiqueta','nudo-favoritas':'Favoritas de HILO: corazón e hilo interior','liston-descargas':'Descargas de HILO: flecha integrada en un listón, acompañada de etiqueta'};
 for(const [name,asset] of Object.entries(allAssets)){
  const a=prepareAruAsset(asset as AruAsset);
  const isEntrelazo=name.startsWith('entrelazo-'),isLuxe=name.startsWith('v02-'),isVenero=name.startsWith('venero-')||isLuxe;
  const vmeta=isEntrelazo?(entrelazoManifest as Record<string,{label:string;purpose:string;kind:string}>)[name.slice(10)]:isLuxe?(luxeManifest as Record<string,{label:string;purpose:string;kind:string}>)[name.slice(4)]:isVenero?(veneroManifest as Record<string,{label:string;purpose:string;kind:string}>)[name.slice(7)]:undefined;
  const extra=vmeta??(expansionManifest as Record<string,{label:string;purpose:string;kind:string}>)[name];
  const cultural=name in culturalPurposes||!!extra;
  const kind=name==='hilo-app'||vmeta?.kind==='app-icon'?'app-icon':extra?.kind==='illustration'||['resonancia','encuentro','canto','primer-brote','un-respiro'].includes(name)?'illustration':'icon';
  const id=await editor.stageResource({id:'hilo-aru-'+name,name:(isEntrelazo?'ENTRELAZO · ':isLuxe?'VENERO 02 · ':isVenero?'VENERO · ':'HILO · ')+(extra?.label??name),kind,purpose:extra?.purpose??(cultural?culturalPurposes[name]:purposes[name]),tags:isEntrelazo?['entrelazo','amealco','original']:isLuxe?['venero-02','amealco','original']:isVenero?['venero','amealco','original']:cultural?['hilo','original','jardin-de-voces']:['hilo','original','html-reference'],svg:a.svg,source:a.aruSource,width:a.width,height:a.height});
  await editor.reviewResource(id);
 }
 const library=await editor.getResourceLibrary();el('status').textContent=`${library.filter(r=>r.origin==='library'&&r.status==='approved').length}/${Object.keys(allAssets).length} recursos revisados en esta sesión · Fuentes ARU exportables · Copia aislada sin guardado automático`;
})();
Object.assign(window,{hilo:{editor,view,evidence,ready,focus}});const concept=new URL(location.href).searchParams.get('concept');void focus(concept==='entrelazo'?'entrelazo-desktop':concept==='venero02'?'v02-desktop':concept==='venero'?'venero-desktop':'jardin-desktop');window.addEventListener('pagehide',()=>editor.destroy(),{once:true});
