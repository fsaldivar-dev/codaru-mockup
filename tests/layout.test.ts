import test from 'node:test';
import assert from 'node:assert/strict';
import { blank, layoutProject, node, validate, type DesignNode, type Project } from '../src/model';
import { importFigma } from '../src/figma-import';

function row(patch: Partial<DesignNode>, kids: Partial<DesignNode>[]): { p: Project; box: DesignNode; kids: DesignNode[] } {
  const p = blank(), frame = node('frame', { id: 'f', width: 800, height: 600 }), box = node('card', { id: 'box', parentId: 'f', x: 0, y: 0, width: 400, height: 100, layout: 'horizontal', padding: 10, gap: 10, ...patch });
  const made = kids.map((kid, i) => node('rect', { id: `k${i}`, parentId: 'box', width: 50, height: 30, ...kid }));
  p.nodes.push(frame, box, ...made); layoutProject(p);
  return { p, box, kids: made };
}
const geometry = (kids: DesignNode[]) => kids.map(k => [k.x, k.y, k.width, k.height]);

test('defaults keep the original behavior: start, stretched, one line', () => {
  const { kids } = row({}, [{}, { sizing: 'fill' }, {}]);
  assert.deepEqual(geometry(kids), [[10, 10, 50, 80], [70, 10, 260, 80], [340, 10, 50, 80]]);
});

test('distribution, cross alignment and per-side padding position the children', () => {
  assert.deepEqual(geometry(row({ justify: 'center', align: 'center' }, [{}, {}]).kids), [[145, 35, 50, 30], [205, 35, 50, 30]]);
  assert.deepEqual(geometry(row({ justify: 'end', align: 'end' }, [{}, {}]).kids), [[280, 60, 50, 30], [340, 60, 50, 30]]);
  assert.deepEqual(geometry(row({ justify: 'between', align: 'start' }, [{}, {}, {}]).kids), [[10, 10, 50, 30], [175, 10, 50, 30], [340, 10, 50, 30]]);
  assert.deepEqual(geometry(row({ paddingSides: { top: 4, right: 40, bottom: 16, left: 20 } }, [{}, { sizing: 'fill' }]).kids), [[20, 4, 50, 80], [80, 4, 280, 80]]);
  const column = row({ layout: 'vertical', height: 300, justify: 'center', align: 'end' }, [{}, {}]);
  assert.deepEqual(geometry(column.kids), [[340, 115, 50, 30], [340, 155, 50, 30]]);
});

test('wrapping starts new lines, hugging resizes the container and limits clamp filled children', () => {
  const wrapped = row({ width: 200, align: 'start', wrap: true, hugHeight: true }, [{ width: 80 }, { width: 80 }, { width: 80, height: 50 }, { width: 80 }]);
  assert.deepEqual(geometry(wrapped.kids), [[10, 10, 80, 30], [100, 10, 80, 30], [10, 50, 80, 50], [100, 50, 80, 30]]);
  assert.equal(wrapped.box.height, 110);
  const hug = row({ hugWidth: true, hugHeight: true, align: 'center' }, [{ width: 60, height: 20 }, { width: 90, height: 44 }]);
  assert.deepEqual([hug.box.width, hug.box.height], [180, 64]);
  assert.deepEqual(geometry(hug.kids), [[10, 22, 60, 20], [80, 10, 90, 44]]);
  const limited = row({}, [{ sizing: 'fill', maxWidth: 120 }, { sizing: 'fill', minWidth: 200 }]);
  assert.deepEqual(limited.kids.map(k => k.width), [120, 200]);
  // A hugging child is measured before its parent places it.
  const p = blank();
  p.nodes.push(node('frame', { id: 'f', width: 500, height: 300, layout: 'vertical', padding: 20, gap: 10, align: 'start' }), node('card', { id: 'chip', parentId: 'f', width: 10, height: 10, layout: 'horizontal', padding: 8, gap: 4, hugWidth: true, hugHeight: true, align: 'center' }), node('rect', { id: 'dot', parentId: 'chip', width: 12, height: 12 }), node('rect', { id: 'label', parentId: 'chip', width: 60, height: 20 }), node('rect', { id: 'below', parentId: 'f', width: 100, height: 40 }));
  layoutProject(p);
  const chip = p.nodes[1], below = p.nodes[4];
  assert.deepEqual([chip.x, chip.y, chip.width, chip.height, below.y], [20, 20, 92, 36, 66]);
});

