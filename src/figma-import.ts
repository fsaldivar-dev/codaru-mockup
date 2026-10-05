import { containerKinds, createComponent, labels, node, validate, type DesignNode, type Kind, type Project } from './model';
import { sanitizeSVG } from './motion';

/**
 * Import of a file written by the Codaru plugin for Figma (packages/figma-plugin). The plugin only
 * serializes what Figma knows; everything is checked, cleaned and mapped to Codaru here, so the
 * file is treated as untrusted input. Nothing is fetched and no script from the file is executed.
 */
export interface FigmaReport {
  screens: number; layers: number; components: number; tokens: number; illustrations: number;
  /** What was simplified or left out, in the user's language, most relevant first. */
  notes: string[];
}
type Raw = Record<string, any>;
const record = (value: unknown): value is Raw => !!value && typeof value === 'object' && !Array.isArray(value);
const num = (value: unknown, fallback = 0, min = -100000, max = 100000) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const text = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';
const round = (value: number) => Math.round(value * 100) / 100;
const channel = (value: unknown) => Math.round(num(value, 0, 0, 1) * 255).toString(16).padStart(2, '0');
const hex = (color: unknown, alpha = 1) => { const c = record(color) ? color : {}, a = Math.max(0, Math.min(1, alpha * num(c.a, 1, 0, 1))); return `#${channel(c.r)}${channel(c.g)}${channel(c.b)}${a < 1 ? channel(a) : ''}`; };
const serif = /georgia|times|serif|playfair|merriweather|garamond|baskerville|lora|caslon|bodoni|didot/i, mono = /mono|courier|menlo|consolas|code|fira code|jetbrains/i;
const generic = /^(frame|group|rectangle|ellipse|vector|line|polygon|star|text|component|instance|section|union|subtract|image)\s*\d*$/i;

export function isFigmaExport(value: unknown): value is Raw { return record(value) && value.format === 'codaru-figma-export'; }

