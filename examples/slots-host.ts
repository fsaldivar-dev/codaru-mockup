import { createEditor, createEditorView, type CodaruInvoke } from '../src/modular';
import { slotsDesign } from './slots-design';
// Persistence is explicitly owned by this demonstration host, enabled only by ?persist=NAME.
const persistenceName=new URLSearchParams(location.search).get('persist');
const storageKey=persistenceName?`codaru:slots-demo:${persistenceName}`:null;
let fixture=slotsDesign();
if(storageKey){const saved=localStorage.getItem(storageKey);if(saved)fixture=JSON.parse(saved) as typeof fixture;}
const editor=createEditor({document:fixture.document,onChange:document=>{if(storageKey)localStorage.setItem(storageKey,JSON.stringify({...fixture,document}));}});
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
  el('status').textContent=`${state.document.components.length} componentes · Slots compartidos con el IDE · ${storageKey?'Guardado por este host de ejemplo':'Sin persistencia automática'}`;
});
editor.select([fixture.ids.second]);view.fit();Object.assign(window,{slotsExample:{editor,view,ids:fixture.ids}});
window.addEventListener('pagehide',()=>editor.destroy(),{once:true});
