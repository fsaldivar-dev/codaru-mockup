import { ContentCache } from './content-cache';
import { safeColor } from './themes';

/** Motion data is declarative: no script from a document or an SVG is ever executed. */
export const transitionTypes = ['fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'scale', 'unfold', 'fold'] as const;
export const easings = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'spring'] as const;
export type Easing = typeof easings[number];
export interface Transition { type: typeof transitionTypes[number]; duration: number; easing: Easing; }
export interface MotionKeyframe {
  /** Position in the animation, 0..100. */
  at: number;
  x?: number; y?: number; scale?: number; rotate?: number;
  /** 0..100, like a node's opacity. */
  opacity?: number;
  fill?: string; stroke?: string;
  /** Visible part of a stroke, 0..100. */
  draw?: number;
  /** Position of a loading highlight sweeping across the element, 0..100. Not for illustration layers. */
  shine?: number;
}
export interface NodeAnimation {
  id: string; name: string;
  /** Layer id inside an illustration; empty animates the whole element. */
  target: string;
  trigger: 'load' | 'click';
  duration: number; delay: number; easing: Easing;
  /** 0 repeats forever. */
  iterations: number; alternate: boolean;
  keyframes: MotionKeyframe[];
}
export const transitionLabels: Record<Transition['type'], string> = { fade: 'Disolver', 'slide-left': 'Deslizar a la izquierda', 'slide-right': 'Deslizar a la derecha', 'slide-up': 'Deslizar hacia arriba', 'slide-down': 'Deslizar hacia abajo', scale: 'Escalar', unfold: 'Desplegar (plegable)', fold: 'Plegar (plegable)' };
export const easingLabels: Record<Easing, string> = { linear: 'Lineal', ease: 'Suave', 'ease-in': 'Acelerar', 'ease-out': 'Frenar', 'ease-in-out': 'Acelerar y frenar', spring: 'Rebote' };

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const within = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
function onlyKeys(value: Record<string, unknown>, allowed: string[], what: string) {
  const extra = Object.keys(value).find(key => !allowed.includes(key));
  if (extra) throw new Error(`${what}: propiedad desconocida «${extra}».`);
}

export function validateTransition(value: unknown) {
  if (!record(value)) throw new Error('Transición inválida.');
  onlyKeys(value, ['type', 'duration', 'easing'], 'Transición');
  if (!transitionTypes.includes(value.type as Transition['type']) || !easings.includes(value.easing as Easing) || !within(value.duration, 0, 5000)) throw new Error('Transición inválida: revisa type, easing y duration (0 a 5000 ms).');
}
const keyframeRanges: Record<string, [number, number]> = { x: [-10000, 10000], y: [-10000, 10000], scale: [0, 20], rotate: [-3600, 3600], opacity: [0, 100], draw: [0, 100], shine: [0, 100] };
/** `layers` lists the animatable ids of an illustration; other elements only animate as a whole. */
export function validateAnimations(value: unknown, layers: string[]) {
  if (!Array.isArray(value) || value.length > 32) throw new Error('Un elemento admite hasta 32 animaciones.');
  const ids = new Set<string>();
  for (const a of value as unknown[]) {
    if (!record(a)) throw new Error('Animación inválida.');
    onlyKeys(a, ['id', 'name', 'target', 'trigger', 'duration', 'delay', 'easing', 'iterations', 'alternate', 'keyframes'], 'Animación');
    if (typeof a.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(a.id) || ids.has(a.id)) throw new Error('Animación con identificador inválido o repetido.');
    ids.add(a.id);
    if (typeof a.name !== 'string' || a.name.length > 80) throw new Error('Nombre de animación inválido.');
    if (typeof a.target !== 'string' || (a.target && !layers.includes(a.target))) throw new Error(`La capa «${String(a.target)}» no existe en este elemento.`);
    if (!['load', 'click'].includes(a.trigger as string) || !easings.includes(a.easing as Easing) || typeof a.alternate !== 'boolean') throw new Error('Animación inválida: revisa trigger, easing y alternate.');
    if (!within(a.duration, 1, 20000) || !within(a.delay, 0, 20000) || !within(a.iterations, 0, 100) || !Number.isInteger(a.iterations)) throw new Error('Animación inválida: duration 1 a 20000 ms, delay 0 a 20000 ms, iterations 0 a 100.');
    if (!Array.isArray(a.keyframes) || a.keyframes.length < 2 || a.keyframes.length > 32) throw new Error('Una animación necesita entre 2 y 32 fotogramas clave.');
    let last = -1;
    for (const k of a.keyframes as unknown[]) {
      if (!record(k)) throw new Error('Fotograma clave inválido.');
      onlyKeys(k, ['at', 'x', 'y', 'scale', 'rotate', 'opacity', 'fill', 'stroke', 'draw', 'shine'], 'Fotograma clave');
      if (!within(k.at, 0, 100) || k.at <= last) throw new Error('Los fotogramas clave deben ir en orden creciente de 0 a 100.');
      last = k.at;
      for (const [key, [min, max]] of Object.entries(keyframeRanges)) if (k[key] !== undefined && !within(k[key], min, max)) throw new Error(`Fotograma clave: «${key}» debe estar entre ${min} y ${max}.`);
      for (const key of ['fill', 'stroke']) if (k[key] !== undefined && !safeColor(k[key])) throw new Error('Fotograma clave: color inválido.');
    }
  }
}

