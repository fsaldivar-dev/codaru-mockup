import { mountCodaru, type CodaruHandle } from '../src/embed';

const container = document.querySelector<HTMLElement>('#editor-container')!;
const status = document.querySelector<HTMLElement>('#host-status')!;
const toggle = document.querySelector<HTMLButtonElement>('#host-toggle')!;
const context = document.querySelector<HTMLButtonElement>('#host-context')!;
const styles = document.querySelector<HTMLButtonElement>('#host-styles')!;
const native = (window as unknown as { __TAURI_INTERNALS__?: { invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T> } }).__TAURI_INTERNALS__;
let mounted: CodaruHandle | undefined;
async function showEditor() {
  container.replaceChildren();
  mounted = mountCodaru(container, {
    editorUrl: new URL('../index.html', location.href),
    storageKey: 'codaru-mockup:project:v1',
    invoke: native?.invoke.bind(native),
    onChange: document => { status.textContent = `${document.name} · ${document.nodes.length} capas`; },
    onError: error => { status.textContent = error.message; },
  });
  const editor = await mounted.ready;
  status.textContent = `${editor.getDocument().name} · Editor integrado`;
  toggle.textContent = 'Ocultar editor';context.disabled = false;styles.disabled=false;
}
toggle.onclick = async () => {
  toggle.disabled = true;
  try {
    if(mounted){await mounted.destroy();mounted=undefined;container.innerHTML='<p id="host-placeholder">El editor está desmontado. Tu documento está conservado en esta aplicación.</p>';toggle.textContent='Mostrar editor';context.disabled=true;status.textContent='Editor desmontado';}
    else await showEditor();
  } catch(error){status.textContent=String(error);} finally {toggle.disabled=false;}
};
context.onclick = async () => {
  if(!mounted)return;
  const editor=await mounted.ready;
  const result=await editor.agent('context',{depth:0}) as {ok:boolean;context?:{counts:{frames:number;nodes:number}}};
  status.textContent=result.ok&&result.context?`Contexto IA · ${result.context.counts.frames} pantallas · ${result.context.counts.nodes} capas`:'No se pudo obtener contexto';
};
styles.onclick = async () => {
  styles.disabled=true;toggle.disabled=true;context.disabled=true;
  try {
    // Flush the host's document before opening an independent example session.
    if(mounted){await mounted.destroy();mounted=undefined;}
    location.href=new URL('./musaru-styles/index.html',location.href).href;
  } catch(error){status.textContent=String(error);styles.disabled=false;toggle.disabled=false;context.disabled=false;}
};
void showEditor().catch(error=>{status.textContent=String(error);});