test('layout options are validated', () => {
  const { p } = row({ justify: 'between', align: 'center', wrap: true, paddingSides: { top: 1, right: 2, bottom: 3, left: 4 } }, [{ minWidth: 20, maxWidth: 80 }]);
  const valid = validate(p), broken = (edit: (nodes: any[]) => void) => () => { const copy = structuredClone(valid); edit(copy.nodes); validate(copy); };
  assert.throws(broken(nodes => { nodes[1].justify = 'around'; }), /Alineación/);
  assert.throws(broken(nodes => { nodes[1].wrap = 'yes'; }), /Opción/);
  assert.throws(broken(nodes => { nodes[1].paddingSides = { top: 1 }; }), /Márgenes/);
  assert.throws(broken(nodes => { nodes[2].minWidth = 90; }), /mínimo/);
  assert.throws(broken(nodes => { nodes[2].maxHeight = 0; }), /Límite/);
});

test('Figma auto layout is adopted when Codaru reproduces its geometry, with alignment, padding and hug', () => {
  const kid = (name: string, x: number, y: number, width: number, height: number) => ({ id: name, name, type: 'RECTANGLE', visible: true, x, y, width, height, fills: [{ type: 'SOLID', visible: true, opacity: 1, color: { r: 0, g: 0, b: 0 } }], stretch: false });
  const bar = { id: 'bar', name: 'Barra', type: 'FRAME', visible: true, x: 0, y: 0, width: 300, height: 56, fills: [], layout: { mode: 'HORIZONTAL', gap: 0, padding: [8, 24, 8, 16], primaryAlign: 'SPACE_BETWEEN', counterAlign: 'CENTER', wrap: false, primarySizing: 'FIXED', counterSizing: 'FIXED' }, children: [kid('a', 16, 16, 24, 24), kid('b', 126, 8, 40, 40), kid('c', 252, 16, 24, 24)] };
  const chip = { id: 'chip', name: 'Chip', type: 'FRAME', visible: true, x: 0, y: 80, width: 96, height: 32, fills: [], layout: { mode: 'HORIZONTAL', gap: 8, padding: [6, 12, 6, 12], primaryAlign: 'MIN', counterAlign: 'CENTER', wrap: false, primarySizing: 'AUTO', counterSizing: 'AUTO' }, children: [kid('dot', 12, 10, 12, 12), kid('text', 32, 6, 52, 20)] };
  const odd = { id: 'odd', name: 'Rara', type: 'FRAME', visible: true, x: 0, y: 140, width: 200, height: 60, fills: [], layout: { mode: 'HORIZONTAL', gap: -6, padding: [0, 0, 0, 0], primaryAlign: 'MIN', counterAlign: 'MIN', wrap: false }, children: [kid('x', 0, 0, 40, 40), kid('y', 34, 0, 40, 40)] };
  const screen = { id: 's', name: 'Pantalla', type: 'FRAME', visible: true, x: 0, y: 0, width: 300, height: 400, fills: [], children: [bar, chip, odd] };
  const p = blank(), report = importFigma(p, { format: 'codaru-figma-export', version: 1, nodes: [screen] });
  layoutProject(p); validate(p);
  const find = (name: string) => p.nodes.find(n => n.name === name)!;
  assert.deepEqual([find('Barra').layout, find('Barra').justify, find('Barra').align, find('Barra').paddingSides], ['horizontal', 'between', 'center', { top: 8, right: 24, bottom: 8, left: 16 }]);
  assert.deepEqual(p.nodes.filter(n => n.parentId === find('Barra').id).map(n => [n.x, n.y]), [[16, 16], [126, 8], [252, 16]]);
  assert.deepEqual([find('Chip').layout, find('Chip').hugWidth, find('Chip').hugHeight, find('Chip').width, find('Chip').height], ['horizontal', true, true, 96, 32]);
  assert.equal(find('Rara').layout, 'free');
  assert.deepEqual(p.nodes.filter(n => n.parentId === find('Rara').id).map(n => n.x), [0, 34]);
  assert.ok(report.notes.some(note => note.includes('no reproduce igual')));
});
