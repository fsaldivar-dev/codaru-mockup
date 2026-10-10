import {createEditor,createEditorView} from '../src/modular';
import {blank,node} from '../src/model';
import type {FontDefinition} from '../src/contracts';
import regular from './font-assets/fraunces-regular.ttf?url';
import italic from './font-assets/fraunces-italic.ttf?url';
import grotesk from './font-assets/spacegrotesk-regular.ttf?url';
const fonts:FontDefinition[]=[{id:'fraunces',name:'Fraunces',license:'SIL OFL 1.1 · Undercase Type; see font-assets/fraunces-OFL.txt',variants:[400,700].flatMap(weight=>[{weight,style:'normal' as const,source:{url:regular},export:'embed' as const},{weight,style:'italic' as const,source:{url:italic},export:'embed' as const}])},{id:'space-grotesk',name:'Space Grotesk',license:'SIL OFL 1.1 · Florian Karsten; see font-assets/spacegrotesk-OFL.txt',variants:[400,700].map(weight=>({weight,source:{url:grotesk},export:'embed' as const}))},{id:'local-georgia',name:'Georgia local',variants:[{weight:400,source:{local:'Georgia'}}]}];
const p=blank();p.name='Composición tipográfica editable';p.nodes=[node('frame',{id:'typography',name:'Composición libre',x:40,y:40,width:860,height:880,fill:'#f6f2e9',device:'custom'}),
node('text',{id:'eyebrow',parentId:'typography',name:'Etiqueta',text:'UNA VOZ PROPIA / 01',fontFamily:'space-grotesk',fontWeight:700,fontSize:13,x:55,y:48,width:720,height:32,color:'#764c44'}),
node('text',{id:'headline',parentId:'typography',name:'Título editable',typographyToken:'editorial-title',text:`Las palabras
construyen lugares.`,fontFamily:'fraunces',fontSize:62,fontWeight:700,lineHeight:1.1,x:55,y:110,width:750,height:160,color:'#292e39'}),
node('text',{id:'italic',parentId:'typography',name:'Cursiva',text:'Cada voz merece su propio ritmo.',fontFamily:'fraunces',fontStyle:'italic',fontSize:30,fontWeight:400,x:55,y:300,width:730,height:48,color:'#764c44'}),
node('text',{id:'long-copy',parentId:'typography',name:'Texto largo',text:`La tipografía cambia la manera de escuchar una idea. Este texto permanece editable: acentos, signos, líneas largas y una composición con espacio para respirar. El diseñador decide la jerarquía, las proporciones y la posición. Ninguna plantilla decide por él.

Dos familias, distintos pesos y una cursiva real comparten el mismo documento.`,fontFamily:'space-grotesk',fontWeight:400,fontSize:21,lineHeight:1.5,x:55,y:395,width:550,height:300,color:'#292e39'}),
node('text',{id:'missing-copy',parentId:'typography',name:'Referencia ausente',text:'Este texto se conserva hasta registrar la fuente.',fontFamily:'font-not-installed',fontSize:18,x:55,y:760,width:730,height:50,color:'#292e39'})];
for(const mode of ['light','dark'] as const)p.designThemes.project.modes[mode].typography['editorial-title']={name:'Título editorial',fontFamily:'fraunces',fontStyle:'normal',fontWeight:700,fontSize:62,lineHeight:1.1};
const el=(id:string)=>document.getElementById(id)!;
const native=(window as any).__TAURI_INTERNALS__;
const editor=createEditor({document:p,fonts}),view=createEditorView(editor,{appearance:{theme:'light'},invoke:native?.invoke.bind(native),nativeAgent:!!native});
view.mount('canvas',el('canvas'));view.mount('inspector',el('inspector'));view.mount('dialogs',el('dialogs'));editor.select(['headline']);view.fit();
const ready=editor.loadFonts().then(()=>{el('status').textContent=`Fuentes cargadas · ${editor.getFontIssues().length} referencias pendientes · texto editable`; });
editor.subscribe(state=>{el('status').textContent=`${editor.getFontIssues().length} referencias pendientes · texto editable`;el('catalog').replaceChildren();for(const font of state.fonts.filter(f=>!f.builtin)){const h=document.createElement('strong');h.textContent=font.name;const body=document.createElement('p');body.textContent=font.variants.map(v=>`${v.weight} ${v.style}: ${v.status}`).join(' / ');el('catalog').append(h,body);}});
for(const [button,id] of [['title','headline'],['long','long-copy'],['missing','missing-copy']])el(button).onclick=()=>{editor.select([id]);view.fit(true);};el('fit').onclick=()=>view.fit();el('undo').onclick=()=>editor.undo();el('reload').onclick=()=>editor.loadFonts().catch(e=>{el('status').textContent=e.message;});
el('export').onclick=async()=>{try{const result=await editor.exportSVGAsync('typography');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([result],{type:'image/svg+xml'}));a.download='typography.svg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(e){el('status').textContent=(e as Error).message;}};
Object.assign(window,{fontExample:{editor,view,ready,fonts}});window.addEventListener('pagehide',()=>editor.destroy(),{once:true});
