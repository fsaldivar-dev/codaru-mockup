import {transferFonts,attachFonts,FontRegistry} from './fonts';
import { panelsOf, postureGroup, screenFrames, type DesignNode, type Project } from './model';
import { parseDocument, pickScreen, withTheme, type ScreenTheme } from './screen-svg';
import { deviceSkins } from './devices';
import { startMotion, transitionScreens, type Transition } from './motion';
import { element, escape as esc } from './render';

/**
 * Mockups inside Markdown. A fenced block names a design file and a screen:
 *
 *   ```codaru-mockup
 *   archivo: diseno/forma.codaru.json
 *   pantalla: screen-login        (id de la pantalla: estable; también vale el nombre exacto)
 *   modo: prototipo
 *   ```
 *
 * Any Markdown engine turns that into <pre><code class="language-codaru-mockup">; enhanceMarkdown()
 * replaces those blocks with a live preview. The editor is not loaded and no script from the
 * design file runs. Elsewhere the block stays readable text, so the document still makes sense.
 */
export const mockupLanguage = 'codaru-mockup';
export interface MockupBlock {
  /** Path of the design file, as written in the document; the host decides how to load it. */
  file: string;
  /** Screen id (preferred, stable) or exact name. Defaults to the first screen. */
  screen?: string;
  /** `prototype` navigates, animates and switches postures; `static` only draws the screen. */
  mode: 'static' | 'prototype';
  theme?: 'light' | 'dark';
  /** Largest height of the preview, in CSS pixels. */
  maxHeight?: number;
}
export interface MockupPreview { element: HTMLElement; block: MockupBlock; screen(): string; show(screen: string): void; destroy(): void; }
export interface EnhanceOptions {
  /** Return the design file as JSON text or as a parsed object. Reject to show an error in place. */
  load(file: string, block: MockupBlock): Promise<unknown>;
  /** Called from the preview's «Abrir en el editor» button; omit to hide the button. */
  onOpen?(block: MockupBlock, screen: string): void;
  /** Theme for every block: `light`, `dark` or Codaru color tokens (`--codaru-primary`, `primary`…). A block's `tema:` still picks the mode. */
  fonts?:FontRegistry;
  theme?: ScreenTheme;
}

const keys: Record<string, keyof MockupBlock> = { archivo: 'file', file: 'file', pantalla: 'screen', screen: 'screen', modo: 'mode', mode: 'mode', tema: 'theme', theme: 'theme', alto: 'maxHeight', height: 'maxHeight' };
const modes: Record<string, MockupBlock['mode']> = { prototipo: 'prototype', prototype: 'prototype', interactivo: 'prototype', estatico: 'static', 'estático': 'static', static: 'static', imagen: 'static' };
const themes: Record<string, 'light' | 'dark'> = { claro: 'light', light: 'light', oscuro: 'dark', dark: 'dark' };

/** Read the `clave: valor` lines of a block. Unknown keys are an error, so typos do not pass silently. */
export { renderScreenToSVG, renderScreenToDataURL, svgDataURL, screens, type ScreenTheme, type ScreenInfo, type RenderScreenOptions } from './screen-svg';
export function parseMockupBlock(source: string): MockupBlock {
  const block: Partial<MockupBlock> = { mode: 'prototype' };
  for (const raw of source.split('\n')) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const at = line.indexOf(':'), key = keys[line.slice(0, at).trim().toLowerCase()], value = line.slice(at + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
    if (at < 1 || !key) throw new Error(`Línea no reconocida: «${line.slice(0, 60)}». Usa archivo, pantalla, modo, tema o alto.`);
    if (key === 'mode') { if (!modes[value.toLowerCase()]) throw new Error('modo debe ser prototipo o estático.'); block.mode = modes[value.toLowerCase()]; }
    else if (key === 'theme') { if (!themes[value.toLowerCase()]) throw new Error('tema debe ser claro u oscuro.'); block.theme = themes[value.toLowerCase()]; }
    else if (key === 'maxHeight') { const height = Number(value); if (!Number.isFinite(height) || height < 80 || height > 4000) throw new Error('alto debe ser un número entre 80 y 4000.'); block.maxHeight = height; }
    else block[key] = value;
  }
  if (!block.file) throw new Error('Falta «archivo: ruta/al/diseño.codaru.json».');
  return block as MockupBlock;
}

