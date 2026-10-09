import { node, updateNode, type Project } from './model';
import { vectorLayers } from './motion';
import { prepareAruAsset } from './aru-asset';
import type { EditorOperation } from './contracts';
export { prepareAruAsset } from './aru-asset';
export type { AruSource, AruAsset, IllustrationRequest } from './contracts';

/** Same transaction for a CLI import or a result returned from the IDE's ARU editor. */
export function applyAruAsset(project: Project, operation: Extract<EditorOperation, {op:'aru'}>) {
  const prepared = prepareAruAsset(operation.data);
  const current = operation.id ? project.nodes.find(n => n.id === operation.id) : undefined;
  if (current) {
    if (current.type !== 'vector') throw new Error('Solo se puede reemplazar una ilustración vectorial con ARU.');
    const layers = new Set(vectorLayers(prepared.svg).map(l => l.id));
    updateNode(project, current.id, { svg: prepared.svg, aruSource: prepared.aruSource,
      animations: current.animations?.filter(a => !a.target || layers.has(a.target)) });
    return current.id;
  }
  const width = operation.width ?? Math.min(prepared.width, 240);
  const created = node('vector', { ...(operation.id ? {id:operation.id} : {}),
    parentId: operation.parentId ?? null, x: operation.x ?? 32, y: operation.y ?? 32,
    width, height: Math.max(1, width * prepared.height / prepared.width),
    name: operation.name ?? prepared.aruSource.filename.replace(/\.aru$/i, ''),
    svg: prepared.svg, aruSource: prepared.aruSource });
  project.nodes.push(created);
  return created.id;
}
