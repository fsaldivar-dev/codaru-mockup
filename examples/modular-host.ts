import { createEditor, createEditorView, type FragmentHandle } from '../src/modular';
import { demo } from '../src/demo';
import { icon } from '../src/icons';
import type { CodaruInvoke } from '../src/embed';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const native = (window as unknown as { __TAURI_INTERNALS__?: { invoke: CodaruInvoke } }).__TAURI_INTERNALS__;
for (const placeholder of document.querySelectorAll<HTMLElement>('[data-icon]')) {
  placeholder.innerHTML = icon(placeholder.dataset.icon!, 16);
}

// This demo never reads or writes the full editor's saved draft.
const editor = createEditor({ document: demo() });
const view = createEditorView(editor, {
  appearance: { theme: 'light', tokens: { accent: '#007aff' } },
  invoke: native?.invoke.bind(native),
  nativeAgent: false,
});
view.mount('canvas', el('canvas-slot'));
view.mount('layers', el('layers-panel'));
view.mount('library', el('library-panel'));
view.mount('insert', el('insert-slot'));
view.mount('toolbar', el('toolbar-slot'));
// The view bar is split: each control sits where this IDE wants it.
view.mount('modes', el('modes-slot'));
view.mount('designTheme', el('design-theme-slot'));
view.mount('fit', el('fit-slot'));
view.mount('breadcrumb', el('breadcrumb-slot'));
view.mount('status', el('status-slot'));
// Dialogs are deliberately mounted in a zero-footprint overlay container.
view.mount('dialogs', el('dialogs-slot'));
let inspector: FragmentHandle | undefined = view.mount('inspector', el('inspector-slot'));

const notice = el('host-notice');
const width = el<HTMLInputElement>('host-width');
const undo = el<HTMLButtonElement>('undo'), redo = el<HTMLButtonElement>('redo');
async function run(action: () => void | Promise<void>, message?: string) {
  try { await action(); if (message) notice.textContent = message; }
  catch (error) { notice.textContent = error instanceof Error ? error.message : String(error); }
}
undo.onclick = () => { void run(() => editor.undo()); };
redo.onclick = () => { void run(() => editor.redo()); };
el('theme-tokens').onclick = () => { void run(() => editor.command('themes')); };
el('export-html').onclick = () => { void run(() => editor.command('export-html')); };

let dark = false;
el('appearance-toggle').onclick = () => {
  dark = !dark;
  const theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  view.setAppearance({ theme });
  const button = el('appearance-toggle');
  button.setAttribute('aria-pressed', String(dark));
  button.innerHTML = `${icon(dark ? 'sun' : 'moon', 16)}<span>Apariencia ${dark ? 'clara' : 'oscura'}</span>`;
  notice.textContent = 'Apariencia del IDE actualizada. El tema de tu diseño se conserva.';
};

const tabs = ['layers', 'library'] as const;
function showTab(tab: typeof tabs[number]) {
  for (const name of tabs) {
    el(`${name}-panel`).hidden = name !== tab;
    el(`${name}-tab`).setAttribute('aria-selected', String(name === tab));
    el(`${name}-tab`).tabIndex = name === tab ? 0 : -1;
  }
}
for (const tab of tabs) {
  el(`${tab}-tab`).onclick = () => showTab(tab);
  el(`${tab}-tab`).onkeydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'layers' : event.key === 'End' ? 'library' : tab === 'layers' ? 'library' : 'layers';
    showTab(next); el(`${next}-tab`).focus();
  };
}

el('inspector-toggle').onclick = () => {
  if (inspector) { inspector.destroy(); inspector = undefined; }
  else inspector = view.mount('inspector', el('inspector-slot'));
  el('inspector-slot').hidden = !inspector;
  el('inspector-placeholder').hidden = !!inspector;
  el('inspector-toggle').textContent = inspector ? 'Ocultar panel' : 'Mostrar panel';
  el('inspector-toggle').setAttribute('aria-expanded', String(!!inspector));
  notice.textContent = inspector ? 'Panel restaurado con la misma selección e historial.' : 'Panel desmontado. Puedes seguir editando desde el IDE.';
};

const unsubscribe = editor.subscribe(state => {
  const selected = state.document.nodes.filter(node => state.selection.includes(node.id));
  const single = selected.length === 1 ? selected[0] : undefined;
  el('selection-name').textContent = single?.name ?? (selected.length ? `${selected.length} capas seleccionadas` : 'Selecciona una capa');
  el('selection-status').textContent = selected.length ? `${selected.length} ${selected.length === 1 ? 'capa seleccionada' : 'capas seleccionadas'}` : 'Sin selección';
  el('node-count').textContent = `${state.document.nodes.length} capas`;
  width.disabled = !single || single.locked;
  if (document.activeElement !== width) width.value = single ? String(Math.round(single.width * 100) / 100) : '';
  undo.disabled = !state.canUndo; redo.disabled = !state.canRedo;
});
width.onchange = () => {
  const [selected] = editor.getSelection();
  const next = Number(width.value);
  if (!selected || editor.getSelection().length !== 1) return;
  if (!width.value.trim() || !Number.isFinite(next) || next < 1) {
    width.value = String(selected.width); notice.textContent = 'El ancho debe ser de al menos 1 px.'; return;
  }
  void run(() => { editor.apply([{ op: 'update', id: selected.id, patch: { width: next } }]); }, 'Ancho actualizado desde el inspector del IDE.');
};

view.fit();
notice.textContent = 'Lienzo, capas y propiedades comparten tu documento.';
document.documentElement.dataset.codaruReady = 'true';
// Exposed only by this example for integration QA and browser console exploration.
Object.assign(window, { codaruModularDemo: { editor, view } });
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  unsubscribe(); view.destroy(); editor.destroy();
});
