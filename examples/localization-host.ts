import { createEditor, createEditorView, type LocalizationConfig, type TranslationRequest } from '../src/modular';
import { blank, node } from '../src/model';
import type { CodaruInvoke } from '../src/embed';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const design = blank(); design.name = 'Bienvenida · Localización';
design.nodes = [
  node('frame', { id: 'welcome', name: 'Bienvenida', x: 40, y: 40, width: 390, height: 600, fill: '#fafaff' }),
  node('ellipse', { id: 'halo', parentId: 'welcome', x: 115, y: 58, width: 160, height: 160, fill: '#ece6ff' }),
  node('text', { id: 'symbol', parentId: 'welcome', x: 155, y: 91, width: 80, height: 90, text: '✦', fontSize: 68, lineHeight: 1.2, textAlign: 'center', color: '#7b52ee' }),
  node('text', { id: 'title', name: 'Título', parentId: 'welcome', x: 28, y: 258, width: 334, height: 74, text: 'Organiza tu día,\nsin esfuerzo', textKey: 'welcome.title', fontSize: 28, fontWeight: 700, lineHeight: 1.15, textAlign: 'center', color: '#262432' }),
  node('text', { id: 'subtitle', name: 'Descripción', parentId: 'welcome', x: 32, y: 349, width: 326, height: 56, text: 'Crea tareas y encuentra tiempo para lo que importa.', textKey: 'welcome.subtitle', fontSize: 15, textAlign: 'center', color: '#686274' }),
  node('button', { id: 'start', name: 'Comenzar', parentId: 'welcome', x: 28, y: 491, width: 334, height: 50, text: 'Comenzar', textKey: 'welcome.start', fill: '#7950ed', radius: 12 }),
];
// These catalogs belong to the host. A real IDE reads/writes its project's files here.
const catalog: LocalizationConfig = {
  locale: 'es', fallbackLocale: 'es', labels: { es: 'Español', en: 'English', de: 'Deutsch' },
  messages: {
    es: { 'welcome.title': 'Organiza tu día,\nsin esfuerzo', 'welcome.subtitle': 'Crea tareas y encuentra tiempo para lo que importa.', 'welcome.start': 'Comenzar' },
    en: { 'welcome.title': 'Make room for\nwhat matters', 'welcome.subtitle': 'Plan your tasks and find more time for yourself.', 'welcome.start': 'Get started' },
    de: { 'welcome.title': 'Organisiere deinen gesamten Tag und finde ganz entspannt Zeit für die wirklich wichtigen Dinge', 'welcome.start': 'Jetzt starten' },
  },
};
let editing: TranslationRequest | undefined, changes = 0;
function showTranslation(request: TranslationRequest) {
  editing = request; el('translation-form').hidden = false;
  el('host-key').textContent = request.key; el<HTMLSelectElement>('host-locale').value = request.locale ?? 'es';
  loadTranslation(); el<HTMLTextAreaElement>('host-text').focus();
}
function loadTranslation() {
  if (!editing) return;
  const locale = el<HTMLSelectElement>('host-locale').value;
  el<HTMLTextAreaElement>('host-text').value = catalog.messages[locale][editing.key] ?? '';
}
const editor = createEditor({ document: design, localization: catalog, onTranslationRequest: showTranslation, onChange: () => { changes++; } });
const native = (window as unknown as { __TAURI_INTERNALS__?: { invoke: CodaruInvoke } }).__TAURI_INTERNALS__;
const view = createEditorView(editor, { appearance: { theme: 'light', tokens: { accent: '#1670e8' } }, invoke: native?.invoke.bind(native), nativeAgent: !!native });
for (const part of ['canvas', 'layers', 'inspector', 'toolbar', 'locale', 'dialogs'] as const) view.mount(part, el(`${part}-slot`));
el('host-locale').onchange = loadTranslation;
el('translation-form').onsubmit = event => {
  event.preventDefault(); if (!editing) return;
  const locale = el<HTMLSelectElement>('host-locale').value;
  catalog.messages[locale][editing.key] = el<HTMLTextAreaElement>('host-text').value;
  editor.setLocalization({ ...catalog, locale });
  el('host-message').textContent = 'Vista previa actualizada.';
};
el('fit').onclick = () => view.fit();
el('present').onclick = () => { void editor.command('preview'); };
editor.subscribe(state => { el('host-status').textContent = `Catálogos del IDE · ${state.localization.locales.length} idiomas · ${state.localization.locale ?? 'Texto de origen'} · ${changes} cambios del diseño`; });
editor.select(['title']); view.fit();
// Read-only integration inspection and test hooks; no persistence is implicit.
Object.assign(window, { localizationExample: { editor, view, catalog } });
window.addEventListener('pagehide', () => editor.destroy(), { once: true });
