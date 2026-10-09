// Headless rendering of one screen to a self-contained SVG string. Pure: no window, no document,
// no canvas. Text is wrapped with built-in font metrics, so the same call works in a browser, a
// worker, Node or a headless bridge. The editor's own SVG export goes through the same code with a
// canvas-backed measure for exact wrapping.
import { children, color, panelsOf, parseDocument, screenFrames, type DesignNode, type Project, type Theme } from './model';
export { parseDocument, screens, type ScreenInfo } from './model';
import { effectiveTheme, resolveNodeStyle, safeColor, type GradientToken, type MaterialToken } from './themes';
import { iconLicenseNotice, iconSVG } from './icon-data';
import { scopeSVG } from './motion';
import { deviceSkins } from './devices';

export const fonts: Record<string, string> = { system: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' };
export function escape(s: unknown): string { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!); }

/** Token overrides for a render: `light` / `dark`, or a map of Codaru color tokens. Keys may be written
 * as CSS variables (`--codaru-primary`, `--primary`) or bare (`primary`); `mode` picks light or dark. */
export type ScreenTheme = Theme | (Record<string, string> & { mode?: Theme });
export interface RenderScreenOptions {
  /** Screen id (stable) or exact name. Defaults to the first screen in reading order. */
  screen?: string;
  theme?: ScreenTheme;
  /** Largest width of the SVG in pixels; the drawing scales down, never up. */
  maxWidth?: number;
  /** Only `static` exists: the screen is drawn, without navigation or animation. */
  mode?: 'static';
  /** Include the license texts of the icon sets used, as SVG metadata. Default true. */
  licenses?: boolean;
}
/** Width in pixels of `text` set in `font` (a CSS font shorthand: weight, size, family). */
export type TextMeasure = (text: string, font: { family: string; size: number; weight: number }) => number;

