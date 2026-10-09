import { createEditor, createEditorView, type CodaruInvoke, type IllustrationRequest } from '../../src/modular';
import design from './design.codaru.json';
import catalog from './catalog.json';
import { validate } from '../../src/model';
import { readSaved, save } from './storage';
const el=(id:string)=>document.getElementById(id)!;
let request:IllustrationRequest|undefined, revision='';
let initial=design as unknown as import('../../src/model').Project;
try{const saved=await readSaved();if(saved)initial=validate(saved);}catch(error){el('status').textContent='No se pudo leer el laboratorio guardado: '+String(error);}
const editor=createEditor({document:initial,onChange:document=>{void save(document).catch(error=>{el('status').textContent='No se pudo guardar: '+String(error);});},onIllustrationRequest:async next=>{
  request=next;revision=(await editor.agent('context',{scope:next.nodeId,depth:0})).context!.revision;
  el('source-title').textContent=next.source.filename;el('source-code').textContent=next.source.text;el('source-pane').hidden=false;
}});
const native=(window as unknown as {__TAURI_INTERNALS__?:{invoke:CodaruInvoke}}).__TAURI_INTERNALS__;
const view=createEditorView(editor,{appearance:{theme:'dark',tokens:{accent:'#c7d0ef',selection:'#a5bee8',background:'#191b22',surface:'#232631',fontSize:12}},invoke:native?.invoke.bind(native),nativeAgent:!!native});
for(const part of ['canvas','layers','inspector','library','toolbar','dialogs'] as const)view.mount(part,el(`${part}-slot`));
const chooser=el('style-choice') as HTMLSelectElement;
const viewport=el('viewport-choice') as HTMLSelectElement;
for(const item of catalog){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;chooser.append(option);}
chooser.value='pop-cartoon';
function chosenFrame(){const item=catalog.find(item=>item.id===chooser.value)!;return viewport.value==='mobile'?item.mobile:item.desktop;}
function focusStyle(){editor.select([chosenFrame()]);view.fit(true);}
chooser.onchange=focusStyle;viewport.onchange=focusStyle;
el('fit').onclick=()=>view.fit();el('focus').onclick=focusStyle;el('undo').onclick=()=>editor.undo();
el('present').onclick=()=>{editor.select([chosenFrame()]);void editor.command('preview');};
el('back-project').onclick=async()=>{try{await save(editor.getDocument());editor.destroy();location.href=new URL('../tauri-host.html',location.href).href;}catch(error){el('status').textContent='No se pudo guardar. Exporta el proyecto antes de salir: '+String(error);}};
el('source-close').onclick=()=>{el('source-pane').hidden=true;};
el('source-save').onclick=()=>{if(!request)return;const url=URL.createObjectURL(new Blob([request.source.text],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download=request.source.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
el('source-import').onclick=()=>{(el('source-file') as HTMLInputElement).click();};
(el('source-file') as HTMLInputElement).onchange=async e=>{const input=e.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file||!request)return;try{if(file.size>1_200_000)throw new Error('Paquete demasiado grande.');const data=JSON.parse(await file.text());const result=await editor.agent('apply',{expectedRevision:revision,operations:[{op:'aru',id:request.nodeId,data}]});if(!result.ok)throw new Error(result.error?.message);el('source-pane').hidden=true;el('source-error').textContent='';}catch(error){el('source-error').textContent=String(error);}};
editor.subscribe(state=>{(el('undo') as HTMLButtonElement).disabled=!state.canUndo;el('status').textContent=`${state.document.nodes.length} capas editables · 23 estilos · Desktop y Mobile · Cambios guardados por el host en un almacén propio`;});
focusStyle();Object.assign(window,{musaruStyles:{editor,view}});window.addEventListener('pagehide',()=>editor.destroy(),{once:true});