export const animationPresets: Record<string, { name: string; make: () => Omit<NodeAnimation, 'id' | 'target'> }> = {
  appear: { name: 'Aparecer', make: () => ({ name: 'Aparecer', trigger: 'load', duration: 500, delay: 0, easing: 'ease-out', iterations: 1, alternate: false, keyframes: [{ at: 0, opacity: 0, y: 12 }, { at: 100, opacity: 100, y: 0 }] }) },
  slide: { name: 'Deslizar', make: () => ({ name: 'Deslizar', trigger: 'load', duration: 600, delay: 0, easing: 'ease-out', iterations: 1, alternate: false, keyframes: [{ at: 0, x: -40, opacity: 0 }, { at: 100, x: 0, opacity: 100 }] }) },
  pulse: { name: 'Latido', make: () => ({ name: 'Latido', trigger: 'load', duration: 900, delay: 0, easing: 'ease-in-out', iterations: 0, alternate: false, keyframes: [{ at: 0, scale: 1 }, { at: 50, scale: 1.08 }, { at: 100, scale: 1 }] }) },
  spin: { name: 'Girar', make: () => ({ name: 'Girar', trigger: 'load', duration: 2400, delay: 0, easing: 'linear', iterations: 0, alternate: false, keyframes: [{ at: 0, rotate: 0 }, { at: 100, rotate: 360 }] }) },
  float: { name: 'Flotar', make: () => ({ name: 'Flotar', trigger: 'load', duration: 1800, delay: 0, easing: 'ease-in-out', iterations: 0, alternate: true, keyframes: [{ at: 0, y: 0 }, { at: 100, y: -8 }] }) },
  skeleton: { name: 'Esqueleto (pulso de color)', make: () => ({ name: 'Esqueleto', trigger: 'load', duration: 900, delay: 0, easing: 'ease-in-out', iterations: 0, alternate: true, keyframes: [{ at: 0, fill: '#e3e6eb' }, { at: 100, fill: '#c8cdd6' }] }) },
  shimmer: { name: 'Esqueleto (brillo)', make: () => ({ name: 'Brillo de carga', trigger: 'load', duration: 1400, delay: 0, easing: 'ease-in-out', iterations: 0, alternate: false, keyframes: [{ at: 0, shine: 0 }, { at: 100, shine: 100 }] }) },
  draw: { name: 'Dibujar trazo', make: () => ({ name: 'Dibujar trazo', trigger: 'load', duration: 1200, delay: 0, easing: 'ease-in-out', iterations: 1, alternate: false, keyframes: [{ at: 0, draw: 0 }, { at: 100, draw: 100 }] }) },
};

