import {importedFontFamily} from './fonts';
import { createComponent, labels, node, validate, type DesignNode, type Kind, type Project } from './model';
import { sanitizeSVG } from './motion';
import type { DesignTheme, TokenSet } from './themes';

/**
 * Import of a page snapshot written by `scripts/snapshot.js` (skill codaru-clone): the visible
 * elements of a web page with their geometry and computed styles. The snapshot is untrusted input:
 * everything is checked, bounded and mapped here, nothing is fetched and no script runs. The page
 * becomes one screen, its colors and type become a theme, and layers link to the tokens they match.
 */
export interface DOMReport {
  screens: number; layers: number; images: number; illustrations: number; tokens: number;
  /** What was simplified or left out, most frequent first. */
  notes: string[];
}
type Raw = Record<string, any>;
const record = (value: unknown): value is Raw => !!value && typeof value === 'object' && !Array.isArray(value);
const num = (value: unknown, fallback = 0, min = -100000, max = 100000) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const text = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';
const round = (value: number) => Math.round(value * 100) / 100;
const HEX = /^#(?:[\da-f]{6}|[\da-f]{8})$/i;
const color = (value: unknown) => typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : undefined;
const serif = /georgia|times|serif|playfair|merriweather|garamond|baskerville|lora|caslon|bodoni|didot|fraunces|cormorant/i, mono = /mono|courier|menlo|consolas|code|fira code|jetbrains/i;
const generic = /^(div|span|p|section|article|main|header|footer|nav|ul|ol|li|a|h[1-6]|body|form|label|figure|aside|table|tr|td|th)$/;

const lum = (hex: string) => { const f = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(parseInt(hex.slice(1, 3), 16)) + .7152 * f(parseInt(hex.slice(3, 5), 16)) + .0722 * f(parseInt(hex.slice(5, 7), 16)); };
const sat = (hex: string) => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); return Math.max(...c) - Math.min(...c); };
const mix = (a: string, b: string, t: number) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');
const opaque = (hex: string) => hex.slice(0, 7);

export function isDOMSnapshot(value: unknown): value is Raw { return record(value) && value.format === 'codaru-dom-snapshot'; }

