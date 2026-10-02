import { defaultDesignTheme, effectiveTheme, resolveColor, safeColor, validateDesignThemes, validateNodeThemeRefs, type DesignTheme } from './themes';
import { isIconReference } from './icon-data';
export type Kind = 'frame' | 'rect' | 'ellipse' | 'text' | 'button' | 'input' | 'card' | 'group' | 'image' | 'icon';
export type Layout = 'free' | 'vertical' | 'horizontal';
export type Theme = 'light' | 'dark';
export interface DesignNode {
  id: string; type: Kind; name: string; parentId: string | null;
  x: number; y: number; width: number; height: number;
  fill: string; color: string; stroke: string; strokeWidth: number;
  radius: number; radiusTR?: number; radiusBR?: number; radiusBL?: number;
  opacity: number; shadow: boolean;
  gradient: 'none' | 'linear' | 'radial'; gradientEnd: string; gradientAngle: number;
  text: string; fontSize: number; fontWeight: number; fontFamily: string; lineHeight: number;
  textAlign: 'left' | 'center' | 'right';
  layout: Layout; padding: number; gap: number; sizing: 'fixed' | 'fill';
  hidden: boolean; locked: boolean; targetId: string | null;
  image: string;
  iconPack?: string; iconName?: string;
  componentId?: string; instanceOf?: string; componentKey?: string; overrides?: string[];
  fillToken?: string; materialToken?: string; typographyToken?: string; radiusToken?: string;
  themeId?: string; themeMode?: 'inherit' | Theme; kitId?: string;
}
export interface Component { id: string; name: string; masterId: string; template: DesignNode[]; }
export interface Project {
  format: 'codaru-mockup'; version: 2; name: string;
  theme: Theme; themes: Record<Theme, Record<string, string>>;
  designThemes: Record<string, DesignTheme>; activeThemeId: string;
  nodes: DesignNode[]; components: Component[];
}
export const tokens = ['primary', 'surface', 'background', 'text', 'muted', 'border', 'accent'] as const;
export const labels: Record<Kind, string> = { frame: 'Pantalla', rect: 'Rectángulo', ellipse: 'Elipse', text: 'Texto', button: 'Botón', input: 'Campo', card: 'Tarjeta', group: 'Grupo', image: 'Imagen', icon: 'Icono' };
export const containerKinds: Kind[] = ['frame', 'card', 'group'];
export function uid() { return crypto.randomUUID(); }
export function clone<T>(v: T): T { return structuredClone(v); }
export function node(type: Kind, patch: Partial<DesignNode> = {}): DesignNode {
  return {
    id: uid(), type, name: labels[type], parentId: null, x: 0, y: 0,
    width: type === 'icon' ? 24 : type === 'frame' ? 390 : type === 'text' ? 230 : 180,
    height: type === 'icon' ? 24 : type === 'frame' ? 660 : type === 'text' ? 40 : type === 'card' ? 160 : 48,
    fill: type === 'text' || type === 'group' || type === 'icon' ? 'transparent' : type === 'button' || type === 'rect' || type === 'ellipse' ? '@primary' : '@surface',
    color: type === 'button' ? '#ffffff' : '@text', stroke: '@border', strokeWidth: type === 'input' || type === 'card' ? 1 : 0,
    radius: type === 'frame' || type === 'text' || type === 'group' || type === 'icon' ? 0 : type === 'card' ? 16 : 10,
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
export function layoutProject(p: Project) {
  function apply(n: DesignNode) {
    const kids = children(p, n.id).filter(n => !n.hidden);
    if (n.layout !== 'free') {
      const vert = n.layout === 'vertical'; let pos = n.padding;
      const available = Math.max(16, (vert ? n.height : n.width) - n.padding * 2 - Math.max(0, kids.length - 1) * n.gap);
      const fills = kids.filter(k => k.sizing === 'fill');
      const space = Math.max(16, (available - kids.filter(k => k.sizing !== 'fill').reduce((s, k) => s + (vert ? k.height : k.width), 0)) / (fills.length || 1));
      for (const k of kids) {
        k.x = vert ? n.padding : pos; k.y = vert ? pos : n.padding;
        if (vert) { k.width = Math.max(16, n.width - n.padding * 2); if (k.sizing === 'fill') k.height = space; }
        else { k.height = Math.max(16, n.height - n.padding * 2); if (k.sizing === 'fill') k.width = space; }
        pos += (vert ? k.height : k.width) + n.gap;
      }
    }
    for (const k of kids) apply(k);
  }
  for (const n of children(p, null)) apply(n);
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
export function detach(p: Project, id: string) { for (const n of subtree(p, id)) { delete n.instanceOf; delete n.componentKey; delete n.overrides; } }
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
export function validate(input: unknown): Project {
  if (!input || typeof input !== 'object') throw new Error('Archivo de proyecto inválido');
  const source = input as Record<string, unknown>;
  if (source.format !== 'codaru-mockup' || ![1, 2].includes(source.version as number) || !Array.isArray(source.nodes) || !Array.isArray(source.components) || source.nodes.length > 3000 || source.components.length > 300) throw new Error('Formato o versión de proyecto no compatible');
  const p = clone(input) as Project;
  if (typeof p.name !== 'string' || p.name.length > 200 || !['light', 'dark'].includes(p.theme)) throw new Error('Nombre o tema inválido');
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
  const overrideKeys = new Set([...Object.keys(node('rect')), 'radiusTR', 'radiusBR', 'radiusBL', 'componentId', 'instanceOf', 'componentKey', 'overrides', 'fillToken', 'materialToken', 'typographyToken', 'radiusToken', 'themeId', 'themeMode', 'kitId', 'iconPack', 'iconName']);
  function validateNodes(ns: DesignNode[]) {
    const ids = new Set<string>();
    for (const n of ns) {
      if (!n || typeof n.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(n.id) || ids.has(n.id) || !Object.keys(labels).includes(n.type)) throw new Error('Elemento inválido o identificador repetido');
      ids.add(n.id);
      for (const key of ['x', 'y', 'width', 'height', 'strokeWidth', 'radius', 'opacity', 'gradientAngle', 'fontSize', 'fontWeight', 'lineHeight', 'padding', 'gap'] as const) if (!Number.isFinite(n[key]) || Math.abs(n[key]) > 100000) throw new Error('Geometría inválida');
      for (const key of ['radiusTR', 'radiusBR', 'radiusBL'] as const) if (n[key] !== undefined && (!Number.isFinite(n[key]) || n[key]! < 0 || n[key]! > 10000)) throw new Error('Radio inválido');
      if (n.width < 1 || n.height < 1 || n.fontSize < 1 || n.opacity < 0 || n.opacity > 100 || n.padding < 0 || n.gap < 0) throw new Error('Tamaño inválido');
      for (const key of ['name', 'text', 'image'] as const) if (typeof n[key] !== 'string') throw new Error('Contenido inválido');
      if ((n.type === 'icon' || n.iconPack !== undefined || n.iconName !== undefined) && !isIconReference(n.iconPack, n.iconName)) throw new Error('Referencia de icono inválida');
      for (const key of ['fill', 'color', 'stroke', 'gradientEnd'] as const) if (!safeColor(n[key])) throw new Error('Color inválido');
      if (!['none', 'linear', 'radial'].includes(n.gradient) || !['free', 'vertical', 'horizontal'].includes(n.layout) || !['fixed', 'fill'].includes(n.sizing) || !['left', 'center', 'right'].includes(n.textAlign) || !['system', 'serif', 'mono'].includes(n.fontFamily)) throw new Error('Estilo inválido');
      if (n.image && !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(n.image)) throw new Error('Solo se admiten imágenes locales PNG, JPEG, WebP o GIF');
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
    componentIds.add(c.id); validateNodes(c.template);
    if (c.template.filter(n => !n.parentId).length !== 1) throw new Error('Plantilla de componente inválida');
    const master = p.nodes.find(n => n.id === c.masterId);
    const context = effectiveTheme(p, master);
    const templateProject = { ...p, nodes: c.template, activeThemeId: context.id, theme: context.mode };
    for (const n of c.template) validateNodeThemeRefs(templateProject, n);
  }
  for (const n of p.nodes) {
    validateNodeThemeRefs(p, n);
    if ((n.instanceOf && !componentIds.has(n.instanceOf)) || (n.componentId && !componentIds.has(n.componentId))) throw new Error('Referencia a componente inválida');
    if (n.instanceOf && ancestors(p, n.id).some(a => a.instanceOf || a.componentId)) throw new Error('Componentes anidados no admitidos');
    if (n.targetId !== null && !p.nodes.some(f => f.id === n.targetId && f.type === 'frame')) throw new Error('Destino de navegación inválido');
  }
  return p;
}
export class Store {
  project: Project; undoStack: Project[] = []; redoStack: Project[] = [];
  constructor(project: unknown) { this.project = validate(project); }
  commit(edit: (p: Project) => void) {
    const before = clone(this.project);
    try { edit(this.project); syncComponents(this.project); layoutProject(this.project); this.project = validate(this.project); }
    catch (e) { this.project = before; throw e; }
    if (JSON.stringify(before) !== JSON.stringify(this.project)) { this.undoStack.push(before); if (this.undoStack.length > 60) this.undoStack.shift(); this.redoStack = []; }
  }
  undo() { const p = this.undoStack.pop(); if (p) { this.redoStack.push(clone(this.project)); this.project = p; } }
  redo() { const p = this.redoStack.pop(); if (p) { this.undoStack.push(clone(this.project)); this.project = p; } }
}