const svgElements = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'title', 'desc', 'use', 'symbol']);
const layerElements = new Set(['g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'use']);
const resourceElements = new Set(['defs', 'linearGradient', 'radialGradient', 'clipPath', 'mask', 'symbol']);
const textElements = new Set(['text', 'tspan', 'title', 'desc']);
const presentation = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit', 'stroke-opacity', 'opacity', 'clip-rule', 'clip-path', 'mask', 'stop-color', 'stop-opacity', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'paint-order', 'vector-effect', 'display', 'visibility'];
const svgAttributes = new Set([...presentation, 'id', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'dx', 'dy', 'fx', 'fy', 'width', 'height', 'viewBox', 'points', 'transform', 'offset', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'clipPathUnits', 'maskUnits', 'pathLength', 'preserveAspectRatio', 'href']);
const safeAttribute = (value: string) => !/[<>"\u0000-\u001f\\]/.test(value) && !/javascript:|expression\(|@import|&(?!(?:amp|lt|gt|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6});)/i.test(value) && !/url/i.test(value.replace(/url\(#[A-Za-z][\w-]*\)/g, ''));

/**
 * Rebuild an SVG from an allowlist, without a DOM. Scripts, styles, events, images,
 * filters, SMIL and external references are dropped; every shape receives an id so it
 * can be animated. The result is canonical: sanitizing it again returns the same text.
 */
export function sanitizeSVG(input: string): string {
  if (typeof input !== 'string' || !input.trim()) throw new Error('El SVG está vacío.');
  if (input.length > 400_000) throw new Error('El SVG supera 400 kB. Simplifícalo para mantener ligero el proyecto.');
  const token = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>[]*>|<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/y;
  const out: string[] = [], stack: string[] = [], ids = new Set<string>();
  let skip = 0, elements = 0, auto = 0, closed = false;
  for (let match: RegExpExecArray | null; token.lastIndex < input.length;) {
    match = token.exec(input);
    if (!match) throw new Error('El SVG está mal formado o usa una sintaxis no admitida.');
    const [, closing, name, attributeText, selfClosing, text] = match;
    if (text !== undefined) {
      if (!skip && stack.length && textElements.has(stack.at(-1)!) && text.trim()) out.push(text.replace(/\s+/g, ' ').replace(/&(?!(?:amp|lt|gt|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6});)/g, '&amp;').replace(/"/g, '&quot;').replace(/>/g, '&gt;'));
      continue;
    }
    if (!name) continue;
    if (closing) {
      if (skip) { skip--; continue; }
      if (stack.pop() !== name) throw new Error('El SVG tiene etiquetas sin cerrar.');
      out.push(`</${name}>`); if (!stack.length) closed = true;
      continue;
    }
    if (skip) { if (!selfClosing) skip++; continue; }
    if (closed) throw new Error('El SVG debe tener un único elemento raíz.');
    if (!svgElements.has(name) || (name === 'svg') !== !stack.length) {
      if (!stack.length) throw new Error('El archivo debe empezar con un elemento <svg>.');
      if (!selfClosing) skip = 1;
      continue;
    }
    if (++elements > 3000) throw new Error('El SVG tiene demasiados elementos. Simplifícalo antes de importarlo.');
    const attributes = new Map<string, string>();
    for (const [, rawKey, double, single] of attributeText.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const value = (double ?? single).replace(/\s+/g, ' ').trim(), key = rawKey === 'xlink:href' ? 'href' : rawKey;
      if (key === 'style') { for (const declaration of value.split(';')) { const at = declaration.indexOf(':'); if (at > 0) attributes.set(declaration.slice(0, at).trim(), declaration.slice(at + 1).trim()); } }
      else attributes.set(key, value);
    }
    const kept: [string, string][] = [];
    for (const [key, value] of attributes) {
      if (!svgAttributes.has(key) || !safeAttribute(value)) continue;
      if (key === 'href' && !/^#[A-Za-z][\w-]*$/.test(value)) continue;
      if (key === 'id') { if (!/^[A-Za-z][\w-]{0,63}$/.test(value) || ids.has(value)) continue; ids.add(value); }
      kept.push([key, value]);
    }
    if (name === 'svg') {
      const get = (key: string) => kept.find(([k]) => k === key)?.[1];
      const width = parseFloat(get('width') ?? ''), height = parseFloat(get('height') ?? '');
      const box = (get('viewBox') ?? (width > 0 && height > 0 ? `0 0 ${width} ${height}` : '')).split(/[\s,]+/).map(Number);
      if (box.length !== 4 || box.some(v => !Number.isFinite(v)) || box[2] <= 0 || box[3] <= 0) throw new Error('El SVG necesita un viewBox o un ancho y alto válidos.');
      const rest = kept.filter(([key]) => !['width', 'height', 'x', 'y', 'viewBox', 'id'].includes(key));
      kept.splice(0, kept.length, ['xmlns', 'http://www.w3.org/2000/svg'], ['viewBox', box.join(' ')], ...rest);
    } else if (layerElements.has(name) && !stack.some(parent => resourceElements.has(parent)) && !kept.some(([key]) => key === 'id')) {
      let id: string; do id = `capa-${++auto}`; while (ids.has(id));
      ids.add(id); kept.push(['id', id]);
    }
    out.push(`<${name}${kept.map(([key, value]) => ` ${key}="${value}"`).join('')}${selfClosing ? '/' : ''}>`);
    if (selfClosing) { if (!stack.length) closed = true; } else stack.push(name);
  }
  if (stack.length || skip || !closed) throw new Error('El SVG está incompleto.');
  return out.join('');
}

export interface VectorLayer { id: string; tag: string; depth: number; }
/** Animatable layers of a sanitized illustration, in document order. */
const layerCache = new ContentCache<readonly VectorLayer[]>();
export function vectorLayers(svg: string): VectorLayer[] {
  const cached = layerCache.get(svg);
  if (cached) return cached.map(layer => ({ ...layer }));
  const layers: VectorLayer[] = [], stack: string[] = [];
  for (const [, closing, name, attributes, selfClosing] of svg.matchAll(/<(\/?)([A-Za-z]+)((?:\s[\w:.-]+="[^"]*")*)(\/?)>/g)) {
    if (closing) { stack.pop(); continue; }
    const id = /\sid="([^"]+)"/.exec(attributes)?.[1];
    if (id && layerElements.has(name) && !stack.some(parent => resourceElements.has(parent))) layers.push({ id, tag: name, depth: Math.max(0, stack.length - 1) });
    if (!selfClosing) stack.push(name);
  }
  layerCache.set(svg, layers.map(layer => ({ ...layer })), layers.length * 160);
  return layers;
}
export function vectorSize(svg: string) {
  const box = /viewBox="([^"]+)"/.exec(svg)?.[1].split(' ').map(Number) ?? [0, 0, 100, 100];
  return { width: box[2], height: box[3] };
}
/** Several illustrations share one document: scope ids and mark layers for the player. */
export function scopeSVG(svg: string, scope: string): string {
  return svg.replace(/\sid="([^"]+)"/g, (_, id) => ` id="${scope}-${id}" data-layer="${id}"`).replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${scope}-${id})`).replace(/\shref="#([^"]+)"/g, (_, id) => ` href="#${scope}-${id}"`);
}

/**
 * Start the animations declared in data-motion below `root`. Self-contained on purpose:
 * the exported prototype embeds this function's source, so it must not use outer bindings.
 */
export function startMotion(root: Element): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const curves: Record<string, string> = { spring: 'cubic-bezier(.34,1.56,.64,1)' };
  const hosts = [...(root.matches('[data-motion]') ? [root] : []), ...root.querySelectorAll('[data-motion]')];
  for (const host of hosts) {
    let list: Array<Record<string, any>>;
    try { list = JSON.parse((host as HTMLElement).dataset.motion!); } catch { continue; }
    for (const a of list) {
      const target = (a.target ? host.querySelector(`[data-layer="${a.target}"]`) : host) as HTMLElement | SVGElement | null;
      if (!target) continue;
      const vector = target instanceof SVGElement, used = (key: string) => a.keyframes.some((k: Record<string, unknown>) => k[key] !== undefined);
      const frames = a.keyframes.map((k: Record<string, any>) => {
        const frame: Record<string, string | number> = { offset: k.at / 100 };
        if (used('x') || used('y')) frame.translate = `${k.x ?? 0}px ${k.y ?? 0}px`;
        if (k.rotate !== undefined) frame.rotate = `${k.rotate}deg`;
        if (k.scale !== undefined) frame.scale = `${k.scale}`;
        if (k.opacity !== undefined) frame.opacity = k.opacity / 100;
        if (k.fill !== undefined) frame[vector ? 'fill' : 'backgroundColor'] = k.fill;
        if (k.stroke !== undefined) frame[vector ? 'stroke' : 'borderColor'] = k.stroke;
        if (k.draw !== undefined) frame.strokeDashoffset = 1 - k.draw / 100;
        if (k.shine !== undefined && !vector) frame.backgroundPosition = `${100 - k.shine}% 0, 0 0`;
        return frame;
      });
      const play = () => {
        if (vector) { target.style.transformBox = 'fill-box'; target.style.transformOrigin = 'center'; }
        if (used('draw')) { target.setAttribute('pathLength', '1'); target.style.strokeDasharray = '1'; }
        if (used('shine') && !vector && !target.dataset.shine) {
          // A highlight band three times wider than the element, layered over its own fill.
          const own = getComputedStyle(target).backgroundImage;
          target.dataset.shine = '1'; target.style.backgroundImage = `linear-gradient(100deg, transparent 38%, rgba(255,255,255,.65) 50%, transparent 62%)${own === 'none' ? '' : ', ' + own}`;
          target.style.backgroundSize = '300% 100%, auto'; target.style.backgroundRepeat = 'no-repeat';
        }
        target.getAnimations().filter(running => running.id === a.id).forEach(running => running.cancel());
        target.animate(frames, { id: a.id, duration: a.duration, delay: a.delay, easing: curves[a.easing] ?? a.easing, iterations: a.iterations || Infinity, direction: a.alternate ? 'alternate' : 'normal', fill: 'both' });
      };
      if (a.trigger === 'click') { (host as HTMLElement).style.cursor = 'pointer'; host.addEventListener('click', play); } else play();
    }
  }
}
/**
 * Animate between two screens. `ghost` is a copy of the screen being left, already placed
 * over `next`; it is removed when the transition ends. Self-contained, like startMotion.
 */
export function transitionScreens(ghost: HTMLElement, next: HTMLElement, transition: { type: string; duration: number; easing: string }, reverse = false): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !transition.duration) { ghost.remove(); return; }
  const easing = transition.easing === 'spring' ? 'cubic-bezier(.34,1.56,.64,1)' : transition.easing;
  const options: KeyframeAnimationOptions = { duration: transition.duration, easing, fill: 'both' };
  if (transition.type === 'unfold' || transition.type === 'fold') {
    const unfolding = (transition.type === 'unfold') !== reverse, cover = unfolding ? ghost : next, inner = unfolding ? next : ghost;
    if (!cover.dataset.fold && inner.dataset.fold) {
      // A closed foldable shows its outer screen. Opening turns that panel over the hinge: its back
      // is one inner panel, and the panel that was underneath is the next one. Closing is the reverse.
      const vertical = inner.dataset.fold !== 'horizontal', panels = Math.max(2, Number(inner.dataset.panels) || 2), parent = next.parentElement!;
      const W = inner.offsetWidth, H = inner.offsetHeight, size = (vertical ? W : H) / panels, w = vertical ? size : W, h = vertical ? H : size;
      const rest = { left: inner.offsetLeft + (vertical ? size : 0), top: inner.offsetTop + (vertical ? 0 : size) }, shell = '#111116', rim = `0 0 0 7px ${shell}`;
      const copy = (source: HTMLElement) => { const el = source.cloneNode(true) as HTMLElement; el.removeAttribute('id'); el.classList.remove('screen'); Object.assign(el.style, { margin: '0', visibility: 'visible', opacity: '1', boxShadow: 'none', flex: 'none', pointerEvents: 'none' }); return el; };
      const box = (style: Partial<CSSStyleDeclaration>) => { const el = next.ownerDocument.createElement('div'); Object.assign(el.style, { position: 'absolute', width: `${w}px`, height: `${h}px`, overflow: 'hidden', background: shell, boxShadow: rim, ...style }); return el; };
      /** One inner panel: the open screen shifted so only that panel shows. */
      const panel = (index: number, style: Partial<CSSStyleDeclaration>) => { const el = box(style), screen = copy(inner); Object.assign(screen.style, { position: 'absolute', left: vertical ? `${-index * size}px` : '0', top: vertical ? '0' : `${-index * size}px` }); el.append(screen); return el; };
      const stage = next.ownerDocument.createElement('div');
      Object.assign(stage.style, { position: 'absolute', left: `${rest.left}px`, top: `${rest.top}px`, width: `${w}px`, height: `${h}px`, perspective: '2000px', pointerEvents: 'none', zIndex: '3' });
      const flipped = vertical ? 'rotateY(180deg)' : 'rotateX(180deg)', hidden = { backfaceVisibility: 'hidden', left: '0', top: '0' } as Partial<CSSStyleDeclaration>;
      const leaf = (origin: string, front: HTMLElement, back: HTMLElement) => { const el = next.ownerDocument.createElement('div'); Object.assign(el.style, { position: 'absolute', inset: '0', transformStyle: 'preserve-3d', transformOrigin: origin }); el.append(front, back); return el; };
      const face = box({ ...hidden, display: 'flex', alignItems: 'center', justifyContent: 'center' }), outer = copy(cover);
      Object.assign(outer.style, { position: 'relative', left: '0', top: '0', transform: `scale(${Math.min(1, w / cover.offsetWidth, h / cover.offsetHeight)})` }); face.append(outer);
      // The outer screen is on the back of the first panel. A tri-fold closes like a Z: its third
      // panel folds the other way, behind the middle one, so it is drawn underneath everything.
      const first = leaf(vertical ? 'left center' : 'center top', face, panel(0, { ...hidden, transform: flipped }));
      const second = panels === 3 ? leaf(vertical ? 'left center' : 'center top', panel(2, hidden), box({ ...hidden, transform: flipped })) : null;
      if (second) Object.assign(second.style, { inset: '', left: vertical ? `${w}px` : '0', top: vertical ? '0' : `${h}px`, width: `${w}px`, height: `${h}px` });
      stage.append(...(second ? [second] : []), panel(1, { left: '0', top: '0' }), first); parent.append(stage);
      const turn = vertical ? 'rotateY' : 'rotateX', sign = vertical ? -1 : 1;
      // Shade the faces, not the leaf: a filter on the leaf would flatten its two faces into one plane.
      const spin = (el: HTMLElement, folded: number) => {
        for (const side of el.children) side.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(.62)' }, { filter: 'brightness(1)' }], options);
        return el.animate([{ transform: `${turn}(${unfolding ? folded : 0}deg)` }, { transform: `${turn}(${unfolding ? 0 : folded}deg)` }], options);
      };
      // The first leaf rests closed at 0 and ends open at 180; the third panel rests open at 0 and hides behind at 180.
      const turns = [first.animate([{ transform: `${turn}(${unfolding ? 0 : sign * 180}deg)` }, { transform: `${turn}(${unfolding ? sign * 180 : 0}deg)` }], options), ...(second ? [spin(second, -sign * 180)] : [])];
      for (const side of first.children) side.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(.62)' }, { filter: 'brightness(1)' }], options);
      // Both postures are centered on the same spot and keep the size they have on screen, so the
      // device slides and settles while it opens or closes. `data-scale` is how much larger the
      // screen being left was drawn compared with the one that follows.
      const center = (el: HTMLElement) => [el.offsetLeft + el.offsetWidth / 2, el.offsetTop + el.offsetHeight / 2], target = center(next), opened = center(inner), closed = [rest.left + w / 2, rest.top + h / 2];
      const left = Number(ghost.dataset.scale) || 1, natural = 1 / Math.min(1, w / cover.offsetWidth, h / cover.offsetHeight);
      const pose = (open: boolean, scale: number) => { const from = open ? opened : closed; return `translate(${target[0] - closed[0] - scale * (from[0] - closed[0])}px, ${target[1] - closed[1] - scale * (from[1] - closed[1])}px) scale(${scale})`; };
      const slide = stage.animate(unfolding ? [{ transform: pose(false, natural * left) }, { transform: pose(true, 1) }] : [{ transform: pose(true, left) }, { transform: pose(false, natural) }], options);
      // Only the device is visible while it turns: no second copy of either screen, no empty card behind.
      const shadow = parent.style.boxShadow; parent.style.boxShadow = 'none';
      next.style.visibility = 'hidden'; ghost.style.visibility = 'hidden';
      const done = () => { stage.remove(); parent.style.boxShadow = shadow; next.style.visibility = ''; ghost.remove(); };
      Promise.all([slide.finished, ...turns.map(item => item.finished)]).then(done, done);
      return;
    }
    // The screen with the hinge opens or closes as two halves around its fold line.
    if (cover.dataset.fold && inner.dataset.fold && Number(inner.dataset.panels) === 3 && Number(cover.dataset.panels) !== 3) {
      // Tri-fold between two and three panels: the third panel swings out from behind the device
      // (or folds back behind it). The other two stay in place and blend into the other layout.
      const vertical = inner.dataset.fold !== 'horizontal', parent = next.parentElement!, W = inner.offsetWidth, H = inner.offsetHeight, size = (vertical ? W : H) / 3, w = vertical ? size : W, h = vertical ? H : size;
      const shell = '#111116', rim = `0 0 0 7px ${shell}`, doc = next.ownerDocument, turn = vertical ? 'rotateY' : 'rotateX', folded = vertical ? 180 : -180;
      const copy = (source: HTMLElement) => { const el = source.cloneNode(true) as HTMLElement; el.removeAttribute('id'); el.classList.remove('screen'); Object.assign(el.style, { position: 'absolute', left: '0', top: '0', margin: '0', visibility: 'visible', opacity: '1', boxShadow: 'none', pointerEvents: 'none' }); return el; };
      const box = (style: Partial<CSSStyleDeclaration>) => { const el = doc.createElement('div'); Object.assign(el.style, { position: 'absolute', overflow: 'hidden', background: shell, boxShadow: rim, ...style }); return el; };
      const stage = doc.createElement('div');
      Object.assign(stage.style, { position: 'absolute', left: `${inner.offsetLeft}px`, top: `${inner.offsetTop}px`, width: `${W}px`, height: `${H}px`, perspective: '2400px', pointerEvents: 'none', zIndex: '3' });
      const third = doc.createElement('div'), front = box({ inset: '0', backfaceVisibility: 'hidden' }), back = box({ inset: '0', backfaceVisibility: 'hidden', transform: `${turn}(180deg)` }), shown = copy(inner);
      Object.assign(shown.style, vertical ? { left: `${-2 * size}px` } : { top: `${-2 * size}px` }); front.append(shown); third.append(front, back);
      Object.assign(third.style, { position: 'absolute', left: vertical ? `${2 * size}px` : '0', top: vertical ? '0' : `${2 * size}px`, width: `${w}px`, height: `${h}px`, transformStyle: 'preserve-3d', transformOrigin: vertical ? 'left center' : 'center top' });
      const base = box({ left: '0', top: '0', width: `${vertical ? 2 * size : W}px`, height: `${vertical ? H : 2 * size}px` }), two = copy(cover);
      two.style.transformOrigin = '0 0'; two.style.transform = `scale(${(vertical ? 2 * size : W) / cover.offsetWidth}, ${(vertical ? H : 2 * size) / cover.offsetHeight})`;
      base.append(copy(inner), two); stage.append(third, base); parent.append(stage);
      const swing = third.animate([{ transform: `${turn}(${unfolding ? folded : 0}deg)` }, { transform: `${turn}(${unfolding ? 0 : folded}deg)` }], options);
      front.animate([{ filter: `brightness(${unfolding ? .6 : 1})` }, { filter: `brightness(${unfolding ? 1 : .6})` }], options);
      const blend = two.animate([{ opacity: unfolding ? 1 : 0 }, { opacity: unfolding ? 0 : 1 }], options);
      const target = [next.offsetLeft + next.offsetWidth / 2, next.offsetTop + next.offsetHeight / 2], origin = [inner.offsetLeft + W / 2, inner.offsetTop + H / 2];
      const pair = [inner.offsetLeft + (vertical ? size : W / 2), inner.offsetTop + (vertical ? H / 2 : size)], left = Number(ghost.dataset.scale) || 1, natural = cover.offsetWidth / (vertical ? 2 * size : W);
      const pose = (from: number[], scale: number) => `translate(${target[0] - origin[0] - scale * (from[0] - origin[0])}px, ${target[1] - origin[1] - scale * (from[1] - origin[1])}px) scale(${scale})`;
      const slide = stage.animate(unfolding ? [{ transform: pose(pair, natural * left) }, { transform: pose(origin, 1) }] : [{ transform: pose(origin, left) }, { transform: pose(pair, natural) }], options);
      const shadow = parent.style.boxShadow; parent.style.boxShadow = 'none';
      next.style.visibility = 'hidden'; ghost.style.visibility = 'hidden';
      const done = () => { stage.remove(); parent.style.boxShadow = shadow; next.style.visibility = ''; ghost.remove(); };
      Promise.all([swing.finished, blend.finished, slide.finished]).then(done, done);
      return;
    }
    const opening = (transition.type === 'unfold') !== reverse, hinged = opening ? next : ghost, horizontal = hinged.dataset.fold === 'horizontal', turn = horizontal ? 'rotateX' : 'rotateY';
    const panels = Math.max(2, Number(hinged.dataset.panels) || 2), share = 100 / panels;
    const halves = Array.from({ length: panels }, (_, index) => {
      const half = hinged.cloneNode(true) as HTMLElement; half.removeAttribute('id'); half.classList.remove('screen');
      const before = `${index * share}%`, after = `${100 - (index + 1) * share}%`;
      // Each panel turns around the hinge on its inner side; the middle panel of three stays flat.
      const middle = panels === 3 && index === 1, origin = `${index < panels / 2 ? (index + 1) * share : index * share}%`, sign = (index < panels / 2 ? 1 : -1) * (horizontal ? -1 : 1);
      Object.assign(half.style, { position: 'absolute', margin: '0', left: `${hinged.offsetLeft}px`, top: `${hinged.offsetTop}px`, pointerEvents: 'none', visibility: 'visible', opacity: '1',
        transformOrigin: horizontal ? `50% ${origin}` : `${origin} 50%`, clipPath: horizontal ? `inset(${before} 0 ${after} 0)` : `inset(0 ${after} 0 ${before})` });
      const closed = `perspective(1800px) ${turn}(${middle ? 0 : sign * 86}deg)`, flat = `perspective(1800px) ${turn}(0deg)`, dim = middle ? 1 : .55;
      hinged.parentElement!.append(half);
      return half.animate([{ transform: opening ? closed : flat, filter: `brightness(${opening ? dim : 1})` }, { transform: opening ? flat : closed, filter: `brightness(${opening ? 1 : dim})` }], options);
    });
    const other = opening ? ghost : next, fade = other.animate(opening ? [{ opacity: 1 }, { opacity: 0, offset: .45 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0, offset: .5 }, { opacity: 1 }], options);
    if (opening) next.style.visibility = 'hidden'; else ghost.style.visibility = 'hidden';
    const done = () => { halves.forEach(half => (half.effect as KeyframeEffect).target?.remove()); next.style.visibility = ''; fade.cancel(); ghost.remove(); };
    Promise.all([...halves.map(half => half.finished), fade.finished]).then(done, done);
    return;
  }
  const slide = /^slide-(left|right|up|down)$/.exec(transition.type)?.[1];
  let enter: Keyframe[], leave: Keyframe[];
  if (slide) {
    const axis = slide === 'left' || slide === 'right' ? 'X' : 'Y', sign = (slide === 'left' || slide === 'up' ? 1 : -1) * (reverse ? -1 : 1);
    enter = [{ transform: `translate${axis}(${sign * 100}%)` }, { transform: `translate${axis}(0)` }];
    leave = [{ transform: `translate${axis}(0)` }, { transform: `translate${axis}(${-sign * 100}%)` }];
  } else if (transition.type === 'scale') {
    enter = [{ transform: `scale(${reverse ? 1.06 : .92})`, opacity: 0 }, { transform: 'scale(1)', opacity: 1 }];
    leave = [{ transform: 'scale(1)', opacity: 1 }, { transform: `scale(${reverse ? .92 : 1.06})`, opacity: 0 }];
  } else { enter = [{ opacity: 0 }, { opacity: 1 }]; leave = [{ opacity: 1 }, { opacity: 0 }]; }
  ghost.style.pointerEvents = 'none';
  const entering = next.animate(enter, options);
  entering.finished.then(() => entering.cancel(), () => {});
  ghost.animate(leave, options).finished.then(() => ghost.remove(), () => ghost.remove());
}

const canonical = new ContentCache<true>();
/** Validation runs on every commit; remember illustrations already known to be sanitized. */
export function isSanitizedSVG(svg: unknown): svg is string {
  if (typeof svg !== 'string') return false;
  if (canonical.get(svg)) return true;
  try { if (sanitizeSVG(svg) !== svg) return false; } catch { return false; }
  canonical.set(svg, true); return true;
}
