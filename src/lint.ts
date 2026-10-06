import { docStale, designSystemStale, absolute, ancestors, children, color, frameOf, labels, panelsOf, type DesignNode, type Project, type Theme } from './model';
import { effectiveTheme } from './themes';

/**
 * Design review: finds what a careful designer would flag, in both light and dark mode, without
 * drawing anything. Each issue points at one element so it can be shown as a heat map or fixed by an AI.
 */
export type LintRule = 'contrast' | 'target' | 'text-size' | 'text-fit' | 'overflow' | 'safe-area' | 'hinge' | 'overlap' | 'off-theme' | 'alignment' | 'scale' | 'palette' | 'accent-fill' | 'gradient' | 'docs';
export interface LintIssue {
  rule: LintRule; severity: 'error' | 'warning' | 'info';
  /** Element to look at, and the screen it belongs to. */
  node: string; frame: string | null;
  message: string;
  /** Set when the problem only shows in one mode of the theme. */
  mode?: Theme;
  /** What would resolve it, phrased as an action. */
  fix: string;
}
export const lintRules: Record<LintRule, string> = {
  contrast: 'Contraste de texto', target: 'Zona táctil pequeña', 'text-size': 'Texto pequeño', 'text-fit': 'Texto que no cabe', overflow: 'Contenido fuera de la pantalla',
  'safe-area': 'Contenido bajo el área del sistema', hinge: 'Contenido sobre el pliegue', overlap: 'Acciones superpuestas', 'off-theme': 'Color fuera del tema', alignment: 'Casi alineados', palette: 'Paleta sin acento', 'accent-fill': 'Acento como fondo de un chip', gradient: 'Degradado embarrado', docs: 'Documentación desactualizada', scale: 'Demasiadas variantes',
};

