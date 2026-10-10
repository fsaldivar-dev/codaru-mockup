import {createBrowserFontLoader} from './fonts-browser';
import {attachFonts,fontFamilyCSS,fontIssue,requireFonts,validateFontChanges} from './fonts';
import { createStylePackagePanel } from './style-package-view';
import { createResourceLibraryPanel } from './resource-library-view';
import { resourcePreviewRenderer } from './resource-preview';
import { ContentCache } from './content-cache';
import { applyAruAsset } from './aru';
import { componentPropertyPanel, openComponentPropertyEditor } from './component-properties-view';
import { implementationPanel, openImplementationEditor } from './implementations-view';
import { setComponentImplementation } from './implementations';
import type { ImplementationReference } from './contracts';
import { getComponentProperties, setComponentProperty, removeComponentProperty, type ComponentPropertyValue } from './component-properties';
import { getIconItems, isIconReference } from './icon-data';
import { node, blank, clone, uid, validate, children, subtree, ancestors, topSelected, frameOf, absolute, isUnavailable, color, tokens, labels, containerKinds, layoutProject, updateNode, createComponent, instantiate, detach, duplicate, remove, group, ungroup, defineVariant, createVariant, switchVariant, renameVariantSet, variantAxes, variantLabel, variantSet, setDesignSystemNotes, setComponentDoc, docStale, designSystemStale, templateSignature, pagesOf, activePage, rootsOnPage, pageView, addPage, signature, rootIds, roleOf, renamePage, removePage, buildVersion, addVersion, removeVersion, applyVersion, unpackVersion, compareVersion, type Project, type DesignNode, type Kind, type Component, panelsOf, postureGroup } from './model';
import { demo } from './demo';
import { effectiveTheme, resolveNodeStyle } from './themes';
import { openThemeEditor } from './theme-editor';
import type { KitId, KitVariant } from './kits';
import { element, escape as esc, exportHTML, exportSVG } from './render';
import { icon } from './icons';
import { devicePresets, deviceSkins, presetSafeArea, sizeClass } from './devices';
import { contrastRatio, lintProject, lintRules, lintSummary, type LintIssue } from './lint';
import { closeColorPicker, openColorPicker, pickColorFor, type GradientValue } from './color-picker';
import { easingLabels, easings, sanitizeSVG, startMotion, transitionLabels, transitionScreens, transitionTypes, vectorLayers, vectorSize, type Transition } from './motion';
import { atScope, commonScope, scopeAtPoint, inMarquee, type Scope } from './selection';
import type { EmbeddedOptions } from './embed';

import { createEditor, getEditorSession, type CodaruEditor } from './editor-core';
import { createViewDOM } from './view-dom';
import { createBuildingFeedback } from './building';
import { localizeProject, localizationIssues, resolveText, type LocalizationIssue } from './localization';

