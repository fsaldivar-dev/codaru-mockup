import { defaultDesignTheme, effectiveTheme, resolveColor, safeColor, validateDesignThemes, validateNodeThemeRefs, type DesignTheme } from './themes';
import { isIconReference } from './icon-data';
import { deviceSkins } from './devices';
import { isSanitizedSVG, validateAnimations, validateTransition, vectorLayers, type NodeAnimation, type Transition } from './motion';
export type Kind = 'frame' | 'rect' | 'ellipse' | 'text' | 'button' | 'input' | 'card' | 'group' | 'image' | 'icon' | 'vector';
export type Layout = 'free' | 'vertical' | 'horizontal';
export type Theme = 'light' | 'dark';
export interface DesignNode {
  id: string; type: Kind; name: string; parentId: string | null;
  x: number; y: number; width: number; height: number;
  fill: string; color: string; stroke: string; strokeWidth: number;
  radius: number; radiusTR?: number; radiusBR?: number; radiusBL?: number;
  opacity: number; shadow: boolean;
  gradient: 'none' | 'linear' | 'radial'; gradientEnd: string; gradientAngle: number;
  /** Custom gradient with any number of stops. Without it, fill and gradientEnd are the two stops. */
  gradientStops?: Array<{ color: string; position: number }>;
  text: string; fontSize: number; fontWeight: number; fontFamily: string; lineHeight: number;
  textAlign: 'left' | 'center' | 'right';
  layout: Layout; padding: number; gap: number; sizing: 'fixed' | 'fill';
  /** Auto layout refinements; absent means the defaults: uniform padding, start, stretch, one line, fixed size. */
  paddingSides?: { top: number; right: number; bottom: number; left: number };
  /** Distribution along the layout direction. */
  justify?: 'start' | 'center' | 'end' | 'between';
  /** Alignment across the layout direction; stretch resizes the children. */
  align?: 'stretch' | 'start' | 'center' | 'end';
  /** Continue on a new line or column when the children do not fit. */
  wrap?: boolean;
  /** Resize the container to its content. */
  hugWidth?: boolean; hugHeight?: boolean;
  /** Limits applied when a parent's auto layout resizes this element. */
  minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number;
  hidden: boolean; locked: boolean; targetId: string | null;
  image: string;
  iconPack?: string; iconName?: string;
  componentId?: string; instanceOf?: string; componentKey?: string; overrides?: string[];
  /** Page a root node belongs to; ignored on nested nodes. */
  page?: string;
  /** What a top-level frame is for: a screen of the product, an annotation (labels, legends) or a component library sheet. Defaults to screen when it has a device, annotation otherwise. */
  role?: FrameRole;
  fillToken?: string; materialToken?: string; typographyToken?: string; radiusToken?: string;
  themeId?: string; themeMode?: 'inherit' | Theme; kitId?: string;
  /** Sanitized SVG of an illustration (type vector). */
  svg?: string;
  /** Keyframe animations, played in the prototype only. */
  animations?: NodeAnimation[];
  /** How the prototype moves to targetId. */
  transition?: Transition;
  /** Device preset a screen was sized from (see devices.ts); informative. */
  device?: string;
  /** Hinge of a foldable screen: where it runs and how wide the physical gap is. */
  /** Hinges of a foldable screen; three panels have two hinges. */
  fold?: { axis: 'vertical' | 'horizontal'; gap: number; panels?: 2 | 3 };
  /** Screen of the same design in the other posture (folded or unfolded); the prototype can switch between them. */
  foldPair?: string;
  /** Space reserved by the system on a screen. */
  safeArea?: { top: number; right: number; bottom: number; left: number };
  /** Device frame of a screen; an id of deviceSkins. */
  skin?: string;
}
export interface Component {
  id: string; name: string; masterId: string; template: DesignNode[];
  /** Variant set this definition belongs to, its display name and this member's axis values (Estado=Activo, Tamaño=M). */
  set?: string; setName?: string; variant?: Record<string, string>;
  /** Design-system notes: when to use it, good and bad practice. Shared by every member of a set. */
  doc?: ComponentDoc;
  /** Signature of the template when the notes were last saved; a different signature means the notes may be stale. */
  docHash?: string;
}
/** A component page answers four questions: what it is, why, when and how. Guideline lines may end in `[ejemplo: ID]` to show a layer of the document beside them. */
export interface ComponentDoc { description?: string; why?: string; when?: string; how?: string; do?: string; dont?: string; /** Older documents: when + why in one field. */ usage?: string; }
/** The design system's narrative and foundations: what the product is, why the brand works for it, the principles, and one note per foundation. */
export interface DesignSystemNotes { summary?: string; brand?: string; principles?: string; color?: string; typography?: string; spacing?: string; motion?: string; voice?: string; }
export interface Project {
  format: 'codaru-mockup'; version: 2; name: string;
  theme: Theme; themes: Record<Theme, Record<string, string>>;
  designThemes: Record<string, DesignTheme>; activeThemeId: string;
  nodes: DesignNode[]; components: Component[];
  designSystem?: DesignSystemNotes;
  /** Signature of the active theme when the notes were last saved. */
  designSystemHash?: string;
  /** Pages (modules) group root nodes; only the active page is drawn. Documents without pages get one called «Página 1». */
  pages?: Page[]; activePageId?: string;
  /** Named snapshots of the design, compressed, kept inside the document. */
  versions?: Version[];
}
export type FrameRole = 'screen' | 'annotation' | 'library';
export const frameRoles: FrameRole[] = ['screen', 'annotation', 'library'];
/** Role of a frame: explicit, or inferred (screens carry a device). Nested frames take their root's role. */
export function roleOf(p: Project, n: DesignNode): FrameRole { const root = n.parentId ? ancestors(p, n.id).at(-1) ?? n : n; return root.role ?? (root.device ? 'screen' : 'annotation'); }
/** Screen frames of a validated document in reading order: page by page, then top to bottom and left to right. The public `screens(document)` validates and adds role and page. */
export function screenFrames(p: Project): DesignNode[] { return pagesOf(p).flatMap(page => rootsOnPage(p, page.id).filter(n => n.type === 'frame' && !n.hidden && roleOf(p, n) === 'screen').sort((a, b) => Math.round(a.y / 200) - Math.round(b.y / 200) || a.x - b.x)); }
export type ScreenInfo = DesignNode & { role: FrameRole; page: string };
/** Parse JSON text or take an object, and validate it as a design document. */
export function parseDocument(document: unknown): Project {
  let parsed = document;
  if (typeof document === 'string') { try { parsed = JSON.parse(document); } catch { throw new Error('El archivo no es un diseño de Codaru: no contiene JSON válido.'); } }
  return validate(parsed);
}
/**
 * Screens of a document in reading order, page by page. Each keeps its node id, which never changes
 * when screens are reordered, moved or renamed; use it in `pantalla:` and in `renderScreenToSVG`.
 * Accepts JSON text or an object and validates it; returns copies with `role` and `page` resolved.
 */
