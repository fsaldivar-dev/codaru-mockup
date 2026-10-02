import { ancestors, containerKinds, node, type Project } from './model';
import { getIconItems, iconPacks, isIconReference } from './icon-data';
export { getIconItems, iconPacks, iconSVG, ICON_CATALOG_VERSION, type IconItem, type IconPackId } from './icon-data';

/** One normal vector node: editable size, color, opacity, theme and component overrides. */
export function insertIcon(p: Project, pack: string, id: string, parentId: string | null, x: number, y: number, size = 24): string {
  if (!isIconReference(pack, id)) throw new Error('Referencia de icono inválida');
  if (![x, y, size].every(n => Number.isFinite(n) && Math.abs(n) <= 100000) || size < 1) throw new Error('Geometría de icono inválida');
  if (parentId !== null && !p.nodes.some(n => n.id === parentId && containerKinds.includes(n.type))) throw new Error('Contenedor inválido');
  const parent = p.nodes.find(n => n.id === parentId);
  if (parent && [parent, ...ancestors(p, parent.id)].some(n => n.instanceOf)) throw new Error('Edita el maestro o desvincula la instancia antes de añadir iconos');
  const item = getIconItems(pack).find(item => item.id === id)!;
  const n = node('icon', { parentId, x, y, width: size, height: size, iconPack: pack, iconName: id, name: `${item.name} · ${iconPacks.find(p => p.id === pack)!.name}` });
  p.nodes.push(n); return n.id;
}
