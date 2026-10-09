import type { CodaruEditor } from './editor-core';
import { escape } from './screen-svg';

/** Only the view owns file dialogs; portable style data stays in the document core. */
export function createStylePackagePanel(options: {editor:CodaruEditor; read?:()=>Promise<string|null>; save:(content:string,filename:string,extension:string)=>Promise<unknown>; changed:()=>void; error:(message:string)=>void}) {
  let selected='', disposed=false;
  const labels={composition:'Composición',typography:'Tipografía',controls:'Controles',mobile:'Versión móvil',motion:'Movimiento',avoid:'Evitar'};
  function render(target:HTMLElement,tabs:string) {
    const styles=options.editor.getStyles();
    if(!styles.some(s=>s.id===selected)) selected=styles[0]?.id??'';
    const style=selected?options.editor.getStyle(selected):null;
    target.innerHTML=tabs+`<p class="field-note">Importa un lenguaje visual propio: tokens, degradados y guías para la IA. La composición se diseña para cada pantalla.</p><button class="wide-button" data-style-action="import">Importar estilo JSON</button><input type="file" accept=".json,application/json" data-style-file aria-label="Archivo de estilo" hidden/>${styles.length?`<label class="full-field"><span>Estilo</span><select aria-label="Estilo del proyecto" data-style-select>${styles.map(s=>`<option value="${escape(s.id)}" ${s.id===selected?'selected':''}>${escape(s.name)} · ${escape(s.version)}</option>`).join('')}</select></label>`:'<p class="empty-note">Sin estilos externos. Tus temas actuales siguen disponibles en Temas.</p>'}${style?`<section class="inspector-section"><p>${escape(style.description)}</p><button class="wide-button" data-style-action="frame">Usar tokens en pantalla seleccionada</button><button class="wide-button" data-style-action="project">Usar tokens en el proyecto</button><button class="wide-button" data-style-action="export">Exportar estilo JSON</button><p class="field-note">Los tokens afectan elementos vinculados al tema. Las guías quedan disponibles en el contexto de la IA; aplicar tokens conserva la geometría.</p>${Object.entries(labels).map(([key,label])=>`<details class="style-guidance" ${key==='mobile'?'open':''}><summary>${label}</summary><ul>${style.guidance[key as keyof typeof labels].map(t=>`<li>${escape(t)}</li>`).join('')||'<li>Sin indicaciones adicionales.</li>'}</ul></details>`).join('')}${style.aru?`<details class="style-guidance"><summary>Guías para ARU</summary><p class="field-note">Paleta: ${style.aru.palette.map(escape).join(' · ')}</p><ul>${style.aru.instructions.map(t=>`<li>${escape(t)}</li>`).join('')}</ul><p class="field-note">El IDE puede enviar estas guías a ARU. Este archivo no instala un preset en ARU.</p></details>`:''}</section>`:''}`;
  }
  async function accept(text:string) { if(disposed)return; if(text.length>2_000_000)throw new Error('El archivo de estilo supera 2 MB.'); const input=JSON.parse(text);options.editor.importStyle(input);selected=input.id;options.changed(); }
  async function action(name:string,el:HTMLElement) {
    if(name==='import') { if(options.read){const text=await options.read();if(text)await accept(text);}else el.parentElement?.querySelector<HTMLInputElement>('[data-style-file]')?.click();return; }
    if(!selected)return;
    if(name==='export') {const style=options.editor.getStyle(selected);if(style)await options.save(JSON.stringify(style,null,2),`${selected}.codaru-style.json`,'json');return;}
    if(name==='frame'||name==='project') {
      const frame=options.editor.getSelection().find(n=>n.type==='frame');
      if(name==='frame'&&!frame)throw new Error('Selecciona una pantalla para aplicar sus tokens.');
      options.editor.applyStyle(selected,{frameId:name==='frame'?frame!.id:undefined});options.changed();
    }
  }
  function click(el:HTMLElement) {if(!el.dataset.styleAction)return false;void action(el.dataset.styleAction,el).catch(e=>options.error(e instanceof Error?e.message:String(e)));return true;}
  function input(el:HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement) {
    if(el.hasAttribute('data-style-select')){selected=el.value;options.changed();return true;}
    if(el.hasAttribute('data-style-file')){const file=(el as HTMLInputElement).files?.[0];if(file)void (file.size>2_000_000?Promise.reject(new Error('El archivo de estilo supera 2 MB.')):file.text().then(accept)).catch(e=>options.error(String(e)));return true;}
    return false;
  }
  return {render,click,input,dispose:()=>{disposed=true;}};
}