export function screens(document: unknown): ScreenInfo[] {
  const p = parseDocument(document), fallback = defaultPageId(p);
  return screenFrames(p).map(n => ({ ...n, role: roleOf(p, n), page: n.page ?? fallback }));
}
export interface Page { id: string; name: string; }
export interface Version { id: string; name: string; at: string; note?: string; /** gzip + base64 of the version payload */ data: string; screens: number; nodes: number; }
export const PAGE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export function pagesOf(p: Project): Page[] { return p.pages?.length ? p.pages : [{ id: 'pagina-1', name: 'Página 1' }]; }
export function activePage(p: Project): Page { const pages = pagesOf(p); return pages.find(page => page.id === p.activePageId) ?? pages[0]; }
/** Roots without pageId belong to «principal» when it exists, else to the first page; validate() stamps them so reordering pages never moves screens. */
export function defaultPageId(p: Project) { const pages = pagesOf(p); return (pages.find(page => page.id === 'pagina-1') ?? pages.find(page => page.id === 'principal') ?? pages[0]).id; }
export function rootsOnPage(p: Project, pageId: string) { const fallback = defaultPageId(p); return p.nodes.filter(n => n.parentId === null && (n.page ?? fallback) === pageId); }
/** The id of the top-level ancestor of every node, in one pass. */
export function rootIds(p: Project): Map<string, string> {
  const parent = new Map(p.nodes.map(n => [n.id, n.parentId])), roots = new Map<string, string>();
  const top = (id: string): string => { const cached = roots.get(id); if (cached) return cached; const up = parent.get(id); const value = up ? top(up) : id; roots.set(id, value); return value; };
  for (const n of p.nodes) top(n.id);
  return roots;
}
/** The document as seen from one page: its roots and their descendants, everything else left out. */
export function pageView(p: Project, pageId: string): Project {
  const fallback = defaultPageId(p), tops = rootIds(p), byId = new Map(p.nodes.map(n => [n.id, n]));
  return { ...p, nodes: p.nodes.filter(n => { const root = byId.get(tops.get(n.id)!); return !!root && (root.page ?? fallback) === pageId; }) };
}
export function addPage(p: Project, name: string, id?: string): Page {
  const pages = [...pagesOf(p)], clean = (name ?? '').trim().slice(0, 60) || `Página ${pages.length + 1}`;
  let pageId = id ?? `pagina-${uid().slice(0, 8)}`; if (!PAGE_ID.test(pageId)) throw new Error('ID de página inválido');
  if (pages.some(page => page.id === pageId)) throw new Error('Ya existe una página con ese id');
  const fallback = defaultPageId(p);
  for (const n of p.nodes) if (n.parentId === null && !n.page) n.page = fallback;
  const page = { id: pageId, name: clean }; p.pages = [...pages, page]; return page;
}
export function renamePage(p: Project, id: string, name: string) { const pages = [...pagesOf(p)], page = pages.find(page => page.id === id); if (!page) throw new Error('Página no encontrada'); const clean = (name ?? '').trim().slice(0, 60); if (!clean) throw new Error('Nombre de página vacío'); page.name = clean; p.pages = pages; }
/** A page can go only when nothing lives on it; its screens must be moved or deleted first. */
/** Remove a page; with `moveTo` its roots move to that page first, otherwise it must be empty. */
export function removePage(p: Project, id: string, moveTo?: string) {
  const pages = pagesOf(p); if (!pages.some(page => page.id === id)) throw new Error('Página no encontrada'); if (pages.length === 1) throw new Error('El documento necesita al menos una página');
  if (moveTo !== undefined) { if (moveTo === id || !pages.some(page => page.id === moveTo)) throw new Error('moveTo debe ser otra página existente'); for (const n of rootsOnPage(p, id)) n.page = moveTo; }
  const left = rootsOnPage(p, id).length; if (left) throw new Error(`La página tiene ${left} ${left === 1 ? 'elemento' : 'elementos'}: indica moveTo con la página de destino, o muévelos o elimínalos antes`);
  p.pages = pages.filter(page => page.id !== id); if (p.activePageId === id) p.activePageId = p.pages[0].id;
}
export function movePage(p: Project, id: string, index: number) { const pages = [...pagesOf(p)], i = pages.findIndex(page => page.id === id); if (i < 0) throw new Error('Página no encontrada'); const [page] = pages.splice(i, 1); pages.splice(Math.max(0, Math.min(pages.length, index)), 0, page); p.pages = pages; }

