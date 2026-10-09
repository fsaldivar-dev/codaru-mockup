import { createEditor, createEditorView, type CodaruInvoke } from '../src/modular';
import { implementationsDesign } from './implementations-design';
import type { ImplementationRequest } from '../src/contracts';
import swift from './implementation-sources/CardView.swift?raw';
import compose from './implementation-sources/Card.kt?raw';
import web from './implementation-sources/Card.tsx?raw';
const requests:ImplementationRequest[]=[];
const sources:Record<string,string>={'examples/implementation-sources/CardView.swift':swift,'examples/implementation-sources/Card.kt':compose,'examples/implementation-sources/Card.tsx':web};
// Persistence is explicitly owned by this demonstration host, enabled only by ?persist=NAME.
const persistenceName=new URLSearchParams(location.search).get('persist');
const storageKey=persistenceName?`codaru:implementation-demo:${persistenceName}`:null;
let fixture=implementationsDesign();
if(storageKey){const saved=localStorage.getItem(storageKey);if(saved)fixture=JSON.parse(saved) as typeof fixture;}
const editor=createEditor({document:fixture.document,onImplementationRequest:request=>{
  const source=sources[request.reference.path??''];
  if(!source)throw new Error('El host de ejemplo solo resuelve los tres archivos incluidos; conecta aquí el resolvedor de tu IDE.');
  requests.push(structuredClone(request));
  el('source-title').textContent=`${request.reference.symbol} · ${request.platform}`;
  el('source-location').textContent=request.reference.path!;
  el('source-code').textContent=source;
},onChange:document=>{if(storageKey)localStorage.setItem(storageKey,JSON.stringify({...fixture,document}));}});
const native=(window as unknown as {__TAURI_INTERNALS__?:{invoke:CodaruInvoke}}).__TAURI_INTERNALS__;
const view=createEditorView(editor,{appearance:{theme:'light'},invoke:native?.invoke.bind(native),nativeAgent:!!native});
const el=(id:string)=>document.getElementById(id)!;
for(const part of ['canvas','layers','inspector','library','toolbar','dialogs'] as const)view.mount(part,el(`${part}-slot`));
el('change-master').onclick=()=>{const current=editor.getDocument().nodes.find(n=>n.id==='logo')!;editor.apply([{op:'update',id:'logo',patch:{fill:current.fill==='#ece7fa'?'#e4f5ef':'#ece7fa'}}]);};
el('select-local').onclick=()=>editor.select([fixture.ids.second]);el('undo').onclick=()=>editor.undo();el('fit').onclick=()=>view.fit();
const title=el('host-title') as HTMLInputElement,content=el('host-content') as HTMLSelectElement;
const edit=(key:string,value:string)=>{title.blur();content.blur();try{editor.setComponentProperty(fixture.ids.second,key,value);el('host-error').textContent='';}catch(error){el('host-error').textContent=String(error);}};
title.onchange=()=>edit('titulo',title.value);content.onchange=()=>edit('cabecera',content.value);
editor.subscribe(state=>{
  const props=editor.getComponentProperties(fixture.ids.second),slot=props.find(prop=>prop.key==='cabecera');
  title.value=String(props.find(prop=>prop.key==='titulo')!.value);
  content.replaceChildren(...(slot?.components??[]).map(c=>{const option=document.createElement('option');option.value=c.id;option.textContent=c.name;option.selected=c.id===slot?.value;return option;}));
  (el('undo') as HTMLButtonElement).disabled=!state.canUndo;
  el('status').textContent=`${state.document.components.length} componentes · Vínculos de implementación · Navegación resuelta por este host · ${storageKey?'Guardado por este host de ejemplo':'Sin persistencia automática'}`;
});
editor.select([fixture.ids.second]);view.fit();Object.assign(window,{implementationsExample:{editor,view,ids:fixture.ids,requests}});
window.addEventListener('pagehide',()=>editor.destroy(),{once:true});