const glyphs = {
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  unfold: '<path d="M12 6v14M12 6 4 4v14l8 2 8-2V4z"/>',
  fold: '<rect x="7" y="3" width="10" height="18" rx="2.500"/><path d="M17 7l3 1v8l-3 1"/>',
  posture: '<rect x="3" y="6" width="8" height="12" rx="1.500"/><rect x="13" y="6" width="8" height="12" rx="1.500"/>',
  open: '<path d="M14 5h5v5M19 5l-8 8M11 7H6v11h11v-5"/>',
};
const glyph = (name: keyof typeof glyphs) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[name]}</svg>`;
const styles = `:host{display:block;margin:12px 0;font:12px/1.4 var(--codaru-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--codaru-text,inherit)}
.frame{border:1px solid var(--codaru-border,rgba(128,128,140,.3));border-radius:10px;overflow:hidden;background:var(--codaru-canvas,rgba(128,128,140,.08))}
.bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:7px 8px;border-bottom:1px solid var(--codaru-border,rgba(128,128,140,.3));background:var(--codaru-surface,transparent)}
.name{flex:1 1 140px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;padding-left:4px}
.name.quiet{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
select,button{height:28px;box-sizing:border-box;font:inherit;color:inherit;background:transparent;border:1px solid var(--codaru-border,rgba(128,128,140,.35));border-radius:7px;cursor:pointer}
select{flex:1 1 150px;min-width:0;max-width:320px;padding:0 8px;font-weight:600}
button{display:inline-flex;align-items:center;gap:6px;flex:none;padding:0 10px;white-space:nowrap}button.icon{width:28px;padding:0;justify-content:center}
button:hover:not(:disabled),select:hover{background:color-mix(in srgb,currentColor 7%,transparent)}
.postures{display:flex;gap:6px;flex:none}.spacer{flex:1 1 0}
button:disabled{opacity:.35;cursor:default}button:focus-visible,select:focus-visible,[data-target]:focus-visible{outline:2px solid var(--codaru-accent,#3b82f6);outline-offset:2px}
.viewport{display:flex;justify-content:center;padding:18px;overflow:hidden}.sizer{position:relative;flex:none}.canvas{position:absolute;left:0;top:0;transform-origin:0 0}
.error{padding:12px 14px;border:1px solid #d9534f66;border-radius:10px;background:#d9534f14;white-space:pre-wrap}.error strong{display:block;margin-bottom:4px}`;

/** Draw one design document as a preview inside `container`. The document is validated first. */
export function renderMockup(container: HTMLElement, document: unknown, options: Omit<Partial<MockupBlock>, 'theme'> & { fonts?:FontRegistry; theme?: ScreenTheme; onOpen?: EnhanceOptions['onOpen'] } = {}): MockupPreview {
  const p: Project = parseDocument(document);if(document&&typeof document==='object')transferFonts(document as Project,p);if(options.fonts)attachFonts(p,options.fonts);
  const mode = typeof options.theme === 'string' ? options.theme : options.theme?.mode;
  const block: MockupBlock = { file: options.file ?? '', screen: options.screen, mode: options.mode ?? 'prototype', theme: mode, maxHeight: options.maxHeight };
  const frames = p.nodes.filter(n => n.type === 'frame' && !n.hidden);
  const first = pickScreen(p, block.screen);
  withTheme(p, options.theme, frames.filter(f => f.parentId === null));
  const resolve = (wanted?: string) => !wanted ? first : frames.find(f => f.id === wanted) ?? frames.find(f => f.name === wanted);
  // The screen picker lists the product's screens in reading order; a frame named in the block that is not one of them is added.
  const listed = screenFrames(p).length ? screenFrames(p) : frames.filter(f => f.parentId === null);
  if (!listed.includes(first)) listed.unshift(first);
  const doc = container.ownerDocument, host = doc.createElement('div'), root = host.attachShadow({ mode: 'open' }), interactive = block.mode === 'prototype';
  host.dataset.codaruMockup = block.mode;
  root.innerHTML = `<style>${styles}</style><div class="frame"><div class="bar">${interactive ? `<button class="icon" data-act="back" aria-label="Pantalla anterior" title="Pantalla anterior">${glyph('back')}</button>` : ''}<span class="name${interactive && listed.length > 1 ? ' quiet' : ''}"></span>${interactive && listed.length > 1 ? `<select aria-label="Pantalla" title="Cambiar de pantalla">${listed.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select><span class="spacer"></span>` : ''}${interactive ? '<span class="postures"></span>' : ''}${options.onOpen ? `<button data-act="open" title="Abrir este diseño en el editor">${glyph('open')}Abrir en el editor</button>` : ''}</div><div class="viewport"><div class="sizer"><div class="canvas"></div></div></div></div>`;
  const viewport = root.querySelector<HTMLElement>('.viewport')!, sizer = root.querySelector<HTMLElement>('.sizer')!, canvas = root.querySelector<HTMLElement>('.canvas')!;
  let current: DesignNode = first, scale = 1, history: { id: string; transition?: Transition }[] = [], disposed = false;
  const bezel = (frame: DesignNode) => frame.skin ? deviceSkins[frame.skin].bezel + 2 : 0;
  function fit() {
    const margin = bezel(current), width = Math.max(40, viewport.clientWidth - 36 - margin * 2), limit = (block.maxHeight ?? 640) - margin * 2;
    scale = Math.min(1, width / current.width, limit / current.height);
    Object.assign(sizer.style, { width: `${current.width * scale}px`, height: `${current.height * scale}px`, margin: `${margin * scale}px` });
    canvas.style.transform = `scale(${scale})`;
  }
  function show(frame: DesignNode, transition?: Transition, reverse = false) {
    const previous = scale, ghost = transition ? canvas.firstElementChild?.cloneNode(true) as HTMLElement | undefined : undefined;
    current = frame; canvas.replaceChildren();
    const el = element(p, frame, interactive, true); Object.assign(el.style, { left: '0', top: '0', position: 'relative' });
    if (!interactive) el.style.pointerEvents = 'none';
    canvas.append(el); fit();
    root.querySelector('.name')!.textContent = frame.name;
    const select = root.querySelector<HTMLSelectElement>('select'); if (select) { if (![...select.options].some(o => o.value === frame.id)) select.add(new Option(frame.name, frame.id)); select.value = frame.id; }
    const back = root.querySelector<HTMLButtonElement>('[data-act="back"]'); if (back) back.disabled = !history.length;
    const postures = root.querySelector<HTMLElement>('.postures');
    if (postures) { const others = postureGroup(p, frame.id).filter(f => f.id !== frame.id); postures.innerHTML = others.map(f => { const opens = panelsOf(f) > panelsOf(frame); return `<button data-posture="${esc(f.id)}" title="Ver esta pantalla ${opens ? 'desplegada' : 'plegada'}">${glyph(others.length > 1 ? 'posture' : opens ? 'unfold' : 'fold')}${others.length === 1 ? opens ? 'Desplegar' : 'Plegar' : esc(f.name.split('·').at(-2)?.trim() || f.name)}</button>`; }).join(''); }
    if (!interactive) return;
    if (ghost) { ghost.dataset.scale = String(previous / scale); Object.assign(ghost.style, { position: 'absolute', left: '0', top: '0' }); canvas.append(ghost); transitionScreens(ghost, el, transition!, reverse); }
    startMotion(el);
  }
  const go = (id: string, transition?: Transition) => { const next = frames.find(f => f.id === id); if (!next || next === current) return; history.push({ id: current.id, transition }); show(next, transition); };
  root.addEventListener('click', event => {
    const target = event.target as HTMLElement, button = target.closest<HTMLElement>('button');
    if (button?.dataset.act === 'open') { options.onOpen?.(block, current.id); return; }
    if (button?.dataset.act === 'back') { const last = history.pop(), frame = last && frames.find(f => f.id === last.id); if (frame) show(frame, last!.transition, true); return; }
    if (button?.dataset.posture) { const other = frames.find(f => f.id === button.dataset.posture); if (other) go(other.id, { type: panelsOf(other) > panelsOf(current) ? 'unfold' : 'fold', duration: 700, easing: 'ease-in-out' }); return; }
    const link = interactive ? target.closest<HTMLElement>('[data-target]') : null;
    if (link && canvas.contains(link)) go(link.dataset.target!, p.nodes.find(n => n.id === link.dataset.node)?.transition);
  });
  root.addEventListener('keydown', event => { const key = (event as KeyboardEvent).key, target = event.target as HTMLElement; if ((key === 'Enter' || key === ' ') && target.matches('[data-target]')) { event.preventDefault(); target.click(); } });
  root.querySelector('select')?.addEventListener('change', event => go((event.target as HTMLSelectElement).value));
  container.append(host);
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => { if (!disposed) fit(); });
  observer?.observe(viewport); show(first);
  return {
    element: host, block, screen: () => current.id,
    show(screen) { const frame = resolve(screen); if (!frame) throw new Error(`No existe la pantalla «${screen}».`); if (frame !== current) { history.push({ id: current.id }); show(frame); } },
    destroy() { disposed = true; observer?.disconnect(); host.remove(); },
  };
}

function failure(container: HTMLElement, title: string, detail: string) {
  const host = container.ownerDocument.createElement('div'), root = host.attachShadow({ mode: 'open' });
  host.dataset.codaruMockup = 'error';
  root.innerHTML = `<style>${styles}</style><div class="error" role="alert"><strong>${esc(title)}</strong>${esc(detail)}</div>`;
  container.append(host); return host;
}

/**
 * Replace every ```codaru-mockup block under `root` with its preview. Works on the HTML that any
 * Markdown engine produces. A block that cannot be shown keeps its text and gains an explanation.
 */
export async function enhanceMarkdown(root: ParentNode, options: EnhanceOptions): Promise<MockupPreview[]> {
  const previews: MockupPreview[] = [];
  for (const code of [...root.querySelectorAll<HTMLElement>(`pre > code.language-${mockupLanguage}, pre > code[data-lang="${mockupLanguage}"]`)]) {
    const pre = code.parentElement as HTMLElement; if (pre.dataset.codaruDone) continue;
    pre.dataset.codaruDone = 'true';
    const slot = pre.ownerDocument.createElement('div'); pre.before(slot);
    let block: MockupBlock;
    try { block = parseMockupBlock(code.textContent ?? ''); } catch (error) { failure(slot, 'Bloque codaru-mockup inválido', error instanceof Error ? error.message : String(error)); continue; }
    try {
      const theme: ScreenTheme | undefined = options.theme && typeof options.theme === 'object' ? { ...options.theme, ...(block.theme ? { mode: block.theme } : {}) } : block.theme ?? options.theme;
      previews.push(renderMockup(slot, await options.load(block.file, block), { ...block, theme, fonts:options.fonts, onOpen: options.onOpen }));
      pre.hidden = true;
    } catch (error) { failure(slot, `No se pudo mostrar ${block.file}`, error instanceof Error ? error.message : String(error)); }
  }
  return previews;
}