/** Add the exported Figma layers to `p`, to the right of what is already there. One call is one undo entry when used inside a commit. */
export function importFigma(p: Project, input: unknown): FigmaReport {
  if (!isFigmaExport(input) || input.version !== 1 || !Array.isArray(input.nodes)) throw new Error('No es un archivo del plugin de Codaru para Figma (versión 1).');
  const report: FigmaReport = { screens: 0, layers: 0, components: 0, tokens: 0, illustrations: 0, notes: [] };
  const counts = new Map<string, number>(), note = (message: string) => counts.set(message, (counts.get(message) ?? 0) + 1);
  const used = new Set(p.nodes.map(n => n.id)), added: DesignNode[] = [];
  const idFor = (raw: unknown) => { const base = `fg-${text(raw, 80).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'capa'}`.slice(0, 100); let id = base; for (let i = 2; used.has(id); i++) id = `${base}-${i}`; used.add(id); return id; };
  const theme = p.designThemes[p.activeThemeId];
  const tokenId = (name: string, taken: (id: string) => boolean) => { const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'estilo'; let id = base; for (let i = 2; taken(id); i++) id = `${base}-${i}`; return id; };

  // Figma styles become theme tokens, so imported layers stay linked the way they were in Figma.
  const paintTokens = new Map<string, { color?: string; gradient?: string }>(), textTokens = new Map<string, string>();
  const styles = record(input.styles) ? input.styles : {};
  for (const style of Array.isArray(styles.paints) ? styles.paints.slice(0, 200) : []) {
    const paint = record(style) && Array.isArray(style.paints) ? style.paints.find((item: unknown) => record(item) && item.visible !== false) : undefined;
    if (!record(style) || !record(paint)) continue;
    const taken = (id: string) => ['light', 'dark'].some(mode => Object.hasOwn(theme.modes[mode as 'light'].colors, id) || Object.hasOwn(theme.modes[mode as 'light'].gradients, id));
    if (paint.type === 'SOLID') {
      const id = tokenId(text(style.name, 120), taken), value = hex(paint.color, num(paint.opacity, 1, 0, 1));
      for (const mode of ['light', 'dark'] as const) theme.modes[mode].colors[id] = value;
      paintTokens.set(text(style.id, 200), { color: id }); report.tokens++;
    } else if (paint.type === 'GRADIENT_LINEAR' || paint.type === 'GRADIENT_RADIAL') {
      const gradient = gradientOf(paint); if (!gradient) continue;
      const id = tokenId(text(style.name, 120), taken);
      for (const mode of ['light', 'dark'] as const) theme.modes[mode].gradients[id] = { name: text(style.name, 80) || id, ...gradient, stops: gradient.stops.map(stop => ({ ...stop })) };
      paintTokens.set(text(style.id, 200), { gradient: id }); report.tokens++;
    }
  }
  const families = new Set<string>();
  const family = (name: unknown) => { const value = text(name, 80); if (value && !/^(inter|sf pro|sf compact|system|helvetica|arial|roboto|segoe)/i.test(value)) families.add(value); return serif.test(value) ? 'serif' : mono.test(value) ? 'mono' : 'system'; };
  const weight = (raw: Raw) => { const direct = num(raw.fontWeight, 0, 0, 1000); if (direct) return Math.max(100, Math.min(900, direct)); const style = text(raw.fontStyle, 40).toLowerCase(); return /black|heavy/.test(style) ? 900 : /extra ?bold/.test(style) ? 800 : /semi ?bold|demi/.test(style) ? 600 : /bold/.test(style) ? 700 : /medium/.test(style) ? 500 : /light/.test(style) ? 300 : /thin/.test(style) ? 100 : 400; };
  const lineHeight = (raw: Raw, size: number) => { const lh = record(raw.lineHeight) ? raw.lineHeight : {}; return round(Math.max(.5, Math.min(4, lh.unit === 'PIXELS' ? num(lh.value, size * 1.2) / size : lh.unit === 'PERCENT' ? num(lh.value, 120) / 100 : 1.2))); };
  for (const style of Array.isArray(styles.texts) ? styles.texts.slice(0, 100) : []) {
    if (!record(style)) continue;
    const id = tokenId(text(style.name, 120), candidate => ['light', 'dark'].some(mode => Object.hasOwn(theme.modes[mode as 'light'].typography, candidate))), size = num(style.fontSize, 16, 1, 400);
    for (const mode of ['light', 'dark'] as const) theme.modes[mode].typography[id] = { name: text(style.name, 80) || id, fontFamily: family(style.fontFamily), fontSize: size, fontWeight: weight(style), lineHeight: lineHeight(style, size) };
    textTokens.set(text(style.id, 200), id); report.tokens++;
  }

  function gradientOf(paint: Raw) {
    const stops = (Array.isArray(paint.gradientStops) ? paint.gradientStops : []).filter(record).slice(0, 16).map((stop: Raw) => ({ color: hex(stop.color, num(paint.opacity, 1, 0, 1)), position: round(num(stop.position, 0, 0, 1) * 100) })).sort((a: { position: number }, b: { position: number }) => a.position - b.position);
    if (stops.length < 2) return;
    // Figma stores the gradient direction as a matrix; identity runs left to right (90deg in CSS).
    const m = Array.isArray(paint.gradientTransform) ? paint.gradientTransform : [[1, 0, 0], [0, 1, 0]];
    const angle = (Math.round(Math.atan2(-num(m[1]?.[0]), num(m[0]?.[0], 1)) * 180 / Math.PI) + 90 + 360) % 360;
    return { type: paint.type === 'GRADIENT_RADIAL' ? 'radial' as const : 'linear' as const, angle, stops };
  }
  function convert(raw: unknown, parentId: string | null, depth: number, top: boolean): DesignNode | undefined {
    if (!record(raw) || added.length >= 3000) { if (added.length >= 3000) note('El archivo supera 3000 capas: el resto no se importó.'); return; }
    if (raw.visible === false) { note('Capas ocultas descartadas.'); return; }
    const kids = Array.isArray(raw.children) ? raw.children : [], figmaType = text(raw.type, 40);
    const svg = typeof raw.svg === 'string' ? raw.svg : '', image = typeof raw.image === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(raw.image) && raw.image.length < 4_200_000 ? raw.image : '';
    let type: Kind;
    if (svg) type = 'vector';
    else if (figmaType === 'TEXT') type = 'text';
    else if (figmaType === 'ELLIPSE') type = 'ellipse';
    else if (kids.length || ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'GROUP', 'SECTION'].includes(figmaType)) type = top && parentId === null ? 'frame' : figmaType === 'GROUP' ? 'group' : 'card';
    else if (image) type = 'image';
    else type = 'rect';
    if (containerKinds.includes(type) && !kids.length && type !== 'frame' && figmaType === 'GROUP') { note('Grupos vacíos descartados.'); return; }
    if (depth > 28) { note('Capas anidadas a más de 28 niveles: se omitieron.'); return; }
    const fills = (Array.isArray(raw.fills) ? raw.fills : []).filter((paint: unknown) => record(paint) && paint.visible !== false) as Raw[], strokes = (Array.isArray(raw.strokes) ? raw.strokes : []).filter((paint: unknown) => record(paint) && paint.visible !== false && paint.type === 'SOLID') as Raw[];
    if (fills.length > 1) note('Capas con varios rellenos: se usó el superior.');
    const paint = fills.at(-1), style = paintTokens.get(text(raw.fillStyle, 200)), radius = Array.isArray(raw.radius) ? raw.radius.map((value: unknown) => num(value, 0, 0, 10000)) : [0, 0, 0, 0];
    const name = text(raw.name, 120).trim(), id = idFor(raw.id);
    const patch: Partial<DesignNode> = {
      id, parentId, name: !name || generic.test(name) ? labels[type] : name, x: round(num(raw.x)), y: round(num(raw.y)), width: Math.max(1, round(num(raw.width, 1))), height: Math.max(1, round(num(raw.height, 1))),
      opacity: Math.round(num(raw.opacity, 1, 0, 1) * 100), fill: 'transparent', strokeWidth: 0, radius: radius[0] ?? 0, shadow: false, locked: raw.locked === true,
    };
    if (radius.some((value: number) => value !== radius[0])) Object.assign(patch, { radiusTR: radius[1] ?? 0, radiusBR: radius[2] ?? 0, radiusBL: radius[3] ?? 0 });
    if (num(raw.rotation)) note('Capas giradas: se importaron sin rotación.');
    if (Array.isArray(raw.effects) && raw.effects.some((effect: unknown) => record(effect) && effect.visible !== false)) {
      if (raw.effects.some((effect: unknown) => record(effect) && effect.type === 'DROP_SHADOW' && effect.visible !== false)) patch.shadow = true;
      note('Sombras y desenfoques: se aproximan con la sombra estándar o se omiten.');
    }
    if (type === 'vector') {
      try { patch.svg = sanitizeSVG(svg); report.illustrations++; } catch { note('Vectores que no se pudieron convertir a SVG: se omitieron.'); return; }
    } else if (type === 'text') {
      const t = record(raw.text) ? raw.text : {}, size = num(t.fontSize, 16, 1, 400), token = textTokens.get(text(raw.textStyle, 200));
      Object.assign(patch, { text: text(t.characters, 20000), fontSize: size, fontWeight: weight(t), fontFamily: family(t.fontFamily), lineHeight: lineHeight(t, size), textAlign: t.align === 'CENTER' ? 'center' : t.align === 'RIGHT' ? 'right' : 'left', color: style?.color ? `@${style.color}` : paint?.type === 'SOLID' ? hex(paint.color, num(paint.opacity, 1, 0, 1)) : '@text', ...(token ? { typographyToken: token } : {}) });
      if (t.mixed === true) note('Textos con varios estilos: se usó el del primer carácter.');
    } else if (type === 'image') {
      patch.image = image;
    }
    if (type !== 'text' && type !== 'vector') {
      if (style?.color) Object.assign(patch, { fill: `@${style.color}`, fillToken: style.color });
      else if (style?.gradient) Object.assign(patch, { fill: '@primary', fillToken: style.gradient });
      else if (paint?.type === 'SOLID') patch.fill = hex(paint.color, num(paint.opacity, 1, 0, 1));
      else if (paint?.type === 'GRADIENT_LINEAR' || paint?.type === 'GRADIENT_RADIAL') { const g = gradientOf(paint); if (g) Object.assign(patch, { gradient: g.type, gradientAngle: g.angle, gradientStops: g.stops, fill: g.stops[0].color, gradientEnd: g.stops.at(-1)!.color }); }
      else if (paint?.type === 'IMAGE' && type !== 'image') note('Rellenos de imagen en contenedores: se omitieron.');
      else if (paint) note('Rellenos no admitidos (angular, diamante, vídeo): se omitieron.');
    }
    if (strokes[0] && type !== 'vector') Object.assign(patch, { stroke: hex(strokes[0].color, num(strokes[0].opacity, 1, 0, 1)), strokeWidth: num(raw.strokeWeight, 1, 0, 50) });
    const layout = record(raw.layout) ? raw.layout : undefined;
    if (layout && containerKinds.includes(type) && (layout.mode === 'HORIZONTAL' || layout.mode === 'VERTICAL')) {
      const padding = Array.isArray(layout.padding) ? layout.padding.map((value: unknown) => num(value, 0, 0, 1000)) : [0, 0, 0, 0];
      const simple = padding.every((value: number) => value === padding[0]) && layout.wrap !== true && (layout.primaryAlign ?? 'MIN') === 'MIN' && (layout.counterAlign ?? 'MIN') === 'MIN';
      if (simple) Object.assign(patch, { layout: layout.mode === 'HORIZONTAL' ? 'horizontal' : 'vertical', padding: padding[0], gap: num(layout.gap, 0, 0, 1000) });
      else note('Auto layout con alineación, ajuste de línea o márgenes distintos: se conservaron las posiciones, sin auto layout.');
    }
    if (raw.grow === 1) patch.sizing = 'fill';
    const created = node(type, patch); added.push(created); report.layers++;
    if (figmaType === 'INSTANCE') note('Instancias de componentes: se importaron como copias independientes.');
    if (figmaType === 'COMPONENT_SET') note('Variantes: cada una se importó como un componente separado.');
    if (type !== 'vector') for (const child of kids) convert(child, id, depth + 1, false);
    return created;
  }

  // Loose components of a page have no screen around them; they are gathered on one sheet.
  const loose: Raw[] = [], roots: DesignNode[] = [];
  for (const raw of input.nodes as unknown[]) {
    if (record(raw) && (raw.type === 'COMPONENT' || raw.type === 'COMPONENT_SET')) { loose.push(...(raw.type === 'COMPONENT_SET' && Array.isArray(raw.children) ? raw.children.filter(record).map((child: Raw) => ({ ...child, name: `${text(raw.name, 60)} / ${text(child.name, 60)}` })) : [raw])); if (raw.type === 'COMPONENT_SET') note('Variantes: cada una se importó como un componente separado.'); continue; }
    const created = convert(raw, null, 0, true);
    if (created) { roots.push(created); if (created.type === 'frame') report.screens++; }
  }
  if (loose.length) {
    const sheet = node('frame', { id: idFor('componentes'), name: 'Componentes de Figma', x: roots.length ? Math.max(...roots.map(n => n.x + n.width)) + 120 : 0, y: roots.length ? Math.min(...roots.map(n => n.y)) : 0, width: 400, height: 200, fill: '@background' }); added.push(sheet); roots.push(sheet); report.screens++;
    let x = 40, y = 40, rowHeight = 0, widest = 0;
    for (const raw of loose) {
      const created = convert({ ...raw, x: 0, y: 0 }, sheet.id, 1, false); if (!created) continue;
      if (x > 40 && x + created.width > 1400) { x = 40; y += rowHeight + 40; rowHeight = 0; }
      created.x = x; created.y = y; x += created.width + 40; rowHeight = Math.max(rowHeight, created.height); widest = Math.max(widest, x);
    }
    sheet.width = Math.max(400, widest); sheet.height = y + rowHeight + 40;
  }
  if (!added.length) throw new Error('El archivo de Figma no contiene capas visibles que importar.');
  // Keep the arrangement Figma had, moved to the right of the current document.
  const existing = p.nodes.filter(n => n.parentId === null), left = Math.min(...roots.map(n => n.x)), topEdge = Math.min(...roots.map(n => n.y));
  const offsetX = (existing.length ? Math.max(...existing.map(n => n.x + n.width)) + 120 : 60) - left, offsetY = (existing.length ? Math.min(...existing.map(n => n.y)) : 100) - topEdge;
  for (const root of roots) { root.x = round(root.x + offsetX); root.y = round(root.y + offsetY); }
  p.nodes.push(...added);
  for (const created of added.filter(n => loose.length && n.parentId === roots.at(-1)!.id)) {
    try { createComponent(p, created.id); report.components++; } catch { note('Componentes que contienen otros componentes: se importaron como grupos.'); }
  }
  if (families.size) note(`Tipografías no incluidas (${[...families].slice(0, 6).join(', ')}): se muestran con la fuente de sistema, serif o monoespaciada más parecida.`);
  report.notes = [...counts].sort((a, b) => b[1] - a[1]).map(([message, count]) => count > 1 ? `${message} (${count})` : message);
  validate(p);
  return report;
}