// Versions: the whole design (not the version list) packed with gzip into one string.
const VERSION_KEYS = ['name', 'theme', 'themes', 'designThemes', 'activeThemeId', 'nodes', 'components', 'designSystem', 'designSystemHash', 'pages', 'activePageId'] as const;
async function pipeString(text: string, stream: GenericTransformStream) { const chunks: Uint8Array[] = []; const reader = new Blob([text]).stream().pipeThrough(stream).getReader(); for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); } const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0)); let offset = 0; for (const c of chunks) { out.set(c, offset); offset += c.length; } return out; }
const toBase64 = (bytes: Uint8Array) => { let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const fromBase64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));
export async function packVersion(p: Project): Promise<string> {
  const payload = Object.fromEntries(VERSION_KEYS.filter(k => p[k] !== undefined).map(k => [k, p[k]]));
  return toBase64(await pipeString(JSON.stringify(payload), new CompressionStream('gzip')));
}
export async function unpackVersion(data: string): Promise<Partial<Project>> {
  const bytes = fromBase64(data), chunks: Uint8Array[] = []; const reader = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
  const text = new TextDecoder().decode(await new Blob(chunks as unknown as BlobPart[]).arrayBuffer()), payload = JSON.parse(text) as Partial<Project>;
  if (!Array.isArray(payload.nodes) || !Array.isArray(payload.components)) throw new Error('Versión dañada');
  return payload;
}
/** Build a version of the current design; the caller stores it inside a commit. */
export async function buildVersion(p: Project, name: string, note?: string): Promise<Version> {
  const clean = (name ?? '').trim().slice(0, 80) || `Versión ${(p.versions?.length ?? 0) + 1}`;
  return { id: `v-${uid().slice(0, 8)}`, name: clean, at: new Date().toISOString(), ...(note?.trim() ? { note: note.trim().slice(0, 2000) } : {}), data: await packVersion(p), screens: p.nodes.filter(n => n.type === 'frame').length, nodes: p.nodes.length };
}
export function addVersion(p: Project, version: Version) { const list = [...(p.versions ?? []), version]; if (list.length > 30) throw new Error('Máximo 30 versiones por documento: elimina alguna antes'); p.versions = list; }
export function removeVersion(p: Project, id: string) { if (!p.versions?.some(v => v.id === id)) throw new Error('Versión no encontrada'); p.versions = p.versions.filter(v => v.id !== id); if (!p.versions.length) delete p.versions; }
/** Replace the design with a version's payload, keeping the version list itself. */
export function applyVersion(p: Project, payload: Partial<Project>) {
  const versions = p.versions;
  for (const key of VERSION_KEYS) { if (payload[key] !== undefined) (p as unknown as Record<string, unknown>)[key] = clone(payload[key]); else if (key !== 'name' && key !== 'nodes' && key !== 'components') delete (p as unknown as Record<string, unknown>)[key]; }
  if (versions) p.versions = versions;
}
/** What changed between a version payload and the current design, by screen. */
export function compareVersion(current: Project, payload: Partial<Project>) {
  const sig = (p: Project, frame: DesignNode) => signature(subtree(p, frame.id).map(n => [n.id, n.type, n.name, n.text, n.x, n.y, n.width, n.height, n.fill, n.color, n.radius, n.fontSize]));
  const old = { ...current, nodes: payload.nodes ?? [], components: payload.components ?? [] } as Project;
  const oldFrames = new Map(old.nodes.filter(n => n.type === 'frame').map(n => [n.id, n])), newFrames = new Map(current.nodes.filter(n => n.type === 'frame').map(n => [n.id, n]));
  const added = [...newFrames.values()].filter(n => !oldFrames.has(n.id)).map(n => n.name), removed = [...oldFrames.values()].filter(n => !newFrames.has(n.id)).map(n => n.name);
  const changed = [...newFrames.values()].filter(n => oldFrames.has(n.id) && sig(current, n) !== sig(old, oldFrames.get(n.id)!)).map(n => n.name);
  return { added, removed, changed, nodesBefore: old.nodes.length, nodesAfter: current.nodes.length };
}
export const tokens = ['primary', 'surface', 'background', 'text', 'muted', 'border', 'accent'] as const;
export const labels: Record<Kind, string> = { frame: 'Pantalla', rect: 'Rectángulo', ellipse: 'Elipse', text: 'Texto', button: 'Botón', input: 'Campo', card: 'Tarjeta', group: 'Grupo', image: 'Imagen', icon: 'Icono', vector: 'Ilustración' };
export const containerKinds: Kind[] = ['frame', 'card', 'group'];
export function uid() { return crypto.randomUUID(); }
export function clone<T>(v: T): T { return structuredClone(v); }
export function node(type: Kind, patch: Partial<DesignNode> = {}): DesignNode {
  return {
    id: uid(), type, name: labels[type], parentId: null, x: 0, y: 0,
    width: type === 'icon' ? 24 : type === 'frame' ? 390 : type === 'text' ? 230 : type === 'vector' ? 160 : 180,
    height: type === 'icon' ? 24 : type === 'frame' ? 660 : type === 'text' ? 40 : type === 'card' || type === 'vector' ? 160 : 48,
    fill: type === 'text' || type === 'group' || type === 'icon' || type === 'vector' ? 'transparent' : type === 'button' || type === 'rect' || type === 'ellipse' ? '@primary' : '@surface',
    color: type === 'button' ? '#ffffff' : '@text', stroke: '@border', strokeWidth: type === 'input' || type === 'card' ? 1 : 0,
    radius: type === 'frame' || type === 'text' || type === 'group' || type === 'icon' || type === 'vector' ? 0 : type === 'card' ? 16 : 10,
    opacity: 100, shadow: false, gradient: 'none', gradientEnd: '#a78bfa', gradientAngle: 135,
    text: type === 'button' ? 'Continuar' : type === 'input' ? 'Escribe aquí…' : type === 'text' ? 'Tu texto aquí' : '',
    fontSize: 16, fontWeight: type === 'button' ? 600 : 400, fontFamily: 'system', lineHeight: 1.4,
    textAlign: type === 'button' ? 'center' : 'left', layout: 'free', padding: 20, gap: 16, sizing: 'fixed',
    hidden: false, locked: false, targetId: null, image: '', ...(type === 'icon' ? { iconPack: 'web', iconName: 'home' } : {}), ...patch,
  };
}
export function blank(): Project {
  const theme = defaultDesignTheme();
  return { format: 'codaru-mockup', version: 2, name: 'Mi primer mockup', theme: 'light',
    themes: { light: { ...theme.modes.light.colors }, dark: { ...theme.modes.dark.colors } },
    designThemes: { project: theme }, activeThemeId: 'project', nodes: [], components: [] };
}
export function color(p: Project, value: string, n?: DesignNode): string { return resolveColor(p, value, n); }
/** Number of panels of a screen: 1 when it has no hinge. */
export const panelsOf = (n: DesignNode) => n.fold ? n.fold.panels ?? 2 : 1;
/** Screens showing the same design in other postures, linked through foldPair, from most folded to most open. */
export function postureGroup(p: Project, id: string): DesignNode[] {
  const frames = p.nodes.filter(n => n.type === 'frame'), group = new Set([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const n of frames) if (!group.has(n.id) ? (n.foldPair !== undefined && group.has(n.foldPair)) : (n.foldPair !== undefined && !group.has(n.foldPair) && frames.some(f => f.id === n.foldPair))) { group.add(group.has(n.id) ? n.foldPair! : n.id); grew = true; }
  }
  return frames.filter(n => group.has(n.id)).sort((a, b) => panelsOf(a) - panelsOf(b) || a.width - b.width);
}
export function children(p: Project, parentId: string | null) { return p.nodes.filter(n => n.parentId === parentId); }
export function subtree(p: Project, id: string): DesignNode[] {
  const n = p.nodes.find(n => n.id === id); if (!n) return [];
  return [n, ...children(p, id).flatMap(c => subtree(p, c.id))];
}
export function ancestors(p: Project, id: string): DesignNode[] {
  const result: DesignNode[] = []; let n = p.nodes.find(n => n.id === id);
  while (n?.parentId) { n = p.nodes.find(x => x.id === n!.parentId); if (n) result.push(n); }
  return result;
}
export function frameOf(p: Project, id: string) { const n = p.nodes.find(n => n.id === id); return n?.type === 'frame' ? n : ancestors(p, id).find(n => n.type === 'frame'); }
export function topSelected(p: Project, ids: string[]) { return ids.filter(id => !ancestors(p, id).some(n => ids.includes(n.id))); }
export function absolute(p: Project, n: DesignNode) { return ancestors(p, n.id).reduce((a, x) => ({ x: a.x + x.x, y: a.y + x.y }), { x: n.x, y: n.y }); }
export function isUnavailable(p: Project, n: DesignNode) { return n.hidden || n.locked || ancestors(p, n.id).some(a => a.hidden || a.locked); }
export function updateNode(p: Project, id: string, patch: Partial<DesignNode>) {
  const n = p.nodes.find(n => n.id === id); if (!n) throw new Error('Elemento no encontrado');
  if (n.instanceOf || n.componentKey) n.overrides = [...new Set([...(n.overrides || []), ...Object.keys(patch).filter(k => !['id', 'overrides'].includes(k))])];
  Object.assign(n, patch);
}
/** Arrange the visible children of one auto layout container, and resize it when it hugs its content. */
export function layoutNode(p: Project, n: DesignNode, kidsOf?: Map<string | null, DesignNode[]>) {
  if (n.layout === 'free') return;
  const kids = (kidsOf ? kidsOf.get(n.id) ?? [] : children(p, n.id)).filter(k => !k.hidden); if (!kids.length) return;
  const vert = n.layout === 'vertical', pad = n.paddingSides ?? { top: n.padding, right: n.padding, bottom: n.padding, left: n.padding };
  const main = vert ? 'height' : 'width', cross = vert ? 'width' : 'height', at = vert ? 'y' : 'x', across = vert ? 'x' : 'y';
  const start = vert ? pad.top : pad.left, end = vert ? pad.bottom : pad.right, crossStart = vert ? pad.left : pad.top, crossEnd = vert ? pad.right : pad.bottom;
  const limit = (k: DesignNode, key: 'width' | 'height', value: number) => Math.max(key === 'width' ? k.minWidth ?? 16 : k.minHeight ?? 16, Math.min(key === 'width' ? k.maxWidth ?? Infinity : k.maxHeight ?? Infinity, value));
  const hugMain = vert ? n.hugHeight : n.hugWidth, hugCross = vert ? n.hugWidth : n.hugHeight, align = n.align ?? 'stretch', wrap = !!n.wrap && !hugMain;
  if (hugMain) n[main] = Math.max(1, start + end + kids.reduce((sum, k) => sum + k[main], 0) + (kids.length - 1) * n.gap);
  const inner = Math.max(16, n[main] - start - end);
  // Lines: one, unless wrapping breaks the children when the next one does not fit.
  const lines: DesignNode[][] = [[]];
  for (const k of kids) {
    const line = lines.at(-1)!, used = line.reduce((sum, item) => sum + item[main] + n.gap, 0);
    if (wrap && line.length && used + k[main] > inner + .01) lines.push([k]); else line.push(k);
  }
  const lineSizes = lines.map(line => Math.max(...line.map(k => k[cross])));
  if (hugCross) n[cross] = Math.max(1, crossStart + crossEnd + lineSizes.reduce((sum, size) => sum + size, 0) + (lines.length - 1) * n.gap);
  const innerCross = Math.max(16, n[cross] - crossStart - crossEnd);
  let offset = crossStart;
  lines.forEach((line, index) => {
    const lineCross = lines.length === 1 ? innerCross : lineSizes[index], fills = line.filter(k => k.sizing === 'fill'), gaps = (line.length - 1) * n.gap;
    const available = Math.max(16, inner - gaps), fixed = line.filter(k => k.sizing !== 'fill').reduce((sum, k) => sum + k[main], 0);
    for (const k of fills) k[main] = limit(k, main, (available - fixed) / fills.length);
    const free = fills.length ? 0 : Math.max(0, inner - gaps - fixed), justify = n.justify ?? 'start';
    let pos = start + (justify === 'center' ? free / 2 : justify === 'end' ? free : 0);
    const gap = n.gap + (justify === 'between' && line.length > 1 ? free / (line.length - 1) : 0);
    for (const k of line) {
      if (align === 'stretch') k[cross] = limit(k, cross, lineCross);
      k[at] = pos; k[across] = offset + (align === 'center' ? (lineCross - k[cross]) / 2 : align === 'end' ? lineCross - k[cross] : 0);
      pos += k[main] + gap;
    }
    offset += lineCross + n.gap;
  });
}
/** Children grouped by parent in one pass; hot paths use it instead of filtering the node list per node. */
export function childrenIndex(p: Project): Map<string | null, DesignNode[]> {
  const kids = new Map<string | null, DesignNode[]>();
  for (const n of p.nodes) { const list = kids.get(n.parentId); if (list) list.push(n); else kids.set(n.parentId, [n]); }
  return kids;
}
export function layoutProject(p: Project) {
  const kidsOf = childrenIndex(p);
  function apply(n: DesignNode) {
    const kids = (kidsOf.get(n.id) ?? []).filter(k => !k.hidden);
    // Containers that hug their content know their size before the parent arranges them.
    for (const k of kids) if (k.layout !== 'free' && (k.hugWidth || k.hugHeight)) apply(k);
    layoutNode(p, n, kidsOf);
    for (const k of kids) apply(k);
  }
  for (const n of kidsOf.get(null) ?? []) apply(n);
}
export function createComponent(p: Project, id: string) {
  const root = p.nodes.find(n => n.id === id); if (!root || root.type === 'frame') throw new Error('Selecciona un elemento o grupo dentro de una pantalla');
  if (root.instanceOf || ancestors(p, id).some(n => n.instanceOf || n.componentId) || subtree(p, id).some(n => n.componentId || n.instanceOf)) throw new Error('Los componentes anidados quedan fuera de esta versión');
  const c: Component = { id: uid(), name: root.name, masterId: id, template: [] }; root.componentId = c.id;
  p.components.push(c); syncComponents(p); return c;
}
export function instantiate(p: Project, componentId: string, parentId: string | null, x: number, y: number): string {
  const c = p.components.find(c => c.id === componentId); if (!c) throw new Error('Componente no encontrado');
  const map = new Map(c.template.map(n => [n.id, uid()]));
  for (const src of c.template) {
    const n = clone(src); n.id = map.get(src.id)!; n.componentKey = src.id; delete n.componentId;
    n.parentId = src.id === c.template[0].id ? parentId : map.get(src.parentId!)!;
    if (src.id === c.template[0].id) { n.instanceOf = c.id; n.x = x; n.y = y; n.name = c.name; }
    p.nodes.push(n);
  }
  return map.get(c.template[0].id)!;
}
export function syncComponents(p: Project) {
  for (const c of p.components) {
    const master = p.nodes.find(n => n.id === c.masterId && n.componentId === c.id);
    if (master) { c.name = master.name; c.template = clone(subtree(p, master.id)); c.template[0].parentId = null; c.template[0].x = 0; c.template[0].y = 0; for (const n of c.template) { delete n.componentId; delete n.overrides; } }
    for (const instance of p.nodes.filter(n => n.instanceOf === c.id)) {
      const existing = subtree(p, instance.id); const rootKey = c.template[0].id;
      const map = new Map(c.template.map(src => [src.id, src.id === rootKey ? instance.id : existing.find(n => n.componentKey === src.id)?.id || uid()]));
      const rebuilt = c.template.map(src => {
        const old = existing.find(n => n.id === map.get(src.id)); const fresh = clone(src);
        fresh.id = map.get(src.id)!; fresh.componentKey = src.id; delete fresh.componentId;
        fresh.parentId = src.id === rootKey ? instance.parentId : map.get(src.parentId!)!;
        if (old) { for (const key of old.overrides || []) if (!['id', 'componentId', 'componentKey', 'instanceOf', 'parentId'].includes(key)) (fresh as unknown as Record<string, unknown>)[key] = (old as unknown as Record<string, unknown>)[key]; fresh.overrides = old.overrides; }
        if (src.id === rootKey) { fresh.x = instance.x; fresh.y = instance.y; fresh.instanceOf = c.id; }
        return fresh;
      });
      const ids = new Set(existing.map(n => n.id)); const insertion = p.nodes.findIndex(n => n.id === instance.id);
      p.nodes = p.nodes.filter(n => !ids.has(n.id)); p.nodes.splice(insertion, 0, ...rebuilt);
    }
  }
}
const variantText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 40 && !/[=,]/.test(value);
export function cleanVariant(variant: unknown): Record<string, string> {
  if (!variant || typeof variant !== 'object' || Array.isArray(variant)) throw new Error('Variante inválida: usa {eje: valor}');
  const entries = Object.entries(variant as Record<string, unknown>);
  if (!entries.length || entries.length > 6) throw new Error('Una variante tiene entre 1 y 6 ejes');
  for (const [axis, value] of entries) if (!variantText(axis) || !variantText(value) || ['__proto__', 'constructor', 'prototype'].includes(axis)) throw new Error('Ejes y valores de variante: texto de 1 a 40 caracteres, sin "=" ni ","');
  return Object.fromEntries(entries.map(([axis, value]) => [axis.trim(), (value as string).trim()]));
}
const NOTE_KEYS = { designSystem: ['summary', 'brand', 'principles', 'color', 'typography', 'spacing', 'motion', 'voice'], doc: ['description', 'why', 'when', 'how', 'do', 'dont', 'usage'] } as const;
/** Merge free-text notes: strings up to 4000 characters, null or empty removes a field, nothing else gets in. */
export function mergeNotes<T extends object>(current: T | undefined, patch: unknown, kind: keyof typeof NOTE_KEYS): T | undefined {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Se esperaba un objeto con textos');
  const next: Record<string, string> = { ...(current ?? {}) } as Record<string, string>;
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (!(NOTE_KEYS[kind] as readonly string[]).includes(key)) throw new Error(`Campo desconocido: ${key}. Admitidos: ${NOTE_KEYS[kind].join(', ')}`);
    if (value === null || value === '' || value === undefined) { delete next[key]; continue; }
    if (typeof value !== 'string' || value.length > 4000) throw new Error(`${key} debe ser texto de hasta 4000 caracteres`);
    next[key] = value;
  }
  return Object.keys(next).length ? next as unknown as T : undefined;
}
/** Small stable hash (FNV-1a) so documents can tell whether a component or theme changed after being documented. */
export function signature(value: unknown): string { const text = JSON.stringify(value); let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
export const templateSignature = (c: Component) => signature(c.template.map(n => [n.type, n.name, n.text, n.fill, n.color, n.stroke, n.strokeWidth, Math.round(n.width), Math.round(n.height), n.radius, n.fontSize, n.fontWeight, n.fontFamily, n.layout, n.gap, n.padding, n.opacity, n.shadow, n.gradient, n.svg?.length ?? 0, n.animations?.length ?? 0, n.iconName]));
export const themeSignature = (p: Project) => { const t = p.designThemes[p.activeThemeId]; return signature(t ? [t.id, t.modes.light.colors, t.modes.dark.colors, t.modes.light.typography, t.modes.light.radii, Object.keys(t.modes.light.gradients)] : null); };
/** True when the component changed after its notes were written. */
export const docStale = (c: Component) => !!c.doc && !!c.docHash && c.docHash !== templateSignature(c);
export const designSystemStale = (p: Project) => !!p.designSystem && !!p.designSystemHash && p.designSystemHash !== themeSignature(p);
/** Saving notes, even an empty patch, stamps them as current for the theme as it is now. */
export const setDesignSystemNotes = (p: Project, patch: unknown) => { p.designSystem = mergeNotes(p.designSystem, patch, 'designSystem'); if (p.designSystem) p.designSystemHash = themeSignature(p); else delete p.designSystemHash; };
/** Document a component; members of a set share the same notes. */
export function setComponentDoc(p: Project, componentId: string, patch: unknown) {
  const c = componentOf(p, componentId), doc = mergeNotes(c.doc, patch, 'doc');
  for (const member of c.set ? variantSet(p, c.set) : [c]) { member.doc = doc ? { ...doc } : undefined; if (doc) member.docHash = templateSignature(member); else delete member.docHash; }
}
export const variantLabel = (variant: Record<string, string> | undefined) => variant ? Object.entries(variant).map(([axis, value]) => `${axis}=${value}`).join(', ') : '';
export function variantSet(p: Project, setId: string) { return p.components.filter(c => c.set === setId); }
/** Axes of a set and the values its members use, in first-seen order. */
export function variantAxes(p: Project, setId: string): Record<string, string[]> {
  const axes: Record<string, string[]> = {};
  for (const c of variantSet(p, setId)) for (const [axis, value] of Object.entries(c.variant ?? {})) { axes[axis] ??= []; if (!axes[axis].includes(value)) axes[axis].push(value); }
  return axes;
}
function componentOf(p: Project, id: string) { const c = p.components.find(c => c.id === id); if (!c) throw new Error('Componente no encontrado'); return c; }
/** Place a definition in a variant set with these axis values; a definition without a set starts one. Every member answers to the same axes. */
export function defineVariant(p: Project, componentId: string, variant: Record<string, string>, setName?: string) {
  const c = componentOf(p, componentId), values = cleanVariant(variant);
  if (!c.set) c.set = `set-${uid()}`;
  if (setName !== undefined) renameVariantSet(p, c.set, setName); else c.setName ??= c.name;
  const next = { ...(c.variant ?? {}), ...values };
  if (variantSet(p, c.set).some(s => s.id !== c.id && variantLabel({ ...Object.fromEntries(Object.keys(next).map(axis => [axis, 'Base'])), ...s.variant }) === variantLabel(next))) throw new Error(`Ya existe la variante ${variantLabel(next)}`);
  c.variant = next;
  for (const s of variantSet(p, c.set)) { s.setName ??= c.setName; s.variant ??= {}; for (const axis of Object.keys(next)) s.variant[axis] ??= 'Base'; }
  return c;
}
export function renameVariantSet(p: Project, setId: string, name: string) {
  if (typeof name !== 'string' || !name.trim() || name.length > 80) throw new Error('Nombre de conjunto inválido');
  for (const s of variantSet(p, setId)) s.setName = name.trim();
}
/** Duplicate a master beside the original as a new definition of the same set, with these axis values. */
export function createVariant(p: Project, componentId: string, variant: Record<string, string>) {
  const c = componentOf(p, componentId), values = cleanVariant(variant);
  const master = p.nodes.find(n => n.id === c.masterId && n.componentId === c.id); if (!master) throw new Error('El maestro fue eliminado; crea la variante desde otro componente del conjunto');
  if (!c.set || !c.variant) defineVariant(p, c.id, Object.fromEntries(Object.keys(values).map(axis => [axis, c.variant?.[axis] ?? 'Base'])));
  const target = { ...c.variant, ...values };
  if (variantSet(p, c.set!).some(s => variantLabel(s.variant) === variantLabel(target))) throw new Error(`Ya existe la variante ${variantLabel(target)}`);
  // The set lives in one container that lays its masters out in a row, so variants never scatter across the canvas.
  const containerId = `variants-${c.set}`;
  let container = p.nodes.find(n => n.id === containerId);
  if (!container) {
    container = node('group', { id: containerId, name: `${c.setName} · variantes`, parentId: master.parentId, x: master.x, y: master.y, width: master.width + 48, height: master.height + 48, layout: 'horizontal', gap: 24, padding: 24, align: 'start', hugWidth: true, hugHeight: true, fill: 'transparent', stroke: '@border', strokeWidth: 1, radius: 12 });
    p.nodes.splice(p.nodes.findIndex(n => n.id === master.id), 0, container);
    master.parentId = containerId; master.x = 24; master.y = 24;
  }
  const ns = subtree(p, master.id), map = new Map(ns.map(n => [n.id, uid()]));
  for (const original of ns) {
    const n = clone(original); n.id = map.get(original.id)!; n.parentId = map.get(original.parentId!) ?? original.parentId; delete n.componentId; delete n.overrides;
    if (n.targetId && map.has(n.targetId)) n.targetId = map.get(n.targetId)!;
    if (original.id === master.id) { n.parentId = containerId; n.x = master.x + master.width + 24; n.name = `${c.setName} / ${variantLabel(target)}`; }
    p.nodes.push(n);
  }
  layoutNode(p, container);
  const created = createComponent(p, map.get(master.id)!);
  created.set = c.set; created.setName = c.setName; created.variant = target;
  return { componentId: created.id, masterId: created.masterId, containerId };
}
/** Point an instance at the member of its set that matches these values, keeping overrides by layer name and the instance id. */
export function switchVariant(p: Project, instanceId: string, variant: Record<string, string>) {
  const inst = p.nodes.find(n => n.id === instanceId); if (!inst?.instanceOf) throw new Error('Selecciona una instancia');
  const c = componentOf(p, inst.instanceOf); if (!c.set) throw new Error('Este componente no tiene variantes');
  const target = { ...(c.variant ?? {}), ...cleanVariant(variant) };
  const next = variantSet(p, c.set).find(s => Object.entries(target).every(([axis, value]) => (s.variant ?? {})[axis] === value));
  if (!next) throw new Error(`No hay una variante ${variantLabel(target)} en ${c.setName ?? c.name}`);
  if (next.id === c.id) return c.id;
  const old = subtree(p, inst.id), kept = old.filter(n => n.overrides?.length).map(n => ({ node: n, src: n.id === inst.id ? c.template[0] : c.template.find(t => t.id === n.componentKey) }));
  const index = p.nodes.findIndex(n => n.id === inst.id), ids = new Set(old.map(n => n.id));
  p.nodes = p.nodes.filter(n => !ids.has(n.id));
  const rootId = instantiate(p, next.id, inst.parentId, inst.x, inst.y), fresh = subtree(p, rootId);
  p.nodes = p.nodes.filter(n => !fresh.includes(n)); p.nodes.splice(index, 0, ...fresh);
  for (const n of fresh) if (n.parentId === rootId) n.parentId = inst.id;
  fresh[0].id = inst.id;
  for (const { node: oldNode, src } of kept) {
    const match = oldNode.id === inst.id ? fresh[0] : src ? fresh.find(f => { const t = next.template.find(t => t.id === f.componentKey); return !!t && t.type === src.type && t.name === src.name; }) : undefined;
    if (!match) continue;
    const fields = (oldNode.overrides ?? []).filter(key => !['id', 'componentId', 'componentKey', 'instanceOf', 'parentId', 'x', 'y'].includes(key) && !(oldNode.id === inst.id && key === 'name' && oldNode.name === c.name));
    for (const key of fields) (match as unknown as Record<string, unknown>)[key] = (oldNode as unknown as Record<string, unknown>)[key];
    if (fields.length) match.overrides = fields;
  }
  return next.id;
}
export function detach(p: Project, id: string) { for (const n of subtree(p, id)) { delete n.instanceOf; delete n.componentKey; delete n.overrides; } }
/** Delete a definition nobody uses, with its master; a variants container left empty goes with it. Instances keep a definition alive. */
export function removeComponent(p: Project, componentId: string) {
  const c = componentOf(p, componentId), used = p.nodes.filter(n => n.instanceOf === c.id).length;
  if (used) throw new Error(`«${c.name}» tiene ${used} ${used === 1 ? 'instancia' : 'instancias'}: sepáralas o elimínalas antes de borrar el componente`);
  const master = p.nodes.find(n => n.id === c.masterId && n.componentId === c.id);
  if (master) {
    const container = c.set ? p.nodes.find(n => n.id === master.parentId && n.id === `variants-${c.set}`) : undefined;
    remove(p, [master.id]);
    if (container && !children(p, container.id).length) remove(p, [container.id]);
  }
  p.components = p.components.filter(other => other.id !== c.id);
}
export function duplicate(p: Project, ids: string[]) {
  const result: string[] = [];
  for (const id of topSelected(p, ids)) {
    const ns = subtree(p, id); if (!ns.length) continue;
    if (ns[0].componentId) { result.push(instantiate(p, ns[0].componentId, ns[0].parentId, ns[0].x + 24, ns[0].y + 24)); continue; }
    const map = new Map(ns.map(n => [n.id, uid()]));
    for (const original of ns) {
      const n = clone(original); n.id = map.get(original.id)!; n.parentId = map.get(original.parentId!) || original.parentId;
      if (n.targetId && map.has(n.targetId)) n.targetId = map.get(n.targetId)!;
      if (original.id === id) { n.x += 24; n.y += 24; n.name += ' copia'; result.push(n.id); }
      p.nodes.push(n);
    }
  }
  return result;
}
export function remove(p: Project, ids: string[]) {
  const doomed = new Set(ids.flatMap(id => subtree(p, id).map(n => n.id)));
  p.nodes = p.nodes.filter(n => !doomed.has(n.id));
  for (const n of p.nodes) if (n.targetId && doomed.has(n.targetId)) n.targetId = null;
}
export function group(p: Project, ids: string[]) {
  const ns = topSelected(p, ids).map(id => p.nodes.find(n => n.id === id)!).filter(Boolean);
  if (ns.length < 2 || ns.some(n => n.parentId !== ns[0].parentId || n.type === 'frame')) throw new Error('Selecciona al menos dos elementos de la misma pantalla o grupo');
  const x = Math.min(...ns.map(n => n.x)), y = Math.min(...ns.map(n => n.y));
  const g = node('group', { x, y, width: Math.max(...ns.map(n => n.x + n.width)) - x, height: Math.max(...ns.map(n => n.y + n.height)) - y, parentId: ns[0].parentId });
  p.nodes.push(g); for (const n of ns) { n.parentId = g.id; n.x -= x; n.y -= y; } return g.id;
}
export function ungroup(p: Project, id: string) {
  const n = p.nodes.find(n => n.id === id); if (!n || n.type !== 'group') return [];
  if (n.componentId || n.instanceOf) throw new Error('Desvincula el componente antes de desagrupar');
  const kids = children(p, id); for (const k of kids) { k.parentId = n.parentId; k.x += n.x; k.y += n.y; }
  p.nodes = p.nodes.filter(x => x.id !== id); return kids.map(k => k.id);
}
export function validate(input: unknown, trusted = false): Project {
  if (!input || typeof input !== 'object') throw new Error('Archivo de proyecto inválido');
  const source = input as Record<string, unknown>;
  if (source.format !== 'codaru-mockup' || ![1, 2].includes(source.version as number) || !Array.isArray(source.nodes) || !Array.isArray(source.components) || source.nodes.length > 3000 || source.components.length > 300) throw new Error('Formato o versión de proyecto no compatible');
  const p = (trusted ? input : clone(input)) as Project;
  if (typeof p.name !== 'string' || p.name.length > 200 || !['light', 'dark'].includes(p.theme)) throw new Error('Nombre o tema inválido');
  if (p.designSystem !== undefined) { const notes = mergeNotes(undefined, p.designSystem, 'designSystem'); if (notes) p.designSystem = notes; else delete p.designSystem; }
  if (p.designSystemHash !== undefined && (typeof p.designSystemHash !== 'string' || p.designSystemHash.length > 64)) throw new Error('Firma de documentación inválida');
  if (p.pages !== undefined) {
    if (!Array.isArray(p.pages) || p.pages.length > 100 || p.pages.some(page => !page || typeof page.id !== 'string' || !PAGE_ID.test(page.id) || typeof page.name !== 'string' || page.name.length > 60) || new Set(p.pages.map(page => page.id)).size !== p.pages.length) throw new Error('Páginas inválidas');
    if (!p.pages.length) delete p.pages;
  }
  if (p.activePageId !== undefined && !pagesOf(p).some(page => page.id === p.activePageId)) p.activePageId = defaultPageId(p);
  for (const n of p.nodes) { const legacy = (n as unknown as { pageId?: string }).pageId; if (legacy !== undefined) { n.page ??= legacy; delete (n as unknown as { pageId?: string }).pageId; } }
  if (p.pages) { const ids = new Set(p.pages.map(page => page.id)), fallback = defaultPageId(p); for (const n of p.nodes) if (n.parentId === null && (!n.page || !ids.has(n.page))) n.page = fallback; }
  if (p.versions !== undefined) {
    if (!Array.isArray(p.versions) || p.versions.length > 30 || p.versions.some(v => !v || typeof v.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(v.id) || typeof v.name !== 'string' || v.name.length > 80 || typeof v.at !== 'string' || typeof v.data !== 'string' || v.data.length > 12_000_000 || (v.note !== undefined && (typeof v.note !== 'string' || v.note.length > 2000)))) throw new Error('Versiones inválidas');
    if (!p.versions.length) delete p.versions;
  }
  for (const t of ['light', 'dark'] as const) {
    if (!p.themes?.[t] || typeof p.themes[t] !== 'object' || Array.isArray(p.themes[t]) || Object.keys(p.themes[t]).length > 128 || Object.keys(p.themes[t]).some(key => !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(key) || ['constructor', 'prototype', '__proto__'].includes(key))) throw new Error('Paleta inválida');
    for (const key of tokens) if (!safeColor(p.themes[t][key])) throw new Error('Paleta inválida');
  }
  if (source.version === 1) {
    const theme = defaultDesignTheme();
    for (const mode of ['light', 'dark'] as const) theme.modes[mode].colors = { ...p.themes[mode] };
    p.version = 2; p.designThemes = { project: theme }; p.activeThemeId = 'project';
  }
  validateDesignThemes(p);
  const overrideKeys = new Set([...Object.keys(node('rect')), 'radiusTR', 'radiusBR', 'radiusBL', 'componentId', 'instanceOf', 'componentKey', 'overrides', 'fillToken', 'materialToken', 'typographyToken', 'radiusToken', 'themeId', 'themeMode', 'kitId', 'iconPack', 'iconName', 'svg', 'animations', 'transition', 'gradientStops', 'device', 'fold', 'foldPair', 'safeArea', 'skin', 'paddingSides', 'justify', 'align', 'wrap', 'hugWidth', 'hugHeight', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight']);
  function validateNodes(ns: DesignNode[]) {
    const ids = new Set<string>();
    for (const n of ns) {
      if (!n || typeof n.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(n.id) || ids.has(n.id) || !Object.keys(labels).includes(n.type)) throw new Error('Elemento inválido o identificador repetido');
      ids.add(n.id);
      for (const key of ['x', 'y', 'width', 'height', 'strokeWidth', 'radius', 'opacity', 'gradientAngle', 'fontSize', 'fontWeight', 'lineHeight', 'padding', 'gap'] as const) if (!Number.isFinite(n[key]) || Math.abs(n[key]) > 100000) throw new Error('Geometría inválida');
      if (n.page !== undefined && (typeof n.page !== 'string' || !PAGE_ID.test(n.page))) throw new Error('Página de pantalla inválida');
      if (n.role !== undefined && !frameRoles.includes(n.role)) throw new Error('Rol de marco inválido: screen, annotation o library');
      for (const key of ['radiusTR', 'radiusBR', 'radiusBL'] as const) if (n[key] !== undefined && (!Number.isFinite(n[key]) || n[key]! < 0 || n[key]! > 10000)) throw new Error('Radio inválido');
      if (n.width < 1 || n.height < 1 || n.fontSize < 1 || n.opacity < 0 || n.opacity > 100 || n.padding < 0 || n.gap < 0) throw new Error('Tamaño inválido');
      for (const key of ['name', 'text', 'image'] as const) if (typeof n[key] !== 'string') throw new Error('Contenido inválido');
      if ((n.type === 'icon' || n.iconPack !== undefined || n.iconName !== undefined) && !isIconReference(n.iconPack, n.iconName)) throw new Error('Referencia de icono inválida');
      for (const key of ['fill', 'color', 'stroke', 'gradientEnd'] as const) if (!safeColor(n[key])) throw new Error('Color inválido');
      if (!['none', 'linear', 'radial'].includes(n.gradient) || !['free', 'vertical', 'horizontal'].includes(n.layout) || !['fixed', 'fill'].includes(n.sizing) || !['left', 'center', 'right'].includes(n.textAlign) || !['system', 'serif', 'mono'].includes(n.fontFamily)) throw new Error('Estilo inválido');
      if (n.image && !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(n.image)) throw new Error('Solo se admiten imágenes locales PNG, JPEG, WebP o GIF');
      if (n.device !== undefined && (typeof n.device !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(n.device))) throw new Error('Dispositivo inválido');
      if (n.fold !== undefined && (n.type !== 'frame' || !n.fold || typeof n.fold !== 'object' || Object.keys(n.fold).some(key => key !== 'axis' && key !== 'gap' && key !== 'panels') || (n.fold.panels !== undefined && n.fold.panels !== 2 && n.fold.panels !== 3) || !['vertical', 'horizontal'].includes(n.fold.axis) || !Number.isFinite(n.fold.gap) || n.fold.gap < 0 || n.fold.gap > 200)) throw new Error('Pliegue inválido: solo pantallas, axis vertical u horizontal y gap de 0 a 200.');
      if (n.foldPair !== undefined && (n.type !== 'frame' || typeof n.foldPair !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(n.foldPair) || n.foldPair === n.id)) throw new Error('Pantalla emparejada inválida.');
      if (n.skin !== undefined && (n.type !== 'frame' || !Object.hasOwn(deviceSkins, n.skin))) throw new Error('Marco de dispositivo desconocido.');
      if (n.safeArea !== undefined && (n.type !== 'frame' || !n.safeArea || typeof n.safeArea !== 'object' || Object.keys(n.safeArea).sort().join() !== 'bottom,left,right,top' || Object.values(n.safeArea).some(v => !Number.isFinite(v) || v < 0 || v > 400))) throw new Error('Área segura inválida: top, right, bottom y left de 0 a 400, solo en pantallas.');
      if (n.paddingSides !== undefined && (!n.paddingSides || typeof n.paddingSides !== 'object' || Object.keys(n.paddingSides).sort().join() !== 'bottom,left,right,top' || Object.values(n.paddingSides).some(v => !Number.isFinite(v) || v < 0 || v > 2000))) throw new Error('Márgenes inválidos: top, right, bottom y left de 0 a 2000.');
      if ((n.justify !== undefined && !['start', 'center', 'end', 'between'].includes(n.justify)) || (n.align !== undefined && !['stretch', 'start', 'center', 'end'].includes(n.align))) throw new Error('Alineación de auto layout inválida.');
      for (const key of ['wrap', 'hugWidth', 'hugHeight'] as const) if (n[key] !== undefined && typeof n[key] !== 'boolean') throw new Error('Opción de auto layout inválida.');
      for (const key of ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const) if (n[key] !== undefined && (!Number.isFinite(n[key]) || n[key]! < 1 || n[key]! > 100000)) throw new Error('Límite de tamaño inválido: de 1 a 100000.');
      if ((n.minWidth ?? 0) > (n.maxWidth ?? Infinity) || (n.minHeight ?? 0) > (n.maxHeight ?? Infinity)) throw new Error('El tamaño mínimo no puede superar al máximo.');
      if (n.gradientStops !== undefined) {
        if (!Array.isArray(n.gradientStops) || n.gradientStops.length < 2 || n.gradientStops.length > 16) throw new Error('Un degradado necesita entre 2 y 16 paradas.');
        let previous = -1;
        for (const stop of n.gradientStops) {
          if (!stop || typeof stop !== 'object' || Object.keys(stop).some(key => key !== 'color' && key !== 'position') || !safeColor(stop.color) || !Number.isFinite(stop.position) || stop.position < 0 || stop.position > 100 || stop.position < previous) throw new Error('Parada de degradado inválida: color y position de 0 a 100 en orden creciente.');
          previous = stop.position;
        }
      }
      if ((n.type === 'vector') !== (n.svg !== undefined) || (n.svg !== undefined && !isSanitizedSVG(n.svg))) throw new Error('Ilustración inválida: importa el SVG desde el editor o con la operación vector.');
      if (n.transition !== undefined) validateTransition(n.transition);
      if (n.animations !== undefined) validateAnimations(n.animations, n.svg ? vectorLayers(n.svg).map(layer => layer.id) : []);
      if (n.overrides && (!Array.isArray(n.overrides) || n.overrides.some(k => typeof k !== 'string' || !overrideKeys.has(k)))) throw new Error('Propiedades de instancia inválidas');
    }
    for (const n of ns) {
      if (n.parentId !== null && !ns.some(x => x.id === n.parentId && containerKinds.includes(x.type))) throw new Error('Contenedor inválido');
      if (n.type === 'frame' && n.parentId) throw new Error('Las pantallas deben estar en el lienzo');
      const seen = new Set([n.id]); let parent = n.parentId; let depth = 0;
      while (parent) { if (seen.has(parent) || ++depth > 30) throw new Error('Jerarquía cíclica o demasiado profunda'); seen.add(parent); parent = ns.find(x => x.id === parent)?.parentId || null; }
    }
  }
  validateNodes(p.nodes); const componentIds = new Set<string>();
  for (const c of p.components) {
    if (!c || typeof c.id !== 'string' || componentIds.has(c.id) || typeof c.name !== 'string' || typeof c.masterId !== 'string' || !Array.isArray(c.template) || !c.template.length || c.template.length > 3000) throw new Error('Componente inválido');
    if (c.set !== undefined && (typeof c.set !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(c.set))) throw new Error('Conjunto de variantes inválido');
    if (c.setName !== undefined && (typeof c.setName !== 'string' || c.setName.length > 80)) throw new Error('Nombre de conjunto inválido');
    if (c.variant !== undefined) cleanVariant(c.variant);
    if (c.doc !== undefined) mergeNotes(undefined, c.doc, 'doc');
    if (c.docHash !== undefined && (typeof c.docHash !== 'string' || c.docHash.length > 64)) throw new Error('Firma de documentación inválida');
    componentIds.add(c.id); validateNodes(c.template);
    if (c.template.filter(n => !n.parentId).length !== 1) throw new Error('Plantilla de componente inválida');
    const master = p.nodes.find(n => n.id === c.masterId);
    const context = effectiveTheme(p, master);
    const templateProject = { ...p, nodes: c.template, activeThemeId: context.id, theme: context.mode };
    for (const n of c.template) validateNodeThemeRefs(templateProject, n);
  }
  const byId = new Map(p.nodes.map(n => [n.id, n])), frames = new Set(p.nodes.filter(n => n.type === 'frame').map(n => n.id));
  for (const n of p.nodes) {
    validateNodeThemeRefs(p, n, byId);
    if ((n.instanceOf && !componentIds.has(n.instanceOf)) || (n.componentId && !componentIds.has(n.componentId))) throw new Error('Referencia a componente inválida');
    if (n.instanceOf) { for (let up = n.parentId ? byId.get(n.parentId) : undefined, hops = 0; up && hops < 64; up = up.parentId ? byId.get(up.parentId) : undefined, hops++) if (up.instanceOf || up.componentId) throw new Error('Componentes anidados no admitidos'); }
    if (n.targetId !== null && !frames.has(n.targetId)) throw new Error('Destino de navegación inválido');
  }
  return p;
}
export class Store {
  project: Project; undoStack: Project[] = []; redoStack: Project[] = [];
  private cache = ''; private cacheFor: Project | undefined;
  constructor(project: unknown) { this.project = validate(project); }
  /** The document as JSON, computed once per committed version: every commit produces a new object, so identity is the cache key. */
  /** Forget the cached serialization after an in-place change that is not a commit (view state kept in the document). */
  touch() { this.cacheFor = undefined; }
  serialize() { if (this.cacheFor !== this.project) { this.cache = JSON.stringify(this.project); this.cacheFor = this.project; } return this.cache; }
  commit(edit: (p: Project) => void) {
    const before = this.project, beforeSerialized = this.serialize(), draft = clone(before);
    try { edit(draft); syncComponents(draft); layoutProject(draft); this.project = validate(draft); }
    catch (e) { this.project = before; throw e; }
    if (this.serialize() !== beforeSerialized) { this.undoStack.push(before); if (this.undoStack.length > 60) this.undoStack.shift(); this.redoStack = []; }
  }
  undo() { const p = this.undoStack.pop(); if (p) { this.redoStack.push(this.project); this.project = p; } }
  redo() { const p = this.redoStack.pop(); if (p) { this.undoStack.push(this.project); this.project = p; } }
}