/** Add the snapshot as a new screen to the right of the document, with its own theme. One undo entry inside a commit. */
export function importDOM(p: Project, input: unknown): DOMReport {
  if (!isDOMSnapshot(input) || input.version !== 1 || !Array.isArray(input.elements)) throw new Error('No es una instantánea de página de Codaru (codaru-dom-snapshot, versión 1).');
  const report: DOMReport = { screens: 1, layers: 0, images: 0, illustrations: 0, tokens: 0, notes: [] };
  const counts = new Map<string, number>(), note = (message: string) => counts.set(message, (counts.get(message) ?? 0) + 1);
  for (const raw of Array.isArray(input.notes) ? input.notes.slice(0, 20) : []) if (typeof raw === 'string') note(text(raw, 200));
  const used = new Set(p.nodes.map(n => n.id));
  const idFor = (base: string) => { base = `dom-${base.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'capa'}`.slice(0, 80); let id = base; for (let i = 2; used.has(id); i++) id = `${base}-${i}`; used.add(id); return id; };
  const elements = (input.elements as unknown[]).filter(record).slice(0, 3000) as Raw[];
  if (elements.length < (input.elements as unknown[]).length) note('La instantánea supera 3000 elementos: el resto no se importó.');
  const viewport = record(input.viewport) ? input.viewport : {}, width = Math.max(200, Math.round(num(viewport.width, 390, 100, 4000))), height = Math.max(200, Math.round(num(input.height, 844, 100, 6000)));
  let host = 'pagina'; try { host = new URL(text(input.url, 2000)).hostname.replace(/^www\./, '') || host; } catch { /* no URL in the snapshot */ }

  // Theme: the colors the page uses most become tokens, so layers stay linked and dark mode can be derived.
  const area = new Map<string, number>(), textColors = new Map<string, number>(), borders = new Map<string, number>(), buttons = new Map<string, number>(), links = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string | undefined, weight: number) => { if (key) map.set(key, (map.get(key) ?? 0) + weight); };
  const top = (map: Map<string, number>, skip: (c: string) => boolean = () => false) => [...map].filter(([c]) => !skip(c)).sort((a, b) => b[1] - a[1])[0]?.[0];
  for (const e of elements) {
    const w = num(e.w, 1, 0, 10000) * num(e.h, 1, 0, 10000), bg = color(e.bg), fg = color(e.color);
    if (e.kind === 'box') bump(area, bg && opaque(bg), w);
    if (e.kind === 'text') { bump(textColors, fg && opaque(fg), Math.max(1, text(e.text, 2000).length)); if (e.tag === 'a') bump(links, fg && opaque(fg), 1); }
    if (e.kind === 'button') bump(buttons, bg && opaque(bg), 1);
    if (record(e.border)) bump(borders, color(e.border.color) && opaque(color(e.border.color)!), 1);
  }
  const body = record(input.body) ? input.body : {};
  const background = color(body.bg) ? opaque(color(body.bg)!) : top(area, c => lum(c) < .5) ?? '#ffffff';
  const surface = top(area, c => c === background || Math.abs(lum(c) - lum(background)) > .5) ?? (lum(background) > .5 ? '#ffffff' : mix(background, '#ffffff', .08));
  const textColor = top(textColors) ?? (lum(background) > .5 ? '#1a1a1a' : '#f2f2f2');
  const muted = top(textColors, c => c === textColor || Math.abs(lum(c) - lum(background)) < .1) ?? mix(textColor, background, .45);
  const primary = top(buttons, c => Math.abs(lum(c) - lum(background)) < .05) ?? top(links) ?? top(area, c => sat(c) < .25 || c === background || c === surface) ?? '#2563eb';
  const border = top(borders) ?? mix(textColor, background, .85);
  const accent = mix(primary, surface, .86);
  const light: TokenSet['colors'] = { primary, surface, background, text: textColor, muted, border, accent };
  const darkPrimary = lum(primary) < .35 ? mix(primary, '#ffffff', .35) : primary;
  const dark: TokenSet['colors'] = { primary: darkPrimary, surface: '#1c1c21', background: '#111114', text: '#f3f3f6', muted: '#a3a3b0', border: '#2c2c34', accent: mix(darkPrimary, '#1c1c21', .7) };
  const themeId = (() => { const base = `dom-${host.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`.slice(0, 60); let id = base; for (let i = 2; p.designThemes[id]; i++) id = `${base}-${i}`; return id; })();
  const typography: TokenSet['typography'] = {};
  const family = (name:unknown)=>importedFontFamily(p,text(name,200),note);
  const families = new Set<string>();
  const styles = new Map<string, number>();
  const typeKeys = new Map<string,string>();
  const fontStyle=(f:Record<string,unknown>)=>f.style==='oblique'?'oblique':f.style==='italic'||f.italic===true?'italic':'normal';
  const fontKey=(f:Record<string,unknown>)=>`${family(f.family)}|${Math.round(num(f.size,16,1,400))}|${Math.round(num(f.weight,400,100,900))}|${fontStyle(f)}`;
  for (const e of elements) if ((e.kind === 'text' || e.kind === 'button') && record(e.font)) {
    const name = text(e.font.family, 80); if (name && !/^(-apple-system|system-ui|blinkmacsystemfont|segoe ui|roboto|helvetica|arial|inter|sf pro|ui-sans-serif|sans-serif)$/i.test(name)) families.add(name);
    const key = fontKey(e.font); styles.set(key, (styles.get(key) ?? 0) + 1);
  }
  for (const [key] of [...styles].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    const [fam,size,weight,style]=key.split('|');let id=`texto-${size}-${weight}`;for(let suffix=2;typography[id];suffix++)id=`texto-${size}-${weight}-${suffix}`;typeKeys.set(key,id);
    typography[id]={name:`${fam} ${size} · ${weight} · ${style}`,fontFamily:fam,fontStyle:style as 'normal'|'italic'|'oblique',fontSize:Number(size),fontWeight:Number(weight),lineHeight:1.3};
  }
  const tokens = (colors: TokenSet['colors']): TokenSet => ({ colors, gradients: {}, materials: {}, typography: structuredClone(typography), radii: {} });
  const theme: DesignTheme = { id: themeId, name: `Importado · ${host}`, modes: { light: tokens(light), dark: tokens(dark) } };
  p.designThemes[themeId] = theme; report.tokens = 7 + Object.keys(typography).length;
  // The same hex can be several tokens (a black that is both the text and the primary action); text prefers the text tokens, fills the surfaces.
  const colorToken = (hex: string | undefined, fallback: string, use: 'text' | 'fill' = 'fill') => { if (!hex) return fallback; const flat = opaque(hex); const order = use === 'text' ? ['text', 'muted', 'primary', 'background', 'surface', 'border', 'accent'] : ['background', 'surface', 'primary', 'accent', 'border', 'text', 'muted']; const key = order.find(k => light[k as keyof typeof light] === flat); return key && hex.length === 7 ? `@${key}` : hex; };

  // Layers: one node per element, positioned relative to the nearest imported ancestor.
  const existing = p.nodes.filter(n => n.parentId === null);
  const frame = node('frame', { id: idFor(host), name: text(input.title, 80).trim() || host, x: existing.length ? Math.max(...existing.map(n => n.x + n.width)) + 120 : 60, y: existing.length ? Math.min(...existing.map(n => n.y)) : 100, width, height, fill: '@background', themeId, padding: 0, gap: 0 });
  const added: DesignNode[] = [frame], byIndex = new Map<number, DesignNode>();
  const abs = new Map<string, { x: number; y: number }>([[frame.id, { x: 0, y: 0 }]]);
  for (const e of elements) {
    if (added.length >= 3000) { note('Más de 3000 capas: el resto no se importó.'); break; }
    const parentRaw = typeof e.p === 'number' ? byIndex.get(e.p) : undefined, parent = parentRaw ?? frame, origin = abs.get(parent.id)!;
    const x = round(num(e.x) - origin.x), y = round(num(e.y) - origin.y), w = Math.max(1, round(num(e.w, 1, 0, 10000))), h = Math.max(1, round(num(e.h, 1, 0, 10000)));
    const kind = text(e.kind, 10), tag = text(e.tag, 20), radius = Array.isArray(e.radius) ? e.radius.map((r: unknown) => round(num(r, 0, 0, 5000))) : [0, 0, 0, 0];
    const patch: Partial<DesignNode> = { parentId: parent.id, x, y, width: w, height: h, opacity: Math.round(num(e.opacity, 100, 0, 100)), fill: 'transparent', strokeWidth: 0, radius: radius[0] ?? 0, shadow: e.shadow === true, padding: 0, gap: 0 };
    if (radius.some((r: number) => r !== radius[0])) Object.assign(patch, { radiusTR: radius[1] ?? 0, radiusBR: radius[2] ?? 0, radiusBL: radius[3] ?? 0 });
    const bg = color(e.bg), gradient = record(e.gradient) ? e.gradient : undefined, borderRaw = record(e.border) ? e.border : undefined;
    const paint = () => {
      const stops = gradient && Array.isArray(gradient.stops) ? gradient.stops.filter(record).map((s: Raw) => ({ color: color(s.color) ?? '#000000', position: round(num(s.position, 0, 0, 100)) })).slice(0, 16) : [];
      if (stops.length >= 2) Object.assign(patch, { gradient: gradient!.type === 'radial' ? 'radial' : 'linear', gradientAngle: Math.round(num(gradient!.angle, 180, 0, 360)), gradientStops: stops, fill: stops[0].color, gradientEnd: stops.at(-1)!.color });
      else if (bg) patch.fill = colorToken(bg, bg);
      if (borderRaw && color(borderRaw.color)) Object.assign(patch, { stroke: colorToken(color(borderRaw.color), color(borderRaw.color)!), strokeWidth: round(num(borderRaw.width, 1, 0, 50)) });
    };
    let type: Kind, created: DesignNode | undefined;
    if (kind === 'svg') {
      try { const svg = sanitizeSVG(text(e.svg, 60000)); created = node('vector', { ...patch, id: idFor('ilustracion'), name: 'Ilustración', svg, color: colorToken(color(e.color), '@text', 'text') }); report.illustrations++; }
      catch { note('SVG que no se pudo sanear: se omitió.'); continue; }
    } else if (kind === 'img') {
      const image = text(e.image, 420000);
      if (/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(image)) { created = node('image', { ...patch, id: idFor('imagen'), name: text(e.alt, 60).trim() || 'Imagen', image }); report.images++; }
      else { paint(); created = node('rect', { ...patch, id: idFor('imagen'), name: `${text(e.alt, 60).trim() || 'Imagen'} (no capturada)`, fill: patch.fill === 'transparent' ? '@border' : patch.fill }); note('Imágenes no capturadas: quedan como caja del mismo tamaño.'); }
    } else if (kind === 'text' || kind === 'button' || kind === 'input') {
      type = kind as Kind; paint();
      const font = record(e.font) ? e.font : {}, size = round(num(font.size, 16, 1, 400)), weight = Math.round(num(font.weight, 400, 100, 900) / 100) * 100;
      const token=typeKeys.get(fontKey(font));
      const label = text(e.text, 20000);
      created = node(type, { ...patch, id: idFor(type === 'text' ? label.slice(0, 24) || 'texto' : type), name: type === 'text' ? (label.slice(0, 40) || labels.text) : type === 'button' ? `Botón · ${label.slice(0, 30)}` : `Campo · ${label.slice(0, 30)}`, text: label,
        fontSize: size, fontWeight: weight, fontFamily: family(font.family),fontStyle:fontStyle(font), lineHeight: round(Math.max(.5, Math.min(4, num(font.lineHeight, size * 1.2, 1, 2000) / size))), textAlign: font.align === 'center' ? 'center' : font.align === 'right' ? 'right' : 'left',
        color: colorToken(color(e.color), '@text', 'text'), ...(token ? { typographyToken: token } : {}), ...(type === 'input' && patch.strokeWidth === 0 ? { stroke: '@border', strokeWidth: 1 } : {}) });

      if (kind === 'text' && e.href) note('Enlaces: se importaron como texto; añade flujos si quieres navegación.');
    } else {
      paint(); const hasKids = elements.some(k => k.p === e.i);
      type = hasKids ? 'card' : 'rect';
      created = node(type, { ...patch, id: idFor(generic.test(tag) ? type : tag), name: generic.test(tag) ? (hasKids ? 'Grupo' : labels.rect) : tag, ...(type === 'card' && patch.strokeWidth === 0 ? { strokeWidth: 0 } : {}) });
    }
    if (!created) continue;
    added.push(created); byIndex.set(num(e.i, -1), created); abs.set(created.id, { x: num(e.x), y: num(e.y) }); report.layers++;
  }
  if (added.length === 1) throw new Error('La instantánea no contiene elementos visibles que importar.');
  p.nodes.push(...added);
  if (families.size) note(`Tipografías de la página (${[...families].slice(0, 6).join(', ')}): se muestran con la fuente de sistema, serif o monoespaciada más parecida.`);
  report.notes = [...counts].sort((a, b) => b[1] - a[1]).map(([message, count]) => count > 1 ? `${message} (${count})` : message);
  validate(p);
  return report;
}

/** Turn the repeated cards of an imported screen into one component with instances; optional, for people who want a system out of a clone. */
export function componentizeRepeats(p: Project, frameId: string): number {
  const kids = p.nodes.filter(n => n.parentId === frameId && n.type === 'card');
  const groups = new Map<string, DesignNode[]>();
  // Same size within 2 px is the signal: cards of a list share a frame even when one carries a badge the others lack.
  for (const k of kids) { const key = `${Math.round(k.width / 2)}x${Math.round(k.height / 2)}`; groups.set(key, [...(groups.get(key) ?? []), k]); }
  let made = 0;
  for (const list of groups.values()) if (list.length >= 3) { try { createComponent(p, list[0].id); made++; } catch { /* nested components are left as they are */ } }
  return made;
}