type RGBA = [number, number, number, number];
function parse(value: string): RGBA {
  let hex = /^#([\da-f]{3,8})$/i.exec(value)?.[1] ?? '';
  if (hex.length === 3 || hex.length === 4) hex = [...hex].map(c => c + c).join('');
  if (hex.length !== 6 && hex.length !== 8) return [0, 0, 0, 0];
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1];
}
const over = (top: RGBA, bottom: RGBA): RGBA => { const a = top[3]; return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1]; };
const luminance = ([r, g, b]: RGBA) => { const f = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
/** Perceptual chroma and lightness (OKLCH) of an opaque color. */
function oklch([r, g, b]: RGBA) {
  const lin = (v: number) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(.4122214708 * R + .5363325363 * G + .0514459929 * B), m = Math.cbrt(.2119034982 * R + .6806995451 * G + .1073969566 * B), s = Math.cbrt(.0883024619 * R + .2817188376 * G + .6299787005 * B);
  const a = 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, bb = .0259040371 * l + .7827717662 * m - .808675766 * s;
  return { lightness: .2104542553 * l + .793617785 * m - .0040720468 * s, chroma: Math.hypot(a, bb), hue: (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360 };
}
/** WCAG contrast ratio between two opaque colors. */
export function contrastRatio(a: string, b: string) { const x = luminance(parse(a)), y = luminance(parse(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
const distance = (a: RGBA, b: RGBA) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const toHex = (c: RGBA) => `#${c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export function lintProject(input: Project, options: { frame?: string } = {}): LintIssue[] {
  const issues: LintIssue[] = [], seen = new Set<string>();
  const add = (issue: LintIssue) => { const key = `${issue.rule}|${issue.node}|${issue.mode ?? ''}|${issue.rule === 'scale' ? issue.message : ''}`; if (!seen.has(key)) { seen.add(key); issues.push(issue); } };
  const visible = (n: DesignNode) => !n.hidden && !ancestors(input, n.id).some(a => a.hidden);
  const inScope = (n: DesignNode) => !options.frame || frameOf(input, n.id)?.id === options.frame || n.id === options.frame;
  const nodes = input.nodes.filter(n => visible(n) && inScope(n));
  const frameId = (n: DesignNode) => frameOf(input, n.id)?.id ?? null;
  const name = (n: DesignNode) => `«${n.name || labels[n.type]}»`;
  const interactive = (n: DesignNode) => !!n.targetId || n.type === 'button' || n.type === 'input';

  type Point = { x: number; y: number };
  /** Color a layer paints at one point of the canvas in one mode, or nothing when it is transparent there. */
  function paintAt(p: Project, layer: DesignNode, point: Point): RGBA | undefined {
    const tokens = effectiveTheme(p, layer).tokens, fade = (c: RGBA): RGBA => [c[0], c[1], c[2], c[3] * layer.opacity / 100];
    if (layer.materialToken && tokens.materials[layer.materialToken]) { const m = tokens.materials[layer.materialToken], c = parse(color(p, m.tint, layer)); return fade([c[0], c[1], c[2], c[3] * m.opacity / 100]); }
    const token = layer.fillToken && Object.hasOwn(tokens.gradients, layer.fillToken) ? tokens.gradients[layer.fillToken] : undefined;
    const gradient = token ?? (layer.gradient !== 'none' ? { type: layer.gradient, angle: layer.gradientAngle, stops: layer.gradientStops ?? [{ color: layer.fill, position: 0 }, { color: layer.gradientEnd, position: 100 }] } : undefined);
    if (gradient) {
      // Where the point falls along the gradient, as the renderer draws it.
      const origin = absolute(p, layer), px = point.x - origin.x, py = point.y - origin.y, w = layer.width, h = layer.height;
      let t: number;
      if (gradient.type === 'linear') { const a = gradient.angle * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), length = Math.abs(w * dx) + Math.abs(h * dy) || 1; t = ((px - w / 2) * dx + (py - h / 2) * dy) / length + .5; }
      else { const cx = token || layer.gradientStops ? w / 2 : w * .3, cy = token || layer.gradientStops ? h / 2 : h * .2; t = Math.hypot(px - cx, py - cy) / (Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy)) || 1); }
      const at = Math.max(0, Math.min(1, t)) * 100, stops = gradient.stops, next = stops.find(stop => stop.position >= at) ?? stops.at(-1)!, previous = [...stops].reverse().find(stop => stop.position <= at) ?? stops[0];
      const from = parse(color(p, previous.color, layer)), to = parse(color(p, next.color, layer)), k = next.position === previous.position ? 0 : (at - previous.position) / (next.position - previous.position);
      return fade([0, 1, 2, 3].map(i => from[i] + (to[i] - from[i]) * k) as RGBA);
    }
    const value = layer.fillToken && Object.hasOwn(tokens.colors, layer.fillToken) ? `@${layer.fillToken}` : layer.fill, solid = fade(parse(color(p, value, layer)));
    return solid[3] > 0 ? solid : undefined;
  }
  /**
   * Opaque colors behind the text of `n`, sampled at its left edge, center and right edge: every
   * surface under each point, from the screen up. That is each ancestor, plus the siblings drawn
   * before it at every level (a card behind a title).
   */
  function backgrounds(p: Project, n: DesignNode): RGBA[] {
    // Sample under the glyphs, not the whole box: a short left-aligned title only covers its start.
    const at = absolute(p, n), pad = n.type === 'text' ? 0 : 14, longest = Math.max(...n.text.split('\n').map(line => line.length), 1);
    const run = Math.min(n.width - pad * 2, longest * n.fontSize * .52), start = n.textAlign === 'center' ? (n.width - run) / 2 : n.textAlign === 'right' ? n.width - pad - run : pad;
    return [start + Math.min(4, run / 4), start + run / 2, start + run - Math.min(4, run / 4)].map(offset => {
      const point = { x: at.x + offset, y: at.y + n.height / 2 };
      const covers = (k: DesignNode) => { const o = absolute(p, k); return point.x >= o.x && point.x <= o.x + k.width && point.y >= o.y && point.y <= o.y + k.height; };
      let result: RGBA = [255, 255, 255, 1];
      for (const layer of [n, ...ancestors(p, n.id)].reverse()) {
        const siblings = children(p, layer.parentId);
        for (const sibling of [...siblings.slice(0, siblings.indexOf(layer)).filter(k => !k.hidden && k.type !== 'text' && covers(k)), layer]) { const paint = paintAt(p, sibling, point); if (paint) result = over(paint, result); }
      }
      return result;
    });
  }
  function contrast(p: Project, n: DesignNode) {
    const foreground = parse(color(p, n.color, n)); if (foreground[3] === 0) return undefined;
    const worst = backgrounds(p, n).map(bg => { const text = over([foreground[0], foreground[1], foreground[2], foreground[3] * n.opacity / 100], bg); return { ratio: (Math.max(luminance(text), luminance(bg)) + .05) / (Math.min(luminance(text), luminance(bg)) + .05), bg, text }; }).sort((a, b) => a.ratio - b.ratio)[0];
    return worst;
  }

  const light = { ...input, theme: 'light' as const }, dark = { ...input, theme: 'dark' as const };
  for (const n of nodes) {
    const frame = frameOf(input, n.id), hasText = ['text', 'button', 'input'].includes(n.type) && !!n.text.trim();
    if (hasText) {
      const size = effectiveTheme(input, n).tokens.typography[n.typographyToken ?? '']?.fontSize ?? n.fontSize, weight = n.fontWeight;
      const large = size >= 24 || (size >= 18.5 && weight >= 700), need = large ? 3 : 4.5;
      const results = ([['light', light], ['dark', dark]] as const).map(([mode, p]) => ({ mode, found: contrast(p, n) }));
      const failing = results.filter(r => r.found && r.found.ratio < need - .005);
      for (const r of failing) {
        const both = failing.length === 2 && Math.abs(failing[0].found!.ratio - failing[1].found!.ratio) < .01;
        if (both && r.mode === 'dark') continue;
        add({ rule: 'contrast', severity: r.found!.ratio < 3 ? 'error' : 'warning', node: n.id, frame: frame?.id ?? null, ...(both ? {} : { mode: r.mode }),
          message: `${name(n)}: contraste ${r.found!.ratio.toFixed(2)}:1 entre ${toHex(r.found!.text)} y ${toHex(r.found!.bg)}${both ? '' : ` en modo ${r.mode === 'light' ? 'claro' : 'oscuro'}`}; se necesitan ${need}:1.`,
          // The advice depends on the cause: a token with a weak value, or a fixed color that ignores the mode.
          fix: n.color.startsWith('@') ? `El token ${n.color} no contrasta lo suficiente${both ? '' : ` en modo ${r.mode === 'light' ? 'claro' : 'oscuro'}`}: ajusta su valor en Temas (cambiará en todos los textos que lo usan) o elige otro token.`
            : `${n.color} es un color fijo y no cambia con el modo. Usa un token que contraste con este fondo en claro y en oscuro${n.type === 'text' ? ' (por ejemplo @text)' : ' (sobre el color de marca, por ejemplo @surface)'}.` });
      }
      if (size < 11) add({ rule: 'text-size', severity: 'warning', node: n.id, frame: frame?.id ?? null, message: `${name(n)}: texto de ${size} px, difícil de leer.`, fix: 'Sube el tamaño a 11 px o más; 12 px para texto secundario.' });
      // Estimate, not measurement: average glyph width of a sans-serif face.
      const inset = n.type === 'text' ? 0 : 28, perLine = Math.max(1, Math.floor((n.width - inset) / (size * .52))), lines = n.text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
      if (n.type === 'text' && lines * size * n.lineHeight > n.height + size * .6) add({ rule: 'text-fit', severity: 'info', node: n.id, frame: frame?.id ?? null, message: `${name(n)}: el texto necesita unas ${lines} líneas y la caja solo admite ${Math.max(1, Math.floor(n.height / (size * n.lineHeight)))}.`, fix: 'Aumenta el alto o el ancho de la caja, o acorta el texto.' });
    }
    if (interactive(n) && Math.min(n.width, n.height) < 44) add({ rule: 'target', severity: Math.min(n.width, n.height) < 32 ? 'error' : 'warning', node: n.id, frame: frame?.id ?? null, message: `${name(n)}: zona táctil de ${Math.round(n.width)} × ${Math.round(n.height)}; lo recomendado es 44 × 44 (48 en Android).`, fix: 'Amplía el elemento o envuélvelo en una zona táctil de al menos 44 × 44.' });
    if (frame && n.id !== frame.id) {
      const at = absolute(input, n), origin = absolute(input, frame), x = at.x - origin.x, y = at.y - origin.y;
      if (x + n.width > frame.width + 1 || y + n.height > frame.height + 1 || x < -1 || y < -1) add({ rule: 'overflow', severity: x >= frame.width || y >= frame.height || x + n.width <= 0 || y + n.height <= 0 ? 'error' : 'warning', node: n.id, frame: frame.id, message: `${name(n)}: sobresale de la pantalla y se recorta.`, fix: 'Muévelo o redúcelo para que quede dentro de la pantalla, o usa auto layout.' });
      const leaf = !children(input, n.id).length;
      if (leaf && frame.safeArea && (hasText || interactive(n)) && (y < frame.safeArea.top - 1 || y + n.height > frame.height - frame.safeArea.bottom + 1 || x < frame.safeArea.left - 1 || x + n.width > frame.width - frame.safeArea.right + 1))
        add({ rule: 'safe-area', severity: 'warning', node: n.id, frame: frame.id, message: `${name(n)}: queda bajo la barra de estado, la cámara o el indicador de inicio.`, fix: 'Colócalo dentro del área segura de la pantalla.' });
      if (leaf && frame.fold && (hasText || interactive(n))) {
        const vertical = frame.fold.axis === 'vertical', panels = panelsOf(frame), start = vertical ? x : y, end = start + (vertical ? n.width : n.height), length = vertical ? frame.width : frame.height;
        for (let hinge = 1; hinge < panels; hinge++) { const line = length * hinge / panels, half = Math.max(frame.fold.gap / 2, 4); if (start < line - half && end > line + half) add({ rule: 'hinge', severity: 'warning', node: n.id, frame: frame.id, message: `${name(n)}: cruza la línea del pliegue.`, fix: 'Muévelo a un solo panel o divide el contenido entre los dos lados.' }); }
      }
    }
  }

  // Colors that almost match a theme token, and elements that almost line up.
  for (const n of nodes) {
    const tokens = effectiveTheme(input, n).tokens.colors;
    for (const key of ['fill', 'color', 'stroke'] as const) {
      const value = n[key]; if (!/^#/.test(value) || (key === 'stroke' && !n.strokeWidth) || (key === 'fill' && (n.fillToken || n.gradient !== 'none'))) continue;
      const literal = parse(value); if (literal[3] < 1) continue;
      const match = Object.keys(tokens).map(id => ({ id, d: distance(literal, parse(color(input, `@${id}`, n))) })).sort((a, b) => a.d - b.d)[0];
      if (match && match.d <= 12) add({ rule: 'off-theme', severity: 'info', node: n.id, frame: frameId(n), message: `${name(n)}: ${value} es ${match.d < 1 ? 'idéntico' : 'casi idéntico'} al token @${match.id}, pero no está vinculado.`, fix: `Sustituye ${value} por @${match.id} para que cambie con el tema y el modo.` });
    }
  }
  const parents = new Set(nodes.map(n => n.parentId).filter((id): id is string => !!id));
  for (const parentId of parents) {
    const parent = input.nodes.find(n => n.id === parentId); if (!parent || parent.layout !== 'free') continue;
    const kids = children(input, parentId).filter(k => !k.hidden);
    for (const k of kids) {
      // Report the odd one out; when two columns tie, only the one that comes later.
      const at = (x: number) => kids.filter(q => Math.abs(q.x - x) < .01).length;
      const near = kids.find(o => o !== k && Math.abs(o.x - k.x) > .01 && Math.abs(o.x - k.x) <= 3 && (at(o.x) > at(k.x) || (at(o.x) === at(k.x) && kids.indexOf(o) < kids.indexOf(k))));
      if (near) add({ rule: 'alignment', severity: 'info', node: k.id, frame: frameId(k), message: `${name(k)}: su borde izquierdo está a ${Math.abs(near.x - k.x).toFixed(1).replace('.0', '')} px del de ${name(near)}.`, fix: `Alinea x a ${near.x} o usa auto layout en el contenedor.` });
    }
    const targets = kids.filter(interactive);
    for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i], b = targets[j], w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x), h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (w > 4 && h > 4) add({ rule: 'overlap', severity: 'warning', node: b.id, frame: frameId(b), message: `${name(b)} se superpone con ${name(a)}: dos acciones en el mismo punto.`, fix: 'Sepáralos al menos 8 px.' });
    }
  }
  // Scales: a screen with many near-identical sizes or radii reads as inconsistent.
  for (const frame of input.nodes.filter(n => n.type === 'frame' && visible(n) && inScope(n))) {
    const inside = nodes.filter(n => frameOf(input, n.id)?.id === frame.id && n.id !== frame.id);
    const sizes = [...new Set(inside.filter(n => ['text', 'button', 'input'].includes(n.type) && n.text.trim()).map(n => n.fontSize))].sort((a, b) => a - b);
    if (sizes.length > 7) add({ rule: 'scale', severity: 'info', node: frame.id, frame: frame.id, message: `${name(frame)}: ${sizes.length} tamaños de texto distintos (${sizes.join(', ')}).`, fix: 'Reduce a una escala de 4 a 6 tamaños y vincúlalos a tokens de tipografía.' });
    const radii = [...new Set(inside.filter(n => n.radius > 0 && n.type !== 'ellipse' && n.radius < Math.min(n.width, n.height) / 2).map(n => n.radius))].sort((a, b) => a - b);
    if (radii.length > 4) add({ rule: 'scale', severity: 'info', node: frame.id, frame: frame.id, message: `${name(frame)}: ${radii.length} radios distintos (${radii.join(', ')}).`, fix: 'Usa dos o tres radios y vincúlalos a tokens de radio.' });
  }
  // Accent as a chip background: a small element filled with a saturated warm accent (gold, amber, yellow) and dark
  // text on it reads as hazard signage, however good the contrast ratio. Large surfaces and icons are not the issue.
  for (const n of nodes) {
    if (n.type !== 'text' || !n.text.trim()) continue;
    const host = ancestors(input, n.id).find(a => a.type !== 'frame' && a.type !== 'group' ? parse(color(input, a.fill, a))[3] > .5 || a.gradient !== 'none' || !!a.fillToken : a.type === 'group' && parse(color(input, a.fill, a))[3] > .5);
    if (!host || host.width > 80 || host.height > 80) continue;
    for (const [mode, p] of [['light', light], ['dark', dark]] as const) {
      const paint = paintAt(p, host, { x: absolute(p, host).x + host.width / 2, y: absolute(p, host).y + host.height / 2 }); if (!paint || paint[3] < .9) continue;
      const fill = oklch(paint), text = oklch(parse(color(p, n.color, n)));
      if (fill.chroma >= .08 && fill.lightness >= .55 && fill.lightness <= .88 && fill.hue >= 40 && fill.hue <= 110 && text.lightness < .4) {
        add({ rule: 'accent-fill', severity: 'info', node: host.id, frame: frameId(host), mode, message: `${name(host)}: chip de ${Math.round(host.width)} × ${Math.round(host.height)} con el acento ${toHex(paint)} de fondo y texto oscuro encima${mode === 'dark' ? ' en modo oscuro' : ''}: contrasta, pero parece una señal de aviso.`, fix: 'En elementos pequeños el acento va como texto, icono o borde, o como tinte (12–15 % sobre la superficie) con el texto en el acento oscurecido. El acento sólido con texto encima queda para la acción principal y las superficies grandes.' });
        break;
      }
    }
  }
  // Gradients: a ramp that passes through olive or khaki (a warm hue with little chroma at mid-to-low lightness)
  // reads as mud, whether that tone is one of the stops or the halfway point between a dark neutral and a gold.
  const muddy = (c: RGBA) => { const o = oklch(c); return o.hue >= 70 && o.hue <= 130 && o.chroma >= .03 && o.chroma < .09 && o.lightness >= .18 && o.lightness <= .55; };
  for (const n of nodes) {
    if (n.type === 'text' || n.type === 'frame') continue;
    for (const [mode, p] of [['light', light], ['dark', dark]] as const) {
      const tokens = effectiveTheme(p, n).tokens, token = n.fillToken && Object.hasOwn(tokens.gradients, n.fillToken) ? tokens.gradients[n.fillToken] : undefined;
      const stops = token?.stops ?? (n.gradient !== 'none' ? n.gradientStops ?? [{ color: n.fill, position: 0 }, { color: n.gradientEnd, position: 100 }] : undefined);
      if (!stops || stops.length < 2) continue;
      const colors = stops.map(stop => parse(color(p, stop.color, n))); if (colors.some(c => c[3] < 1)) continue;
      const samples = colors.flatMap((c, i) => i ? [[0, 1, 2, 3].map(k => (colors[i - 1][k] + c[k]) / 2) as RGBA, c] : [c]);
      const mud = samples.find(muddy); if (!mud) continue;
      add({ rule: 'gradient', severity: 'warning', node: n.id, frame: frameId(n), mode, message: `${name(n)}: el degradado pasa por ${toHex(mud)}${mode === 'dark' ? ' en modo oscuro' : ''}, un tono oliva: un neutro oscuro y un acento cálido no se funden, se embarran.`, fix: 'Haz el degradado con tonos de un mismo color (oro claro a oro oscuro, negro a gris carbón) o separa el negro y el oro con una línea o un borde; el acento metálico va en texto, líneas y aros.' });
      break;
    }
  }
  // Docs: a documented component that changed afterwards, or notes written for a theme that has since changed.
  if (!options.frame) {
    for (const c in Object.fromEntries(input.components.filter(docStale).map(c => [c.id, c]))) {
      const comp = input.components.find(x => x.id === c)!, master = input.nodes.find(n => n.id === comp.masterId);
      add({ rule: 'docs', severity: 'info', node: master?.id ?? comp.id, frame: master ? frameOf(input, master.id)?.id ?? null : null, message: `«${comp.setName ?? comp.name}»: el componente cambió después de documentarse; revisa su ficha en Sistema.`, fix: 'Actualiza component.doc (description, why, when, how, do, dont) o envía {} para marcarla como revisada si sigue siendo válida.' });
    }
    if (designSystemStale(input)) add({ rule: 'docs', severity: 'info', node: input.activeThemeId, frame: null, message: 'El tema cambió después de escribir los fundamentos del sistema; revisa Color, Tipografía y Espaciado en Sistema.', fix: 'Actualiza designSystem.set o envía {} para marcar los fundamentos como revisados.' });
  }
  // Palette: a theme whose primary color is a muddy mid tone neither reads as an accent nor anchors as a dark
  // neutral; the whole design ends up as one tonal band. Checked per theme in use, in both modes.
  const themeIds = new Set(input.nodes.filter(n => n.type === 'frame' && visible(n) && inScope(n)).map(n => n.themeId ?? input.activeThemeId));
  for (const id of themeIds) {
    const theme = input.designThemes[id]; if (!theme) continue;
    for (const mode of ['light', 'dark'] as const) {
      const colors = theme.modes[mode].colors, primary = parse(colors.primary), bg = parse(colors.background);
      if (primary[3] < 1 || bg[3] < 1) continue;
      const ratio = contrastRatio(colors.primary, colors.background), { chroma, lightness } = oklch(primary), label = mode === 'light' ? 'claro' : 'oscuro';
      if (ratio < 3) add({ rule: 'palette', severity: 'error', node: id, frame: null, mode, message: `Tema «${theme.name}», modo ${label}: @primary ${colors.primary} contrasta solo ${ratio.toFixed(1)}:1 con @background, así que la acción principal no se distingue del fondo.`, fix: 'Elige un color principal con al menos 3:1 frente al fondo en ambos modos.' });
      else if (chroma < .08 && lightness > .3 && lightness < .85) add({ rule: 'palette', severity: 'warning', node: id, frame: null, mode, message: `Tema «${theme.name}», modo ${label}: @primary ${colors.primary} es un tono apagado (croma ${chroma.toFixed(2)}): ni destaca como acento ni ancla como neutro oscuro, y toda la paleta se lee como una sola banda.`, fix: 'Usa un acento con más saturación o un neutro realmente oscuro como color principal y deja los tonos tierra o grises para superficies.' });
      // A neutral primary (black or white buttons) is a valid anchor only if some other token carries the color.
      else if (chroma < .08 && parse(colors.accent)[3] === 1 && oklch(parse(colors.accent)).chroma < .08) add({ rule: 'palette', severity: 'warning', node: id, frame: null, mode, message: `Tema «${theme.name}», modo ${label}: @primary ${colors.primary} es un neutro y @accent ${colors.accent} tampoco tiene color (croma ${oklch(parse(colors.accent)).chroma.toFixed(2)}): la paleta es monocroma sin ningún acento.`, fix: 'Si el ancla es negra o blanca, @accent debe llevar el color de la marca (un oro, un azul, un verde) con croma suficiente; un marrón o gris apagado no cuenta.' });
    }
  }
  const order = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}
export function lintSummary(issues: LintIssue[]) {
  const count = (severity: LintIssue['severity']) => issues.filter(issue => issue.severity === severity).length;
  return { errors: count('error'), warnings: count('warning'), notes: count('info'), byRule: Object.fromEntries(Object.keys(lintRules).map(rule => [rule, issues.filter(issue => issue.rule === rule).length]).filter(([, n]) => n)) };
}
