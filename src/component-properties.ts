import { ancestors, clone, subtree, switchSlot, switchVariant, syncComponents, updateNode, validateComponentProperties, type Component, type ComponentProperty, type DesignNode, type Project } from './model';
import { isIconReference } from './icon-data';
export type { ComponentProperty } from './model';
export type ComponentPropertyValue = string | boolean | { pack: string; name: string };
export interface ComponentPropertyState {
  key: string; label: string; type: ComponentProperty['type'];
  /** Layer in the definition; resolvedTargetId identifies the layer in this use. */
  targetId: string; resolvedTargetId?: string; axis?: string;
  available: boolean; reason?: string; value?: ComponentPropertyValue;
  overridden: boolean; options?: string[]; textKey?: string;
  /** Slot choices are definition IDs; labels are supplied separately for host controls. */
  components?: Array<{ id: string; name: string }>; defaultComponentId?: string;
}
const fields = (prop: ComponentProperty): string[] => ({ text: ['text'], icon: ['iconPack', 'iconName'], visibility: ['hidden'], variant: ['instanceOf'], slot: ['instanceOf'] })[prop.type];
const definition = (p: Project, id: string) => { const c = p.components.find(c => c.id === id); if (!c) throw new Error('Componente no encontrado'); return c; };
const owner = (p: Project, id: string) => { const n = p.nodes.find(n => n.id === id); if (!n || !(n.componentId || n.instanceOf)) throw new Error('Selecciona un maestro o una instancia'); return { n, c: definition(p, (n.componentId || n.instanceOf)!) }; };
/** Same correspondence used by variants: full paths, type/name and sibling ordinal. Never a global name search. */
function variantKey(from: Component, to: Component, key: string): string | undefined {
  if (from.id === to.id) return key;
  if (!from.set || from.set !== to.set) return;
  const path: DesignNode[] = []; let current = from.template.find(n => n.id === key);
  while (current?.parentId) { path.unshift(current); current = from.template.find(n => n.id === current!.parentId); }
  if (!current) return;
  let target = to.template[0];
  for (const source of path) {
    const siblings = from.template.filter(n => n.parentId === source.parentId && n.type === source.type && n.name === source.name);
    const match = to.template.filter(n => n.parentId === target.id && n.type === source.type && n.name === source.name)[siblings.findIndex(n => n.id === source.id)];
    if (!match) return; target = match;
  }
  return target.id;
}
function resolve(p: Project, root: DesignNode, c: Component, targetId: string): DesignNode | undefined {
  if (root.componentId) return subtree(p, root.id).find(n => n.id === targetId);
  const path: DesignNode[] = []; let src = c.template.find(n => n.id === targetId);
  while (src?.parentId) { path.unshift(src); src = c.template.find(n => n.id === src!.parentId); }
  if (!src || src.id !== c.template[0].id) return;
  let actual = root, sourceOwner = c, actualOwner = c, nested = false;
  for (const child of path) {
    if (src.instanceOf) { sourceOwner = definition(p, src.instanceOf); actualOwner = definition(p, actual.instanceOf!); nested = true; }
    const key = variantKey(sourceOwner, actualOwner, nested ? child.componentKey ?? child.id : child.id);
    const match = key && p.nodes.find(n => n.parentId === actual.id && n.componentKey === key);
    if (!match) return;
    src = child; actual = match;
  }
  return actual;
}
function options(p: Project, n: DesignNode, axis: string): string[] {
  const c = p.components.find(c => c.id === n.instanceOf);
  if (!c?.set || !c.variant || !(axis in c.variant)) return [];
  return [...new Set(p.components.filter(member => member.set === c.set && Object.entries(c.variant!).every(([k, v]) => k === axis || member.variant?.[k] === v)).map(member => member.variant![axis]))];
}
function incompatibility(p: Project, n: DesignNode | undefined, prop: ComponentProperty, rootId: string): string | undefined {
  if (!n) return 'La capa vinculada ya no existe en esta composición';
  if (prop.type === 'text' && !['text', 'button', 'input'].includes(n.type)) return 'La capa no admite texto';
  if (prop.type === 'icon' && n.type !== 'icon') return 'La capa no es un icono';
  if (prop.type === 'slot' && (n.id === rootId || !n.instanceOf)) return 'Vincula una instancia propia del maestro';
  if (prop.type === 'slot' && !prop.allowedComponents.includes(n.instanceOf!)) return 'El contenido no está permitido en este slot';
  if (prop.type === 'variant' && (n.id === rootId || !n.instanceOf || !options(p, n, prop.axis).length)) return 'Vincula un eje existente de una instancia anidada';
}
export function defineComponentProperty(p: Project, componentId: string, key: string, property: ComponentProperty) {
  const c = definition(p, componentId), next = { ...c.properties, [key]: clone(property) };
  validateComponentProperties(next);
  const master = p.nodes.find(n => n.id === c.masterId && n.componentId === c.id);
  const target = (master ? subtree(p, master.id) : c.template).find(n => n.id === property.targetId);
  const error = incompatibility(p, target, property, c.masterId); if (error) throw new Error(error);
  if (property.type === 'slot' && target && ancestors({ ...p, nodes: master ? subtree(p, master.id) : c.template }, target.id).some(n => n.instanceOf)) throw new Error('Expón el slot en el maestro de la instancia que lo contiene');
  c.properties = next;
}
export function removeComponentProperty(p: Project, componentId: string, key: string) {
  const c = definition(p, componentId);
  if (!c.properties || !Object.hasOwn(c.properties, key)) throw new Error('Propiedad pública no encontrada');
  delete c.properties[key]; if (!Object.keys(c.properties).length) delete c.properties;
}
export function getComponentProperties(p: Project, nodeId: string): ComponentPropertyState[] {
  const { n, c } = owner(p, nodeId);
  return Object.entries(c.properties ?? {}).map(([key, prop]) => {
    const target = resolve(p, n, c, prop.targetId), reason = incompatibility(p, target, prop, n.id);
    const state: ComponentPropertyState = { key, ...clone(prop), available: !reason, overridden: !!target?.overrides?.some(field => fields(prop).includes(field)), ...(target ? { resolvedTargetId: target.id } : {}), ...(reason ? { reason } : {}) };
    if (!reason && target) {
      if (prop.type === 'text') { state.value = target.text; if (target.textKey) state.textKey = target.textKey; }
      if (prop.type === 'icon') state.value = { pack: target.iconPack!, name: target.iconName! };
      if (prop.type === 'visibility') state.value = !target.hidden;
      if (prop.type === 'slot') { state.value = target.instanceOf!; state.options = [...prop.allowedComponents]; state.components = prop.allowedComponents.flatMap(id => { const c = p.components.find(c => c.id === id); return c ? [{ id, name: c.name }] : []; }); state.defaultComponentId = c.template.find(n => n.id === prop.targetId)?.instanceOf; }
      if (prop.type === 'variant') { state.value = definition(p, target.instanceOf!).variant![prop.axis]; state.options = options(p, target, prop.axis); }
    }
    return state;
  });
}
/** null removes only the fields owned by this binding. Source textKey and unrelated overrides survive. */
export function setComponentProperty(p: Project, nodeId: string, key: string, value: ComponentPropertyValue | null) {
  // A previous operation in this transaction may have changed a master's structure or values.
  syncComponents(p);
  const { n, c } = owner(p, nodeId), prop = c.properties && Object.hasOwn(c.properties, key) ? c.properties[key] : undefined;
  if (!prop) throw new Error('Propiedad pública no encontrada');
  const target = resolve(p, n, c, prop.targetId), error = incompatibility(p, target, prop, n.id); if (error || !target) throw new Error(error);
  if (target.locked || ancestors(p, target.id).some(a => a.locked)) throw new Error('La capa vinculada está bloqueada');
  if (value === null) { target.overrides = target.overrides?.filter(field => !fields(prop).includes(field)); syncComponents(p); return; }
  switch (prop.type) {
    case 'text': if (typeof value !== 'string' || value.length > 10000) throw new Error('El texto admite hasta 10000 caracteres'); updateNode(p, target.id, { text: value }); break;
    case 'visibility': if (typeof value !== 'boolean') throw new Error('Visibilidad requiere true o false'); updateNode(p, target.id, { hidden: !value }); break;
    case 'icon': {
      if (!value || typeof value !== 'object' || Object.keys(value).some(k => !['pack', 'name'].includes(k)) || !isIconReference(value.pack, value.name)) throw new Error('Icono inválido: consulta el catálogo de iconos');
      updateNode(p, target.id, { iconPack: value.pack, iconName: value.name }); break;
    }
    case 'slot': if (typeof value !== 'string') throw new Error('El contenido de un slot es un ID de componente'); switchSlot(p, target.id, value); break;
    case 'variant': if (typeof value !== 'string' || !options(p, target, prop.axis).includes(value)) throw new Error('Valor de variante no disponible'); switchVariant(p, target.id, { [prop.axis]: value }); break;
  }
}