export interface RuntimeOptions { onCorrectionRequest?:(request:import('./contracts').CorrectionRequest)=>Promise<void>; app: HTMLDivElement; editor?: CodaruEditor; modular?: boolean; storageKey?: string | null; invoke?: EmbeddedOptions['invoke']; nativeAgent?: boolean; onDispose?: () => void; }
export function createEditorRuntime(options: RuntimeOptions) {
const ownerDocument = options.app.ownerDocument;
const window = ownerDocument.defaultView!;
let document = ownerDocument;
const embedParams = new URLSearchParams(location.search);
const embedded = options.modular || embedParams.get('codaruEmbed') === '1';
const STORAGE = options.modular ? options.storageKey ?? null : embedded ? embedParams.get('storageKey') || null : 'codaru-mockup:project:v1';
type NativeInvoke = <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;
const tauri = (window as unknown as { __TAURI_INTERNALS__?: { invoke: NativeInvoke } }).__TAURI_INTERNALS__;
let nativeInvoke: NativeInvoke | undefined = options.invoke ?? (embedded ? undefined : tauri?.invoke.bind(tauri));
let embeddedInitialized = false, disposed = false;
let onHostChange: EmbeddedOptions['onChange'];
let onCorrectionRequest=options.onCorrectionRequest;
let storageWarning = '';
function initial() {
  try { const saved = STORAGE && localStorage.getItem(STORAGE); if (saved) return validate(JSON.parse(saved)); }
  catch { storageWarning = 'No se pudo leer el borrador. Tu copia anterior se conserva hasta que guardes un archivo.'; }
  return embedded && !STORAGE ? blank() : demo();
}
const editor = options.editor ?? createEditor({ document: initial() });
const session = getEditorSession(editor), store = session.store, state = session.state;
const unbindFonts=session.bindFontLoader(createBrowserFontLoader(ownerDocument));
void editor.loadFonts().catch(()=>{});
let lastNotified = store.serialize();


let tab: 'layers' | 'components' | 'system' = 'layers';
let resourceSource: import('./resources').ResourceSource = 'iconify', resourceQuery = '', resourceHits: import('./resources').ResourceHit[] = [], resourceState: 'idle' | 'loading' | 'error' | 'done' = 'idle', resourceError = '', resourceSeed = 'codaru', resourceTimer: ReturnType<typeof setTimeout> | undefined, resourceAbort: AbortController | undefined, resourceModule: typeof import('./resources') | undefined;
let libraryTab: 'local' | 'kits' | 'icons' | 'resources' | 'styles' = 'local', kitId: KitId = 'ios', kitVariant: KitVariant = 'default', kitSearch = '';
let kitModule: typeof import('./kits') | undefined;
let iconModule: typeof import('./icon-library') | undefined, iconPack='mac', iconSearch='';
let space = false;
const MIN_ZOOM = .1, MAX_ZOOM = 8;
let collapsed = new Set<string>(), expanded = new Set<string>();
// Panel folding is view-local, never persisted into the shared design document.
const foldedInspectorSections = new Set<string>();
// In a page with many screens the list starts folded; a frame is open when the person opened it or selected inside it.
const collapsedByDefault = (n: DesignNode) => n.type === 'frame' && n.parentId === null && rootsOnPage(p(), pageId()).filter(f => f.type === 'frame').length > 6;
const isCollapsed = (n: DesignNode) => collapsedByDefault(n) ? !expanded.has(n.id) : collapsed.has(n.id); let saveTimer: ReturnType<typeof setTimeout>; let toastTimer: ReturnType<typeof setTimeout>;
let lastPoint = { x: 90, y: 120 }; let previewFrame: string | null = null; let previewHistory: { id: string; transition?: Transition }[] = []; let previewRatio = 1;
/** Result of the last design review; the heat map is drawn while it is on. */
let review: { issues: LintIssue[]; heat: boolean } | null = null;
const p = () => attachFonts(store.project,session.fonts);
const previewProject = () => session.previewProject();
const find = (id: string) => p().nodes.find(n => n.id === id);
const app = options.app;
const btn = (act: string, label: string, ico?: string, cls = '') => `<button class="${cls}" data-action="${act}" title="${esc(label)}" aria-label="${esc(label)}">${ico ? icon(ico) : ''}${ico ? '' : esc(label)}</button>`;
app.innerHTML = `
  <header class="topbar"><div class="brand"><span class="brand-mark">${icon('frame', 21)}</span><strong>codaru<span> / mockup</span></strong><span class="alpha">01</span></div>
    <div class="project-title"><span class="breadcrumb">Proyectos</span><span class="slash">/</span><input id="project-name" aria-label="Nombre del proyecto" maxlength="200"/><span id="save-state" class="save-dot" title="Guardado local"></span></div>
    <div class="top-actions"><button data-action="agent-help" class="agent-button">IA / CLI</button>${options.modular?'':'<button data-action="annotate" class="themes-button">Anotar</button><button data-action="comments" class="themes-button">Comentarios</button>'}<button data-action="versions" class="themes-button">Versiones</button><button data-action="themes" class="themes-button">Temas</button>${btn('open', 'Abrir proyecto', 'folder', 'icon-button')}${btn('save', 'Guardar archivo · ⌘S', 'download', 'icon-button')}<span class="divider"></span><button data-action="preview" class="preview-button">${icon('play', 14)}<span>Presentar</span></button></div>
  </header>
  <div class="workspace"><aside class="sidebar left-panel">
    <section class="project-panel"><div class="section-heading"><span>PÁGINAS</span><span class="count" id="frame-count" title="Pantallas en el documento">2</span><button class="icon-button tiny" data-action="add-page" aria-label="Nueva página" title="Nueva página">${icon('plus', 15)}</button></div><div id="pages" class="page-list"></div>
    <button class="new-screen" data-action="add-frame">${icon('plus', 14)} Nueva pantalla</button></section>
    <div class="sidebar-tabs"><button data-tab="layers" class="active">Capas</button><button data-tab="components">Componentes</button><button data-tab="system">Sistema<span id="system-stale" class="stale-badge" hidden></span></button></div>
    <div id="layers" class="layer-list"></div><div id="components" class="component-list" hidden></div><div id="system-index" class="system-index" hidden></div>
    <section class="insert-panel"><div class="section-heading"><span>INSERTAR</span><span class="hint-key">arrastrar</span></div><div class="insert-grid">${(['text','button','input','card','rect','image','vector'] as Kind[]).map(k => `<button draggable="true" data-insert="${k}" title="Insertar ${labels[k]}" aria-label="${labels[k]}">${icon(k, 17)}<span>${labels[k]}</span></button>`).join('')}</div></section>
    <div class="sidebar-footer"><span class="local-dot"></span> Guardado en tu dispositivo${btn('help', 'Atajos de teclado', 'help', 'icon-button tiny')}</div>
  </aside>
  <main class="canvas-area"><div class="canvas-top"><div class="mode-switch"><button data-mode="design" class="active">Diseño</button><button data-mode="flow">Flujos <span id="flow-count">2</span></button><button data-mode="system">Sistema</button></div><div class="canvas-top-right"><span class="locale-switch"><select id="locale-select" aria-label="Idioma de vista previa"></select><button data-action="locale-review" class="locale-count" hidden></button></span><span class="theme-switch"><select id="theme-select" class="theme-select" aria-label="Tema del diseño"></select><button data-action="theme" class="icon-button" aria-label="Cambiar entre claro y oscuro">${icon('sun',16)}</button></span><span class="divider"></span><button data-action="fit" class="fit-button" title="Ajustar pantallas · ⇧1">Ajustar</button></div></div>
    <div class="scope-bar"><nav id="scope-path" aria-label="Nivel de selección"></nav><span id="scope-hint"></span></div>
    <div id="stage" class="stage" tabindex="0" aria-label="Lienzo de diseño"><div id="world"><svg id="connections" class="connections"></svg><div id="artboards"></div><div id="selection-overlay"></div><div id="drawing-overlay"></div></div><div id="system-view" class="system-view" hidden></div><div id="empty-canvas" hidden><span class="empty-icon">${icon('frame',30)}</span><h2>Tu próxima idea empieza aquí.</h2><p>Crea una pantalla y dibuja sobre ella.</p><button class="primary" data-action="add-frame">Crear pantalla</button></div></div>
    <div class="canvas-bottom"><div id="selection-info">Listo para crear</div><div class="zoom-controls" role="group" aria-label="Zoom del lienzo"><span class="zoom-caption">Zoom</span>${btn('zoom-out','Alejar','minus','icon-button')}<input id="zoom-value" type="text" inputmode="decimal" aria-label="Porcentaje de zoom" value="70%" title="Zoom entre 10% y 800% · Enter para aplicar" autocomplete="off" spellcheck="false"/>${btn('zoom-in','Acercar','plus','icon-button')}<select id="zoom-options" aria-label="Opciones de zoom" title="Ajustar vista o elegir escala"><option value="">▾</option><option value="fit">Ajustar pantallas · ⇧1</option><option value="selection">Ajustar selección · ⇧2</option>${[25,50,100,200,400,800].map(value=>`<option value="${value}">${value}%</option>`).join('')}</select></div></div>
    <div class="toolbar" role="toolbar" aria-label="Herramientas de dibujo">${([['cursor','Seleccionar · V'],['frame','Pantalla · F'],['rect','Rectángulo · R'],['ellipse','Elipse · O'],['text','Texto · T'],['button','Botón · B'],['hand','Mover lienzo · Espacio']] as const).map(([k,l]) => `<button data-tool="${k}" class="${k === 'cursor' ? 'active' : ''}" title="${l}" aria-label="${l}">${icon(k,19)}</button>`).join('')}<span class="divider"></span>${btn('undo','Deshacer · ⌘Z','undo')}${btn('redo','Rehacer · ⇧⌘Z','redo')}</div>
  </main>
  <aside class="sidebar right-panel"><div class="inspector-title"><span>Propiedades</span><span class="inspector-badge">${icon('rect',13)}</span></div><div id="inspector"></div></aside></div>
  <div id="toast" role="status"></div><div id="modal-root"></div><input type="file" id="import-file" accept=".json" hidden/><input type="file" id="image-file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg,.aru.codaru.json" hidden/>`;
const dom = createViewDOM(app, !!options.modular);
document = dom.document;
const events = dom.events;
const stage = document.querySelector<HTMLDivElement>('#stage')!, world = document.querySelector<HTMLDivElement>('#world')!;
// Agent batches get visual feedback: particles settle into what changed, a pill reports progress.
const building = createBuildingFeedback({ stage, artboards: () => byId('artboards'), project: p, camera: () => ({ pan: state.pan, zoom: state.zoom }), document });
let touchedByAgent: string[] = [];
const layersEl = document.querySelector<HTMLDivElement>('#layers')!, inspector = document.querySelector<HTMLDivElement>('#inspector')!;
const selectionOverlay = document.querySelector<HTMLDivElement>('#selection-overlay')!;
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
// Pages: only the active page is drawn, hit-tested and listed; the page view is cached per document version.
const pageId = () => activePage(p()).id;
let pageViewCache: { doc: Project; id: string; view: Project; ids: Set<string> } | undefined;
function pv() { const doc = p(), id = pageId(); if (!pageViewCache || pageViewCache.doc !== doc || pageViewCache.id !== id) { const view = pageView(doc, id); pageViewCache = { doc, id, view, ids: new Set(view.nodes.map(n => n.id)) }; } return pageViewCache.view; }
const onPage = (id: string) => { pv(); return pageViewCache!.ids.has(id); };
const firstFrame = (): DesignNode | undefined => rootsOnPage(p(), pageId()).find(n => n.type === 'frame' && !n.hidden) ?? p().nodes.find(node => node.type === 'frame');
function renderPages() {
  const target = byId('pages'); if (!target) return;
  const pages = pagesOf(p()), active = pageId();
  target.innerHTML = pages.map(page => { const count = rootsOnPage(p(), page.id).filter(n => n.type === 'frame').length; return `<div class="page-row ${page.id === active ? 'active' : ''}" data-page="${esc(page.id)}"><button class="page-name" data-page="${esc(page.id)}" title="${esc(page.name)}">${icon('layers', 14)}<span>${esc(page.name)}</span></button><span class="count">${count}</span><button class="icon-button tiny page-tool" data-page-rename="${esc(page.id)}" aria-label="Renombrar página ${esc(page.name)}">✎</button>${pages.length > 1 ? `<button class="icon-button tiny page-tool" data-page-remove="${esc(page.id)}" aria-label="Eliminar página ${esc(page.name)}">×</button>` : ''}</div>`; }).join('');
}
function setPage(id: string) { if (!pagesOf(p()).some(page => page.id === id) || id === pageId()) return; p().activePageId = id; store.touch(); state.selected = []; state.selectionScope = null; render(); fit(); persist(); }

function toast(message: string) { byId('toast').textContent = message; byId('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => byId('toast').classList.remove('visible'), 3500); }
function persist() {
  if (disposed) return;
  session.notify(true);
  const serialized = store.serialize();
  if (serialized !== lastNotified) {
    lastNotified = serialized;
    try { onHostChange?.(clone(p())); } catch (error) { console.error('Codaru onChange:', error); }
  }
  if (!STORAGE) { byId('save-state').className = 'save-dot'; byId('save-state').title = 'Documento gestionado por la aplicación'; return; }
  byId('save-state').className = 'save-dot pending';
  clearTimeout(saveTimer); saveTimer = setTimeout(() => {
    if (storageWarning) { byId('save-state').className = 'save-dot error'; return; }
    try { localStorage.setItem(STORAGE!, store.serialize()); byId('save-state').className = 'save-dot'; byId('save-state').title = 'Guardado en este dispositivo'; }
    catch { byId('save-state').className = 'save-dot error'; byId('save-state').title = 'Sin espacio local: guarda un archivo'; toast('No hay espacio para el borrador. Guarda el proyecto como archivo.'); }
  }, 250);
}
function change(fn: (project: Project) => void, message?: string) {
  if (disposed) return;
  try { const before=p();store.commit(draft=>{attachFonts(draft,session.fonts);fn(draft);},draft=>validateFontChanges(before,draft,session.fonts,true)); state.selected = state.selected.filter(id => !!find(id)); render(); persist(); if (message) toast(message); }
  catch (e) { render(); toast(e instanceof Error ? e.message : 'No se pudo realizar el cambio'); }
}
function select(ids: string[], scope?: Scope) {
  closeColorPicker();
  if (disposed) return;
  state.selected = [...new Set(ids)].filter(id => !!find(id));
  state.selectionScope = scope === undefined ? state.selected.length ? commonScope(p(), state.selected) : state.selectionScope : scope;
  // Explicit layer/API selections can inspect locked nodes; pointer selection filters them.
  state.selected = [...new Set(state.selected.map(id => {
    let n = find(id)!;
    while (n.parentId !== state.selectionScope && n.id !== state.selectionScope && n.parentId) n = find(n.parentId)!;
    return n.parentId === state.selectionScope ? n.id : '';
  }).filter(Boolean))];
  renderSelection(); syncLayerSelection(); renderInspector();
}
// Selection changes only touch the rows involved; the list is rebuilt when a selected row is not on screen.
function syncLayerSelection() {
  if (tab !== 'layers') return;
  if (state.selected.some(id => !layersEl.querySelector(`[data-layer="${CSS.escape(id)}"]`))) { for (const id of state.selected) for (const a of ancestors(p(), id)) { expanded.add(a.id); collapsed.delete(a.id); } renderLayers(); return; }
  for (const row of layersEl.querySelectorAll<HTMLElement>('.layer.selected')) row.classList.remove('selected');
  for (const id of state.selected) layersEl.querySelector(`[data-layer="${CSS.escape(id)}"]`)?.classList.add('selected');
}
function canEnter(n: DesignNode) { return containerKinds.includes(n.type) && !isUnavailable(p(), n); }
function enterScope(id: Scope) {
  if (id && (!find(id) || !canEnter(find(id)!))) return;
  select([], id); setTool('cursor'); stage.focus();
}
function exitScope() {
  const n = state.selectionScope ? find(state.selectionScope) : undefined;
  select(n ? [n.id] : [], n?.parentId ?? null); setTool('cursor'); stage.focus();
}
function renderScope() {
  const scope = state.selectionScope ? find(state.selectionScope) : undefined;
  const path = scope ? [...ancestors(p(), scope.id).reverse(), scope] : [];
  byId('scope-path').innerHTML = `<button data-scope="" ${!scope ? 'aria-current="location"' : ''}>Workspace</button>${path.map(n => `<span aria-hidden="true">/</span><button data-scope="${n.id}" ${n.id === state.selectionScope ? 'aria-current="location"' : ''} title="Seleccionar hijos de ${esc(n.name)}">${esc(n.name)}</button>`).join('')}`;
  byId('scope-hint').textContent = scope ? 'Selecciona hijos · Esc para salir' : 'Doble clic o Enter para entrar';
  stage.dataset.scope = state.selectionScope || '';
}
function render() {
  stage.dataset.tool = state.tool;
  document.querySelectorAll<HTMLElement>('[data-tool]').forEach(el => el.classList.toggle('active', el.dataset.tool === state.tool));
  document.querySelectorAll<HTMLElement>('[data-mode]').forEach(el => el.classList.toggle('active', el.dataset.mode === state.mode));
  state.selected = state.selected.filter(id => !!find(id));
  if (state.selected.length) state.selectionScope = commonScope(p(), state.selected);
  while (state.selectionScope && (!find(state.selectionScope) || !canEnter(find(state.selectionScope)!))) state.selectionScope = find(state.selectionScope)?.parentId ?? null;
  state.selected = state.selected.filter(id => find(id)?.parentId === state.selectionScope);
  byId<HTMLInputElement>('project-name').value = p().name;
  byId('frame-count').textContent = `${p().nodes.filter(n => n.type === 'frame').length}`;
  byId('flow-count').textContent = `${p().nodes.filter(n => n.targetId).length}`;
  { const select = byId<HTMLSelectElement>('theme-select'); if (select && document.activeElement !== select) { select.innerHTML = Object.values(p().designThemes).map(t => `<option value="${esc(t.id)}" ${t.id === p().activeThemeId ? 'selected' : ''}>${esc(t.name)} · ${p().theme === 'light' ? 'Claro' : 'Oscuro'}</option>`).join(''); select.title = `${p().designThemes[p().activeThemeId].name} · ${p().theme === 'light' ? 'Claro' : 'Oscuro'}`; } }
  document.querySelector('[data-action="theme"]')!.innerHTML = icon(p().theme === 'light' ? 'sun' : 'moon', 16);
  (document.querySelector('[data-action="undo"]') as HTMLButtonElement).disabled = !store.undoStack.length;
  (document.querySelector('[data-action="redo"]') as HTMLButtonElement).disabled = !store.redoStack.length;
  renderPages(); renderCanvas(); renderLocaleControl(); if (tab === 'layers' || (options.modular && layersEl.isConnected)) renderLayers(); renderInspector(); if (tab === 'components' || (options.modular && byId('components').isConnected)) renderComponents(); renderSystem();
  const pending = p().components.filter(docStale).length + (designSystemStale(p()) ? 1 : 0), badge = byId('system-stale'); badge.hidden = !pending; badge.textContent = `${pending}`; badge.title = `${pending} ${pending === 1 ? 'ficha' : 'fichas'} por revisar`;
}
// Each top-level screen keeps its DOM between renders until something inside it changes; a theme, mode or page
// switch invalidates everything. Exact content identities avoid hashing large payloads on every selection.
const canvasCache = new Map<string, { sig: string; el: HTMLElement; label?: HTMLElement }>(); let canvasKey = '';
const payloads = new ContentCache<number>(); let nextPayload = 0;
const lightNode = (key: string, value: unknown) => {
  if ((key === 'image' || key === 'svg' || key === 'text') && typeof value === 'string' && value.length > 256) {
    let id = payloads.get(value); if (id === undefined) { id = ++nextPayload; payloads.set(value, id); }
    return { contentIdentity: id };
  }
  return value;
};
function rootSignatures() {
  const tops = rootIds(p()), groups = new Map<string, DesignNode[]>();
  for (const n of p().nodes) { const root = tops.get(n.id)!; const list = groups.get(root); if (list) list.push(n); else groups.set(root, [n]); }
  return new Map([...groups].map(([root, nodes]) => [root, signature(JSON.stringify(nodes, lightNode))]));
}
function frameLabel(n: DesignNode) {
  const label = document.createElement('button'); label.className = 'frame-label'; label.dataset.node = n.id; label.style.left = `${n.x}px`; label.style.top = `${n.y - 30 / state.zoom}px`; label.style.fontSize = `${11 / state.zoom}px`; label.style.height = `${24 / state.zoom}px`; label.innerHTML = `${icon('frame', 13 / state.zoom)}<span>${esc(n.name)}</span><small>${Math.round(n.width)} × ${Math.round(n.height)}</small>`;
  return label;
}
function renderCanvas() {
  const artboards = byId('artboards');
  const projection = previewProject();
  const key = `${session.fonts.revision}|${editor.getLocalizationState().revision}|${p().activeThemeId}|${p().theme}|${pageId()}|${signature(p().designThemes)}|${signature(p().components.map(c => [c.id, c.template.length]))}`;
  if (key !== canvasKey) { canvasCache.clear(); canvasKey = key; }
  const ordered: Node[] = [], seen = new Set<string>(), sigs = rootSignatures();
  for (const n of rootsOnPage(p(), pageId())) {
    if (n.hidden) continue;
    const sig = sigs.get(n.id) ?? ''; let entry = canvasCache.get(n.id);
    if (!entry || entry.sig !== sig) { entry = { sig, el: element(projection, projection.nodes.find(x=>x.id===n.id)!), label: n.type === 'frame' ? frameLabel(n) : undefined }; canvasCache.set(n.id, entry); }
    seen.add(n.id); if (entry.label) ordered.push(entry.label); ordered.push(entry.el);
  }
  for (const id of [...canvasCache.keys()]) if (!seen.has(id)) canvasCache.delete(id);
  // Preserve connected, unchanged screens (including decoded images) and only move/replace affected nodes.
  let cursor = artboards.firstChild;
  for (const child of ordered) {
    if (child === cursor) cursor = cursor.nextSibling;
    else artboards.insertBefore(child, cursor);
  }
  while (cursor) { const next = cursor.nextSibling; cursor.remove(); cursor = next; }
  if (review?.heat) {
    // One soft spot per issue: red for errors, amber for warnings, blue for notes. Overlaps add up.
    const layer = document.createElement('div'); layer.className = 'heat-layer'; layer.setAttribute('aria-hidden', 'true');
    for (const issue of review.issues) {
      const n = find(issue.node); if (!n || n.type === 'frame' || !onPage(n.id)) continue;
      const at = absolute(p(), n), spot = document.createElement('div'), grow = Math.max(18, Math.min(n.width, n.height) * .35);
      spot.className = `heat-spot ${issue.severity}`; spot.dataset.heat = issue.node;
      Object.assign(spot.style, { left: `${at.x - grow}px`, top: `${at.y - grow}px`, width: `${n.width + grow * 2}px`, height: `${n.height + grow * 2}px` });
      layer.append(spot);
    }
    artboards.append(layer);
  }
  byId('empty-canvas').hidden = p().nodes.length > 0;
  building.decorate(p(), touchedByAgent); touchedByAgent = [];
  setTransform(); renderSelection(); renderConnections();
}
// Redraw only the top-level screens that contain these nodes; the rest of the canvas keeps its DOM.
function renderRoots(ids: string[]) {
  const artboards = byId('artboards'), roots = new Set<string>(), projection = previewProject();
  for (const id of ids) { const chain = [find(id), ...ancestors(p(), id)].filter((n): n is DesignNode => !!n); roots.add((chain.at(-1) ?? chain[0])?.id ?? id); }
  for (const id of roots) {
    const n = find(id); const old = artboards.querySelector<HTMLElement>(`:scope > .design-node[data-node="${CSS.escape(id)}"]`);
    if (!n || n.hidden) { old?.remove(); continue; }
    const fresh = element(projection, projection.nodes.find(x=>x.id===n.id)!);
    if (old) old.replaceWith(fresh); else artboards.append(fresh);
    const label = artboards.querySelector<HTMLElement>(`:scope > .frame-label[data-node="${CSS.escape(id)}"]`); if (label) { label.style.left = `${n.x}px`; label.style.top = `${n.y - 30 / state.zoom}px`; }
    const entry = canvasCache.get(id); if (entry) { entry.el = fresh; entry.sig = ''; }
  }
  renderSelection(); renderConnections();
}
function setTransform() {
  session.notify(false);
  world.style.transform = `translate(${state.pan.x}px,${state.pan.y}px) scale(${state.zoom})`;
  stage.style.backgroundSize = `${20 * state.zoom}px ${20 * state.zoom}px`; stage.style.backgroundPosition = `${state.pan.x}px ${state.pan.y}px`; stage.classList.toggle('no-grid', !state.grid);
  if (document.activeElement !== byId('zoom-value')) byId<HTMLInputElement>('zoom-value').value = `${Math.round(state.zoom * 100)}%`;
  (document.querySelector('[data-action="zoom-out"]') as HTMLButtonElement).disabled = state.zoom <= MIN_ZOOM;
  (document.querySelector('[data-action="zoom-in"]') as HTMLButtonElement).disabled = state.zoom >= MAX_ZOOM;
}
// Camera changes preserve the actual artboards, including an in-progress text edit.
function renderCamera() {
  setTransform();
  for (const label of byId('artboards').querySelectorAll<HTMLElement>('.frame-label')) {
    const n = find(label.dataset.node!); if (!n) continue;
    label.style.top = `${n.y - 30 / state.zoom}px`; label.style.fontSize = `${11 / state.zoom}px`; label.style.height = `${24 / state.zoom}px`;
    const svg = label.querySelector('svg'); svg?.setAttribute('width', `${13 / state.zoom}`); svg?.setAttribute('height', `${13 / state.zoom}`);
  }
  renderSelection(); renderConnections();
}
function fit(selectionOnly = false, ids = state.selected) {
  if (gesture) return;
  const nodes = (selectionOnly ? topSelected(p(), ids).map(find).filter((n): n is DesignNode => !!n) : rootsOnPage(p(), pageId())).filter(n => !n.hidden);
  if (!nodes.length) {
    if (selectionOnly) { toast('Selecciona un elemento para ajustar la vista.'); return; }
    state.pan = { x: 80, y: 60 }; state.zoom = 1; renderCamera(); return;
  }
  const bounds = nodes.map(n => ({ ...absolute(p(), n), width: n.width, height: n.height }));
  const minX = Math.min(...bounds.map(n=>n.x)), minY = Math.min(...bounds.map(n=>n.y));
  const maxX = Math.max(...bounds.map(n=>n.x+n.width)), maxY = Math.max(...bounds.map(n=>n.y+n.height));
  state.zoom = Math.max(MIN_ZOOM, Math.min(selectionOnly ? MAX_ZOOM : 1, (stage.clientWidth - 100) / (maxX - minX), (stage.clientHeight - 140) / (maxY - minY)));
  state.pan = { x: (stage.clientWidth - (maxX-minX)*state.zoom)/2-minX*state.zoom, y: (stage.clientHeight-70-(maxY-minY)*state.zoom)/2-minY*state.zoom };
  renderCamera();
}
function zoomAt(value: number, sx = stage.clientWidth / 2, sy = stage.clientHeight / 2) {
  if (gesture || !Number.isFinite(value)) return;
  const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)); state.pan = { x: sx-(sx-state.pan.x)*next/state.zoom, y: sy-(sy-state.pan.y)*next/state.zoom }; state.zoom = next; renderCamera();
}
function focusFrame(id: string) { const f = frameOf(p(), id) || find(id); if (!f) return; state.pan = { x: stage.clientWidth / 2 - (f.x + f.width / 2)*state.zoom, y: (stage.clientHeight - 60) / 2 - (f.y + f.height / 2)*state.zoom }; setTransform(); }
function renderSelection() {
  renderScope();
  selectionOverlay.replaceChildren();
  const scope = state.selectionScope ? find(state.selectionScope) : undefined;
  if (scope) {
    const pos = absolute(p(), scope), outline = document.createElement('div'); outline.className = 'scope-outline';
    Object.assign(outline.style, { left: `${pos.x}px`, top: `${pos.y}px`, width: `${scope.width}px`, height: `${scope.height}px`, borderWidth: `${1 / state.zoom}px`, outlineOffset: `${4 / state.zoom}px` });
    selectionOverlay.append(outline);
  }
  const ns = state.selected.map(find).filter((n): n is DesignNode => !!n && !n.hidden);
  for (const n of ns) {
    const { x, y } = absolute(p(), n); const outline = document.createElement('div'); outline.className = `selection-box ${n.componentId || n.instanceOf ? 'is-component' : ''}`;
    Object.assign(outline.style, { left: `${x}px`, top: `${y}px`, width: `${n.width}px`, height: `${n.height}px`, borderWidth: `${1.5 / state.zoom}px` });
    if (ns.length === 1 && !isUnavailable(p(), n)) {
      for (const handle of ['nw','ne','se','sw']) { const el = document.createElement('span'); el.className = `resize-handle ${handle}`; el.dataset.resize = handle; el.dataset.id = n.id; Object.assign(el.style, { width: `${7/state.zoom}px`, height: `${7/state.zoom}px`, borderWidth: `${1/state.zoom}px` }); outline.append(el); }
      const size = document.createElement('span'); size.className = 'size-label'; size.style.fontSize = `${10/state.zoom}px`; size.style.bottom = `${-25/state.zoom}px`; size.style.padding = `${3/state.zoom}px ${6/state.zoom}px`; size.textContent = `${Math.round(n.width)} × ${Math.round(n.height)}`; outline.append(size);
    }
    selectionOverlay.append(outline);
  }
  session.notify(false);
  byId('selection-info').textContent = ns.length === 1 ? `${labels[ns[0].type]} / ${ns[0].name}` : ns.length ? `${ns.length} elementos seleccionados` : state.tool === 'cursor' ? 'Rueda: mover · ⌘ + rueda: zoom · ⇧1: ajustar' : `Arrastra para dibujar ${state.tool === 'hand' ? 'el lienzo' : labels[state.tool]}`;
}
function renderConnections() {
  session.notify(false);
  const svg = document.querySelector<SVGSVGElement>('#connections')!; svg.style.display = state.mode === 'flow' ? 'block' : 'none';
  svg.innerHTML = `<defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#ab8aff"/></marker></defs>`;
  if (state.mode !== 'flow') return;
  for (const n of p().nodes.filter(n => n.targetId && !n.hidden && onPage(n.id) && onPage(n.targetId!))) {
    const target = find(n.targetId!); if (!target || target.hidden) continue;
    const a = absolute(p(), n), b = absolute(p(), target); const toRight = b.x > a.x;
    const x1 = a.x + (toRight ? n.width : 0), y1 = a.y + n.height / 2, x2 = b.x + (toRight ? 0 : target.width), y2 = b.y + 42;
    const bend = Math.max(60, Math.abs(x2-x1)*.5); const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', `M${x1},${y1} C${x1+(toRight?bend:-bend)},${y1} ${x2+(toRight?-bend:bend)},${y2} ${x2},${y2}`); path.setAttribute('stroke','#ab8aff'); path.setAttribute('stroke-width',`${2/state.zoom}`); path.setAttribute('fill','none'); path.setAttribute('marker-end','url(#arrowhead)'); svg.append(path);
  }
}
function renderLayers() {
  const visit = (parentId: string | null, depth: number): string => (parentId === null ? rootsOnPage(p(), pageId()) : children(p(), parentId)).map(n => {
    const kids = children(p(), n.id); const selectedClass = state.selected.includes(n.id) ? ' selected' : ''; const collapsedClass = isCollapsed(n) ? ' closed' : '';
    return `<div class="layer${selectedClass}${n.hidden ? ' is-hidden' : ''}${n.type === 'frame' ? ' frame-layer' : ''}" data-layer="${esc(n.id)}" style="--depth:${depth}"><button class="collapse${collapsedClass}" data-collapse="${esc(n.id)}" aria-label="${isCollapsed(n)?'Expandir':'Contraer'} ${esc(n.name)}" ${!kids.length?'style="visibility:hidden"':''}>${icon('chevron',10)}</button><span class="layer-icon ${n.componentId || n.instanceOf ? 'purple' : ''}">${icon(n.componentId || n.instanceOf ? 'component' : n.type,14)}</span><span class="layer-name">${esc(n.name)}</span><button class="layer-action ${n.locked?'on':''}" data-lock="${n.id}" aria-label="${n.locked?'Desbloquear':'Bloquear'} ${esc(n.name)}">${icon('lock',12)}</button><button class="layer-action ${n.hidden?'on':''}" data-hide="${n.id}" aria-label="${n.hidden?'Mostrar':'Ocultar'} ${esc(n.name)}">${icon('eye',12)}</button></div>${!isCollapsed(n)?visit(n.id,depth+1):''}`;
  }).join('');
  layersEl.innerHTML = visit(null,0) || '<p class="empty-note">Las capas de tus pantallas aparecerán aquí.</p>';
}
async function loadKits() {
  if(kitModule)return kitModule;
  kitModule = await import('./kits');
  renderComponents();
  return kitModule;
}
function renderComponents() {
  const target=byId('components');
  const tabs=`<div class="library-tabs"><button data-library="local" aria-pressed="${libraryTab==='local'}">Locales</button><button data-library="kits" aria-pressed="${libraryTab==='kits'}">Kits de diseño</button><button data-library="icons" aria-pressed="${libraryTab==='icons'}">Iconos</button><button data-library="resources" aria-pressed="${libraryTab==='resources'}">Recursos</button><button data-library="styles" aria-pressed="${libraryTab==='styles'}">Estilos</button></div>`;
  if(libraryTab==='local') {
    const comps=p().components, loose=comps.filter(c=>!c.set), sets=new Map<string,typeof comps>(); for(const c of comps.filter(c=>c.set)) sets.set(c.set!,[...(sets.get(c.set!)??[]),c]);
    const tile=(c:typeof comps[number],label:string)=>`<button class="component-tile" data-component="${c.id}" draggable="true"><span class="component-preview" data-tile-preview="${c.id}"></span><strong>${esc(label)}</strong><small>Arrastra al lienzo o haz clic</small></button>`;
    target.innerHTML = tabs+`<div class="component-caption">Tu biblioteca local <span>${comps.length}</span></div>${loose.map(c=>tile(c,c.name)).join('')}${[...sets].map(([,list])=>`<div class="component-caption variant-caption">${esc(list[0].setName??list[0].name)} <span>${list.length} ${list.length===1?'variante':'variantes'}</span></div>${list.map(c=>tile(c,variantLabel(c.variant)||c.name)).join('')}`).join('')}${comps.length?'':'<p class="empty-note">Selecciona un elemento o grupo y pulsa «Crear componente».</p>'}`;
    for(const slot of target.querySelectorAll<HTMLElement>('[data-tile-preview]')){const c=comps.find(c=>c.id===slot.dataset.tilePreview);if(c)slot.append(componentPreview(c,170,70));}
    return;
  }
  if(libraryTab==='styles'){ stylePanel.render(target,tabs); return; }
  if(libraryTab==='resources'){ renderResources(target, tabs); return; }
  if(libraryTab==='icons'){
    if(!iconModule){target.innerHTML=tabs+'<p class="empty-note">Cargando iconos…</p>';return;}
    const pack=iconModule.iconPacks.find(k=>k.id===iconPack)!;
    const items=iconModule.getIconItems(iconPack).filter(i=>`${i.id} ${i.name} ${i.tags.join(' ')}`.toLocaleLowerCase().includes(iconSearch.toLocaleLowerCase()));
    target.innerHTML=tabs+`<label class="full-field"><span>Familia de iconos</span><select id="icon-pack" aria-label="Kit de iconos">${iconModule.iconPacks.map(k=>`<option value="${k.id}" ${k.id===iconPack?'selected':''}>${esc(k.name)}</option>`).join('')}</select></label><input id="icon-search" aria-label="Buscar iconos" placeholder="Buscar iconos…" value="${esc(iconSearch)}"/><p class="kit-description">${esc(pack.description)}</p><div class="component-caption">${items.length} iconos <span>Vectores</span></div><div class="icon-library-grid">${items.map(i=>`<button draggable="true" data-icon-item="${i.id}" title="${esc(i.name)}" aria-label="Insertar icono ${esc(i.name)}">${iconModule!.iconSVG(iconPack,i.id,'currentColor',24)}<span>${esc(i.name)}</span></button>`).join('')||'<p class="empty-note">Sin coincidencias.</p>'}</div>`;
    return;
  }
  if(!kitModule){target.innerHTML=tabs+'<p class="empty-note">Cargando kits…</p>';return;}
  const items=kitModule.getKitItems(kitId).filter(item=>`${item.name} ${item.category}`.toLocaleLowerCase().includes(kitSearch.toLocaleLowerCase()));
  target.innerHTML=tabs+`<label class="full-field"><span>Plataforma</span><select aria-label="Kit de diseño" id="kit-platform">${kitModule.kits.map(k=>`<option value="${k.id}" ${k.id===kitId?'selected':''}>${k.name}</option>`).join('')}</select></label><label class="full-field"><span>Estado visual</span><select aria-label="Variante del kit" id="kit-variant">${[['default','Normal'],['selected','Seleccionado'],['disabled','Deshabilitado']].map(([id,label])=>`<option value="${id}" ${id===kitVariant?'selected':''}>${label}</option>`).join('')}</select></label><input id="kit-search" aria-label="Buscar componentes" placeholder="Buscar componentes…" value="${esc(kitSearch)}"/><p class="kit-description">${esc(kitModule.kits.find(k=>k.id===kitId)!.description)}</p><div class="component-caption">${items.length} componentes <span>Originales · v1</span></div><div id="kit-results">${items.map(item=>`<button class="component-tile kit-tile" data-kit-item="${item.id}" draggable="true"><span class="kit-preview" aria-hidden="true"></span><strong>${esc(item.name)}</strong><small>${esc(item.category)} · ${item.width} × ${item.height}</small></button>`).join('')||'<p class="empty-note">No hay coincidencias.</p>'}</div>`;
  for(const tile of target.querySelectorAll<HTMLElement>('[data-kit-item]')) {
    const doc=blank(),id=kitModule.insertKitItem(doc,kitId,tile.dataset.kitItem!,null,0,0,kitVariant),root=doc.nodes.find(n=>n.id===id)!;
    const preview=element(doc,root),scale=Math.min(1,156/root.width,72/root.height);
    preview.style.transform=`scale(${scale})`;preview.style.transformOrigin='0 0';preview.style.left=`calc(50% - ${root.width*scale/2}px)`;preview.style.top=`${(88-root.height*scale)/2}px`;
    tile.querySelector('.kit-preview')!.append(preview);
  }
}
async function insertKit(itemId: string,position?:{x:number;y:number}) {
  const kits=await loadKits();const current=find(state.selected[0]);
  let parent=position?parentAt(position.x,position.y):current&&(containerKinds.includes(current.type)?current:find(current.parentId!))||find(state.selectionScope!)||firstFrame();
  // Repeated insertions go beside instances; masters can compose kit components.
  while(parent&&(parent.instanceOf||ancestors(p(),parent.id).some(n=>n.instanceOf)))parent=find(parent.parentId!);
  if(parent&&isUnavailable(p(),parent)){toast('Desbloquea el contenedor para insertar elementos.');return;}
  const pos=parent?absolute(p(),parent):{x:0,y:0};let id='';
  const siblings=children(p(),parent?.id??null).filter(n=>n.kitId);const offset=(siblings.length%8)*20;
  change(pr=>{id=kits.insertKitItem(pr,kitId,itemId,parent?.id??null,position?position.x-pos.x:32+offset,position?position.y-pos.y:32+offset,kitVariant);},'Componente añadido · sus hijos son editables');
  if(id){select([id]);setTool('cursor');}
}
// Free resource bank: searches run only when the person types; results carry their license and credit.
let resourceBank = false;
const stylePanel = createStylePackagePanel({editor, save:saveFile, changed:()=>{renderComponents();persist();}, error:toast,
  ...(nativeInvoke?{read:()=>nativeInvoke!<string|null>('plugin:codaru|open_document')}:{})});
const drawingPanel = createResourceLibraryPanel({editor, project:p, refresh:renderComponents, save:saveFile, error:toast,
  insert:async id=>{
    const current=find(state.selected[0]); let parent=current && (containerKinds.includes(current.type)?current:find(current.parentId!)) || find(state.selectionScope!) || firstFrame();
    while(parent && (parent.instanceOf || ancestors(p(),parent.id).some(n=>n.instanceOf)))parent=find(parent.parentId!);
    await editor.insertResource(id,{parentId:parent?.id ?? null,x:32,y:32});
  }});
function renderResources(target: HTMLElement, tabs: string) {
  if (!resourceBank) { drawingPanel.render(target, tabs); return; }
  tabs += '<button class="wide-button" data-drawing-local>← Mis dibujos y biblioteca</button>';
  const sources = resourceModule?.resourceSources ?? [{ id: 'iconify' as const, name: 'Iconos e ilustraciones · Iconify', hint: '', terms: '' }];
  const source = sources.find(s => s.id === resourceSource) ?? sources[0];
  const tile = (h: import('./resources').ResourceHit) => `<button class="resource-tile ${h.kind}" draggable="true" data-resource="${esc(h.id)}" title="${esc(creditLine(h))}"><img src="${esc(h.thumb)}" alt="" loading="lazy" decoding="async"/><span>${esc(h.title)}</span>${h.kind === 'image' ? `<small>${esc(h.creator ?? '')}${h.creator ? ' · ' : ''}${esc(h.license)}</small>` : `<small>${esc(h.set ?? '')} · ${esc(h.license)}</small>`}</button>`;
  const body = resourceState === 'loading' ? '<p class="empty-note">Buscando…</p>' : resourceState === 'error' ? `<p class="empty-note resource-error">${esc(resourceError)}</p>` : resourceState === 'done' && !resourceHits.length ? '<p class="empty-note">Sin resultados. Prueba en inglés: «piano», «music», «teacher».</p>' : resourceState === 'idle' && resourceSource !== 'picsum' ? '<p class="empty-note">Escribe qué buscas. Los recursos se descargan solo cuando los pides; el editor no necesita conexión para lo demás.</p>' : `<div class="resource-grid ${resourceSource}">${resourceHits.map(tile).join('')}</div>`;
  target.innerHTML = tabs + `<button class="wide-button" data-action="image" title="Importa un archivo .aru.codaru.json preparado con codaru-aru">Importar recurso ARU</button><p class="field-note">Iconos e ilustraciones propios, con fuente editable y capas animables.</p><label class="full-field"><span>Fuente</span><select id="resource-source" aria-label="Fuente de recursos">${sources.map(s => `<option value="${s.id}" ${s.id === resourceSource ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>${resourceSource === 'picsum' ? `<div class="resource-row"><input id="resource-seed" aria-label="Semilla de fotos" placeholder="Semilla" value="${esc(resourceSeed)}"/><button class="text-button" data-action="resource-reseed">Otras fotos</button></div>` : `<input id="resource-search" aria-label="Buscar recursos" placeholder="${resourceSource === 'iconify' ? 'Buscar iconos e ilustraciones…' : 'Buscar fotos…'}" value="${esc(resourceQuery)}"/>`}<p class="kit-description">${esc(source.hint)}${source.terms ? ` <a href="${esc(source.terms)}" target="_blank" rel="noreferrer">Licencia</a>` : ''}</p>${body}<p class="field-note">Al insertar, el nombre de la capa guarda el crédito y la licencia. Las fotos CC BY y CC BY-SA requieren atribución en el producto final.</p>`;
}
function creditLine(h: import('./resources').ResourceHit) { return resourceModule ? resourceModule.creditName(h) : h.title; }
async function loadResources() { if (!resourceModule) { resourceModule = await import('./resources'); if (resourceSource === 'picsum') resourceHits = resourceModule.picsumHits(resourceSeed); renderComponents(); } return resourceModule; }
function searchResources(immediate = false) {
  clearTimeout(resourceTimer);
  const run = async () => {
    const lib = await loadResources(); if (disposed) return;
    resourceAbort?.abort(); const controller = new AbortController(); resourceAbort = controller;
    if (resourceSource === 'picsum') { resourceHits = lib.picsumHits(resourceSeed); resourceState = 'done'; renderComponents(); return; }
    if (!resourceQuery.trim()) { resourceHits = []; resourceState = 'idle'; renderComponents(); return; }
    resourceState = 'loading'; renderComponents();
    try {
      const url = resourceSource === 'iconify' ? lib.iconifySearchURL(resourceQuery) : lib.openverseSearchURL(resourceQuery);
      const response = await fetch(url, { signal: controller.signal }); if (!response.ok) throw new Error(`El servicio respondió ${response.status}`);
      const json = await response.json(); if (controller.signal.aborted || disposed) return;
      resourceHits = resourceSource === 'iconify' ? lib.parseIconify(json) : lib.parseOpenverse(json); resourceState = 'done';
    } catch (error) { if (controller.signal.aborted) return; resourceState = 'error'; resourceError = /fetch|network|Failed/i.test(String(error)) ? 'Sin conexión o servicio no disponible. El banco de recursos necesita internet; el resto del editor no.' : String(error instanceof Error ? error.message : error); }
    renderComponents();
  };
  if (immediate) void run(); else resourceTimer = setTimeout(() => void run(), 350);
}
async function insertResource(id: string, position?: { x: number; y: number }) {
  const lib = await loadResources(); const hit = resourceHits.find(h => h.id === id); if (!hit) return;
  const current = find(state.selected[0]);
  let parent = position ? parentAt(position.x, position.y) : current && (containerKinds.includes(current.type) ? current : find(current.parentId!)) || find(state.selectionScope!) || firstFrame();
  while (parent && (parent.instanceOf || ancestors(p(), parent.id).some(n => n.instanceOf))) parent = find(parent.parentId!);
  if (parent && isUnavailable(p(), parent)) { toast('Desbloquea el contenedor para insertar elementos.'); return; }
  const pos = parent ? absolute(p(), parent) : { x: 0, y: 0 }, x = position ? position.x - pos.x : 32, y = position ? position.y - pos.y : 32;
  toast('Descargando…');
  try {
    let created: DesignNode;
    if (hit.kind === 'vector') {
      const svg = sanitizeSVG(await lib.fetchSVGText(hit.svgUrl!)); if (disposed) return;
      const size = vectorSize(svg), width = Math.min(96, size.width || 64);
      created = node('vector', { parentId: parent?.id ?? null, x, y, width, height: Math.max(1, Math.round(width * (size.height || 64) / (size.width || 64))), svg, name: lib.creditName(hit), color: '@text' });
    } else {
      const image = await lib.fetchImageDataURL(hit.imageUrl!, { maxSize: 800 }); if (disposed) return;
      const width = Math.min(300, image.width);
      created = node('image', { parentId: parent?.id ?? null, x, y, width, height: Math.max(1, Math.round(width * image.height / image.width)), image: image.data, name: lib.creditName(hit) });
    }
    change(pr => pr.nodes.push(created), `Añadido · ${lib.creditName(hit)}`); select([created.id]); setTool('cursor');
  } catch (error) { toast(error instanceof Error ? error.message : 'No se pudo descargar el recurso.'); }
}
async function loadIcons(){if(!iconModule){iconModule=await import('./icon-library');renderComponents();}return iconModule;}
async function insertLibraryIcon(name:string,position?:{x:number;y:number}){
  const library=await loadIcons(),current=find(state.selected[0]);
  let parent=position?parentAt(position.x,position.y):current&&(containerKinds.includes(current.type)?current:find(current.parentId!))||find(state.selectionScope!)||firstFrame();
  while(parent&&(parent.instanceOf||ancestors(p(),parent.id).some(n=>n.instanceOf)))parent=find(parent.parentId!);
  if(parent&&isUnavailable(p(),parent)){toast('Desbloquea el contenedor para insertar elementos.');return;}
  const pos=parent?absolute(p(),parent):{x:0,y:0};let id='';
  change(pr=>{id=library.insertIcon(pr,iconPack,name,parent?.id??null,position?position.x-pos.x:32,position?position.y-pos.y:32,24);},'Icono añadido · cambia color y tamaño en Propiedades');
  if(id){select([id]);setTool('cursor');}
}
function numField(label: string, key: keyof DesignNode, value: number, min = 0, max = 10000, step = 1) { return `<label class="number-field"><span title="${esc(label)}">${label}</span><input type="number" aria-label="${esc(label)}" data-field="${key}" value="${Math.round(value*100)/100}" min="${min}" max="${max}" step="${step}"/></label>`; }
function selectField(label: string, field: keyof DesignNode, value: string, options: [string,string][]) { return `<label class="full-field"><span>${label}</span><select data-field="${field}" aria-label="${esc(label)}">${options.map(([v,l])=>`<option value="${v}" ${v===value?'selected':''}>${l}</option>`).join('')}</select></label>`; }
function colorField(label: string, field: keyof DesignNode, value: string) {
  const n=state.selected.length===1?find(state.selected[0]):undefined; const resolved=color(p(),value,n); const keys=Object.keys(effectiveTheme(p(),n).tokens.colors);
  return `<div class="color-field"><button type="button" class="color-chip" data-pick="${label}: valor" aria-label="${label}: color" title="Elegir color" style="--chip:${esc(resolved)}"></button><input class="hex-input" aria-label="${label}: valor" data-field="${field}" value="${esc(value)}"/><select aria-label="${label}: estilo" data-field="${field}"><option value="${esc(value)}">${value.startsWith('@')?value.slice(1):label}</option>${keys.filter(t=>'@'+t!==value).map(t=>`<option value="@${t}">${t}</option>`).join('')}<option value="transparent">Sin relleno</option></select></div>`;
}
/** Fill type offers the theme's gradients next to the local solid/linear/radial fills. */
function fillFields(n: DesignNode) {
  const gradients=effectiveTheme(p(),n).tokens.gradients, linked=n.fillToken&&Object.hasOwn(gradients,n.fillToken)?gradients[n.fillToken]:undefined;
  const option=(value:string,label:string,selected:boolean)=>`<option value="${esc(value)}" ${selected?'selected':''}>${esc(label)}</option>`;
  const themed=Object.entries(gradients).map(([id,g])=>option('token:'+id,g.name,n.fillToken===id)).join('');
  const type=`<label class="full-field"><span>Tipo</span><select data-fill-type aria-label="Tipo">${option('none','Sólido',!linked&&n.gradient==='none')}${option('linear','Gradiente lineal',!linked&&n.gradient==='linear')}${option('radial','Gradiente radial',!linked&&n.gradient==='radial')}${themed?`<optgroup label="Degradados del tema">${themed}</optgroup>`:''}</select></label>`;
  const custom=!linked&&n.gradient!=='none'&&n.gradientStops, shown=linked??(custom?{type:n.gradient,angle:n.gradientAngle,stops:n.gradientStops!,name:''}:undefined);
  if(shown){
    const stops=shown.stops.map(stop=>`${color(p(),stop.color,n)} ${stop.position}%`).join(',');
    const bar=`<button type="button" class="gradient-preview" data-pick-fill aria-label="${linked?`Degradado del tema ${esc(linked.name)}`:'Editar degradado'}" title="Editar degradado" style="--chip:${shown.type==='linear'?`linear-gradient(90deg,${stops})`:`radial-gradient(circle,${stops})`}"></button>`;
    if(linked)return `${type}${bar}<p class="field-note">«${esc(linked.name)}» viene del tema: ${linked.stops.length} colores${linked.type==='linear'?`, ${linked.angle}°`:', radial'}. Cambia con el tema y el modo. <button class="text-button" data-action="themes">Editar en Temas</button></p>`;
    return `${type}${bar}${n.gradient==='linear'?numField('Ángulo','gradientAngle',n.gradientAngle,0,360):''}<p class="field-note">${n.gradientStops!.length} colores. Pulsa la barra para editar las paradas.</p>`;
  }
  return `${type}${colorField('Relleno','fill',n.fill)}${n.gradient!=='none'?`${colorField('Segundo color','gradientEnd',n.gradientEnd)}${n.gradient==='linear'?numField('Ángulo','gradientAngle',n.gradientAngle,0,360):''}`:''}`;
}
function pickerContext(n?: DesignNode) {
  const theme=effectiveTheme(p(),n).tokens, resolve=(value:string)=>{try{return color(p(),value,n);}catch{return '#ffffff';}};
  return {resolve,tokens:Object.fromEntries(Object.keys(theme.colors).map(key=>[key,resolve('@'+key)]))};
}
/** The fill picker owns solid colors, theme gradients and custom multi-stop gradients. */
function openFillPicker(anchor: HTMLElement, n: DesignNode) {
  const theme=effectiveTheme(p(),n).tokens, linked=n.fillToken&&Object.hasOwn(theme.gradients,n.fillToken)?n.fillToken:undefined, id=n.id;
  const own:GradientValue|undefined=n.gradient==='none'?undefined:{type:n.gradient,angle:n.gradientAngle,stops:n.gradientStops??[{color:n.fill,position:0},{color:n.gradientEnd,position:100}]};
  const value=({type,angle,stops}:GradientValue):GradientValue=>({type,angle,stops:stops.map(stop=>({...stop}))});
  openColorPicker({...pickerContext(n),anchor,value:n.fill,
    commit:fill=>change(pr=>updateNode(pr,id,{fill,gradient:'none',gradientStops:undefined,fillToken:undefined})),
    gradient:{value:linked?value(theme.gradients[linked]):own,themeId:linked,theme:Object.entries(theme.gradients).map(([token,g])=>({id:token,name:g.name,value:value(g)})),
      // fill and gradientEnd mirror the ends so older readers still show a two-color gradient.
      commit:g=>change(pr=>updateNode(pr,id,{gradient:g.type,gradientAngle:g.angle,gradientStops:g.stops,fill:g.stops[0].color,gradientEnd:g.stops.at(-1)!.color,fillToken:undefined})),
      pickTheme:token=>change(pr=>updateNode(pr,id,{fillToken:token}))}});
}
function reviewPanel() {
  if (!review) return `<section class="inspector-section"><div class="section-heading"><span>REVISIÓN DE DISEÑO</span></div><p class="field-note">Busca poco contraste en claro y oscuro, zonas táctiles pequeñas, contenido recortado o bajo el sistema, colores fuera del tema y desalineaciones.</p><button class="wide-button" data-action="lint">${icon('check',16)} Revisar el diseño</button></section>`;
  const summary=lintSummary(review.issues), frames=new Map<string,LintIssue[]>();
  for(const issue of review.issues){const key=issue.frame??'';frames.set(key,[...(frames.get(key)??[]),issue]);}
  const mark={error:'●',warning:'▲',info:'○'};
  return `<section class="inspector-section review-panel"><div class="section-heading"><span>REVISIÓN DE DISEÑO</span><button class="text-button" data-action="lint-close">Cerrar</button></div>
    <p class="review-summary" role="status">${review.issues.length?`<b class="error">${summary.errors} errores</b> · <b class="warning">${summary.warnings} avisos</b> · <b class="info">${summary.notes} notas</b>`:'Sin problemas detectados.'}</p>
    <label class="check-field"><input type="checkbox" data-heat ${review.heat?'checked':''}/> Mapa de calor en el lienzo</label>
    <div class="review-list">${[...frames].map(([id,list])=>`<div class="review-frame">${esc(find(id)?.name??(list.every(i=>i.rule==='palette')?'Paleta del tema':'Fuera de pantalla'))} <span>${list.length}</span></div>${list.slice(0,30).map(issue=>`<button class="review-issue ${issue.severity}" data-lint-node="${esc(issue.node)}" title="${esc(issue.fix)}"><i>${mark[issue.severity]}</i><span><strong>${lintRules[issue.rule]}${issue.mode?` · ${issue.mode==='light'?'claro':'oscuro'}`:''}</strong>${esc(issue.message)}</span></button>`).join('')}${list.length>30?`<p class="field-note">…y ${list.length-30} más en esta pantalla.</p>`:''}`).join('')}</div>
    <button class="wide-button" data-action="lint">Volver a revisar</button></section>`;
}
function themePanel() {
  return `<section class="inspector-section"><div class="section-heading"><span>TEMA DEL PROYECTO</span><button data-action="theme" class="text-button">${p().theme==='light'?'Claro':'Oscuro'}</button></div><div class="palette">${tokens.map(t=>`<button type="button" class="color-chip" data-pick-token="${t}" title="${t}" aria-label="Color del tema ${t}" style="--chip:${esc(color(p(),'@'+t))}"></button>`).join('')}</div><p class="palette-note">${esc(p().designThemes[p().activeThemeId].name)} · colores y estilos compartidos.</p><button class="wide-button" data-action="themes">Configurar temas y tokens →</button></section>`;
}
function devicePanel(n: DesignNode) {
  const groups=[...new Set(devicePresets.map(d=>d.group))], current=devicePresets.find(d=>d.id===n.device&&((d.width===n.width&&d.height===n.height)||(d.width===n.height&&d.height===n.width)));
  return `<section class="inspector-section"><div class="section-heading"><span>DISPOSITIVO</span><button class="text-button" data-action="rotate-frame" title="Intercambiar ancho y alto">Girar ⟳</button></div>
    <label class="full-field"><span>Tamaño de pantalla</span><select data-device aria-label="Tamaño de pantalla"><option value="">Personalizado · ${Math.round(n.width)} × ${Math.round(n.height)}</option>${groups.map(group=>`<optgroup label="${group}">${devicePresets.filter(d=>d.group===group).map(d=>`<option value="${d.id}" ${current?.id===d.id?'selected':''}>${d.name} · ${d.width} × ${d.height}${d.approximate?' ≈':''}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <div class="field-grid"><label class="full-field"><span>Pliegue</span><select data-fold="axis" aria-label="Pliegue"><option value="">Sin pliegue</option><option value="vertical" ${n.fold?.axis==='vertical'?'selected':''}>Vertical · libro</option><option value="horizontal" ${n.fold?.axis==='horizontal'?'selected':''}>Horizontal · tapa</option></select></label>${n.fold?`<label class="number-field"><span>Bisagra</span><input type="number" aria-label="Ancho de la bisagra" data-fold="gap" value="${n.fold.gap}" min="0" max="200" step="1"/></label><label class="full-field"><span>Paneles</span><select data-fold="panels" aria-label="Paneles del plegable"><option value="2" ${panelsOf(n)===2?'selected':''}>2 · una bisagra</option><option value="3" ${panelsOf(n)===3?'selected':''}>3 · tríptico</option></select></label>`:''}</div>
    <div class="field-grid"><label class="full-field"><span>Marco</span><select data-frame-field="skin" aria-label="Marco del dispositivo"><option value="">Sin marco</option>${Object.entries(deviceSkins).map(([id,skin])=>`<option value="${id}" ${n.skin===id?'selected':''}>${skin.name}</option>`).join('')}</select></label><label class="full-field"><span>Otra postura</span><select data-frame-field="foldPair" aria-label="Pantalla en la otra postura"><option value="">Ninguna</option>${p().nodes.filter(f=>f.type==='frame'&&f.id!==n.id).map(f=>`<option value="${f.id}" ${n.foldPair===f.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select></label></div>
    <div class="stops-heading">Área segura <span>sup. · der. · inf. · izq.</span></div><div class="field-grid safe-fields">${(['top','right','bottom','left'] as const).map(edge=>`<label class="number-field"><span>${{top:'↑',right:'→',bottom:'↓',left:'←'}[edge]}</span><input type="number" aria-label="Área segura ${{top:'superior',right:'derecha',bottom:'inferior',left:'izquierda'}[edge]}" data-safe="${edge}" value="${n.safeArea?.[edge]??0}" min="0" max="400" step="1"/></label>`).join('')}</div>
    <p class="field-note">Ancho ${sizeClass(n.width)} (${Math.round(n.width)}).${current?.approximate?' Medidas aproximadas (≈): ajústalas si conoces las oficiales.':''}${n.safeArea?' Las bandas rosas marcan el área del sistema; no aparecen al presentar.':''}${n.skin?' El marco del dispositivo se ve completo en Presentar.':''}${n.fold?' Evita colocar contenido clave sobre la línea del pliegue.':''}${postureGroup(p(),n.id).length>1?` Al presentar podrás alternar entre sus ${postureGroup(p(),n.id).length} posturas.`:''}</p></section>`;
}
function tokenPanel(n: DesignNode) {
  const theme=effectiveTheme(p(),n),s=theme.tokens;
  const choices=(values:Record<string,unknown>):[string,string][]=>[['','Sin vínculo'],...Object.entries(values).map(([id,value]):[string,string]=>[id,typeof value==='object'&&value?(value as {name:string}).name:id])];
  return `${n.type==='frame'?`${n.parentId===null?`<section class="inspector-section"><div class="section-heading"><span>PÁGINA Y ROL</span></div>${pagesOf(p()).length>1?selectField('Página de esta pantalla','page',n.page??pagesOf(p())[0].id,pagesOf(p()).map(page=>[page.id,page.name] as [string,string])):''}${selectField('Rol del marco','role',n.role??'',[['',`Automático · ${roleOf(p(),n)==='screen'?'pantalla':'anotación'}`],['screen','Pantalla del producto'],['annotation','Anotación o rótulo'],['library','Biblioteca de componentes']])}<p class="field-note">Las pantallas pasan la revisión completa (zonas táctiles, área segura, pliegue); las anotaciones y bibliotecas no.</p></section>`:''}${devicePanel(n)}<section class="inspector-section"><div class="section-heading"><span>TEMA DE ESTA PANTALLA</span></div>${selectField('Tema de pantalla','themeId',n.themeId??'',[['','Heredar documento'],...Object.values(p().designThemes).map(t=>[t.id,t.name] as [string,string])])}${selectField('Modo de pantalla','themeMode',n.themeMode??'inherit',[['inherit','Heredar documento'],['light','Claro'],['dark','Oscuro']])}<label class="full-field"><span>Estilo de plataforma</span><select aria-label="Aplicar tema de kit" id="frame-kit"><option value="">Elegir kit…</option>${[['ios','iOS'],['macos','macOS'],['android','Android'],['linux','Linux / GNOME'],['web','Web']].map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label></section>`:''}<section class="inspector-section"><div class="section-heading"><span>TOKENS</span><button class="text-button" data-action="themes">Editar</button></div><p class="field-note">${esc(p().designThemes[theme.id].name)} · ${theme.mode==='light'?'Claro':'Oscuro'}</p>${selectField('Token de relleno','fillToken',n.fillToken??'',choices({...s.colors,...s.gradients}))}${selectField('Material','materialToken',n.materialToken??'',choices(s.materials))}${selectField('Token de radio','radiusToken',n.radiusToken??'',choices(s.radii))}${['text','button','input'].includes(n.type)?selectField('Token de tipografía','typographyToken',n.typographyToken??'',choices(s.typography)):''}<p class="field-note">Un vínculo controla esa propiedad. «Sin vínculo» permite usar el valor manual.</p></section>`;
}
function assetPanel() {
  if (!state.selected.length) return '';
  return `<section class="inspector-section"><div class="section-heading"><span>EXPORTAR ASSET</span></div><p class="field-note">Elemento o selección, con fondo transparente y sus hijos.</p><div class="button-row"><button data-action="asset-svg">SVG</button><button data-action="asset-png">PNG · 1×</button></div><button class="wide-button" data-action="asset-ios">iOS · .imageset</button><button class="wide-button" data-action="asset-android">Android · drawable</button><button class="wide-button" data-action="asset-all">iOS + Android · ZIP</button><p class="field-note">El ZIP incluye el SVG fuente. Cristal: tinte y borde, sin desenfoque del fondo.</p></section>`;
}
let exportingAsset = false;
async function saveAsset(format: 'svg' | 'png' | 'assets', platform: 'ios' | 'android' | 'all' = 'all') {
  if (exportingAsset) { toast('Preparando el asset…'); return; }
  const snapshot = attachFonts(clone(previewProject()),session.fonts), ids = [...state.selected]; exportingAsset = true;
  try {
    toast('Preparando el asset…');
    const { exportAsset } = await import('./asset-export'); if (disposed) return;
    await editor.loadFonts();
    const result = await exportAsset(snapshot, { ids, format, platform }); if (disposed) return;
    await saveFile(result.content, result.filename, format === 'assets' ? 'zip' : format, result.encoding);
  } finally { exportingAsset = false; }
}
function readLocalizationIssues(): LocalizationIssue[] {
  const config = session.localization(), issues = localizationIssues(p(), config);
  if (!config?.locale) return issues;
  for (const n of p().nodes) {
    if (!n.textKey || n.hidden || ancestors(p(),n.id).some(a=>a.hidden)) continue;
    const text = byId('artboards').querySelector<HTMLElement>(`.design-node[data-node="${CSS.escape(n.id)}"] > .node-text`);
    if (!text?.isConnected || !text.textContent) continue;
    const box = text.getBoundingClientRect(); if (!box.width || !box.height) continue;
    const range = ownerDocument.createRange(); range.selectNodeContents(text);
    const ink = range.getBoundingClientRect(), tolerance = Math.max(.6, state.zoom * .6);
    for (let i = issues.length - 1; i >= 0; i--) if (issues[i].node === n.id && issues[i].kind === 'overflow') issues.splice(i,1);
    if (ink.left < box.left - tolerance || ink.right > box.right + tolerance || ink.top < box.top - tolerance || ink.bottom > box.bottom + tolerance) issues.push({ kind:'overflow',node:n.id,key:n.textKey,locale:config.locale,measurement:'dom',message:'El texto se recorta en esta capa. Amplía su tamaño o ajusta la tipografía.' });
  }
  return issues;
}
function renderLocaleControl() {
  const info = editor.getLocalizationState(), select = byId<HTMLSelectElement>('locale-select');
  select.innerHTML = `<option value="">Texto de origen</option>${info.locales.map(locale=>`<option value="${esc(locale.id)}">${esc(locale.label)}</option>`).join('')}`;
  select.value = info.locale ?? ''; select.disabled = !info.locales.length;
  select.title = info.locales.length ? 'Idioma del mockup' : 'El IDE proporciona el catálogo de traducciones';
  const count = readLocalizationIssues().length, button = document.querySelector<HTMLButtonElement>('[data-action="locale-review"]')!;
  button.hidden = !count; button.textContent = `${count} ${count===1?'aviso':'avisos'}`; button.setAttribute('aria-label',`Revisar localización: ${count} avisos`);
}
function localizationPanel(n: DesignNode) {
  const info=editor.getLocalizationState(), config=session.localization(), value=resolveText(n,config), issues=readLocalizationIssues().filter(i=>i.node===n.id);
  const keys=[...new Set(Object.values(config?.messages??{}).flatMap(entries=>Object.keys(entries)))].sort().slice(0,200);
  return `<section class="inspector-section localization-panel"><div class="section-heading"><span>LOCALIZACIÓN</span></div><label class="full-field"><span>Clave del proyecto</span><input aria-label="Clave de localización" data-text-key list="localization-keys" maxlength="200" placeholder="onboarding.start" value="${esc(n.textKey??'')}"/></label><datalist id="localization-keys">${keys.map(key=>`<option value="${esc(key)}"></option>`).join('')}</datalist>${n.textKey?`<p class="field-note">Vista previa · ${esc(info.locale??'texto de origen')}${value.source==='fallback'?' · idioma de respaldo':''}</p><div class="localized-text">${esc(value.text)}</div>${issues.map(issue=>`<p class="localization-warning" data-localization-issue="${issue.kind}">${esc(issue.message)}</p>`).join('')}${info.canRequestTranslation?'<button class="wide-button" data-action="translation-request">Abrir clave en el IDE</button>':''}`:'<p class="field-note">Vincula una clave para previsualizar sus traducciones. El texto de origen se conserva.</p>'}${!info.locales.length?'<p class="field-note">El IDE debe proporcionar el catálogo de idiomas.</p>':''}</section>`;
}
function showLocalizationIssues() {
  const issues=readLocalizationIssues();
  byId('modal-root').innerHTML=`<div class="modal-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-label="Revisión de localización"><button class="dialog-close icon-button" data-action="close-preview" aria-label="Cerrar">×</button><h2>Revisión de localización</h2><p>${issues.length} avisos · ${esc(editor.getLocalizationState().locale??'texto de origen')}</p><div class="localization-issues">${issues.slice(0,100).map(issue=>`<button class="wide-button" data-locale-issue="${esc(issue.node)}"><strong>${esc(find(issue.node)?.name??issue.node)}</strong><span>${esc(issue.key)}</span><small>${esc(issue.message)}</small></button>`).join('')||'<p>Sin avisos para este idioma.</p>'}</div>${issues.length>100?'<p>Se muestran los primeros 100 avisos.</p>':''}</section></div>`;
}
function prepareInspectorSections() {
  let index = 0;
  for (const section of inspector.querySelectorAll<HTMLElement>('.inspector-section')) {
    const heading = section.querySelector<HTMLElement>(':scope > .section-heading');
    const label = heading?.querySelector('span');
    const title = label?.textContent?.trim();
    if (!heading || !title) continue;
    section.dataset.panelSection = title;
    section.setAttribute('part', 'inspector-section');
    heading.setAttribute('part', 'section-heading');
    label!.id = `codaru-inspector-heading-${++index}`;
    const toggle = ownerDocument.createElement('button');
    toggle.className = 'icon-button tiny section-toggle';
    toggle.dataset.sectionToggle = title;
    toggle.setAttribute('part', 'section-toggle');
    const folded = foldedInspectorSections.has(title);
    section.classList.toggle('is-collapsed', folded);
    toggle.setAttribute('aria-expanded', String(!folded));
    toggle.setAttribute('aria-label', `${folded ? 'Expandir' : 'Contraer'} sección`);
    toggle.setAttribute('aria-describedby', label!.id);
    toggle.title = title;
    toggle.innerHTML = icon('chevron', 12);
    heading.append(toggle);
  }
}
function renderInspector() {
  const n = state.selected.length === 1 ? find(state.selected[0]) : undefined;
  if (!n) {
    inspector.innerHTML = `<section class="inspector-section selection-summary"><span class="summary-icon">${icon(state.selected.length?'layers':'frame',24)}</span><h3>${state.selected.length?state.selected.length+' elementos':'Un espacio para crear'}</h3><p>${state.selected.length?'Alinea, agrupa o convierte tu selección en un componente.':'Selecciona un elemento para editarlo, o arrastra una herramienta al lienzo.'}</p>${state.selected.length?`<div class="button-row"><button data-action="group">Agrupar</button><button data-action="duplicate">Duplicar</button></div><div class="button-row"><button data-action="align-left">Alinear izquierda</button><button data-action="align-center">Centrar</button></div><button class="wide-button" data-action="distribute">Distribuir horizontalmente</button>`:''}</section>${assetPanel()}${reviewPanel()}${themePanel()}<section class="inspector-section"><div class="section-heading"><span>DOCUMENTO</span></div><button class="wide-button" data-action="save">${icon('download',16)} Guardar proyecto .json</button><button class="wide-button" data-action="export-html">${icon('play',16)} Exportar prototipo HTML</button><button class="wide-button" data-action="new">${icon('plus',16)} Nuevo proyecto</button><button class="wide-button" data-action="open">${icon('folder',16)} Importar de Figma o abrir .json</button><button class="wide-button" data-action="example">${icon('grid',16)} Abrir ejemplo Forma</button><button class="wide-button" data-action="example-devices">${icon('frame',16)} Ejemplo iOS, Android y plegables</button></section><div class="inspector-tip">Dibuja primero.<br/><strong>Dale forma a tu idea.</strong></div>`; prepareInspectorSections(); return;
  }
  // Linked tokens win over the raw fields, so the inspector shows what is actually drawn.
  const r = { ...n, ...resolveNodeStyle(p(), n) };
  const isText = ['text','button','input'].includes(n.type); const isContainer = containerKinds.includes(n.type);
  const available=editor.getFonts(),face=available.find(f=>f.id===r.fontFamily),custom=face&&!face.builtin;
  const preserve=(choices:[string,string][],value:string)=>choices.some(([id])=>id===value)?choices:[[value,`${value} · no disponible`],...choices] as [string,string][];
  const familyChoices=preserve(available.map(f=>[f.id,f.name+(f.variants.some(v=>v.status==='loaded')?'':' · pendiente')]),r.fontFamily);
  const styles=custom?preserve([...new Set(face.variants.filter(v=>v.status==='loaded').map(v=>v.style))].map(id=>[id,{normal:'Normal',italic:'Cursiva',oblique:'Oblicua'}[id]]),r.fontStyle??'normal'):[['normal','Normal'],['italic','Cursiva'],['oblique','Oblicua']] as [string,string][];
  const weights=custom?preserve(face.variants.filter(v=>v.status==='loaded'&&v.style===(r.fontStyle??'normal')).map(v=>[String(v.weight),String(v.weight)]),String(r.fontWeight)):[];
  inspector.innerHTML = `
    <section class="inspector-section node-heading"><span class="node-type ${n.componentId||n.instanceOf?'purple':''}">${icon(n.componentId||n.instanceOf?'component':n.type,16)} ${n.componentId?'Componente maestro':n.instanceOf?'Instancia':labels[n.type]}</span><input class="node-name" aria-label="Nombre del elemento" data-field="name" value="${esc(n.name)}"/>${isUnavailable(p(),n)?'<p class="locked-note">Este elemento está bloqueado u oculto.</p>':''}${canEnter(n)?'<button class="wide-button enter-scope" data-action="enter-scope" title="Doble clic o Enter">Entrar y seleccionar hijos ↵</button>':''}</section>
    <fieldset ${isUnavailable(p(),n)?'disabled':''}>
    <section class="inspector-section"><div class="section-heading"><span>POSICIÓN Y TAMAÑO</span><button class="icon-button tiny" data-action="duplicate" aria-label="Duplicar selección">${icon('plus',14)}</button></div><div class="field-grid">${numField('X','x',n.x,-100000,100000)}${numField('Y','y',n.y,-100000,100000)}${numField('W','width',n.width,1)}${numField('H','height',n.height,1)}</div><div class="button-row compact"><button data-action="align-left" title="Alinear a la izquierda">${icon('align',16)}</button><button data-action="align-center" title="Centrar horizontalmente">${icon('center',16)}</button><button data-action="front">Al frente</button><button data-action="back">Al fondo</button></div></section>
    </fieldset>${componentPropertyPanel(p(),n)}<fieldset ${isUnavailable(p(),n)?'disabled':''}>
    ${n.type==='icon'?`<section class="inspector-section"><div class="section-heading"><span>ICONO VECTORIAL</span></div><p class="field-note">${esc(n.iconPack)} / ${esc(n.iconName)}</p>${colorField('Color del icono','color',n.color)}<p class="field-note">Escala sin perder nitidez. El color admite tokens como @primary.</p></section>`:''}
    ${isText?`<section class="inspector-section"><div class="section-heading"><span>TEXTO DE ORIGEN</span></div><textarea aria-label="Contenido del texto" data-field="text" rows="2">${esc(n.text)}</textarea>${selectField('Fuente','fontFamily',r.fontFamily,familyChoices)}<div class="field-grid">${numField('Tamaño','fontSize',r.fontSize,1,200)}${selectField('Estilo','fontStyle',r.fontStyle??'normal',styles)}${custom?selectField('Peso','fontWeight',String(r.fontWeight),weights):numField('Peso','fontWeight',r.fontWeight,100,900,1)}${numField('Línea','lineHeight',r.lineHeight,.5,4,.1)}${selectField('Alinear','textAlign',n.textAlign,[['left','Izquierda'],['center','Centro'],['right','Derecha']])}</div>${fontIssue(p(),n)?`<p class="field-note" role="alert">${esc(fontIssue(p(),n)!.message)}</p>`:''}${n.typographyToken?`<p class="field-note" data-linked="typography">Tipografía vinculada al token «${esc(n.typographyToken)}». Si cambias un valor aquí, el texto se desvincula.</p>`:''}${colorField('Texto','color',n.color)}</section>`:''}
    ${isContainer?`<section class="inspector-section"><div class="section-heading"><span>DISTRIBUCIÓN</span></div>${selectField('Organización','layout',n.layout,[['free','Libre'],['vertical','Columna ↕'],['horizontal','Fila ↔']])}${n.layout!=='free'?`<div class="field-grid">${n.paddingSides?'':numField('Padding','padding',n.padding,0,300)}${numField('Espacio','gap',n.gap,0,300)}</div>
      ${n.paddingSides?`<div class="stops-heading">Padding por lado <span>sup. · der. · inf. · izq.</span></div><div class="field-grid safe-fields">${(['top','right','bottom','left'] as const).map(edge=>`<label class="number-field"><span>${{top:'↑',right:'→',bottom:'↓',left:'←'}[edge]}</span><input type="number" aria-label="Padding ${{top:'superior',right:'derecho',bottom:'inferior',left:'izquierdo'}[edge]}" data-pad="${edge}" value="${n.paddingSides![edge]}" min="0" max="2000" step="1"/></label>`).join('')}</div>`:''}
      <button class="text-button" data-action="padding-sides">${n.paddingSides?'Usar un solo padding':'Padding por lado'}</button>
      <div class="field-grid">${selectField(n.layout==='vertical'?'Reparto vertical':'Reparto horizontal','justify',n.justify??'start',[['start','Al inicio'],['center','Centrado'],['end','Al final'],['between','Repartido']])}${selectField(n.layout==='vertical'?'Alineación horizontal':'Alineación vertical','align',n.align??'stretch',[['stretch','Estirar'],['start','Al inicio'],['center','Centrado'],['end','Al final']])}</div>
      <label class="check-field"><input type="checkbox" data-field="wrap" ${n.wrap?'checked':''}/> Pasar a otra línea si no caben</label>
      <label class="check-field"><input type="checkbox" data-field="hugWidth" ${n.hugWidth?'checked':''}/> Ajustar el ancho al contenido</label>
      <label class="check-field"><input type="checkbox" data-field="hugHeight" ${n.hugHeight?'checked':''}/> Ajustar el alto al contenido</label>
      <p class="field-note">Los hijos siguen el orden de las capas. «Llenar» reparte el espacio disponible.</p>`:''}</section>`:''}
    ${n.parentId&&find(n.parentId)?.layout!=='free'?`<section class="inspector-section"><div class="section-heading"><span>EN SU CONTENEDOR</span></div>${selectField('Tamaño en contenedor','sizing',n.sizing,[['fixed','Fijo'],['fill','Llenar espacio']])}<details class="corner-details" ${n.minWidth||n.maxWidth||n.minHeight||n.maxHeight?'open':''}><summary>Tamaño mínimo y máximo</summary><div class="field-grid">${([['minWidth','Ancho mín.'],['maxWidth','Ancho máx.'],['minHeight','Alto mín.'],['maxHeight','Alto máx.']] as const).map(([key,label])=>`<label class="number-field"><span>${label}</span><input type="number" aria-label="${label}" data-limit="${key}" value="${n[key]??''}" min="1" max="100000" step="1" placeholder="—"/></label>`).join('')}</div></details></section>`:''}
    <section class="inspector-section"><div class="section-heading"><span>RELLENO</span></div>${fillFields(n)}<div class="field-grid">${numField('Opacidad','opacity',n.opacity,0,100)}${numField('Radio','radius',r.radius,0,500)}</div><details class="corner-details"><summary>Radios por esquina</summary><div class="field-grid">${numField('Sup. der.','radiusTR',n.radiusTR??n.radius,0,500)}${numField('Inf. der.','radiusBR',n.radiusBR??n.radius,0,500)}${numField('Inf. izq.','radiusBL',n.radiusBL??n.radius,0,500)}</div></details></section>
    <section class="inspector-section"><div class="section-heading"><span>BORDE Y EFECTOS</span></div>${colorField('Borde','stroke',n.stroke)}<div class="field-grid">${numField('Grosor','strokeWidth',n.strokeWidth,0,50)}<label class="check-field"><input type="checkbox" data-field="shadow" ${n.shadow?'checked':''}/> Sombra</label></div></section>
    ${n.type==='image'?'<section class="inspector-section"><button class="wide-button" data-action="image">Cambiar imagen local</button></section>':''}
    ${tokenPanel(n)}${isText?localizationPanel(n):''}
    <section class="inspector-section"><div class="section-heading"><span>AL HACER CLIC</span>${icon('link',14)}</div><select data-field="targetId" aria-label="Navegar a pantalla"><option value="">Sin navegación</option>${pagesOf(p()).map(page=>{const frames=rootsOnPage(p(),page.id).filter(f=>f.type==='frame'&&f.id!==frameOf(p(),n.id)?.id);return frames.length?`<optgroup label="${esc(page.name)}">${frames.map(f=>`<option value="${f.id}" ${n.targetId===f.id?'selected':''}>${esc(f.name)}</option>`).join('')}</optgroup>`:'';}).join('')}</select>${n.targetId&&!onPage(n.targetId)?`<p class="field-note">La pantalla de destino está en otra página.</p>`:''}${n.targetId?`<label class="full-field"><span>Transición</span><select data-transition="type" aria-label="Transición">${[['','Sin animación'],...transitionTypes.map(t=>[t,transitionLabels[t]])].map(([v,l])=>`<option value="${v}" ${(n.transition?.type??'')===v?'selected':''}>${l}</option>`).join('')}</select></label>${n.transition?`<div class="field-grid"><label class="number-field"><span>Duración</span><input type="number" aria-label="Duración de la transición" data-transition="duration" value="${n.transition.duration}" min="0" max="5000" step="50"/></label><label class="full-field"><span>Curva</span><select data-transition="easing" aria-label="Curva de la transición">${easings.map(e=>`<option value="${e}" ${n.transition!.easing===e?'selected':''}>${easingLabels[e]}</option>`).join('')}</select></label></div>`:''}`:''}<p class="field-note">Prueba la conexión en Presentar.</p></section>
    <section class="inspector-section"><div class="section-heading"><span>ANIMACIÓN</span>${icon('play',14)}</div><p class="field-note">${n.animations?.length?`${n.animations.length} ${n.animations.length===1?'animación':'animaciones'}: ${esc(n.animations.map(a=>a.name).join(', '))}.`:'Sin animaciones.'}${n.svg?` ${vectorLayers(n.svg).length} capas animables.`:''} Se reproducen en Presentar.</p><button class="wide-button" data-action="animator">${icon('spark',16)} Abrir animador</button>${n.type==='vector'?'<button class="wide-button" data-action="image">Cambiar ilustración</button>':''}${n.aruSource?`<p class="field-note">ARU · ${esc(n.aruSource.filename)}</p><button class="wide-button" data-action="edit-aru" ${session.canOpenIllustration()?'':'disabled'}>Editar ilustración en el IDE ↗</button><button class="wide-button" data-action="export-aru">Exportar fuente ARU</button>`:''}</section>
    ${variantPanel(n)}
    <section class="inspector-section"><div class="button-row">${n.type!=='frame'&&!n.componentId&&!n.instanceOf?'<button class="component-button" data-action="make-component">◇ Crear componente</button>':''}${n.instanceOf?'<button data-action="master">Editar maestro</button><button data-action="detach">Desvincular</button>':''}${n.componentId?'<button class="component-button" data-action="insert-instance">◇ Insertar instancia</button>':''}${n.type==='group'&&!n.componentId&&!n.instanceOf?'<button data-action="ungroup">Desagrupar</button>':''}</div>${n.type==='frame'?'<button class="wide-button" data-action="export-svg">Exportar pantalla SVG</button>':''}</section></fieldset>${implementationPanel(p(),n,session.canOpenImplementation())}<section class="inspector-section"><div class="section-heading"><span>CONTRATO DEL PRODUCTO</span></div><p class="field-note">Accesibilidad · Analítica · Pruebas${n.experience?.analytics?.length?` · ${n.experience.analytics.length} eventos`:""}</p><button class="wide-button" data-action="experience">Configurar contrato</button></section>${assetPanel()}${themePanel()}`;
  prepareInspectorSections();
}

function setTab(next: typeof tab) { tab=next; document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',(b as HTMLElement).dataset.tab===tab)); if(!options.modular){layersEl.hidden=tab!=='layers'; byId('components').hidden=tab!=='components'; byId('system-index').hidden=tab!=='system';} if(tab==='layers')renderLayers(); if(tab==='components')renderComponents(); }
function setMode(next: typeof state.mode) { state.mode=next; document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',(b as HTMLElement).dataset.mode===state.mode)); renderConnections(); renderSystem(); }
/** A component template drawn small enough to fit a tile, on the theme background it would sit on. */
const previewCache = new Map<string, { key: string; el: HTMLElement }>();
function componentPreview(c: Component, maxWidth: number, maxHeight: number) {
  const key = `${session.fonts.revision}|${templateSignature(c)}|${maxWidth}x${maxHeight}|${p().theme}|${p().activeThemeId}`, cached = previewCache.get(c.id);
  if (cached && cached.key === key) return cached.el.cloneNode(true) as HTMLElement;
  const el = buildComponentPreview(c, maxWidth, maxHeight); previewCache.set(c.id, { key, el }); return el.cloneNode(true) as HTMLElement;
}
function buildComponentPreview(c: Component, maxWidth: number, maxHeight: number) {
  const root = c.template[0], scale = Math.min(1, maxWidth / Math.max(1, root.width), maxHeight / Math.max(1, root.height));
  const wrap = document.createElement('div'); wrap.className = 'sys-preview'; wrap.style.width = `${Math.round(root.width * scale)}px`; wrap.style.height = `${Math.round(root.height * scale)}px`;
  const inner = document.createElement('div'); inner.style.cssText = `position:absolute;left:0;top:0;width:${root.width}px;height:${root.height}px;transform:scale(${scale});transform-origin:0 0;pointer-events:none`;
  try { const proj = attachFonts(localizeProject({ ...p(), nodes: c.template }, session.localization()),session.fonts); inner.append(element(proj, proj.nodes[0], true)); wrap.style.background = color(proj, '@background', root); } catch { inner.textContent = '·'; }
  wrap.append(inner); return wrap;
}
const lines = (text: string | undefined) => (text ?? '').split('\n').map(l => l.trim()).filter(Boolean);
/** Notes are plain text: blank lines split paragraphs, lines starting with "-", "•" or "1." become lists. */
function notesHTML(text: string | undefined) {
  if (!text?.trim()) return '';
  return text.split(/\n\s*\n/).map(block => {
    const items = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (items.length && items.every(l => /^(-|•|\d+[.)])\s/.test(l))) { const ordered = /^\d/.test(items[0]); return `<${ordered ? 'ol' : 'ul'}>${items.map(l => `<li>${esc(l.replace(/^(-|•|\d+[.)])\s/, ''))}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`; }
    return `<p>${items.map(esc).join('<br>')}</p>`;
  }).join('');
}
/** A guideline line, with the optional `[ejemplo: ID]` references it points at. */
function guideline(line: string) { const ids: string[] = []; const text = line.replace(/\[ejemplo:\s*([^\]]+)\]/gi, (_, list: string) => { ids.push(...list.split(',').map(v => v.trim()).filter(Boolean)); return ''; }).trim(); return { text, ids }; }
/** A layer of the document drawn small, for examples beside a guideline. */
function nodePreview(id: string, maxWidth: number, maxHeight: number) {
  const n = find(id); if (!n) return undefined;
  const ns = subtree(previewProject(), id).map(k => clone(k)); ns[0].parentId = null; ns[0].x = 0; ns[0].y = 0;
  const scale = Math.min(1, maxWidth / Math.max(1, n.width), maxHeight / Math.max(1, n.height));
  const wrap = document.createElement('div'); wrap.className = 'sys-preview'; wrap.style.width = `${Math.round(n.width * scale)}px`; wrap.style.height = `${Math.round(n.height * scale)}px`;
  const inner = document.createElement('div'); inner.style.cssText = `position:absolute;left:0;top:0;width:${n.width}px;height:${n.height}px;transform:scale(${scale});transform-origin:0 0;pointer-events:none`;
  try { const proj = { ...p(), nodes: ns }; inner.append(element(proj, ns[0], true)); wrap.style.background = color(p(), '@background', n); } catch { inner.textContent = '·'; }
  wrap.append(inner); return wrap;
}
let systemPage = 'inicio', systemEditing = false;
const foundationPages: Array<[string, string, keyof NonNullable<Project['designSystem']>]> = [['principios', 'Principios', 'principles'], ['color', 'Color', 'color'], ['tipografia', 'Tipografía', 'typography'], ['espaciado', 'Espaciado y radios', 'spacing'], ['movimiento', 'Movimiento', 'motion'], ['contenido', 'Voz y contenido', 'voice']];
// The design system tab is a small documentation site: a contents page with progress, one page per foundation and one per component set.
function renderSystem() {
  const view = byId('system-view'); view.hidden = state.mode !== 'system';
  if (state.mode !== 'system') return;
  const scroll = view.scrollTop, project = p(), theme = project.designThemes[project.activeThemeId], notes = project.designSystem ?? {};
  const sets = new Map<string, Component[]>(); for (const c of project.components) sets.set(c.set ?? c.id, [...(sets.get(c.set ?? c.id) ?? []), c]);
  const setKey = (c: Component) => c.set ?? c.id, title = (list: Component[]) => list[0].set ? list[0].setName ?? list[0].name : list[0].name;
  const documented = (list: Component[]) => !!(list[0].doc?.description || list[0].doc?.when || list[0].doc?.usage || list[0].doc?.how);
  const stale = (list: Component[]) => documented(list) && docStale(list[0]), dsStale = designSystemStale(project);
  const dot = (done: boolean, old: boolean) => `<i class="${old ? 'stale' : done ? 'done' : ''}" title="${old ? 'Desactualizada' : done ? 'Documentada' : 'Pendiente'}"></i>`;
  const done = [...sets.values()].filter(documented).length, pages = [...sets.keys()];
  if (systemPage.startsWith('c:') && !sets.has(systemPage.slice(2))) systemPage = 'inicio';
  const field = (scope: 'system' | 'doc', key: string, label: string, hint: string, value: string | undefined, componentId?: string, rows = 3) => systemEditing || !value
    ? `<label class="sys-field"><span>${esc(label)}</span><textarea ${scope === 'system' ? `data-system="${esc(key)}"` : `data-doc="${esc(key)}" data-doc-component="${esc(componentId ?? '')}"`} rows="${rows}" placeholder="${esc(hint)}" aria-label="${esc(label)}${componentId ? ` · ${esc(title(sets.get(setKey(project.components.find(c => c.id === componentId)!)) ?? []))}` : ''}">${esc(value ?? '')}</textarea></label>`
    : `<div class="sys-read"><h4>${esc(label)}</h4>${notesHTML(value)}</div>`;
  const head = (eyebrow: string, heading: string, sub: string) => `<header class="sys-head"><div><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(heading)}</h1>${sub ? `<p>${sub}</p>` : ''}</div><button class="text-button" data-system-edit aria-pressed="${systemEditing}">${systemEditing ? 'Terminar edición' : 'Editar'}</button></header>`;
  const swatches = (mode: 'light' | 'dark') => Object.entries(theme.modes[mode].colors).map(([k, v]) => `<div class="sys-swatch"><i style="background:${esc(v)}"></i><b>@${esc(k)}</b><small>${esc(v)}</small></div>`).join('');
  let body = '';
  if (systemPage === 'inicio') {
    body = head('SISTEMA DE DISEÑO', project.name, `Tema «${esc(theme.name)}» · ${project.components.length} ${project.components.length === 1 ? 'componente' : 'componentes'} en ${sets.size} ${sets.size === 1 ? 'conjunto' : 'conjuntos'}`)
      + field('system', 'summary', 'Producto, negocio y nicho', 'Qué es la app, para quién y qué problema resuelve.', notes.summary)
      + field('system', 'brand', 'Por qué la marca funciona', 'Por qué esta paleta, esta tipografía y este tono funcionan para ese negocio, y qué los haría fallar.', notes.brand, undefined, 5)
      + `<section><h2>Avance</h2><p class="sys-progress"><b>${done} de ${sets.size}</b> componentes documentados · ${foundationPages.filter(([, , key]) => notes[key]).length} de ${foundationPages.length} fundamentos${[...sets.values()].filter(stale).length || dsStale ? ` · <b class="stale-text">${[...sets.values()].filter(stale).length + (dsStale ? 1 : 0)} por revisar</b>` : ''}</p><div class="sys-progress-bar"><i style="width:${sets.size ? Math.round(done / sets.size * 100) : 0}%"></i></div><p class="field-note">Empieza por lo que más se usa o más dudas genera; cada página responde qué es, por qué, cuándo y cómo.</p></section>
      <section><h2>Contenido</h2><div class="sys-toc"><div><h3>Fundamentos</h3>${foundationPages.map(([id, label, key]) => `<button class="sys-toc-item" data-system-page="${id}"><span>${esc(label)}</span>${dot(!!notes[key], !!notes[key] && dsStale)}</button>`).join('')}</div><div><h3>Componentes</h3>${[...sets.values()].map(list => `<button class="sys-toc-item" data-system-page="c:${esc(setKey(list[0]))}"><span>${esc(title(list))}</span><small>${list[0].set ? `${list.length} var.` : ''}</small>${dot(documented(list), stale(list))}</button>`).join('') || '<p class="empty-note">Aún no hay componentes.</p>'}</div></div></section>`;
  } else if (foundationPages.some(([id]) => id === systemPage)) {
    const [, label, key] = foundationPages.find(([id]) => id === systemPage)!;
    let extra = '';
    if (systemPage === 'color') {
      const pairs: Array<[string, string, string]> = [['@text', '@background', 'texto sobre fondo'], ['@text', '@surface', 'texto sobre superficie'], ['@muted', '@surface', 'texto apagado sobre superficie'], ['@primary', '@background', 'acción principal sobre fondo'], ['@accent', '@surface', 'acento sobre superficie'], ['@accent', '@primary', 'acento sobre la acción principal']];
      const row = (mode: 'light' | 'dark') => pairs.map(([a, b, what]) => { const ca = theme.modes[mode].colors[a.slice(1)], cb = theme.modes[mode].colors[b.slice(1)]; if (!ca || !cb) return ''; const r = contrastRatio(ca, cb); return `<tr><td>${esc(what)}</td><td><code>${a}</code> / <code>${b}</code></td><td class="${r >= 4.5 ? 'ok' : r >= 3 ? 'mid' : 'bad'}">${r.toFixed(1)}:1</td></tr>`; }).join('');
      extra = `<h3>Claro</h3><div class="sys-swatches">${swatches('light')}</div><h3>Oscuro</h3><div class="sys-swatches">${swatches('dark')}</div><h3>Contrastes medidos</h3><table class="sys-table"><thead><tr><th>Uso</th><th>Par</th><th>Claro</th></tr></thead><tbody>${row('light')}</tbody></table><table class="sys-table"><thead><tr><th>Uso</th><th>Par</th><th>Oscuro</th></tr></thead><tbody>${row('dark')}</tbody></table><p class="field-note">4,5:1 para texto, 3:1 para controles e indicadores.</p>`;
    } else if (systemPage === 'tipografia') {
      extra = `<div class="sys-types">${Object.entries(theme.modes.light.typography).map(([k,t])=>{const issue=session.fonts.issue({id:`token:${k}`,fontFamily:t.fontFamily,fontWeight:t.fontWeight,fontStyle:t.fontStyle});return `<div class="sys-type">${issue?`<p role="alert" class="field-note">${esc(issue.message)}</p>`:`<div style="font-family:${fontFamilyCSS(p(),t.fontFamily)};font-size:${Math.min(34,t.fontSize)}px;font-weight:${t.fontWeight};font-style:${t.fontStyle??'normal'};font-synthesis:none;font-optical-sizing:none;line-height:${t.lineHeight}">${esc(project.name)}</div>`}<small><code>${esc(k)}</code> ${esc(t.name)} · ${esc(t.fontFamily)} ${t.fontSize}/${t.fontWeight} · ${t.fontStyle??'normal'} · ${t.lineHeight}</small></div>`;}).join('') || '<p class="empty-note">El tema no define estilos de texto.</p>'}</div>`;
    } else if (systemPage === 'espaciado') {
      extra = `<h3>Escala</h3><div class="sys-scale">${[4, 8, 12, 16, 24, 32, 48].map(v => `<div><i style="width:${v}px;height:${v}px"></i><small>${v}</small></div>`).join('')}</div>${Object.keys(theme.modes.light.radii).length ? `<h3>Radios</h3><div class="sys-scale">${Object.entries(theme.modes.light.radii).map(([k, v]) => `<div><i style="width:40px;height:40px;border-radius:${Math.min(20, v)}px"></i><small>${esc(k)} · ${v}</small></div>`).join('')}</div>` : ''}`;
    } else if (systemPage === 'movimiento') {
      const flows = project.nodes.filter(n => n.targetId), byType = new Map<string, number>(); for (const n of flows) { const t = n.transition?.type ?? 'sin animación'; byType.set(t, (byType.get(t) ?? 0) + 1); }
      const animated = project.nodes.filter(n => n.animations?.length).length;
      extra = `<p class="sys-inline">${flows.length} ${flows.length === 1 ? 'conexión' : 'conexiones'}: ${[...byType].map(([t, n]) => `<code>${esc(t)}</code> ×${n}`).join(' · ') || '—'} · ${animated} ${animated === 1 ? 'elemento animado' : 'elementos animados'}.</p>`;
    } else if (systemPage === 'principios' && notes.principles && !systemEditing) {
      extra = '';
    }
    body = head('FUNDAMENTOS', label, '') + (dsStale && notes[key] ? `<div class="sys-notice"><span>El tema cambió después de escribir estas notas. Revísalas o márcalas como vigentes.</span><button data-doc-reviewed="system">Marcar como revisadas</button></div>` : '') + (systemPage === 'principios' ? field('system', key, 'Principios', 'Una regla por línea: una acción principal por pantalla, el oro solo en detalles…', notes[key], undefined, 8) : extra + field('system', key, `Notas de ${label.toLowerCase()}`, 'Cómo se usa y qué no se hace.', notes[key], undefined, 5));
  } else {
    const list = sets.get(systemPage.slice(2))!, c = list[0], isSet = !!c.set, doc = c.doc ?? {}, axes = isSet ? variantAxes(project, c.set!) : {};
    const master = project.nodes.find(n => n.id === c.masterId && n.componentId === c.id);
    const parts = c.template.slice(1).filter(n => n.name && !/^(Grupo|Texto|Rectángulo|Elipse|Botón|Campo|Tarjeta|Imagen|Icono|Ilustración)$/.test(n.name)).slice(0, 12);
    const options = isSet ? Object.entries(axes).map(([axis, values]) => `<h4>${esc(axis)}</h4><div class="sys-variants">${values.map(v => { const m = list.find(m => m.variant?.[axis] === v) ?? c; return `<figure data-preview-of="${esc(m.id)}"><figcaption>${esc(v)}</figcaption></figure>`; }).join('')}</div>`).join('') : `<div class="sys-variants"><figure data-preview-of="${esc(c.id)}"><figcaption>${esc(c.name)}</figcaption></figure></div>`;
    const guides = (kind: 'do' | 'dont') => lines(doc[kind]).map(l => { const g = guideline(l); return `<li class="${kind}"><span>${esc(g.text)}</span>${g.ids.map(id => `<span class="sys-example" data-example="${esc(id)}"></span>`).join('')}</li>`; }).join('');
    const i = pages.indexOf(systemPage.slice(2)), prev = i > 0 ? pages[i - 1] : undefined, next = i < pages.length - 1 ? pages[i + 1] : undefined;
    body = head(isSet ? `COMPONENTE · ${list.length} ${list.length === 1 ? 'VARIANTE' : 'VARIANTES'}` : 'COMPONENTE', title(list), systemEditing || !doc.description ? '' : esc(doc.description))
      + (stale(list) ? `<div class="sys-notice"><span>El componente cambió después de documentarse. Revisa la ficha o márcala como vigente.</span><button data-doc-reviewed="${esc(c.id)}">Marcar como revisada</button></div>` : '')
      + (systemEditing || !doc.description ? field('doc', 'description', 'Qué es y qué hace', 'Una frase: «La acción que hace avanzar la pantalla».', doc.description, c.id, 2) : '')
      + `<section><h2>Opciones</h2>${options}${master ? `<p class="field-note">Maestro en «${esc(frameOf(project, master.id)?.name ?? 'el lienzo')}» · <button class="text-button" data-select-master="${esc(master.id)}">Ir al maestro</button></p>` : '<p class="field-note">El maestro fue eliminado.</p>'}</section>`
      + (parts.length ? `<section><h2>Anatomía</h2><div class="sys-anatomy"><figure data-anatomy-of="${esc(c.id)}"></figure><ol>${parts.map(n => `<li>${esc(n.name)}<small> · ${esc(labels[n.type])}</small></li>`).join('')}</ol></div></section>` : '')
      + `<section><h2>Por qué</h2>${field('doc', 'why', 'Por qué este y no otro parecido', 'Qué lo distingue de los componentes con los que se confunde.', doc.why, c.id)}</section>`
      + `<section><h2>Cuándo</h2>${field('doc', 'when', 'Cuándo usarlo y cuándo no', 'Las situaciones en que es la pieza adecuada.', doc.when ?? doc.usage, c.id)}</section>`
      + `<section><h2>Cómo</h2>${field('doc', 'how', 'Cómo se usa', 'Opciones, contenido y comportamiento.', doc.how, c.id)}${systemEditing || (!doc.do && !doc.dont) ? `<div class="sys-two">${field('doc', 'do', 'Buenas prácticas', 'Una por línea. Termina con [ejemplo: ID] para mostrar una capa.', doc.do, c.id, 4)}${field('doc', 'dont', 'Malas prácticas', 'Una por línea. Termina con [ejemplo: ID] para mostrar una capa.', doc.dont, c.id, 4)}</div>` : ''}${doc.do || doc.dont ? `<div class="sys-two sys-lists"><div><h4 class="do">Sí</h4><ul>${guides('do')}</ul></div><div><h4 class="dont">No</h4><ul>${guides('dont')}</ul></div></div>` : ''}</section>`
      + `<nav class="sys-pager">${prev ? `<button data-system-page="c:${esc(prev)}">← ${esc(title(sets.get(prev)!))}</button>` : '<span></span>'}${next ? `<button data-system-page="c:${esc(next)}">${esc(title(sets.get(next)!))} →</button>` : ''}</nav>`;
  }
  view.innerHTML = `<article class="system-doc">${body}</article>`;
  for (const fig of view.querySelectorAll<HTMLElement>('figure[data-preview-of]')) { const c = project.components.find(c => c.id === fig.dataset.previewOf); if (c) fig.prepend(componentPreview(c, 300, 180)); }
  for (const fig of view.querySelectorAll<HTMLElement>('figure[data-anatomy-of]')) {
    const c = project.components.find(c => c.id === fig.dataset.anatomyOf); if (!c) continue;
    const preview = componentPreview(c, 420, 240), root = c.template[0], scale = Math.min(1, 420 / Math.max(1, root.width), 240 / Math.max(1, root.height));
    const parts = c.template.slice(1).filter(n => n.name && !/^(Grupo|Texto|Rectángulo|Elipse|Botón|Campo|Tarjeta|Imagen|Icono|Ilustración)$/.test(n.name)).slice(0, 12);
    parts.forEach((n, i) => { const at = absolute({ ...project, nodes: c.template }, n), badge = document.createElement('b'); badge.className = 'sys-badge'; badge.textContent = `${i + 1}`; badge.style.left = `${Math.round((at.x + Math.min(n.width, 24) / 2) * scale)}px`; badge.style.top = `${Math.round((at.y + Math.min(n.height, 24) / 2) * scale)}px`; preview.append(badge); });
    fig.append(preview);
  }
  for (const slot of view.querySelectorAll<HTMLElement>('.sys-example')) { const pv = nodePreview(slot.dataset.example!, 220, 120); if (pv) slot.append(pv); else slot.innerHTML = `<small class="sys-missing">ejemplo «${esc(slot.dataset.example!)}» no encontrado</small>`; }
  byId('system-index').innerHTML = `<button class="sys-link ${systemPage === 'inicio' ? 'active' : ''}" data-system-page="inicio">Inicio · ${done}/${sets.size}</button><h5>Fundamentos</h5>${foundationPages.map(([id, label, key]) => `<button class="sys-link sub ${systemPage === id ? 'active' : ''}" data-system-page="${id}">${esc(label)}${dot(!!notes[key], !!notes[key] && dsStale)}</button>`).join('')}<h5>Componentes</h5>${[...sets.values()].map(list => `<button class="sys-link sub ${systemPage === `c:${setKey(list[0])}` ? 'active' : ''}" data-system-page="c:${esc(setKey(list[0]))}">${esc(title(list))}${dot(documented(list), stale(list))}</button>`).join('')}`;
  view.scrollTop = systemPage === lastSystemPage ? scroll : 0; lastSystemPage = systemPage;
}
let lastSystemPage = 'inicio';
// Variants: a master shows its set and axis values; an instance picks the member it points at.
function variantPanel(n: DesignNode) {
  const c=p().components.find(c=>c.id===(n.componentId??n.instanceOf)); if(!c)return '';
  if(n.componentId){
    if(!c.set)return `<section class="inspector-section"><div class="section-heading"><span>VARIANTES</span></div><p class="field-note">Un conjunto de variantes agrupa los estados o tamaños de este componente; las instancias cambian entre ellos sin perder sus textos.</p><button class="wide-button" data-action="variant-create">◇ Nueva variante</button></section>`;
    const axes=variantAxes(p(),c.set), members=variantSet(p(),c.set);
    return `<section class="inspector-section"><div class="section-heading"><span>VARIANTES</span><span>${members.length}</span></div><label class="full-field"><span>Conjunto</span><input aria-label="Nombre del conjunto" data-variant-set value="${esc(c.setName??c.name)}" maxlength="80"/></label>${Object.keys(axes).map(axis=>`<label class="full-field"><span>${esc(axis)}</span><input aria-label="Valor de ${esc(axis)}" data-variant-axis="${esc(axis)}" value="${esc(c.variant?.[axis]??'Base')}" maxlength="40" list="variant-values-${esc(axis).replace(/[^A-Za-z0-9]+/g,'-')}"/><datalist id="variant-values-${esc(axis).replace(/[^A-Za-z0-9]+/g,'-')}">${axes[axis].map(v=>`<option value="${esc(v)}"></option>`).join('')}</datalist></label>`).join('')}<div class="button-row"><button class="component-button" data-action="variant-create">◇ Nueva variante</button><button data-action="variant-axis">+ Eje</button></div><p class="field-note">${members.length>1?`Otras: ${members.filter(m=>m.id!==c.id).map(m=>`<button class="text-button" data-select-master="${esc(m.masterId)}">${esc(variantLabel(m.variant))}</button>`).join(' · ')}`:'Es la única variante del conjunto.'}</p></section>`;
  }
  if(!c.set)return '';
  const axes=variantAxes(p(),c.set); if(c.set.startsWith('kit-'))axes.Estado=[...new Set([...(axes.Estado??[]),'Normal','Seleccionado','Deshabilitado'])];
  return `<section class="inspector-section"><div class="section-heading"><span>VARIANTE</span></div><p class="field-note">${esc(c.setName??c.name)}</p>${Object.entries(axes).map(([axis,values])=>`<label class="full-field"><span>${esc(axis)}</span><select data-variant-switch="${esc(axis)}" aria-label="Variante · ${esc(axis)}">${values.map(v=>`<option value="${esc(v)}" ${(c.variant?.[axis]??'')===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`).join('')}</section>`;
}
function addFrame() {
  const ns = rootsOnPage(p(), pageId()); const x = ns.length ? Math.max(...ns.map(n=>n.x+n.width))+80 : 60;
  const f = node('frame',{x,y:100,page:pageId(),role:'screen',name:`${String(p().nodes.filter(n=>n.type==='frame').length+1).padStart(2,'0')} · Nueva pantalla`});
  change(pr=>pr.nodes.push(f)); select([f.id]); fit();
}
function parentAt(x: number, y: number) {
  return [...pv().nodes].reverse().find(n=>n.type==='frame'&&!n.hidden&&n.parentId===null&&x>=n.x&&y>=n.y&&x<=n.x+n.width&&y<=n.y+n.height);
}
function insert(kind: Kind, position?: {x:number;y:number}) {
  if (kind==='image'||kind==='vector') { byId<HTMLInputElement>('image-file').click(); return; }
  if (kind==='frame') { addFrame(); return; }
  let parent: DesignNode | undefined;
  if (position) parent = parentAt(position.x,position.y);
  else { const n = find(state.selected[0]); parent = n && containerKinds.includes(n.type) ? n : n ? find(n.parentId!) : find(state.selectionScope!) || firstFrame(); }
  if (parent && isUnavailable(p(),parent)) { toast('Desbloquea el contenedor para insertar elementos.'); return; }
  const pos = parent ? absolute(p(),parent) : {x:0,y:0};
  const n = node(kind,{parentId:parent?.id||null,x:position?position.x-pos.x:32,y:position?position.y-pos.y:32});
  change(pr=>pr.nodes.push(n)); select([n.id]); setTool('cursor');
}
function insertComponent(componentId: string, position?: {x:number;y:number}) {
  const n = find(state.selected[0]), scope = find(state.selectionScope!);
  let parent = position ? parentAt(position.x,position.y) : n ? (containerKinds.includes(n.type)?n:find(n.parentId!)) : scope || firstFrame();
  if (position && scope && containerKinds.includes(scope.type)) { const pos = absolute(p(), scope); if (position.x >= pos.x && position.y >= pos.y && position.x <= pos.x + scope.width && position.y <= pos.y + scope.height) parent = scope; }
  if (parent && isUnavailable(p(),parent)) { toast('Desbloquea el contenedor para insertar elementos.'); return; }
  if (parent && (parent.instanceOf || ancestors(p(),parent.id).some(n=>n.instanceOf))) { toast('Para añadir componentes aquí, edita el maestro o desvincula la instancia.'); return; }
  const pos = parent ? absolute(p(),parent) : {x:0,y:0}; let id = '';
  change(pr=>{id=instantiate(pr,componentId,parent?.id||null,position?position.x-pos.x:32,position?position.y-pos.y:32);}); if(id)select([id]);
}
function setTool(t: typeof state.tool) { if(disposed)return; state.tool=t; document.querySelectorAll<HTMLElement>('[data-tool]').forEach(el=>el.classList.toggle('active',el.dataset.tool===t)); stage.dataset.tool=t; renderSelection(); }
function editableIds() { return state.selected.filter(id=>{const n=find(id);return n&&!isUnavailable(p(),n);}); }
function align(where: 'left'|'center') {
  const ns=topSelected(p(),editableIds()).map(id=>find(id)!); if(!ns.length)return;
  if(ns.some(n=>n.parentId!==ns[0].parentId)){toast('Selecciona elementos del mismo contenedor.');return;}
  change(pr=>{ const left=Math.min(...ns.map(n=>n.x)), right=Math.max(...ns.map(n=>n.x+n.width)); for(const n of ns){ const parent=find(n.parentId!); const x=ns.length===1?(where==='left'?(parent?.padding||0):((parent?.width||stage.clientWidth/state.zoom)-n.width)/2):(where==='left'?left:(left+right-n.width)/2); updateNode(pr,n.id,{x}); } });
}
function distribute() {
  const ns=topSelected(p(),editableIds()).map(id=>find(id)!).sort((a,b)=>a.x-b.x); if(ns.length<3||ns.some(n=>n.parentId!==ns[0].parentId)){toast('Selecciona tres elementos o más del mismo contenedor.');return;}
  const start=ns[0].x,end=ns.at(-1)!.x+ns.at(-1)!.width,gap=(end-start-ns.reduce((s,n)=>s+n.width,0))/(ns.length-1);
  change(pr=>{let x=start;for(const n of ns){updateNode(pr,n.id,{x});x+=n.width+gap;}});
}

async function saveFile(content: string, filename: string, extension: string, encoding: 'utf8' | 'base64' = 'utf8') {
  if(nativeInvoke){const path=await nativeInvoke<string|null>('plugin:codaru|save_document',{content,filename,extension,...(encoding==='base64'?{encoding}:{})});if(path){toast('Archivo guardado');return true;}return false;}
  const data=encoding==='base64'?Uint8Array.from(atob(content),c=>c.charCodeAt(0)):content;const blob=new Blob([data],{type:extension==='json'?'application/json':extension==='svg'?'image/svg+xml':extension==='png'?'image/png':extension==='zip'?'application/zip':extension==='aru'?'text/plain':'text/html'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Archivo descargado');return true;
}
const fileName = () => p().name.replace(/[^\p{L}\p{N} _-]/gu,'').trim()||'mockup';
async function saveProject() { try {if(await saveFile(JSON.stringify(p(),null,2),`${fileName()}.codaru.json`,'json')){storageWarning='';persist();}}catch(e){toast(`No se pudo guardar: ${e instanceof Error?e.message:e}`);} }
async function openFile() {
  try {if(nativeInvoke){const data=await nativeInvoke<string|null>('plugin:codaru|open_document');if(data)await loadProject(data);}else byId<HTMLInputElement>('import-file').click();}catch(e){toast(e instanceof Error?e.message:'No se pudo abrir el archivo');}
}
async function importFromFigma(data: unknown) {
  const {importFigma}=await import('./figma-import');if(disposed)return;
  let report:import('./figma-import').FigmaReport|undefined;const before=new Set(p().nodes.map(n=>n.id));
  change(pr=>{report=importFigma(pr,data);});
  if(!report)return;
  // Imported screens are added to the document, so they are shown selected and in view.
  select(p().nodes.filter(n=>!before.has(n.id)&&n.parentId===null).map(n=>n.id));fit(true);
  byId('modal-root').innerHTML=`<div class="modal-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-label="Importación de Figma"><button data-action="close-preview" class="dialog-close icon-button" aria-label="Cerrar">${icon('close')}</button><span class="eyebrow">FIGMA</span><h2>Importación completada</h2><p>${report.screens} ${report.screens===1?'pantalla':'pantallas'}, ${report.layers} capas, ${report.components} componentes, ${report.tokens} tokens y ${report.illustrations} ilustraciones. Se añadieron a la derecha de tu documento; Deshacer las quita.</p>${report.notes.length?`<div class="import-notes"><strong>Qué se simplificó</strong><ul>${report.notes.map(note=>`<li>${esc(note)}</li>`).join('')}</ul></div>`:'<p>No hubo nada que simplificar.</p>'}<div class="dialog-actions"><button class="primary" data-action="close-preview">Entendido</button></div></section></div>`;
}
async function loadProject(data: string) { if(disposed)return; try {const parsed=JSON.parse(data);if(parsed&&parsed.format==='codaru-figma-export'){await importFromFigma(parsed);return;}const next=validate(parsed);if(await confirmReplace('Abrir proyecto','El proyecto actual se conservará en Deshacer. Guarda un archivo si quieres mantener una copia independiente.'))replace(next);}catch(e){toast(e instanceof Error?e.message:'Archivo inválido');} }
function replace(next: Project){if(disposed)return;commentView?.flush();editor.importDocument(next);collapsed.clear();fit();persist();}
let pendingConfirmation: ((value: boolean) => void) | undefined;
function confirmReplace(title: string, detail: string): Promise<boolean> {
  return new Promise(resolve=>{byId('modal-root').innerHTML=`<div class="modal-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2><p>${esc(detail)}</p><div class="dialog-actions"><button id="confirm-cancel">Cancelar</button><button class="primary" id="confirm-ok">Continuar</button></div></section></div>`;const finish=(value:boolean)=>{pendingConfirmation=undefined;byId('modal-root').replaceChildren();resolve(value);};pendingConfirmation=finish;byId('confirm-cancel').onclick=()=>finish(false);byId('confirm-ok').onclick=()=>finish(true);byId('confirm-cancel').focus();});
}
function preview(id?: string, reset = true, transition?: Transition, reverse = false) {
  const ghost = transition ? byId('preview-canvas')?.firstElementChild?.cloneNode(true) as HTMLElement | undefined : undefined;
  const frame = find(id||'') || frameOf(p(),state.selected[0]) || p().nodes.find(n=>n.type==='frame'&&!n.hidden);
  if(!frame||frame.type!=='frame'){toast('Crea una pantalla para presentar.');return;}if(reset)previewHistory=[];previewFrame=frame.id;
  byId('modal-root').innerHTML=`<div class="preview-backdrop"><header class="preview-header"><span class="preview-brand">${icon('play',16)} Prototipo</span><select id="preview-select" aria-label="Pantalla del prototipo">${p().nodes.filter(n=>n.type==='frame'&&!n.hidden).map(n=>`<option value="${n.id}" ${n.id===frame.id?'selected':''}>${esc(n.name)}</option>`).join('')}</select><div>${(()=>{const others=postureGroup(p(),frame.id).filter(f=>f.id!==frame.id);return others.length===1?`<button data-posture="${others[0].id}" class="posture-button" title="Ver esta pantalla en la otra postura">${panelsOf(others[0])>panelsOf(frame)?'Desplegar':'Plegar'} ⇄</button>`:others.map(f=>`<button data-posture="${f.id}" class="posture-button" title="Ver esta pantalla en otra postura">${esc(f.name.split('·').at(-2)?.trim()||f.name)} ⇄</button>`).join('');})()}${btn('preview-back','Pantalla anterior','undo','icon-button')}${btn('close-preview','Cerrar presentación · Escape','close','icon-button')}</div></header><div id="preview-viewport"><div id="preview-sizer"><div id="preview-canvas"></div></div></div><div class="preview-footnote">Haz clic en los elementos conectados para navegar <span>ESC para volver al editor</span></div></div>`;
  const projection=previewProject();const el=element(projection,projection.nodes.find(n=>n.id===frame.id)!,true);el.style.left='0';el.style.top='0';el.style.position='relative';byId('preview-canvas').append(el);
  const bezel=frame.skin?deviceSkins[frame.skin].bezel*2+4:0,ratio=Math.min(1,(window.innerWidth-120-bezel)/frame.width,(window.innerHeight-160-bezel)/frame.height);if(ghost)ghost.dataset.scale=String(previewRatio/ratio);previewRatio=ratio;byId('preview-canvas').style.transform=`scale(${ratio})`;byId('preview-sizer').style.width=`${frame.width*ratio}px`;byId('preview-sizer').style.height=`${frame.height*ratio}px`;
  if(ghost){Object.assign(ghost.style,{position:'absolute',left:'0',top:'0'});if(!frame.skin&&!ghost.dataset.skin&&transition!.type!=='fold'&&transition!.type!=='unfold')byId('preview-sizer').style.overflow='hidden';byId('preview-canvas').append(ghost);transitionScreens(ghost,el,transition!,reverse);}
  startMotion(el);
  dom.listen(byId('preview-canvas'),'click',e=>{const hit=(e.target as HTMLElement).closest<HTMLElement>('[data-target]');if(hit){const t=find(hit.dataset.node||'')?.transition;previewHistory.push({id:frame.id,transition:t});preview(hit.dataset.target,false,t);}});
  dom.listen(byId('preview-canvas'),'keydown',e=>{if((e.key==='Enter'||e.key===' ')&&(e.target as HTMLElement).matches('[data-target]')){e.preventDefault();(e.target as HTMLElement).click();}});
  byId<HTMLSelectElement>('preview-select').onchange=e=>{previewHistory.push({id:frame.id});preview((e.target as HTMLSelectElement).value,false);};
  (document.querySelector('[data-action="close-preview"]') as HTMLButtonElement).focus();
}
let experienceCleanup:(()=>void)|undefined;
function closePreview(){experienceCleanup?.();experienceCleanup=undefined;closeColorPicker();const modal=byId('modal-root');modal.onclick=null;modal.onchange=null;modal.onkeydown=null;previewFrame=null;byId('modal-root').replaceChildren();stage.focus();}
function help(){byId('modal-root').innerHTML=`<div class="modal-backdrop"><section class="dialog help-dialog" role="dialog" aria-modal="true" aria-label="Atajos"><button data-action="close-preview" class="dialog-close icon-button">${icon('close')}</button><span class="eyebrow">HECHO PARA DIBUJAR</span><h2>Menos vueltas. Más ideas.</h2><div class="shortcut-list">${[['Seleccionar / dibujar','V / R / T / B'],['Crear pantalla / elipse','F / O'],['Mover lienzo','Espacio + arrastrar'],['Zoom','⌘ + rueda / pellizco / + / −'],['Escala 100%','0'],['Mover con rueda','Rueda / ⇧ + rueda'],['Ajustar pantallas / selección','⇧1 / ⇧2'],['Selección múltiple','Arrastrar / ⇧ + clic'],['Entrar en pantalla o grupo','Doble clic / Enter'],['Salir un nivel','Escape'],['Seleccionar hijos del nivel','⌘A'],['Agrupar','⌘G'],['Crear componente','⌥⌘K'],['Duplicar','⌘D'],['Deshacer / rehacer','⌘Z / ⇧⌘Z'],['Mover 1 / 10 px','Flechas / ⇧ + flechas'],['Editar texto','Doble clic'],['Guardar proyecto','⌘S']].map(([l,k])=>`<div><span>${l}</span><kbd>${k}</kbd></div>`).join('')}</div></section></div>`;}

let commentView:import('./comments-view').CommentsView|undefined,commentSidebar:HTMLElement|undefined;
function beginFeedback(){if(state.selected.length&&state.selected.every(id=>find(id)?.type!=='frame'))commentView!.annotate();else commentView!.setAnnotationMode(true);}
async function action(act: string) {
  assertActive();
  if(options.modular && !dom.parts.dialogs.isConnected && ['themes','animator','preview','help','agent-help','new','example','example-devices','open','locale-review'].includes(act)) throw new Error('Monta la parte dialogs para usar esta acción, o usa los diálogos y la API de tu IDE.');
  switch(act){
    case 'annotate':
    case 'comments':{
      if(commentSidebar&&act==='annotate'){beginFeedback();break;}
      if(commentSidebar){commentView!.flush();commentSidebar.hidden=!commentSidebar.hidden;commentSidebar.style.display=commentSidebar.hidden?'none':'flex';break;}
      const {createCommentsView}=await import('./comments-view');commentSidebar=document.createElement('aside');commentSidebar.style.cssText='position:absolute;right:0;top:64px;bottom:0;width:340px;z-index:35;display:flex;flex-direction:column;box-shadow:-8px 0 24px #0003;background:var(--ui-surface);';
      const close=document.createElement('button');close.textContent='Cerrar comentarios';close.onclick=()=>{try{commentView!.flush();commentSidebar!.hidden=true;commentSidebar!.style.display='none';}catch(e){toast(String(e));}};commentSidebar.append(close);
      const slot=document.createElement('div');slot.style.cssText='min-height:0;flex:1;';commentSidebar.append(slot);app.append(commentSidebar);
      commentView=createCommentsView(editor,{onCorrectionRequest,appearance:{theme:'dark'},onReveal:ids=>fit(true,[...new Set(ids.map(id=>frameOf(p(),id)?.id??id))]),onOpen:()=>{commentSidebar!.hidden=false;commentSidebar!.style.display='flex';},onError:e=>toast(e.message)});commentView.mountPanel(slot);commentView.mountPins(stage);if(act==='annotate'){commentSidebar.hidden=true;commentSidebar.style.display='none';beginFeedback();}break;
    }
    case 'enter-scope':if(state.selected.length===1)enterScope(state.selected[0]);break;
    case 'add-frame':addFrame();break;
    case 'undo':editor.undo();persist();break;
    case 'redo':editor.redo();persist();break;
    case 'fit':fit();break;
    case 'zoom-in':zoomAt(state.zoom*1.2);break;
    case 'zoom-out':zoomAt(state.zoom/1.2);break;
    case 'agent-help':agentHelp();break;
    case 'experience':{closePreview();const {openExperienceEditor}=await import('./experience-inspector');if(disposed)break;experienceCleanup=openExperienceEditor(byId('modal-root'),editor,byId('inspector'),fn=>{store.commit(fn);render();persist();},closePreview);break;}
    case 'themes':openThemeEditor({root:byId('modal-root'),get:p,fonts:editor.getFonts,commit:fn=>{const before=p();store.commit(fn,draft=>validateFontChanges(before,draft,session.fonts));render();persist();},undo:()=>{store.undo();render();persist();},close:closePreview});break;
    case 'animator':{const id=state.selected[0];if(state.selected.length!==1||!find(id)){toast('Selecciona un solo elemento para animarlo.');break;}const {openAnimator}=await import('./animator');if(disposed)break;openAnimator({root:byId('modal-root'),get:p,nodeId:id,commit:fn=>{store.commit(fn);render();persist();},undo:()=>{store.undo();render();persist();},close:closePreview});break;}
    case 'lint':review={issues:lintProject(p()),heat:review?.heat??true};select([]);render();toast(review.issues.length?`Revisión: ${review.issues.length} hallazgos. Pulsa uno para ir a él.`:'Revisión: sin problemas detectados.');break;
    case 'lint-close':review=null;render();break;
    case 'padding-sides':{const n=find(state.selected[0]);if(n)change(pr=>updateNode(pr,n.id,n.paddingSides?{paddingSides:undefined,padding:n.paddingSides.top}:{paddingSides:{top:n.padding,right:n.padding,bottom:n.padding,left:n.padding}}));break;}
    case 'rotate-frame':{const n=find(state.selected[0]);if(n?.type==='frame')change(pr=>updateNode(pr,n.id,{width:n.height,height:n.width,...(n.fold?{fold:{...n.fold,axis:n.fold.axis==='vertical'?'horizontal':'vertical'}}:{}),...(n.safeArea?{safeArea:{top:n.safeArea.left,right:n.safeArea.top,bottom:n.safeArea.right,left:n.safeArea.bottom}}:{})}));fit(true);break;}
    case 'theme':change(pr=>pr.theme=pr.theme==='light'?'dark':'light');break;
    case 'save':await saveProject();break;
    case 'open':await openFile();break;
    case 'preview':preview();break;
    case 'close-preview':closePreview();break;
    case 'preview-back':{const last=previewHistory.pop();if(last)preview(last.id,false,last.transition,true);break;}
    case 'new':if(await confirmReplace('Crear proyecto','El proyecto actual se conservará en Deshacer. También puedes guardarlo como archivo.'))replace(blank());break;
    case 'example-devices':if(await confirmReplace('Abrir ejemplo multiplataforma','El proyecto actual se conservará en Deshacer.')){const {demoDevices}=await import('./demo-devices');if(!disposed){replace(demoDevices());fit();}}break;
    case 'example':if(await confirmReplace('Abrir ejemplo Forma','El proyecto actual se conservará en Deshacer.'))replace(demo());break;
    case 'duplicate':{let ids:string[]=[];change(pr=>ids=duplicate(pr,editableIds()));select(ids);break;}
    case 'delete':change(pr=>remove(pr,editableIds()));break;
    case 'group':{let id='';change(pr=>id=group(pr,editableIds()));if(id)select([id]);break;}
    case 'ungroup':{let ids:string[]=[];change(pr=>ids=ungroup(pr,state.selected[0]));select(ids);break;}
    case 'make-component':{if(state.selected.length!==1){toast('Agrupa tu selección antes de crear un componente.');break;}change(pr=>createComponent(pr,state.selected[0]),'Componente creado en tu biblioteca');break;}
    case 'insert-instance':{const n=find(state.selected[0]);if(n?.componentId)insertComponent(n.componentId,{x:absolute(p(),n).x,y:absolute(p(),n).y+n.height+20});break;}
    case 'master':{const n=find(state.selected[0]);const c=p().components.find(c=>c.id===n?.instanceOf);if(c&&find(c.masterId)){select([c.masterId]);focusFrame(c.masterId);}else toast('El maestro fue eliminado; puedes desvincular esta instancia.');break;}
    case 'detach':change(pr=>detach(pr,state.selected[0]));break;
    case 'add-page':{let id='';change(pr=>{id=addPage(pr,`Página ${pagesOf(pr).length+1}`).id;},'Página creada');setPage(id);break;}
    case 'versions':openVersions();break;
    case 'variant-create':{const n=find(state.selected[0]);const c=p().components.find(c=>c.id===n?.componentId);if(!c)break;const axes=c.set?variantAxes(p(),c.set):{};const axis=Object.keys(axes)[0]??'Estado';const taken=new Set(axes[axis]??[]);let value='Variante 2';for(let i=2;taken.has(value);i++)value=`Variante ${i}`;let masterId='';change(pr=>{masterId=createVariant(pr,c.id,{[axis]:value}).masterId;},'Variante creada junto al maestro');if(masterId){select([masterId]);focusFrame(masterId);}break;}
    case 'variant-axis':{const n=find(state.selected[0]);const c=p().components.find(c=>c.id===n?.componentId);if(!c)break;const existing=c.set?Object.keys(variantAxes(p(),c.set)):[];let axis='Eje 2';for(let i=2;existing.includes(axis);i++)axis=`Eje ${i}`;change(pr=>defineVariant(pr,c.id,{[axis]:'Base'}));break;}
    case 'align-left':align('left');break;
    case 'align-center':align('center');break;
    case 'distribute':distribute();break;
    case 'front':case 'back':change(pr=>{const ns=pr.nodes.filter(n=>editableIds().includes(n.id));pr.nodes=pr.nodes.filter(n=>!editableIds().includes(n.id));if(act==='front')pr.nodes.push(...ns);else pr.nodes.unshift(...ns);});break;
    case 'image':byId<HTMLInputElement>('image-file').click();break;
    case 'locale-review':showLocalizationIssues();break;
    case 'translation-request':if(state.selected[0])await editor.requestTranslation(state.selected[0]);break;
    case 'asset-svg':await saveAsset('svg');break;
    case 'asset-png':await saveAsset('png');break;
    case 'asset-ios':await saveAsset('assets','ios');break;
    case 'asset-android':await saveAsset('assets','android');break;
    case 'asset-all':await saveAsset('assets');break;
    case 'export-html':await saveFile(await editor.exportHTMLAsync(),`${fileName()}.html`,'html');break;
    case 'export-svg':{const frame=frameOf(p(),state.selected[0]);if(frame)await saveFile(await editor.exportSVGAsync(frame.id),`${frame.name}.svg`,'svg');break;}
    case 'help':help();break;
  }
}

events.addEventListener('click',e=>{
  const el=(e.target as HTMLElement).closest<HTMLElement>('button,[data-layer]');if(!el)return;
  if (el.dataset.sectionToggle) {
    const key = el.dataset.sectionToggle, section = el.closest<HTMLElement>('.inspector-section')!;
    const folded = !foldedInspectorSections.has(key);
    if (folded) foldedInspectorSections.add(key); else foldedInspectorSections.delete(key);
    section.classList.toggle('is-collapsed', folded);
    el.setAttribute('aria-expanded', String(!folded));
    el.setAttribute('aria-label', `${folded ? 'Expandir' : 'Contraer'} sección`);
    return;
  }
  if(el.dataset.action==='edit-aru'){void editor.requestIllustration(state.selected[0]).catch(error=>toast(String(error)));return;}
  if(el.dataset.action==='export-aru'){const n=find(state.selected[0]);if(n?.aruSource)void saveFile(n.aruSource.text,n.aruSource.filename,'aru').catch(error=>toast(String(error)));return;}
  if(el.dataset.implementationOpen){void editor.requestImplementation(el.dataset.implementationNode!,el.dataset.implementationOpen).catch(error=>toast(String(error)));return;}
  if(el.dataset.implementationCreate||el.dataset.implementationEdit){openImplementationEditor(byId('modal-root'),p,(el.dataset.implementationCreate??el.dataset.implementationComponent)!,el.dataset.implementationEdit,fn=>{store.commit(fn);render();persist();},closePreview);return;}
  if(el.dataset.implementationRemove){change(pr=>setComponentImplementation(pr,el.dataset.implementationComponent!,el.dataset.implementationRemove!,null));return;}
  if(el.dataset.propertyCreate||el.dataset.propertyEdit){openComponentPropertyEditor(byId('modal-root'),p,(el.dataset.propertyCreate??el.dataset.propertyComponent)!,el.dataset.propertyTarget,el.dataset.propertyEdit,fn=>{store.commit(fn);render();persist();},closePreview);return;}
  if(el.dataset.propertyRemove){change(pr=>removeComponentProperty(pr,el.dataset.propertyComponent!,el.dataset.propertyRemove!));return;}
  if(el.dataset.propertyReset){const id=state.selected[0];if(id)change(pr=>setComponentProperty(pr,id,el.dataset.propertyReset!,null));return;}
  if('scope' in el.dataset){enterScope(el.dataset.scope||null);return;}
  if((el.dataset.pick||'pickFill' in el.dataset)&&el.closest('#inspector')){const n=state.selected.length===1?find(state.selected[0]):undefined;if(n&&('pickFill' in el.dataset||el.dataset.pick==='Relleno: valor'))openFillPicker(el,n);else pickColorFor(el,pickerContext(n));return;}
  if(el.dataset.pickToken&&el.closest('#inspector')){const token=el.dataset.pickToken;openColorPicker({...pickerContext(),anchor:el,value:p().designThemes[p().activeThemeId].modes[p().theme].colors[token],commit:value=>change(pr=>{pr.designThemes[pr.activeThemeId].modes[pr.theme].colors[token]=value;if(pr.activeThemeId==='project')pr.themes[pr.theme][token]=value;})});return;}
  if(el.dataset.selectMaster){select([el.dataset.selectMaster]);focusFrame(el.dataset.selectMaster);return;}
  if(el.dataset.lintNode){const n=find(el.dataset.lintNode);if(n){select([n.id]);fit(true);}else if(p().designThemes[el.dataset.lintNode])void action('themes');return;}
  if(el.dataset.posture){const current=find(previewFrame||''),other=find(el.dataset.posture);if(current&&other){const t:Transition={type:panelsOf(other)>panelsOf(current)?'unfold':'fold',duration:700,easing:'ease-in-out'};previewHistory.push({id:current.id,transition:t});preview(other.id,false,t);}return;}
  if(el.dataset.localeIssue){const id=el.dataset.localeIssue,root=find(rootIds(p()).get(id)??id);closePreview();if(root)setPage(root.page??pagesOf(p())[0].id);select([id]);fit(true);return;}
  if(el.dataset.action){void action(el.dataset.action).catch(err=>toast(String(err)));return;}
  if(el.hasAttribute('data-drawing-bank')){resourceBank=true;renderComponents();void loadResources().catch(err=>toast(String(err)));return;}
  if(el.hasAttribute('data-drawing-local')){resourceBank=false;renderComponents();return;}
  if(drawingPanel.click(el)||stylePanel.click(el))return;
  if(el.dataset.library){libraryTab=el.dataset.library as typeof libraryTab;renderComponents();if(libraryTab==='kits')void loadKits().catch(err=>toast(String(err)));if(libraryTab==='icons')void loadIcons().catch(err=>toast(String(err)));if(libraryTab==='resources')void loadResources().catch(err=>toast(String(err)));return;}
  if(el.dataset.pageRename){const id=el.dataset.pageRename,row=el.closest<HTMLElement>('.page-row')!,page=pagesOf(p()).find(page=>page.id===id)!;row.innerHTML=`<input class="page-input" data-page-name="${esc(id)}" aria-label="Nombre de la página" value="${esc(page.name)}" maxlength="60"/>`;const input=row.querySelector<HTMLInputElement>('input')!;input.focus();input.select();input.onkeydown=ev=>{if(ev.key==='Escape'){ev.stopPropagation();renderPages();}if(ev.key==='Enter'){ev.preventDefault();input.blur();}};return;}
  if(el.dataset.pageRemove){try{const id=el.dataset.pageRemove;change(pr=>removePage(pr,id),'Página eliminada');}catch(error){toast(String(error instanceof Error?error.message:error));}return;}
  if(el.dataset.page&&!el.dataset.pageName){setPage(el.dataset.page);return;}
  if(el.dataset.resource){void insertResource(el.dataset.resource).catch(err=>toast(String(err)));return;}
  if(el.dataset.action==='resource-reseed'){resourceSeed=`${resourceSeed.replace(/-\d+$/,'')}-${Math.floor(Math.random()*9000+1000)}`;searchResources(true);return;}
  if(el.dataset.iconItem){void insertLibraryIcon(el.dataset.iconItem).catch(err=>toast(String(err)));return;}
  if(el.dataset.kitItem){void insertKit(el.dataset.kitItem).catch(err=>toast(String(err)));return;}
  if(el.dataset.tool){setTool(el.dataset.tool as typeof state.tool);return;}
  if(el.dataset.insert){insert(el.dataset.insert as Kind);return;}
  if(el.dataset.component){insertComponent(el.dataset.component);return;}
  if(el.dataset.tab){setTab(el.dataset.tab as typeof tab);if(tab==='system'&&state.mode!=='system')setMode('system');else if(tab!=='system'&&state.mode==='system')setMode('design');return;}
  if(el.dataset.mode){setMode(el.dataset.mode as typeof state.mode);if(state.mode==='system'&&tab!=='system')setTab('system');else if(state.mode!=='system'&&tab==='system')setTab('layers');if(state.mode==='flow')toast('Selecciona un elemento y elige su destino en «Al hacer clic».');return;}
  if(el.dataset.systemPage){systemPage=el.dataset.systemPage;renderSystem();return;}
  if(el.dataset.systemEdit!==undefined){systemEditing=!systemEditing;renderSystem();return;}
  if(el.dataset.docReviewed){const id=el.dataset.docReviewed;change(pr=>{if(id==='system')setDesignSystemNotes(pr,{});else setComponentDoc(pr,id,{});},'Documentación marcada como vigente');return;}
  if(el.dataset.collapse){const id=el.dataset.collapse,n=find(id);if(n&&collapsedByDefault(n)){expanded.has(id)?expanded.delete(id):expanded.add(id);}else{collapsed.has(id)?collapsed.delete(id):collapsed.add(id);}renderLayers();return;}
  if(el.dataset.lock){change(pr=>{const n=pr.nodes.find(n=>n.id===el.dataset.lock)!;n.locked=!n.locked;});return;}
  if(el.dataset.hide){change(pr=>{const n=pr.nodes.find(n=>n.id===el.dataset.hide)!;n.hidden=!n.hidden;});return;}
  if(el.dataset.layer){const id=el.dataset.layer;const siblings=find(id)?.parentId===state.selectionScope;select((e as MouseEvent).shiftKey&&siblings?(state.selected.includes(id)?state.selected.filter(x=>x!==id):[...state.selected,id]):[id]);return;}
  if(el.dataset.palette){const values:Record<string,[string,string,string,string]>={violet:['#7955e8','#eee8fd','#a28af6','#36304f'],ocean:['#227c9d','#e1f2f7','#6cc4df','#213e4a'],forest:['#33876c','#e4f2eb','#78c6a3','#233f34']};const [primary,accent,darkPrimary,darkAccent]=values[el.dataset.palette];change(pr=>{pr.themes.light.primary=primary;pr.themes.light.accent=accent;pr.themes.dark.primary=darkPrimary;pr.themes.dark.accent=darkAccent;});}
});
events.addEventListener('input',e=>{const el=e.target as HTMLInputElement;if(drawingPanel.input(el))return;if(el.id==='resource-search'){resourceQuery=el.value;searchResources();return;}if(el.id==='resource-seed'){resourceSeed=el.value;return;}if(!['icon-search','kit-search'].includes(el.id))return;const id=el.id,pos=el.selectionStart;if(id==='icon-search')iconSearch=el.value;else kitSearch=el.value;renderComponents();const next=byId<HTMLInputElement>(id);next.focus();next.setSelectionRange(pos,pos);});
dom.listen(layersEl,'dblclick',e=>{const el=(e.target as HTMLElement).closest<HTMLElement>('[data-layer]');if(el&&!(e.target as HTMLElement).closest('button'))enterScope(el.dataset.layer!);});
events.addEventListener('change',e=>{
  const el=e.target as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
  if(el.dataset.publicProperty){const id=state.selected[0];if(!id)return;const prop=getComponentProperties(p(),id).find(prop=>prop.key===el.dataset.publicProperty);if(!prop)return;let value:ComponentPropertyValue=prop.type==='visibility'?(el as HTMLInputElement).checked:el.value;if(prop.type==='icon'){const current=prop.value as {pack:string;name:string};const pack=el.dataset.iconPart==='pack'?el.value:current.pack;const name=el.dataset.iconPart==='name'?el.value:isIconReference(pack,current.name)?current.name:getIconItems(pack)[0].id;value={pack,name};}change(pr=>setComponentProperty(pr,id,prop.key,value));return;}
  if(el.dataset.system!==undefined){const key=el.dataset.system;change(pr=>setDesignSystemNotes(pr,{[key]:el.value}));return;}
  if(el.dataset.doc!==undefined&&el.dataset.docComponent){const key=el.dataset.doc,id=el.dataset.docComponent;change(pr=>setComponentDoc(pr,id,{[key]:el.value}));return;}
  if(state.selected.length===1&&(el.dataset.variantAxis!==undefined||el.dataset.variantSet!==undefined||el.dataset.variantSwitch!==undefined)){
    const n=find(state.selected[0]); const c=p().components.find(c=>c.id===(n?.componentId??n?.instanceOf)); if(!n||!c)return;
    if(el.dataset.variantSet!==undefined){change(pr=>renameVariantSet(pr,c.set!,el.value));return;}
    if(el.dataset.variantAxis!==undefined){change(pr=>defineVariant(pr,c.id,{[el.dataset.variantAxis!]:el.value}));return;}
    const axis=el.dataset.variantSwitch!, value=el.value;
    void (async()=>{if(c.set!.startsWith('kit-')){const mod=kitModule??await import('./kits');if(disposed)return;change(pr=>{mod.ensureKitVariant(pr,c.set!,{...(c.variant??{}),[axis]:value});switchVariant(pr,n.id,{[axis]:value});});}else change(pr=>switchVariant(pr,n.id,{[axis]:value}));})();
    return;
  }
  if(el.dataset.pageName){const id=el.dataset.pageName;try{change(pr=>renamePage(pr,id,el.value));}catch(error){toast(String(error instanceof Error?error.message:error));renderPages();}return;}
  if(el.id==='locale-select'){const value=el.value;el.blur();try{editor.setLocale(value||null);}catch(error){toast(String(error instanceof Error?error.message:error));renderLocaleControl();}return;}
  if(el.dataset.textKey!==undefined){const n=find(state.selected[0]);if(!n||isUnavailable(p(),n))return;try{change(pr=>updateNode(pr,n.id,{textKey:el.value.trim()||undefined}));}catch(error){toast(String(error instanceof Error?error.message:error));renderInspector();}return;}
  if(el.id==='theme-select'){const id=el.value;if(p().designThemes[id]&&id!==p().activeThemeId)change(pr=>{pr.activeThemeId=id;},`Tema «${p().designThemes[id].name}» activo`);return;}
  if(drawingPanel.input(el)||stylePanel.input(el))return;
  if(el.id==='resource-source'){resourceSource=el.value as typeof resourceSource;resourceHits=[];resourceState='idle';searchResources(true);return;}
  if(el.id==='zoom-value') {
    const raw = el.value.trim().replace(/%$/, '').trim().replace(',', '.'); const value = Number(raw);
    if (raw && Number.isFinite(value) && value > 0) zoomAt(value / 100);
    else toast('Introduce un porcentaje entre 10% y 800%.');
    el.value = `${Math.round(state.zoom * 100)}%`; return;
  }
  if(el.id==='zoom-options') {
    const value = el.value; el.value = '';
    if(value === 'fit' || value === 'selection') fit(value === 'selection'); else if(value) zoomAt(Number(value) / 100);
    stage.focus(); return;
  }
  if(el.id==='project-name'){change(pr=>pr.name=el.value.trim()||'Sin título');return;}
  if(el.id==='icon-pack'){iconPack=el.value;renderComponents();return;}
  if(el.id==='icon-search'){iconSearch=el.value;renderComponents();return;}
  if(el.id==='kit-platform'){kitId=el.value as KitId;renderComponents();return;}
  if(el.id==='kit-variant'){kitVariant=el.value as KitVariant;renderComponents();return;}
  if(el.id==='kit-search'){kitSearch=el.value;renderComponents();return;}
  if(el.id==='frame-kit'&&el.value&&state.selected.length===1){const id=state.selected[0],kit=el.value as KitId;void loadKits().then(kits=>change(pr=>{const themeId=kits.ensureKitTheme(pr,kit);updateNode(pr,id,{themeId,kitId:kit});})).catch(err=>toast(String(err)));return;}
  if(el.dataset.token){change(pr=>{pr.designThemes[pr.activeThemeId].modes[pr.theme].colors[el.dataset.token!]=el.value;if(pr.activeThemeId==='project')pr.themes[pr.theme][el.dataset.token!]=el.value;});return;}
  if('heat' in el.dataset&&review){review.heat=(el as HTMLInputElement).checked;render();return;}
  if((el.dataset.pad||el.dataset.limit)&&state.selected.length===1){
    const n=find(state.selected[0]);if(!n||isUnavailable(p(),n))return;
    if(!(el as HTMLInputElement).checkValidity()){toast('Introduce un valor dentro del rango permitido.');renderInspector();return;}
    if(el.dataset.pad)change(pr=>updateNode(pr,n.id,{paddingSides:{...n.paddingSides!,[el.dataset.pad!]:Number(el.value)}}));
    else change(pr=>updateNode(pr,n.id,{[el.dataset.limit!]:el.value.trim()===''?undefined:Number(el.value)}));
    return;
  }
  if((el.dataset.frameField||el.dataset.safe)&&state.selected.length===1){
    const n=find(state.selected[0]);if(!n||n.type!=='frame'||isUnavailable(p(),n))return;
    if(el.dataset.safe){
      if(!(el as HTMLInputElement).checkValidity()){toast('Introduce un valor dentro del rango permitido.');renderInspector();return;}
      const next={top:0,right:0,bottom:0,left:0,...n.safeArea,[el.dataset.safe]:Number(el.value)};
      change(pr=>updateNode(pr,n.id,{safeArea:Object.values(next).some(Boolean)?next:undefined}));return;
    }
    if(el.dataset.frameField==='skin'){change(pr=>updateNode(pr,n.id,{skin:el.value||undefined}));return;}
    // Linking joins this screen to the other one's posture group; a tri-fold has three screens in it.
    change(pr=>{if(!el.value)for(const other of pr.nodes)if(other.foldPair===n.id)updateNode(pr,other.id,{foldPair:undefined});updateNode(pr,n.id,{foldPair:el.value||undefined});const target=pr.nodes.find(other=>other.id===el.value);if(target&&!pr.nodes.some(other=>other.id===target.foldPair&&other.type==='frame'))updateNode(pr,target.id,{foldPair:n.id});});return;
  }
  if((el.dataset.device!==undefined||el.dataset.fold)&&state.selected.length===1){
    const n=find(state.selected[0]);if(!n||n.type!=='frame'||isUnavailable(p(),n))return;
    if(el.dataset.device!==undefined){const d=devicePresets.find(d=>d.id===el.value);change(pr=>updateNode(pr,n.id,d?{device:d.id,width:d.width,height:d.height,fold:d.fold?{...d.fold}:undefined,skin:d.skin,safeArea:presetSafeArea(d)}:{device:undefined}));fit(true);return;}
    if(el instanceof HTMLInputElement&&!el.checkValidity()){toast('Introduce un valor dentro del rango permitido.');renderInspector();return;}
    change(pr=>updateNode(pr,n.id,{fold:el.dataset.fold==='axis'?el.value?{...n.fold,axis:el.value as 'vertical'|'horizontal',gap:n.fold?.gap??0}:undefined:el.dataset.fold==='panels'?{axis:n.fold!.axis,gap:n.fold!.gap,...(el.value==='3'?{panels:3 as const}:{})}:{...n.fold!,gap:Number(el.value)}}));return;
  }
  if(el.dataset.transition&&state.selected.length===1){
    const n=find(state.selected[0]);if(!n||isUnavailable(p(),n))return;
    if(el instanceof HTMLInputElement&&!el.checkValidity()){toast('Introduce un valor dentro del rango permitido.');renderInspector();return;}
    const base:Transition=n.transition??{type:'fade',duration:300,easing:'ease-out'},key=el.dataset.transition;
    change(pr=>updateNode(pr,n.id,{transition:key==='type'&&!el.value?undefined:{...base,[key]:key==='duration'?Number(el.value):el.value}}));return;
  }
  if(el.dataset.fillType!==undefined&&state.selected.length===1){
    const n=find(state.selected[0]);if(!n||isUnavailable(p(),n))return;
    const token=el.value.startsWith('token:')?el.value.slice(6):undefined;
    // A local gradient replaces any fill link; a solid fill only drops a link to a theme gradient.
    const keep=!token&&el.value==='none'&&n.fillToken&&Object.hasOwn(effectiveTheme(p(),n).tokens.colors,n.fillToken);
    change(pr=>updateNode(pr,n.id,token?{fillToken:token}:{gradient:el.value as DesignNode['gradient'],fillToken:keep?n.fillToken:undefined,...(el.value==='none'?{gradientStops:undefined}:{})}));return;
  }
  if(el.dataset.field&&state.selected.length===1){const n=find(state.selected[0]);if(!n||isUnavailable(p(),n))return;const field=el.dataset.field as keyof DesignNode;let value:unknown=el.value;if(el instanceof HTMLInputElement&&el.type==='number'){if(!el.checkValidity()){toast('Introduce un valor dentro del rango permitido.');renderInspector();return;}value=Number(el.value);}if(el instanceof HTMLInputElement&&el.type==='checkbox')value=el.checked;if(field==='targetId'&&!value)value=null;if(['fillToken','materialToken','typographyToken','radiusToken','themeId'].includes(field)&&!value)value=undefined;
    // Editing a value that a token controls detaches the token and keeps the other resolved values, so nothing else jumps.
    if(field==='page'){change(pr=>updateNode(pr,n.id,{page:String(value)}),'Pantalla movida de página');select([]);return;}
    if(field==='role'){change(pr=>updateNode(pr,n.id,{role:value?String(value) as DesignNode['role']:undefined}));return;}
    const resolved=resolveNodeStyle(p(),n);if(field==='fontWeight')value=Number(value);let patch:Partial<DesignNode>={[field]:value};
    if(field==='fontFamily'||field==='fontStyle'){const family=field==='fontFamily'?String(value):resolved.fontFamily??n.fontFamily,style=field==='fontStyle'?String(value):resolved.fontStyle??n.fontStyle??'normal',weight=resolved.fontWeight??n.fontWeight;const face=editor.getFonts().find(f=>f.id===family);if(face&&!face.builtin){const candidates=face.variants.filter(v=>v.status==='loaded'&&(field==='fontFamily'||v.style===style));const variant=candidates.find(v=>v.style===style&&v.weight===weight)??candidates.find(v=>v.style===style)??candidates[0];if(variant){patch={...patch,fontWeight:variant.weight,fontStyle:variant.style};if(variant.weight!==weight||variant.style!==style)toast(`${face.name}: ${variant.weight} ${variant.style} disponible aplicado.`);}}}
    if(n.typographyToken&&['fontFamily','fontSize','fontWeight','fontStyle','lineHeight'].includes(field))patch={fontFamily:resolved.fontFamily,fontSize:resolved.fontSize,fontWeight:resolved.fontWeight,fontStyle:resolved.fontStyle??'normal',lineHeight:resolved.lineHeight,...patch,typographyToken:undefined};
    if(n.radiusToken&&field==='radius')patch={...patch,radiusToken:undefined};
    change(pr=>updateNode(pr,n.id,patch));}
});
dom.listen(byId<HTMLInputElement>('zoom-value'),'focus', e => (e.target as HTMLInputElement).select());
dom.listen(byId<HTMLInputElement>('zoom-value'),'keydown', e => {
  if(e.key === 'Escape') { e.stopPropagation(); (e.target as HTMLInputElement).value = `${Math.round(state.zoom * 100)}%`; stage.focus(); }
  if(e.key === 'Enter') { e.preventDefault(); stage.focus(); }
});
events.addEventListener('dragstart',e=>{const el=(e.target as HTMLElement).closest<HTMLElement>('[data-insert],[data-component],[data-kit-item],[data-icon-item],[data-resource]');if(el){e.dataTransfer?.setData('application/codaru',JSON.stringify({kind:el.dataset.insert,component:el.dataset.component,kitItem:el.dataset.kitItem,iconItem:el.dataset.iconItem,resource:el.dataset.resource}));if(e.dataTransfer)e.dataTransfer.effectAllowed='copy';}});
dom.listen(stage,'dragover',e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';});
dom.listen(stage,'drop',e=>{e.preventDefault();try{const data=JSON.parse(e.dataTransfer?.getData('application/codaru')||'{}');const pos=point(e.clientX,e.clientY);if(data.resource)void insertResource(data.resource,pos).catch(err=>toast(String(err)));else if(data.iconItem)void insertLibraryIcon(data.iconItem,pos).catch(err=>toast(String(err)));else if(data.kitItem)void insertKit(data.kitItem,pos).catch(err=>toast(String(err)));else if(data.component)insertComponent(data.component,pos);else if(data.kind)insert(data.kind,pos);}catch{toast('No se pudo insertar este elemento.');}});
byId<HTMLInputElement>('import-file').onchange=async e=>{const el=e.target as HTMLInputElement;const f=el.files?.[0];if(f){if(f.size>20_000_000)toast('El archivo supera 20 MB.');else await loadProject(await f.text());}el.value='';};
byId<HTMLInputElement>('image-file').onchange=async e=>{const el=e.target as HTMLInputElement;const file=el.files?.[0];if(!file)return;
  if(/\.aru\.codaru\.json$/i.test(file.name)){
    el.value='';
    try { if(file.size>1_200_000)throw new Error('El paquete ARU supera 1.2 MB.');
      const data=JSON.parse(await file.text()); if(disposed)return;
      const current=find(state.selected[0]),parent=current?frameOf(p(),current.id):firstFrame();let id='';
      change(pr=>{id=applyAruAsset(pr,{op:'aru',data,...(current?.type==='vector'?{id:current.id}:{parentId:parent?.id??null})});},'Ilustración ARU importada');select([id]);
    }catch(error){toast(error instanceof Error?error.message:'No se pudo importar ARU.');}return;
  }
  if(file.type==='image/svg+xml'||/\.svg$/i.test(file.name)){
    el.value='';
    try{
      const svg=sanitizeSVG(await file.text());if(disposed)return;
      const current=find(state.selected[0]),layers=vectorLayers(svg).map(l=>l.id);
      // Replacing the artwork keeps the animations whose layers still exist.
      if(current?.type==='vector')change(pr=>updateNode(pr,current.id,{svg,animations:current.animations?.filter(a=>!a.target||layers.includes(a.target))}),'Ilustración actualizada');
      else{const parent=current?frameOf(p(),current.id):firstFrame(),size=vectorSize(svg),width=Math.min(240,size.width);const n=node('vector',{parentId:parent?.id||null,x:32,y:32,width,height:Math.max(1,Math.round(width*size.height/size.width)),svg,name:file.name.replace(/\.svg$/i,'')});change(pr=>pr.nodes.push(n),'Ilustración añadida · anímala en Propiedades');select([n.id]);}
    }catch(error){toast(error instanceof Error?error.message:'No se pudo importar el SVG.');}
    return;
  }if(file.size>3_000_000){toast('Usa una imagen de menos de 3 MB para mantener ligero el proyecto.');el.value='';return;}
  const reader=new FileReader();reader.onload=()=>{if(disposed)return;const image=String(reader.result);const current=find(state.selected[0]);if(current?.type==='image')change(pr=>updateNode(pr,current.id,{image}));else{const parent=current?frameOf(p(),current.id):firstFrame();const n=node('image',{parentId:parent?.id||null,x:32,y:32,width:240,height:180,image,name:file.name});change(pr=>pr.nodes.push(n));select([n.id]);}};reader.readAsDataURL(file);el.value='';};

// Pointer gestures make one history entry, regardless of how many pointer moves occur.
type Gesture = {kind:'pan'|'drag'|'resize'|'draw'|'marquee';pointerId:number;start:{x:number;y:number};screen:{x:number;y:number};before:Project;geometry:Map<string,{x:number;y:number;width:number;height:number}>;ids:string[];handle?:string;pan:{x:number;y:number};draft?:DesignNode;moved:boolean;shift:boolean;scope:Scope;scopeBefore:Scope;selectionBefore:string[]};
let gesture:Gesture|null=null;
function point(clientX:number,clientY:number){const r=stage.getBoundingClientRect();return{x:(clientX-r.left-state.pan.x)/state.zoom,y:(clientY-r.top-state.pan.y)/state.zoom};}
function hitNode(target:HTMLElement):DesignNode|undefined{const hit=target.closest<HTMLElement>('[data-node]');return hit?find(hit.dataset.node!):undefined;}
dom.listen(stage,'pointerdown',e=>{
  if((e.target as HTMLElement).closest('#system-view'))return;
  if(e.button!==0&&e.button!==1)return;if((e.target as HTMLElement).closest('[contenteditable="true"]'))return;
  stage.focus();e.preventDefault();const pos=point(e.clientX,e.clientY);lastPoint=pos;
  const g:Gesture={kind:'marquee',pointerId:e.pointerId,start:pos,screen:{x:e.clientX,y:e.clientY},before:clone(p()),geometry:new Map(p().nodes.map(n=>[n.id,{x:n.x,y:n.y,width:n.width,height:n.height}])),ids:[],pan:{...state.pan},moved:false,shift:e.shiftKey,scope:state.selectionScope,scopeBefore:state.selectionScope,selectionBefore:[...state.selected]};
  const handle=(e.target as HTMLElement).closest<HTMLElement>('[data-resize]');
  if(space||state.tool==='hand'||e.button===1)g.kind='pan';
  else if(handle){g.kind='resize';g.ids=[handle.dataset.id!];g.handle=handle.dataset.resize;}
  else if(state.tool!=='cursor'){
    const parent=state.tool==='frame'?undefined:parentAt(pos.x,pos.y);if(parent&&isUnavailable(p(),parent)){toast('Esta pantalla está bloqueada.');return;}
    g.kind='draw';g.draft=node(state.tool,{parentId:parent?.id||null,...(parent?{}:{page:pageId()}),x:pos.x-(parent?.x||0),y:pos.y-(parent?.y||0),width:1,height:1});
  }else{
    const raw=hitNode(e.target as HTMLElement);
    const scope=(e.target as HTMLElement).closest('.frame-label') ? raw?.parentId ?? null : scopeAtPoint(pv(),state.selectionScope,pos,raw?.id);
    if(scope!==state.selectionScope)select([],scope);
    g.scope=state.selectionScope;
    const n=atScope(pv(),raw?.id,state.selectionScope);
    if(n){
      if(e.shiftKey)select(state.selected.includes(n.id)?state.selected.filter(id=>id!==n.id):[...state.selected,n.id],state.selectionScope);
      else if(!state.selected.includes(n.id))select([n.id],state.selectionScope);
      g.kind='drag';g.ids=topSelected(p(),editableIds());
    }else{if(!e.shiftKey)select([],state.selectionScope);g.ids=[...state.selected];}
  }
  gesture=g;stage.setPointerCapture(e.pointerId);
});
dom.listen(stage,'pointermove',e=>{
  if(!gesture)return;const g=gesture;const pos=point(e.clientX,e.clientY);let dx=pos.x-g.start.x,dy=pos.y-g.start.y;
  if(Math.hypot(e.clientX-g.screen.x,e.clientY-g.screen.y)>3)g.moved=true;
  if(g.kind==='pan'){state.pan={x:g.pan.x+e.clientX-g.screen.x,y:g.pan.y+e.clientY-g.screen.y};setTransform();return;}
  if(!g.moved)return;
  if(g.kind==='draw'&&g.draft){const parent=g.draft.parentId?find(g.draft.parentId):undefined;const n=g.draft;n.x=Math.min(pos.x,g.start.x)-(parent?.x||0);n.y=Math.min(pos.y,g.start.y)-(parent?.y||0);n.width=Math.max(1,Math.abs(dx));n.height=Math.max(1,Math.abs(dy));if(e.shiftKey)n.height=n.width;const ghost=element(p(),{...n,parentId:null,x:n.x+(parent?.x||0),y:n.y+(parent?.y||0)});ghost.style.opacity='.6';byId('drawing-overlay').replaceChildren(ghost);return;}
  if(g.kind==='marquee'){
    const box=document.createElement('div');box.className='marquee';Object.assign(box.style,{left:`${Math.min(pos.x,g.start.x)}px`,top:`${Math.min(pos.y,g.start.y)}px`,width:`${Math.abs(dx)}px`,height:`${Math.abs(dy)}px`,borderWidth:`${1/state.zoom}px`});byId('drawing-overlay').replaceChildren(box);
    state.selected=[...new Set([...g.ids,...inMarquee(pv(),g.scope,g.start,pos)])];renderSelection();return;
  }
  // Put every node back where the gesture found it (no document clone per pointer move), then apply the delta.
  for(const n of p().nodes){const o=g.geometry.get(n.id);if(o){n.x=o.x;n.y=o.y;n.width=o.width;n.height=o.height;}}
  if(g.kind==='drag'){
    if(e.shiftKey){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0;}
    for(const id of g.ids){const n=find(id)!;const par=n.parentId?find(n.parentId):undefined;if(par?.layout!=='free'&&par)continue;updateNode(p(),id,{x:e.altKey?n.x+dx:Math.round((n.x+dx)/4)*4,y:e.altKey?n.y+dy:Math.round((n.y+dy)/4)*4});}
  }else if(g.kind==='resize'){
    const n=find(g.ids[0])!;const h=g.handle!;let width=Math.max(8,n.width+(h.includes('e')?dx:-dx)),height=Math.max(8,n.height+(h.includes('s')?dy:-dy));if(e.shiftKey)height=width*n.height/n.width;
    updateNode(p(),n.id,{width:Math.round(width),height:Math.round(height),x:h.includes('w')?n.x+n.width-width:n.x,y:h.includes('n')?n.y+n.height-height:n.y});
  }
  layoutProject(p());renderRoots(g.ids);
});
function finishGesture(e:Pick<PointerEvent,'pointerId'|'clientX'|'clientY'>,cancel=false){
  if(!gesture)return;const g=gesture;gesture=null;byId('drawing-overlay').replaceChildren();if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);
  if(cancel){store.project=g.before;state.selectionScope=g.scopeBefore;state.selected=g.selectionBefore;state.pan=g.pan;render();return;}if(g.kind==='pan')return;
  if(g.kind==='draw'&&g.draft){const n=g.draft;if(!g.moved||n.width<8||n.height<8){const standard=node(n.type);n.width=standard.width;n.height=standard.height;}change(pr=>pr.nodes.push(n));select([n.id]);setTool('cursor');return;}
  if(g.kind==='marquee'&&g.moved){select([...new Set([...g.ids,...inMarquee(pv(),g.scope,g.start,point(e.clientX,e.clientY))])],g.scope);return;}
  if(g.moved&&(g.kind==='drag'||g.kind==='resize')){
    if(g.kind==='drag'){
      const destination=parentAt(point(e.clientX,e.clientY).x,point(e.clientX,e.clientY).y);
      if(destination&&!isUnavailable(p(),destination))for(const id of g.ids){
        const n=find(id)!;const oldFrame=frameOf(p(),id);
        if(n.type!=='frame'&&oldFrame?.id!==destination.id&&(!n.componentKey||n.instanceOf)&&!ancestors(p(),id).some(a=>a.componentId||a.instanceOf)){
          const a=absolute(p(),n);updateNode(p(),id,{parentId:destination.id,x:a.x-destination.x,y:a.y-destination.y});
        }
      }
    }
    const after=clone(p());store.project=g.before;change(pr=>Object.assign(pr,after));
  }else renderInspector();
}
dom.listen(stage,'pointerup',e=>finishGesture(e));dom.listen(stage,'pointercancel',e=>finishGesture(e,true));
dom.listen(stage,'lostpointercapture',e=>{if(gesture?.pointerId===e.pointerId)finishGesture(e,true);});
dom.listen(stage,'dblclick',e=>{
  if(state.tool!=='cursor')return;
  // Pointer capture retargets click events to the stage in some engines.
  const target=document.elementFromPoint(e.clientX,e.clientY) as HTMLElement|null;
  const raw=hitNode(target||e.target as HTMLElement);const n=atScope(pv(),raw?.id,state.selectionScope);if(!n)return;
  if(canEnter(n)){enterScope(n.id);return;}
  if(!['text','button','input'].includes(n.type)||isUnavailable(p(),n))return;
  const el=byId('artboards').querySelector<HTMLElement>(`[data-node="${CSS.escape(n.id)}"] .node-text`);if(!el)return;el.contentEditable='true';el.style.pointerEvents='auto';el.style.cursor='text';el.focus();
  const range=document.createRange();range.selectNodeContents(el);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);
  dom.listen(el,'blur',()=>{const text=el.innerText;change(pr=>updateNode(pr,n.id,{text}));},{once:true});
});
let pinch: { zoom: number; x: number; y: number } | null = null;
let cursor = { x: 0, y: 0 };
dom.listen(stage,'pointermove', e => { const r = stage.getBoundingClientRect(); cursor = { x: e.clientX-r.left, y: e.clientY-r.top }; });
dom.listen(stage,'wheel', e => {
  if((e.target as HTMLElement).closest('#system-view'))return;
  e.preventDefault(); if (gesture || pinch) return;
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? stage.clientHeight : 1;
  const dx = e.deltaX * unit, dy = e.deltaY * unit;
  // Scrolling moves the canvas on both axes; Ctrl/Cmd + wheel (and trackpad pinch) zooms.
  if (!(e.ctrlKey || e.metaKey)) {
    const sideways = e.shiftKey && !dx;
    state.pan.x -= sideways ? dy : dx; state.pan.y -= sideways ? 0 : dy; setTransform(); return;
  }
  const r = stage.getBoundingClientRect();
  // Bound large wheel deltas while retaining smooth trackpad/pinch increments.
  zoomAt(state.zoom * Math.exp(-Math.max(-240, Math.min(240, dy)) * (e.ctrlKey ? .01 : .0025)), e.clientX-r.left, e.clientY-r.top);
}, { passive: false });
// WKWebView sends GestureEvents for trackpad pinch; Chromium sends Ctrl+wheel.
dom.listen(stage,'gesturestart', event => {
  event.preventDefault(); if (gesture) return;
  const e = event as Event & { clientX?: number; clientY?: number }; const r = stage.getBoundingClientRect();
  const inStage = e.clientX !== undefined && e.clientY !== undefined && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  pinch = { zoom: state.zoom, x: inStage ? e.clientX! - r.left : cursor.x || stage.clientWidth/2, y: inStage ? e.clientY! - r.top : cursor.y || stage.clientHeight/2 };
}, { passive: false });
document.addEventListener('gesturechange', event => {
  if (!pinch) return; event.preventDefault();
  const scale = (event as Event & { scale: number }).scale;
  if (scale > 0) zoomAt(pinch.zoom * scale, pinch.x, pinch.y);
}, { passive: false });
document.addEventListener('gestureend', event => { if (pinch) { event.preventDefault(); pinch = null; } }, { passive: false });
document.addEventListener('keydown',e=>{
  const editing=(e.target as HTMLElement).matches('input,textarea,select,[contenteditable="true"]');const mod=e.metaKey||e.ctrlKey;
  if(e.key==='Escape'){
    if(byId('modal-root').children.length){const cancel=byId('confirm-cancel');if(cancel)cancel.click();else closePreview();}
    else if(editing)(e.target as HTMLElement).blur();
    else if(gesture)finishGesture({pointerId:gesture.pointerId,clientX:gesture.screen.x,clientY:gesture.screen.y},true);
    else exitScope();
    return;
  }
  if(editing)return;if(byId('modal-root').children.length)return;
  if(gesture)return;
  if(e.key==='Enter'&&!mod&&!e.altKey&&!(e.target as HTMLElement).closest('button,a')){if(state.selected.length===1&&canEnter(find(state.selected[0])!)){e.preventDefault();enterScope(state.selected[0]);}return;}
  if(!e.altKey && ['+','=','-','0'].includes(e.key)) {
    e.preventDefault(); zoomAt(e.key === '0' ? 1 : e.key === '-' ? state.zoom / 1.2 : state.zoom * 1.2); return;
  }
  if(e.code==='Space'){e.preventDefault();space=true;stage.classList.add('panning');return;}
  if(mod){const key=e.key.toLowerCase();if(['z','s','d','g','k','a'].includes(key))e.preventDefault();if(key==='z')void action(e.shiftKey?'redo':'undo');if(key==='s')void action('save');if(key==='d')void action('duplicate');if(key==='g')void action(e.shiftKey?'ungroup':'group');if(key==='k'&&e.altKey)void action('make-component');if(key==='a')select(children(p(),state.selectionScope).filter(n=>!isUnavailable(p(),n)).map(n=>n.id),state.selectionScope);return;}
  if(e.shiftKey&&(e.code==='Digit1'||e.code==='Digit2')){e.preventDefault();fit(e.code==='Digit2');return;}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();void action('delete');return;}
  if(e.key.startsWith('Arrow')&&state.selected.length){e.preventDefault();const step=e.shiftKey?10:1;change(pr=>{for(const id of topSelected(pr,editableIds())){const n=pr.nodes.find(n=>n.id===id)!;updateNode(pr,id,{x:n.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),y:n.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0)});}});return;}
  const keys:Record<string,typeof state.tool>={v:'cursor',f:'frame',r:'rect',o:'ellipse',t:'text',b:'button',h:'hand'};if(keys[e.key.toLowerCase()])setTool(keys[e.key.toLowerCase()]);if(e.key==='?')help();
});
document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;stage.classList.remove('panning');}});
dom.onWindow('blur',()=>{space=false;pinch=null;stage.classList.remove('panning');if(gesture)finishGesture({pointerId:gesture.pointerId,clientX:gesture.screen.x,clientY:gesture.screen.y},true);});
function flushDraft() { if(STORAGE&&!storageWarning)try{localStorage.setItem(STORAGE,JSON.stringify(gesture?.before||p()));}catch{/* The host can still retain getDocument(). */} }
dom.onWindow('beforeunload',flushDraft);

function assertActive() { if(disposed)throw new Error('El editor ya fue desmontado.'); }
function initializeEmbedded(options: EmbeddedOptions) {
  assertActive();
  if(!embedded||embeddedInitialized)throw new Error('El editor solo puede inicializarse una vez al montarlo.');
  const next=options.document===undefined?undefined:validate(options.document);
  embeddedInitialized=true;
  if(next){store.project=next;store.undoStack=[];store.redoStack=[];state.selected=[];state.selectionScope=null;}
  if(options.fonts!==undefined)editor.setFonts(options.fonts);
  if(options.localization!==undefined)editor.setLocalization(options.localization);
  session.setTranslationHandler(options.onTranslationRequest);
  session.setImplementationHandler(options.onImplementationRequest);
  session.setIllustrationHandler(options.onIllustrationRequest);
  onCorrectionRequest=options.onCorrectionRequest;
  session.setResourceLibraryHandler(options.onResourceLibraryChange);
  editor.setResourceServices(options.resourceServices ?? {});
  lastNotified=store.serialize();onHostChange=options.onChange;nativeInvoke=options.invoke;
  if(!STORAGE){const footer=document.querySelector('.sidebar-footer');const label=footer?.childNodes[1];if(label)label.textContent=' Documento en tu aplicación';}
  render();fit();persist();
  if(nativeInvoke&&options.nativeAgent!==false)startAgentPolling();
}
function disposeEmbedded() {
  if(!disposed){
    pendingConfirmation?.(false);
    // Commit a focused text edit before taking the final snapshot, cancel transient gestures.
    (document.activeElement as HTMLElement|null)?.blur();
    if(gesture)finishGesture({pointerId:gesture.pointerId,clientX:gesture.screen.x,clientY:gesture.screen.y},true);
    experienceCleanup?.();experienceCleanup=undefined;
    clearTimeout(saveTimer);clearTimeout(toastTimer);flushDraft();
    disposed=true;onHostChange=undefined;nativeInvoke=undefined;
    if(agentTimer!==undefined)clearInterval(agentTimer);
    stageObserver.disconnect();building.dispose();drawingPanel.dispose();stylePanel.dispose();unbindFonts();unbindFontExtension();session.setResourceRenderer(undefined);dom.dispose();unbindView();if(!options.editor){session.setResourceLibraryHandler(undefined);editor.destroy();}options.onDispose?.();
  }
  return clone(p());
}

// Explicit, transactional operations for a host agent. No model or network is required by the editor.
type Operation = import('./contracts').EditorOperation;
const api = {
  getExperienceReport:editor.getExperienceReport,setExperience:editor.setExperience,
  getComments:editor.getComments,getCorrectionRequest:editor.getCorrectionRequest,captureCommentAnchor:editor.captureCommentAnchor,getCommentContext:editor.getCommentContext,subscribeComments:editor.subscribeComments,
  getStyles:()=>{assertActive();return editor.getStyles();},getStyle:(id:string)=>{assertActive();return editor.getStyle(id);},importStyle:(...args:Parameters<typeof editor.importStyle>)=>{assertActive();const result=editor.importStyle(...args);persist();return result;},applyStyle:(...args:Parameters<typeof editor.applyStyle>)=>{assertActive();const result=editor.applyStyle(...args);persist();return result;},
  getResourceLibrary:(...args:Parameters<typeof editor.getResourceLibrary>)=>{assertActive();return editor.getResourceLibrary(...args);},getResource:(...args:Parameters<typeof editor.getResource>)=>{assertActive();return editor.getResource(...args);},stageResource:(...args:Parameters<typeof editor.stageResource>)=>{assertActive();return editor.stageResource(...args);},reviewResource:(...args:Parameters<typeof editor.reviewResource>)=>{assertActive();return editor.reviewResource(...args);},requestResourceEdit:(...args:Parameters<typeof editor.requestResourceEdit>)=>{assertActive();return editor.requestResourceEdit(...args);},setResourceServices:(...args:Parameters<typeof editor.setResourceServices>)=>{assertActive();return editor.setResourceServices(...args);},exportResource:(...args:Parameters<typeof editor.exportResource>)=>{assertActive();return editor.exportResource(...args);},
  insertResource:async (...args:Parameters<typeof editor.insertResource>)=>{assertActive();const result=await editor.insertResource(...args);persist();return result;},
  getDocument:()=>clone(p()), getSelection:()=>state.selected.map(id=>clone(find(id)!)), getSelectionScope:()=>state.selectionScope,
  select:(ids:string[])=>{assertActive();select(ids);},
  apply:(operations:Operation[])=>{const result=editor.apply(operations);persist();return result;},
  getComponentProperties:editor.getComponentProperties,
  getImplementations:(id:string)=>{assertActive();return editor.getImplementations(id);},
  setImplementation:(componentId:string,platform:string,reference:ImplementationReference|null)=>{assertActive();const result=editor.setImplementation(componentId,platform,reference);persist();return result;},
  requestIllustration:(id:string)=>{assertActive();return editor.requestIllustration(id);},
  requestImplementation:(id:string,platform:string)=>{assertActive();return editor.requestImplementation(id,platform);},
  setComponentProperty:(id:string,key:string,value:ComponentPropertyValue|null)=>{const result=editor.setComponentProperty(id,key,value);persist();return result;},
  agent:(command:string,params:Record<string,unknown>={})=>runAgent({command,params}),
  importDocument:(input:unknown)=>{assertActive();editor.importDocument(input);fit();persist();},
  undo:()=>{assertActive();return action('undo');},redo:()=>{assertActive();return action('redo');}, exportHTML:editor.exportHTML, exportAsset: editor.exportAsset,
  getFonts:editor.getFonts,setFonts:editor.setFonts,registerFonts:editor.registerFonts,loadFonts:editor.loadFonts,getFontIssues:editor.getFontIssues,exportHTMLAsync:editor.exportHTMLAsync,exportSVGAsync:editor.exportSVGAsync,
  getPreviewDocument:editor.getPreviewDocument,getLocalization:editor.getLocalization,getLocalizationState:editor.getLocalizationState,getLocalizationIssues:editor.getLocalizationIssues,setLocalization:editor.setLocalization,setLocale:editor.setLocale,requestTranslation:editor.requestTranslation,
  initializeEmbedded,disposeEmbedded,
};

render();requestAnimationFrame(()=>{if(disposed || options.modular)return;fit();if(storageWarning)toast(storageWarning);});

// The native CLI and the in-page API use the same transaction/context contract.
let agentRunning=false;
async function runAgent(request:import('./agent').AgentRequest){
  if(disposed)return {ok:false,error:{code:'editor_disposed',message:'El editor ya fue desmontado.'}};
  const module=await import('./agent');
  return module.handleAgentRequest({resourceLibrary:editor.getResourceLibrary,resource:editor.getResource,exportResource:editor.exportResource,fonts:editor.getFonts,fontIssues:editor.getFontIssues,loadFonts:editor.loadFonts,fontRegistry:session.fonts,project:p,selection:()=>[...state.selected],localization:session.localization,localizationState:editor.getLocalizationState,previewProject,setLocale:editor.setLocale,localizationIssues:editor.getLocalizationIssues,scope:()=>state.selectionScope,
    busy:()=>disposed||(embedded&&!options.modular&&!embeddedInitialized)||!!gesture||!!byId('modal-root').children.length||!!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'),
    commit:edit=>{assertActive();const before=building.snapshot(p());store.commit(edit);touchedByAgent=building.track(before,p());state.selected=state.selected.filter(id=>!!find(id));render();persist();},
    commitPrepared:prepared=>{assertActive();const before=building.snapshot(p());store.commitPrepared(prepared);touchedByAgent=building.track(before,p());state.selected=state.selected.filter(id=>!!find(id));render();persist();},select:ids=>select(ids),
    undo:()=>{store.undo();render();persist();},redo:()=>{store.redo();render();persist();}},request);
}
let agentConnected=false,agentTimer:ReturnType<typeof setInterval>|undefined;
async function pollAgent(){
  if(agentRunning||!nativeInvoke||disposed)return;agentRunning=true;
  const invoke=nativeInvoke;
  try{
    const request=await invoke<({id:string}&import('./agent').AgentRequest)|null>('plugin:codaru|agent_poll');agentConnected=true;
    if(request){let response:Record<string,unknown>;try{response=await runAgent(request);}catch(e){response={ok:false,error:{code:'internal_error',message:String(e)}};}await invoke('plugin:codaru|agent_respond',{id:request.id,response});}
  }catch{agentConnected=false;}finally{agentRunning=false;}
}
function startAgentPolling(){if(agentTimer!==undefined)return;void pollAgent();agentTimer=setInterval(()=>void pollAgent(),500);}
if(nativeInvoke && options.nativeAgent !== false)startAgentPolling();
const stageObserver=new ResizeObserver(()=>{if(!disposed && stage.isConnected)renderCamera();});stageObserver.observe(stage);
// Versions: named, compressed snapshots kept inside the document; restoring is a normal (undoable) commit.
async function openVersions(compareId?: string){
  const modal=byId('modal-root'),versions=p().versions??[];
  let compare='';
  if(compareId){const v=versions.find(v=>v.id===compareId);if(v){try{const d=compareVersion(p(),await unpackVersion(v.data));if(disposed)return;const list=(label:string,items:string[])=>items.length?`<p><b>${label}</b> ${esc(items.slice(0,12).join(', '))}${items.length>12?` y ${items.length-12} más`:''}</p>`:'';compare=`<section class="version-compare"><h3>Desde «${esc(v.name)}»</h3>${list('Pantallas nuevas:',d.added)}${list('Pantallas eliminadas:',d.removed)}${list('Pantallas cambiadas:',d.changed)}${!d.added.length&&!d.removed.length&&!d.changed.length?'<p>Sin cambios en las pantallas.</p>':''}<p class="field-note">${d.nodesBefore} → ${d.nodesAfter} elementos.</p></section>`;}catch(error){compare=`<p class="field-note">No se pudo leer la versión: ${esc(String(error instanceof Error?error.message:error))}</p>`;}}}
  const size=(v:import('./model').Version)=>`${(v.data.length*3/4/1024).toFixed(0)} KB`;
  modal.innerHTML=`<div class="modal-backdrop"><section class="dialog versions-dialog" role="dialog" aria-modal="true" aria-label="Versiones del diseño"><button class="dialog-close icon-button" data-action="close-preview" aria-label="Cerrar versiones">×</button><span class="eyebrow">VERSIONES</span><h2>Guarda hitos y vuelve a ellos.</h2><p>Cada versión es una copia comprimida del diseño dentro del documento (máximo 30). Restaurar es un cambio normal: Deshacer lo revierte.</p>
    <form class="version-form" data-version-form><input name="name" aria-label="Nombre de la versión" placeholder="Nombre · p. ej. Entrega v1" maxlength="80" required/><input name="note" aria-label="Nota" placeholder="Nota (opcional)" maxlength="200"/><button class="primary" type="submit">Guardar versión</button></form>
    ${versions.length?`<div class="version-list">${[...versions].reverse().map(v=>`<div class="version-row"><div><strong>${esc(v.name)}</strong><small>${esc(new Date(v.at).toLocaleString())} · ${v.screens} ${v.screens===1?'pantalla':'pantallas'} · ${size(v)}</small>${v.note?`<p>${esc(v.note)}</p>`:''}</div><div class="button-row compact"><button data-version-compare="${esc(v.id)}">Comparar</button><button data-version-restore="${esc(v.id)}">Restaurar</button><button data-version-remove="${esc(v.id)}" aria-label="Eliminar versión ${esc(v.name)}">×</button></div></div>`).join('')}</div>`:'<p class="empty-note">Aún no hay versiones guardadas.</p>'}${compare}</section></div>`;
  modal.onsubmit=async e=>{e.preventDefault();const form=e.target as HTMLFormElement;const name=String(new FormData(form).get('name')??''),note=String(new FormData(form).get('note')??'');try{const version=await buildVersion(p(),name,note);if(disposed)return;change(pr=>addVersion(pr,version),`Versión «${version.name}» guardada`);void openVersions();}catch(error){toast(String(error instanceof Error?error.message:error));}};
  modal.onclick=async e=>{const el=(e.target as HTMLElement).closest<HTMLElement>('button');if(!el)return;
    if(el.dataset.versionCompare){void openVersions(el.dataset.versionCompare);return;}
    if(el.dataset.versionRemove){change(pr=>removeVersion(pr,el.dataset.versionRemove!),'Versión eliminada');void openVersions();return;}
    if(el.dataset.versionRestore){const v=(p().versions??[]).find(v=>v.id===el.dataset.versionRestore);if(!v)return;try{const payload=await unpackVersion(v.data);if(disposed)return;change(pr=>applyVersion(pr,payload),`Versión «${v.name}» restaurada · Deshacer la revierte`);closePreview();fit();}catch(error){toast(String(error instanceof Error?error.message:error));}}};
}
function agentHelp(){
  byId('modal-root').innerHTML=`<div class="modal-backdrop"><section class="dialog agent-dialog" role="dialog" aria-modal="true" aria-label="Flujo de IA y CLI"><button class="dialog-close icon-button" data-action="close-preview" aria-label="Cerrar guía de IA">×</button><span class="eyebrow">DISEÑAR JUNTOS</span><h2>Tú dibujas. La IA continúa.</h2><p class="agent-status">${nativeInvoke?(agentConnected?'● CLI local disponible con la app abierta':'Puente nativo disponible'):(embedded?'Editor integrado · API disponible para la aplicación':'Vista de navegador · el CLI se conecta a la app nativa')}</p><ol><li><strong>Leer contexto</strong><code>codaru context</code><span>Selección, pantallas, temas, conexiones y revisión actual.</span></li><li><strong>Descubrir piezas</strong><code>codaru catalog --kind icons</code><span>También: --kind kits. Usa schema para conocer las operaciones.</span></li><li><strong>Probar y aplicar</strong><code>codaru apply --file cambios.json --dry-run<br/>codaru apply --file cambios.json</code><span>Un lote atómico; devuelve IDs, cambios y contexto actualizado.</span></li><li><strong>Revisar el resultado</strong><code>codaru export --format svg --frame ID --output vista.svg</code><span>El diseño aparece en este lienzo. Deshacer restaura el lote.</span></li></ol><p>El JSON incluye <code>expectedRevision</code> y <code>operations</code>. Una revisión antigua se rechaza para proteger tus cambios. Cierra esta guía antes de pedir modificaciones.</p><p class="field-note">La app no llama a ningún modelo: tu agente ejecuta el CLI. Ejecutable en src-tauri/target/release/codaru; guía completa en CLI.md. Sin servidor Node.</p></section></div>`;
}

const unbindFontExtension=session.bindExtension({flush:()=>{},dispose:()=>{unbindFonts();unbindFontExtension();}});
const unbindView = session.bindView({
  render, resources: () => { drawingPanel.invalidate(); if (libraryTab === 'resources') renderComponents(); }, camera: renderCamera, localizationIssues: readLocalizationIssues,
  flush: () => { (document.activeElement as HTMLElement | null)?.blur(); if (gesture) finishGesture({pointerId:gesture.pointerId,clientX:gesture.screen.x,clientY:gesture.screen.y},true); persist(); flushDraft(); },
  isInteracting: () => !!gesture || !!pinch,
  isBusy: () => !!gesture || !!byId('modal-root').children.length || !!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'),
  dispose: () => { disposeEmbedded(); },
  command: async actionName => { assertActive(); await action(actionName); },
});
session.setResourceRenderer(resourcePreviewRenderer(app.ownerDocument));
let savedComments=p().comments;
const unbindCommentPersistence=session.bindExtension({flush:()=>{},dispose:()=>{commentView?.destroy();commentSidebar?.remove();unbindCommentPersistence();},notify:()=>{if(savedComments!==p().comments){savedComments=p().comments;persist();}}});
return { api, editor, parts: dom.parts, restorePart: dom.restore, refresh: () => { render(); renderCamera(); }, dismissDialogs: () => { pendingConfirmation?.(false); closePreview(); }, fit, dispose: disposeEmbedded };
}
