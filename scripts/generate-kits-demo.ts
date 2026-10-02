import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Store, blank, node, subtree } from '../src/model';
import { ensureKitTheme, getKitItems, insertKitItem, kits } from '../src/kits';

// A reviewable, local catalog: two columns, one light/dark-ready artboard per platform.
const store = new Store(blank());
store.commit(p => {
  p.name = 'Codaru · Catálogo de kits originales';
  for (const [index, kit] of kits.entries()) {
    const themeId = ensureKitTheme(p, kit.id), items = getKitItems(kit.id);
    const column = 560, gutter = 48, padding = 40, width = padding * 2 + column * 2 + gutter;
    const rows = Array.from({ length: items.length / 2 }, (_, row) => items.slice(row * 2, row * 2 + 2));
    const height = 160 + rows.reduce((sum, row) => sum + Math.max(...row.map(item => item.height)) + 76, 0) + padding;
    const frame = node('frame', { id: `catalog-${kit.id}`, name: `${kit.name} · 20 componentes`, x: 40 + index * (width + 80), y: 40, width, height, fill: '@background', themeId });
    p.nodes.push(frame);
    p.nodes.push(node('text', { id: `catalog-${kit.id}-title`, parentId: frame.id, name: 'Título del catálogo', x: padding, y: 34, width: width - padding * 2, height: 48, text: `${kit.name} · Kit original`, fontSize: 32, fontWeight: 700 }));
    p.nodes.push(node('text', { id: `catalog-${kit.id}-description`, parentId: frame.id, name: 'Descripción del kit', x: padding, y: 91, width: width - padding * 2, height: 40, text: kit.description + ' 20 componentes reutilizables · Todas las capas son editables.', fontSize: 15, color: '@muted' }));
    let y = 160;
    for (const [rowIndex, row] of rows.entries()) {
      for (const [col, item] of row.entries()) {
        const x = padding + col * (column + gutter), number = rowIndex * 2 + col + 1;
        p.nodes.push(node('text', { id: `catalog-${kit.id}-label-${number}`, parentId: frame.id, name: `Rótulo · ${item.name}`, x, y, width: column, height: 26, text: `${String(number).padStart(2, '0')} · ${item.name}`, fontSize: 14, fontWeight: 600, color: '@muted' }));
        const variant = ['toggle', 'checkbox', 'radio', 'avatar'].includes(item.id) ? 'selected' : 'default';
        const rootId = insertKitItem(p, kit.id, item.id, frame.id, x, y + 34, variant);
        const layers = subtree(p, rootId);
        const stableIds = new Map(layers.map((layer, layerIndex) => [layer.id, `catalog-${kit.id}-${item.id}-${layerIndex + 1}`]));
        for (const layer of layers) { layer.id = stableIds.get(layer.id)!; layer.parentId = stableIds.get(layer.parentId!) || layer.parentId; }
      }
      y += Math.max(...row.map(item => item.height)) + 76;
    }
  }
});
// Validate visible bounds of each top-level specimen as well as document schema (Store).
for (const frame of store.project.nodes.filter(n => n.type === 'frame')) {
  for (const n of store.project.nodes.filter(n => n.parentId === frame.id)) {
    if (n.x < 0 || n.y < 0 || n.x + n.width > frame.width || n.y + n.height > frame.height) throw new Error(`Specimen out of frame: ${n.name}`);
  }
  const instances = store.project.nodes.filter(n => n.parentId === frame.id && n.instanceOf);
  if (instances.length !== 20) throw new Error(`Incomplete catalog: ${frame.name}`);
  for (const root of instances) if (subtree(store.project, root.id).some(n => n.locked)) throw new Error('Catalog contains a locked child');
}
const path = fileURLToPath(new URL('../examples/kits-demo.codaru.json', import.meta.url));
// Compact JSON keeps the editable catalog lightweight despite its one hundred definitions.
writeFileSync(path, JSON.stringify(store.project) + '\n');
console.log(`Created ${path}: ${store.project.components.length} reusable definitions, ${store.project.nodes.length} editable layers.`);
