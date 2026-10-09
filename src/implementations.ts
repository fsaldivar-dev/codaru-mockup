import type { Project } from './model';
import type { ComponentImplementations, ImplementationReference } from './contracts';

const reserved = ['constructor', 'prototype', '__proto__'];
export function validateImplementationPlatform(platform: string) {
  if (typeof platform !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(platform) || reserved.includes(platform)) throw new Error('Plataforma inválida: usa una clave en minúsculas de hasta 32 caracteres');
}
function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && !!value.trim() && value === value.trim() && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}
export function validateImplementations(input: unknown): asserts input is Record<string, ImplementationReference> {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length > 16) throw new Error('Un componente admite hasta 16 plataformas de implementación');
  for (const [platform, value] of Object.entries(input)) {
    validateImplementationPlatform(platform);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Referencia de implementación inválida');
    const ref = value as ImplementationReference;
    if (Object.keys(ref).some(key => !['symbol', 'path', 'module'].includes(key))) throw new Error('Campo desconocido en referencia de implementación');
    if (!text(ref.symbol, 200)) throw new Error('El símbolo debe tener entre 1 y 200 caracteres');
    if (ref.module !== undefined && !text(ref.module, 200)) throw new Error('El módulo debe tener entre 1 y 200 caracteres');
    if (ref.path !== undefined && (!text(ref.path, 512) || /[\\:?#%]/.test(ref.path) || ref.path.split('/').some(part => !part || part === '.' || part === '..'))) throw new Error('Usa una ruta relativa al workspace, sin URL, barras invertidas ni segmentos . o ..');
  }
}

/** References belong to a definition; instances never store a second copy. */
export function setComponentImplementation(p: Project, componentId: string, platform: string, reference: ImplementationReference | null) {
  validateImplementationPlatform(platform);
  const c = p.components.find(c => c.id === componentId);
  if (!c) throw new Error('No existe la definición de componente');
  const next = { ...c.implementations };
  if (reference === null) delete next[platform];
  else next[platform] = reference;
  validateImplementations(next);
  if (Object.keys(next).length) c.implementations = structuredClone(next);
  else delete c.implementations;
}

/** Resolve the nearest boundary, including a nested instance or a replacement in a slot. */
export function getComponentImplementations(p: Project, nodeId: string): ComponentImplementations | null {
  const byId = new Map(p.nodes.map(n => [n.id, n]));
  let owner = byId.get(nodeId);
  if (!owner) throw new Error('No existe la capa solicitada');
  while (owner) {
    const id = owner.instanceOf ?? owner.componentId;
    if (id) {
      const c = p.components.find(c => c.id === id);
      if (!c) throw new Error('No existe la definición de componente');
      return { nodeId, ownerId: owner.id, componentId: c.id, componentName: c.name, implementations: structuredClone(c.implementations ?? {}) };
    }
    owner = owner.parentId ? byId.get(owner.parentId) : undefined;
  }
  return null;
}