/** Draw one screen of a design document as SVG. The document may be JSON text or an object; it is validated first. */
export function renderScreenToSVG(document: unknown, options: RenderScreenOptions = {}): string {
  const p = parseDocument(document);
  if (options.mode !== undefined && options.mode !== 'static') throw new Error('mode solo admite «static».');
  if (options.maxWidth !== undefined && !(Number.isFinite(options.maxWidth) && options.maxWidth > 0)) throw new Error('maxWidth debe ser un número positivo.');
  const frame = pickScreen(p, options.screen);
  withTheme(p, options.theme, [frame]);
  return frameToSVG(p, frame, { maxWidth: options.maxWidth, licenses: options.licenses });
}
/** The same SVG as a `data:image/svg+xml` URL, safe inside `<img src>`, CSS `url()` and a Markdown image link. */
export function renderScreenToDataURL(document: unknown, options: RenderScreenOptions = {}): string { return svgDataURL(renderScreenToSVG(document, options)); }
export function svgDataURL(svg: string): string {
  // Percent-encode everything that could end a Markdown link or an HTML attribute, keep the rest readable.
  const body = encodeURIComponent(svg).replace(/[()'!*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()).replace(/%(3D|3A|2F|2C|3B|40)/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return 'data:image/svg+xml;charset=utf-8,' + body;
}

/** Resolve a screen by id or exact name among visible frames; without one, the first screen in reading order. */
export function pickScreen(p: Project, wanted?: string): DesignNode {
  const frames = p.nodes.filter(n => n.type === 'frame' && !n.hidden);
  if (!frames.length) throw new Error('El diseño no tiene pantallas visibles.');
  if (!wanted) return screenFrames(p)[0] ?? frames.find(f => f.parentId === null) ?? frames[0];
  const found = frames.find(f => f.id === wanted) ?? frames.find(f => f.name === wanted);
  if (!found) { const list = screenFrames(p).length ? screenFrames(p) : frames; throw new Error(`No existe la pantalla «${wanted}». Disponibles: ${list.slice(0, 12).map(f => f.id).join(', ')}${list.length > 12 ? '…' : ''}`); }
  return found;
}

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
/** Apply a theme option to a validated copy: the mode for the whole document, color overrides to the theme each frame uses. */
export function withTheme(p: Project, theme: ScreenTheme | undefined, frames: DesignNode[]): Project {
  if (theme === undefined) return p;
  if (typeof theme === 'string') { if (theme !== 'light' && theme !== 'dark') throw new Error('theme debe ser light, dark o un mapa de tokens.'); p.theme = theme; return p; }
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) throw new Error('theme debe ser light, dark o un mapa de tokens.');
  const overrides: Record<string, string> = {};
  for (const [raw, value] of Object.entries(theme)) {
    if (raw === 'mode') { if (value !== 'light' && value !== 'dark') throw new Error('theme.mode debe ser light o dark.'); p.theme = value; continue; }
    const key = raw.replace(/^--(codaru-)?/, '');
    if (!TOKEN.test(key)) throw new Error(`Token de tema inválido: ${raw}`);
    const clean = typeof value === 'string' ? value.trim() : value;
    if (!safeColor(clean)) throw new Error(`Color inválido para ${raw}: usa HEX, "transparent" o "@alias".`);
    overrides[key] = clean;
  }
  if (!Object.keys(overrides).length) return p;
  const ids = new Set(frames.map(f => effectiveTheme(p, f).id));
  for (const id of ids) for (const mode of ['light', 'dark'] as const) {
    const set = p.designThemes[id]?.modes[mode]; if (set) set.colors = { ...set.colors, ...overrides };
    if (id === 'project') p.themes[mode] = { ...p.themes[mode], ...overrides };
  }
  return p;
}

// ---- text metrics ---------------------------------------------------------------------------
// Advance widths in 1/1000 em for ASCII 32–126 (Helvetica regular and bold), close to the system
// sans-serif faces. Accented letters use their base letter; other scripts fall back to averages.
const REGULAR = '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584'.split(',').map(Number);
const BOLD = '278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584'.split(',').map(Number);
const SPECIAL: Record<string, number> = { '•': 350, '·': 278, '…': 1000, '—': 1000, '–': 556, '→': 1000, '←': 1000, '¿': 611, '¡': 333, '€': 556, '“': 333, '”': 333, '‘': 222, '’': 222, '°': 400, '×': 584, '▧': 800 };
function advance(ch: string, bold: boolean): number {
  const code = ch.codePointAt(0)!;
  if (code >= 32 && code <= 126) return (bold ? BOLD : REGULAR)[code - 32];
  if (SPECIAL[ch]) return SPECIAL[ch];
  const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (base && base !== ch && base.length === 1 && base.codePointAt(0)! <= 126) return advance(base, bold);
  if (code >= 0x2e80 && code <= 0x9fff || code >= 0xac00 && code <= 0xd7af || code >= 0xff00 && code <= 0xffef) return 1000;
  if (code >= 0x1f000) return 1150;
  return 556;
}
/** Built-in measure used when there is no canvas: Helvetica-like metrics, Georgia slightly narrower, monospace 0.6 em. */
export const metricMeasure: TextMeasure = (text, { family, size, weight }) => {
  if (/mono|Menlo|Courier/i.test(family)) return [...text].length * size * .6;
  const t = Math.max(0, Math.min(1, (weight - 400) / 300)); let sum = 0;
  for (const ch of text) sum += advance(ch, false) * (1 - t) + advance(ch, true) * t;
  return sum / 1000 * size * (/Georgia|serif/i.test(family) && !/sans-serif/i.test(family) ? .94 : 1);
};
/** Lines as CSS `white-space: pre-wrap; overflow-wrap: anywhere` would break them in `width`. */
export function wrapText(text: string, width: number, font: { family: string; size: number; weight: number }, measure: TextMeasure = metricMeasure): string[] {
  const lines: string[] = [], fits = (s: string) => measure(s, font) <= width + .5;
  for (const paragraph of text.split('\n')) {
    const indent = /^ */.exec(paragraph)![0];
    let line = indent, first = true;
    for (const word of paragraph.slice(indent.length).split(' ')) {
      const next = first ? line + word : line ? `${line} ${word}` : word; first = false;
      if (fits(next) || (!line && !word)) { line = next; continue; }
      if (line) lines.push(line);
      line = '';
      // A word wider than the box breaks between characters.
      let piece = '';
      for (const ch of word) { if (piece && !fits(piece + ch)) { lines.push(piece); piece = ch; } else piece += ch; }
      line = piece;
    }
    lines.push(line);
  }
  return lines;
}

// ---- drawing --------------------------------------------------------------------------------
const num = (v: number) => String(Math.round(v * 100) / 100);
/** Font attributes for SVG text. Between 400 and 700 the system face is variable: without an explicit
 * axis, SVG and canvas fall back to a wider static face while HTML uses the variable one. */
const fontAttrs = (family: string, size: number, weight: number) => `font-family="${escape(family)}" font-size="${num(size)}" font-weight="${weight}"${weight % 100 || (weight !== 400 && weight !== 700) ? ` style="font-variation-settings:'wght' ${weight}"` : ''}`;
/** Split a color into an SVG paint and its opacity, so 8-digit hex and material alpha survive every renderer. */
function paint(value: string, opacity = 1): { color: string; opacity: number } {
  if (!value || value.toLowerCase() === 'transparent') return { color: 'none', opacity: 0 };
  let hex = value.slice(1);
  if (hex.length === 3 || hex.length === 4) hex = [...hex].map(c => c + c).join('');
  const alpha = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
  return { color: '#' + hex.slice(0, 6).toLowerCase(), opacity: alpha * opacity };
}
const attr = (name: string, p: { color: string; opacity: number }) => p.color === 'none' ? `${name}="none"` : `${name}="${p.color}"${p.opacity < 1 ? ` ${name}-opacity="${num(p.opacity)}"` : ''}`;
function gradientFor(p: Project, n: DesignNode): GradientToken | undefined {
  const set = effectiveTheme(p, n).tokens;
  if (n.fillToken && Object.hasOwn(set.gradients, n.fillToken)) return set.gradients[n.fillToken];
  if (n.gradient === 'none') return;
  return { name: 'Local', type: n.gradient, angle: n.gradientAngle, stops: n.gradientStops ?? [{ color: n.fill, position: 0 }, { color: n.gradientEnd, position: 100 }] };
}
/** Rounded rectangle with per-corner radii, clamped as CSS does when they exceed the box. */
function roundedRect(x: number, y: number, w: number, h: number, radii: number[]): string {
  if (w <= 0 || h <= 0) return '';
  let [a, b, c, d] = radii.map(r => Math.max(0, r));
  const f = Math.min(1, w / (a + b || 1), w / (d + c || 1), h / (a + d || 1), h / (b + c || 1)); a *= f; b *= f; c *= f; d *= f;
  if (!a && !b && !c && !d) return `M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}Z`;
  return `M${num(x + a)} ${num(y)}H${num(x + w - b)}${b ? `A${num(b)} ${num(b)} 0 0 1 ${num(x + w)} ${num(y + b)}` : ''}V${num(y + h - c)}${c ? `A${num(c)} ${num(c)} 0 0 1 ${num(x + w - c)} ${num(y + h)}` : ''}H${num(x + d)}${d ? `A${num(d)} ${num(d)} 0 0 1 ${num(x)} ${num(y + h - d)}` : ''}V${num(y + a)}${a ? `A${num(a)} ${num(a)} 0 0 1 ${num(x + a)} ${num(y)}` : ''}Z`;
}
/** Distance from the line box's vertical middle to the baseline, in em, for the system faces. */
const BASELINE = .35;
const SIGNAL = '<rect x="0" y="8" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="7" rx="1"/><rect x="10" y="3" width="3" height="10" rx="1"/><rect x="15" y="0" width="3" height="13" rx="1"/><path d="M30 3.2a8.6 8.6 0 0 1 11 0l-1.4 1.7a6.4 6.4 0 0 0-8.2 0zm2.3 3a5 5 0 0 1 6.4 0L37.3 8a2.8 2.8 0 0 0-3.6 0zm3.2 6.3 1.8-2.3a2.3 2.3 0 0 0-3.6 0z"/><rect x="46" y="1" width="17" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".5"/><rect x="47.7" y="2.7" width="11" height="7.6" rx="1.7"/><rect x="64" y="4.5" width="1.5" height="4" rx=".7" opacity=".5"/>';

/** Draw a validated frame at the origin. `measure` defaults to the built-in metrics. */
export function frameToSVG(p: Project, frame: DesignNode, options: { measure?: TextMeasure; maxWidth?: number; licenses?: boolean } = {}): string {
  const measure = options.measure ?? metricMeasure;
  const scope = 'c' + frame.id.replace(/[^A-Za-z0-9_-]/g, '');
  const defs: string[] = [], body: string[] = [], filters = new Map<string, string>();
  let next = 0;
  const id = (kind: string) => `${scope}-${kind}${next++}`;
  const clip = (d: string) => { const ref = id('k'); defs.push(`<clipPath id="${ref}"><path d="${d}"/></clipPath>`); return ref; };
  const shadow = (dy: number, blur: number, ink: string, alpha: number) => {
    const key = `${dy}|${blur}|${ink}|${alpha}`; let ref = filters.get(key);
    if (!ref) { ref = id('s'); filters.set(key, ref); defs.push(`<filter id="${ref}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="${num(dy)}" stdDeviation="${num(blur / 2)}" flood-color="${ink}" flood-opacity="${num(alpha)}"/></filter>`); }
    return ref;
  };

  function draw(raw: DesignNode, ox: number, oy: number) {
    if (raw.hidden) return;
    const n = { ...raw, ...resolveNodeStyle(p, raw) }, root = raw.id === frame.id;
    const x = root ? 0 : ox + n.x, y = root ? 0 : oy + n.y, w = n.width, h = n.height;
    const set = effectiveTheme(p, n).tokens, material: MaterialToken | undefined = n.materialToken ? set.materials[n.materialToken] : undefined;
    const skin = n.type === 'frame' && n.skin ? deviceSkins[n.skin] : undefined;
    const border = material ? Math.max(1, n.strokeWidth) : n.strokeWidth;
    const radii = skin ? [skin.radius, skin.radius, skin.radius, skin.radius] : n.type === 'ellipse' ? [] : [n.radius, n.radiusTR ?? n.radius, n.radiusBR ?? n.radius, n.radiusBL ?? n.radius];
    const outline = (inset: number) => n.type === 'ellipse'
      ? `M${num(x + w / 2)} ${num(y + inset)}A${num(w / 2 - inset)} ${num(h / 2 - inset)} 0 1 1 ${num(x + w / 2)} ${num(y + h - inset)}A${num(w / 2 - inset)} ${num(h / 2 - inset)} 0 1 1 ${num(x + w / 2)} ${num(y + inset)}Z`
      : roundedRect(x + inset, y + inset, w - inset * 2, h - inset * 2, radii.map(r => r - inset));
    body.push(`<g${n.opacity < 100 ? ` opacity="${num(n.opacity / 100)}"` : ''}${material ? ' data-material-fallback="tint-and-border"' : ''}>`);

    // Background: a token or local gradient, a glass tint, or a flat fill.
    const gradient = gradientFor(p, n), alpha = material ? material.opacity / 100 : 1;
    let fill = gradient ? '' : attr('fill', paint(color(p, material?.tint ?? n.fill, n), alpha));
    if (gradient) {
      const ref = id('g'), stops = gradient.stops.map(stop => { const c = paint(color(p, stop.color, n), alpha); return `<stop offset="${num(stop.position / 100)}" stop-color="${c.color === 'none' ? '#000000' : c.color}"${c.opacity < 1 ? ` stop-opacity="${num(c.opacity)}"` : ''}/>`; }).join('');
      if (gradient.type === 'linear') {
        // CSS gradient line: through the center, long enough for the corners to reach 0% and 100%.
        const a = gradient.angle * Math.PI / 180, half = (Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a))) / 2, dx = Math.sin(a) * half, dy = -Math.cos(a) * half, cx = x + w / 2, cy = y + h / 2;
        defs.push(`<linearGradient id="${ref}" gradientUnits="userSpaceOnUse" x1="${num(cx - dx)}" y1="${num(cy - dy)}" x2="${num(cx + dx)}" y2="${num(cy + dy)}">${stops}</linearGradient>`);
      } else {
        const [fx, fy] = n.gradientStops ? [.5, .5] : [.3, .2], cx = x + w * fx, cy = y + h * fy, r = Math.hypot(Math.max(cx - x, x + w - cx), Math.max(cy - y, y + h - cy));
        defs.push(`<radialGradient id="${ref}" gradientUnits="userSpaceOnUse" cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}">${stops}</radialGradient>`);
      }
      fill = `fill="url(#${ref})"`;
    }
    const drop = material?.shadow ? shadow(material.shadow / 2, material.shadow * 2, '#0a0c1c', .18) : n.shadow ? shadow(8, 22, '#19102e', .13) : undefined;
    if (fill !== 'fill="none"' && w > 0 && h > 0) body.push(`<path d="${outline(0)}" ${fill}${drop ? ` filter="url(#${drop})"` : ''}/>`);
    // CSS borders sit inside the box.
    const stroke = paint(color(p, material?.stroke ?? n.stroke, n));
    if (border > 0 && stroke.color !== 'none' && w > border && h > border) body.push(`<path d="${outline(border / 2)}" fill="none" ${attr('stroke', stroke)} stroke-width="${num(border)}"/>`);

    // Content lives in the padding box: inside the border, clipped by the inner radius where the DOM clips.
    const cx = x + border, cy = y + border, cw = w - border * 2, ch = h - border * 2;
    const inner = n.type === 'ellipse' ? outline(border) : roundedRect(cx, cy, cw, ch, radii.map(r => r - border));
    if (n.type === 'image') {
      if (n.image) body.push(`<image href="${escape(n.image)}" x="${num(cx)}" y="${num(cy)}" width="${num(Math.max(0, cw))}" height="${num(Math.max(0, ch))}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip(inner)})"/>`);
      else {
        const muted = paint(color(p, '@muted', n)), stub = paint(color(p, '@accent', n));
        body.push(`<path d="${inner}" ${attr('fill', stub)}/><text x="${num(cx + cw / 2)}" y="${num(cy + ch / 2 + BASELINE * n.fontSize)}" text-anchor="middle" ${attr('fill', muted)} ${fontAttrs(fonts[n.fontFamily] ?? fonts.system, n.fontSize, n.fontWeight)}>▧  Imagen</text>`);
      }
    }
    if (n.type === 'icon') {
      const svg = iconSVG(n.iconPack!, n.iconName!, color(p, n.color, n), Math.max(1, w));
      body.push(svg.replace(/^<svg /, `<svg x="${num(cx)}" y="${num(cy)}" `).replace(/ width="[^"]*" height="[^"]*"/, ` width="${num(Math.max(0, cw))}" height="${num(Math.max(0, ch))}"`).replace(/ aria-hidden="true" focusable="false"/, ''));
    }
    if (n.type === 'vector') {
      // Sanitized markup: the root has no size of its own, so it fills the box; `color` feeds currentColor.
      body.push(scopeSVG(n.svg!, `${scope}-${n.id}`).replace(/^<svg /, `<svg x="${num(cx)}" y="${num(cy)}" width="${num(Math.max(0, cw))}" height="${num(Math.max(0, ch))}" overflow="visible" color="${paint(color(p, n.color, n)).color}" `));
    }
    if (n.text && n.type !== 'image') {
      const boxed = n.type === 'button' || n.type === 'input', pad = boxed ? 14 : 0, family = fonts[n.fontFamily] ?? fonts.system;
      const font = { family, size: n.fontSize, weight: n.fontWeight }, lines = wrapText(n.text, Math.max(1, cw - pad * 2), font, measure), lh = n.fontSize * n.lineHeight;
      const top = boxed ? cy + (ch - lines.length * lh) / 2 : cy;
      const anchor = n.textAlign === 'center' ? 'middle' : n.textAlign === 'right' ? 'end' : 'start';
      const tx = n.textAlign === 'center' ? cx + cw / 2 : n.textAlign === 'right' ? cx + cw - pad : cx + pad;
      const overflows = lines.length * lh > ch + .5 || top < cy - .5 || lines.some(line => measure(line, font) > cw - pad * 2 + .5);
      const ink = paint(color(p, n.color, n));
      body.push(`<text ${attr('fill', ink)} ${fontAttrs(family, n.fontSize, n.fontWeight)} text-anchor="${anchor}" xml:space="preserve"${overflows ? ` clip-path="url(#${clip(roundedRect(cx, cy, cw, ch, [0, 0, 0, 0]))})"` : ''}>${lines.map((line, i) => `<tspan x="${num(tx)}" y="${num(top + i * lh + lh / 2 + BASELINE * n.fontSize)}">${escape(line)}</tspan>`).join('')}</text>`);
    }

    const kids = children(p, raw.id).filter(k => !k.hidden);
    const framed = n.type === 'frame' && (kids.length || skin || n.fold);
    if (framed) body.push(`<g clip-path="url(#${clip(inner)})">`);
    for (const kid of kids) draw(kid, cx, cy);
    if (n.type === 'frame' && n.fold) {
      // The hinge is drawn above the content, as in the preview.
      const vertical = n.fold.axis === 'vertical', gap = n.fold.gap, size = Math.max(gap, 1), panels = panelsOf(n), dash = 'stroke="#787c8c" stroke-opacity=".75" stroke-width="1" stroke-dasharray="3 3"';
      for (let hinge = 1; hinge < panels; hinge++) {
        const at = (vertical ? cw : ch) * hinge / panels - size / 2;
        if (vertical) { if (gap) body.push(`<rect x="${num(cx + at)}" y="${num(cy)}" width="${num(size)}" height="${num(ch)}" fill="#14161e" fill-opacity=".82"/>`); body.push(`<path d="M${num(cx + at + .5)} ${num(cy)}V${num(cy + ch)}${gap ? `M${num(cx + at + size - .5)} ${num(cy)}V${num(cy + ch)}` : ''}" ${dash}/>`); }
        else { if (gap) body.push(`<rect x="${num(cx)}" y="${num(cy + at)}" width="${num(cw)}" height="${num(size)}" fill="#14161e" fill-opacity=".82"/>`); body.push(`<path d="M${num(cx)} ${num(cy + at + .5)}H${num(cx + cw)}${gap ? `M${num(cx)} ${num(cy + at + size - .5)}H${num(cx + cw)}` : ''}" ${dash}/>`); }
      }
    }
    if (skin && skin.system !== 'none' || skin?.cutout || skin?.home) {
      // System chrome above the design: status bar, camera cutout and home indicator.
      const ink = paint(color(p, '@text', n)), ios = skin!.system === 'ios', top = n.safeArea?.top || (ios ? 24 : 28), bar = Math.min(top, 54), side = Math.max(16, Math.min(34, skin!.radius * .62));
      if (skin!.system !== 'none') {
        const size = ios ? 15 : 13, width = ios ? 66 : 54;
        body.push(`<text x="${num(cx + side)}" y="${num(cy + bar / 2 + BASELINE * size)}" ${attr('fill', ink)} ${fontAttrs(fonts.system, size, ios ? 600 : 500)}${ios ? ' letter-spacing="-0.2"' : ''}>${ios ? '9:41' : '12:30'}</text>`);
        body.push(`<svg x="${num(cx + cw - side - width)}" y="${num(cy + bar / 2 - 6.5)}" width="${width}" height="13" viewBox="0 0 66 13" fill="${ink.color}" color="${ink.color}">${SIGNAL}</svg>`);
      }
      if (skin!.cutout === 'island' && n.height >= n.width) body.push(`<rect x="${num(cx + cw / 2 - 59)}" y="${num(cy + Math.max(8, (top - 36) / 2 + 3))}" width="118" height="34" rx="17" fill="#050506"/>`);
      if (skin!.cutout === 'punch') body.push(`<circle cx="${num(cx + cw / 2)}" cy="${num(cy + Math.max(6, bar / 2 - 6) + 6)}" r="6" fill="#050506"/>`);
      if (skin!.home) { const hw = ios ? 134 : 108, hh = ios ? 5 : 4; body.push(`<rect x="${num(cx + cw / 2 - hw / 2)}" y="${num(cy + ch - (ios ? 8 : 9) - hh)}" width="${hw}" height="${hh}" rx="${num(hh / 2)}" fill="${ink.color}" fill-opacity="${ios ? .85 : .55}"/>`); }
    }
    if (framed) body.push('</g>');
    body.push('</g>');
  }

  draw(frame, 0, 0);
  // Hash the rendered drawing, not unrelated nodes or volatile document metadata.
  // Identical renders stay deterministic; inline theme variants cannot share paint resources.
  let drawing = `${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${body.join('')}`;
  let hash = 2166136261; for (let i = 0; i < drawing.length; i++) hash = Math.imul(hash ^ drawing.charCodeAt(i), 16777619);
  const resource = (ref: string) => ref.startsWith(scope + '-') ? `${scope}-${(hash >>> 0).toString(16)}-${ref.slice(scope.length + 1)}` : ref;
  drawing = drawing.replace(/\sid="([^"]+)"/g, (_, ref) => ` id="${resource(ref)}"`).replace(/url\(#([^)]+)\)/g, (_, ref) => `url(#${resource(ref)})`).replace(/\shref="#([^"]+)"/g, (_, ref) => ` href="#${resource(ref)}"`);
  const scale = options.maxWidth && frame.width > options.maxWidth ? options.maxWidth / frame.width : 1;
  const notices = options.licenses === false ? '' : iconLicenseNotice(p.nodes.filter(n => n.type === 'icon' && isInside(p, n, frame)).map(n => n.iconPack!));
  const material = p.nodes.some(n => n.materialToken && isInside(p, n, frame));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${num(frame.width * scale)}" height="${num(frame.height * scale)}" viewBox="0 0 ${num(frame.width)} ${num(frame.height)}" role="img" aria-label="${escape(frame.name)}"><title>${escape(frame.name)}</title>${notices ? `<metadata id="codaru-icon-licenses">${escape(notices)}</metadata>` : ''}${material ? '<desc>Los materiales de cristal se dibujan como tinte y borde; el desenfoque del fondo se conserva en la vista HTML.</desc>' : ''}${drawing}</svg>`;
}
function isInside(p: Project, n: DesignNode, frame: DesignNode) { let cur: DesignNode | undefined = n; while (cur) { if (cur.id === frame.id) return true; const parent: string | null = cur.parentId; cur = parent ? p.nodes.find(x => x.id === parent) : undefined; } return false; }
