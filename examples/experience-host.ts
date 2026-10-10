import {createEditor,createEditorView} from '../src/modular';
import {createExperienceView,type ExperiencePart} from '../src/experience-view';
import {blank,node,parseDocument} from '../src/model';
const el=(id:string)=>document.getElementById(id)!;
const p=blank();p.name='Reproductor · Contrato del producto';p.nodes=[
 node('frame',{id:'player-screen',name:'Reproductor',role:'screen',device:'iphone-16',x:80,y:60,width:390,height:720,fill:'#f6f4fb'}),
 node('text',{id:'title',parentId:'player-screen',name:'Título',text:'Tu próxima escucha',x:28,y:46,width:334,height:54,fontSize:28,fontWeight:650,color:'#242135'}),
 node('rect',{id:'cover',parentId:'player-screen',name:'Portada',x:28,y:125,width:334,height:250,radius:22,fill:'#b8a0eb',gradient:'linear',gradientEnd:'#6f59bb',experience:{accessibility:{decorative:true},analytics:[]}}),
 node('text',{id:'track',parentId:'player-screen',name:'Canción',text:'Slow Bloom',x:28,y:410,width:334,height:42,fontSize:24,fontWeight:600}),
 node('text',{id:'artist',parentId:'player-screen',name:'Artista',text:'The Sunday Collective',x:28,y:454,width:334,height:26,fontSize:14,color:'#686078'}),
 node('button',{id:'play',parentId:'player-screen',name:'Reproducir canción',text:'Reproducir',x:28,y:528,width:334,height:52,fill:'#7052cc',color:'#ffffff',radius:14,experience:{accessibility:{role:'button',name:'Reproducir Slow Bloom',keyboard:['Enter','Space'],focus:'visible',focusOrder:1,states:['disabled','busy']},analytics:[{name:'player.track.play',trigger:'success',purpose:'Medir reproducciones confirmadas',consent:'required',properties:{track_id:{type:'string',source:'track.id'}}}],testId:'player-play',acceptance:['Al fallar la carga mostrar un mensaje accesible y no emitir éxito.']}}),
 node('button',{id:'save',parentId:'player-screen',name:'Guardar canción',text:'Guardar en mi colección',x:28,y:600,width:334,height:46,fill:'#e5dff3',color:'#34264e',radius:12})
];
const native=(window as any).__TAURI_INTERNALS__;
const editor=createEditor({document:parseDocument(p)}),view=createEditorView(editor,{appearance:{theme:'light'},invoke:native?.invoke.bind(native),nativeAgent:!!native});
view.mount('canvas',el('canvas'));view.mount('inspector',el('inspector'));view.mount('toolbar',el('toolbar'));view.mount('dialogs',el('dialogs'));
const exports:unknown[]=[],handoffs:unknown[]=[];
function download(report:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='product-contract.codaru.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const experience=createExperienceView(editor,{appearance:{theme:'light'},onExport:report=>{exports.push(report);download(report);},onHandoff:async report=>{handoffs.push(report);el('status').textContent=`El IDE recibió ${report.entries.length} elementos · ${report.issues.length} hallazgos · Sin envío de analítica`;}});
for(const part of ['accessibility','analytics','tests'] as ExperiencePart[])experience.mount(part,el(part));
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-tab]'))b.onclick=()=>{experience.flush();for(const slot of document.querySelectorAll<HTMLElement>('[data-slot]'))slot.hidden=slot.id!==b.dataset.tab;for(const tab of document.querySelectorAll('[data-tab]'))tab.setAttribute('aria-pressed',String(tab===b));};
el('play-selection').onclick=()=>{experience.flush();editor.select(['play']);view.fit(true);};el('save-selection').onclick=()=>{experience.flush();editor.select(['save']);view.fit(true);};el('fit').onclick=()=>view.fit();el('undo').onclick=()=>{experience.flush();editor.undo();};
let dark=false;el('theme').onclick=()=>{dark=!dark;const a={theme:dark?'dark' as const:'light' as const};view.setAppearance(a);experience.setAppearance(a);el('theme').textContent=dark?'Tema claro':'Tema oscuro';};
editor.select(['play']);view.fit(false);Object.assign(window,{experienceExample:{editor,view,experience,exports,handoffs}});window.addEventListener('pagehide',()=>editor.destroy(),{once:true});
