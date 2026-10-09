import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { blank, clone, node, Store, createComponent, instantiate, subtree, updateNode, remove, duplicate, syncComponents, validate, createVariant, switchVariant, detach, removeComponent, type Project } from '../src/model';
import { createEditor } from '../src/editor-core';

function fixture() {
  const p = blank(); p.nodes.push(node('frame', { id: 'f', width: 1400, height: 1000 }));
  p.nodes.push(node('group', { id: 'icon', parentId: 'f', width: 24, height: 24 }), node('ellipse', { id: 'dot', parentId: 'icon', width: 20, height: 20, fill: '#336699' }));
  const icon = createComponent(p, 'icon').id;
  p.nodes.push(node('group', { id: 'button', parentId: 'f', width: 200, height: 48, fill: '#7766cc' }), node('text', { id: 'label', name: 'Label', parentId: 'button', text: 'Base', textKey: 'button.base', x: 40, width: 140, height: 30 }));
  instantiate(p, icon, 'button', 8, 10);
  const button = createComponent(p, 'button').id;
  p.nodes.push(node('group', { id: 'card', parentId: 'f', width: 260, height: 200 }));
  const first = instantiate(p, button, 'card', 20, 20), second = instantiate(p, button, 'card', 20, 90);
  updateNode(p, subtree(p, first).find(n => n.type === 'text')!.id, { text: 'En tarjeta' });
  const card = createComponent(p, 'card').id, copy = instantiate(p, card, 'f', 500, 20);
  return { s: new Store(p), icon, button, card, first, second, copy };
}
const get = (p: Project, id: string) => p.nodes.find(n => n.id === id)!;
const texts = (p: Project, id: string) => subtree(p, id).filter(n => n.type === 'text');

test('three nested levels propagate in dependency order, with separate inherited and local overrides', () => {
  const { s, copy } = fixture(), labels = texts(s.project, copy), ids = subtree(s.project, copy).map(n => n.id);
  assert.deepEqual(labels.map(n => n.text), ['En tarjeta', 'Base']);
  s.commit(p => updateNode(p, labels[0].id, { text: 'Solo aquí', textKey: 'card.custom' }));
  s.commit(p => { p.components.reverse(); updateNode(p, 'label', { text: 'Nuevo', fontSize: 21 }); updateNode(p, 'dot', { fill: '#ff5533' }); });
  assert.deepEqual(texts(s.project, copy).map(n => n.text), ['Solo aquí', 'Nuevo']);
  assert.ok(texts(s.project, copy).every(n => n.fontSize === 21));
  assert.equal(get(s.project, labels[0].id).textKey, 'card.custom');
  assert.ok(subtree(s.project, copy).filter(n => n.type === 'ellipse').every(n => n.fill === '#ff5533'));
  assert.deepEqual(subtree(s.project, copy).map(n => n.id), ids);
  s.undo(); assert.equal(get(s.project, 'dot').fill, '#336699'); s.redo(); assert.equal(get(s.project, 'dot').fill, '#ff5533');
  const serialized = JSON.stringify(s.project); s.commit(() => {}); assert.equal(JSON.stringify(s.project), serialized, 'sync is idempotent');
  assert.deepEqual(validate(JSON.parse(serialized)), s.project);
});

test('adding/removing a leaf preserves sibling IDs and overrides; duplicate stays linked', () => {
  const { s, copy } = fixture(), before = subtree(s.project, copy).map(n => n.id); let twin = '';
  s.commit(p => { updateNode(p, texts(p, copy)[1].id, { text: 'Personalizado' }); twin = duplicate(p, [copy])[0]; });
  s.commit(p => p.nodes.push(node('rect', { id: 'badge', parentId: 'icon', width: 5, height: 5 })));
  assert.equal(subtree(s.project, copy).filter(n => n.componentKey === 'badge').length, 2);
  assert.ok(before.every(id => s.project.nodes.some(n => n.id === id)));
  assert.equal(texts(s.project, twin)[1].text, 'Personalizado');
  s.commit(p => remove(p, ['badge'])); assert.ok(!s.project.nodes.some(n => n.componentKey === 'badge'));
  assert.deepEqual(subtree(s.project, copy).map(n => n.id), before);
});

test('definition cycles, invalid template references and visual cycles roll back without touching history', () => {
  const { s, card } = fixture(), before = clone(s.project);
  for (const op of [(p: Project) => instantiate(p, card, 'icon', 0, 0), (p: Project) => updateNode(p, 'card', { parentId: 'card' })]) {
    assert.throws(() => s.commit(op), /cíclica/); assert.deepEqual(s.project, before); assert.equal(s.undoStack.length, 0);
  }
  const bad = clone(before); remove(bad, ['card']); const template = bad.components.find(c => c.id === card)!.template;
  template[1].instanceOf = 'missing'; assert.throws(() => validate(bad), /Referencia a componente/);
  template[1].instanceOf = card; assert.throws(() => validate(bad), /cíclica/);
});

test('templates keep dependencies alive and refresh after their master is removed', () => {
  const { s, copy, button } = fixture();
  s.commit(p => remove(p, ['card']));
  s.commit(p => updateNode(p, 'label', { fontSize: 23, text: 'Después' }));
  assert.deepEqual(texts(s.project, copy).map(n => n.text), ['En tarjeta', 'Después']);
  assert.ok(texts(s.project, copy).every(n => n.fontSize === 23));
  s.commit(p => remove(p, [copy, 'button']));
  assert.throws(() => s.commit(p => removeComponent(p, button)), /instancia/);
});

test('nested variant switches retain repeated labels, root identity, undo and subsequent propagation', () => {
  const { s, button, copy } = fixture(); let disabled = '';
  s.commit(p => { const v = createVariant(p, button, { Estado: 'Disabled' }); disabled = v.componentId; updateNode(p, v.masterId, { opacity: 40 }); });
  const buttons = subtree(s.project, copy).filter(n => n.instanceOf === button), label = texts(s.project, buttons[0].id)[0];
  s.commit(p => updateNode(p, label.id, { text: 'Mi acción' }));
  s.commit(p => switchVariant(p, buttons[0].id, { Estado: 'Disabled' }));
  assert.equal(get(s.project, buttons[0].id).instanceOf, disabled); assert.equal(get(s.project, buttons[0].id).opacity, 40);
  assert.equal(get(s.project, label.id).text, 'Mi acción'); assert.equal(get(s.project, buttons[1].id).instanceOf, button);
  const ids = subtree(s.project, copy).map(n => n.id);
  s.commit(p => updateNode(p, 'dot', { fill: '#119944' }));
  assert.equal(get(s.project, buttons[0].id).instanceOf, disabled); assert.equal(get(s.project, buttons[0].id).opacity, 40);
  assert.deepEqual(subtree(s.project, copy).map(n => n.id), ids);
  assert.ok(subtree(s.project, copy).filter(n => n.type === 'ellipse').every(n => n.fill === '#119944'));
  s.undo(); s.undo(); assert.equal(get(s.project, buttons[0].id).instanceOf, button); s.redo(); assert.equal(get(s.project, buttons[0].id).instanceOf, disabled);
});

test('outer variants retain distinct overrides in nested children with the same layer names', () => {
  const { s, card, copy } = fixture(); let compact = '';
  s.commit(p => { compact = createVariant(p, card, { Size: 'Compact' }).componentId; });
  const labels = texts(s.project, copy), ids = subtree(s.project, copy).map(n => n.id);
  s.commit(p => { updateNode(p, labels[0].id, { text: 'Uno' }); updateNode(p, labels[1].id, { text: 'Dos' }); });
  s.commit(p => switchVariant(p, copy, { Size: 'Compact' }));
  assert.equal(get(s.project, copy).instanceOf, compact); assert.deepEqual(texts(s.project, copy).map(n => n.text), ['Uno', 'Dos']);
  assert.deepEqual(subtree(s.project, copy).map(n => n.id), ids);
  s.commit(p => updateNode(p, 'label', { fontSize: 22 }));
  assert.deepEqual(texts(s.project, copy).map(n => n.text), ['Uno', 'Dos']);
  assert.ok(texts(s.project, copy).every(n => n.fontSize === 22));
});

test('detaching outer composition keeps nested components and their inherited text', () => {
  const { s, copy, button } = fixture();
  s.commit(p => detach(p, copy)); assert.equal(get(s.project, copy).instanceOf, undefined);
  assert.equal(subtree(s.project, copy).filter(n => n.instanceOf === button).length, 2);
  s.commit(p => updateNode(p, 'label', { text: 'Actualizado', fontSize: 24 }));
  assert.deepEqual(texts(s.project, copy).map(n => n.text), ['En tarjeta', 'Actualizado']);
  assert.ok(texts(s.project, copy).every(n => n.fontSize === 24));
});

test('agent transactions expose nested selection, reject cycles atomically and export source', async () => {
  const { s, card, copy } = fixture(), editor = createEditor({ document: s.project });
  const before = await editor.agent('context', { scope: copy, depth: 4 });
  const response = await editor.agent('apply', { expectedRevision: before.context!.revision, operations: [{ op: 'instance', componentId: card, parentId: 'icon', x: 0, y: 0 }] });
  assert.equal(response.ok, false); assert.deepEqual(editor.getDocument(), s.project); assert.equal(editor.getState().canUndo, false);
  const label = texts(s.project, copy)[0]; editor.select([label.id]);
  editor.apply([{ op: 'update', id: label.id, patch: { text: 'Desde el IDE' } }]);
  assert.equal(texts(editor.getDocument(), copy)[0].text, 'Desde el IDE');
  editor.undo(); assert.equal(texts(editor.getDocument(), copy)[0].text, 'En tarjeta'); editor.destroy();
});

test('nested propagation remains bounded on a document with hundreds of instances', () => {
  const { s, card } = fixture(); const p = clone(s.project);
  for (let i = 0; i < 200; i++) instantiate(p, card, 'f', i * 5, 300);
  const start = performance.now(); const store = new Store(p); store.commit(q => updateNode(q, 'dot', { fill: '#123456' }));
  const elapsed = performance.now() - start;
  assert.ok(store.project.nodes.length > 1800);
  assert.ok(store.project.nodes.filter(n => n.type === 'ellipse').every(n => n.fill === '#123456'));
  assert.ok(elapsed < 5000, `Update took ${elapsed.toFixed(0)}ms`);
  console.log(`Nested benchmark: ${store.project.nodes.length} layers, ${elapsed.toFixed(1)}ms (validate + transaction)`);
});

test('detaching preserves outer defaults on a deeply nested icon', () => {
  const { s, copy, first } = fixture();
  s.commit(p => updateNode(p, subtree(p, first).find(n => n.type === 'ellipse')!.id, { fill: '#aa1122' }));
  s.commit(p => detach(p, copy)); s.commit(p => updateNode(p, 'dot', { fill: '#445566', radius: 5 }));
  assert.deepEqual(subtree(s.project, copy).filter(n => n.type === 'ellipse').map(n => n.fill), ['#aa1122', '#445566']);
});

test('switching the outer variant preserves a locally chosen nested variant', () => {
  const { s, card, button, copy } = fixture(); let disabled = '';
  s.commit(p => { disabled = createVariant(p, button, { Estado: 'Disabled' }).componentId; createVariant(p, card, { Size: 'Compact' }); });
  const nested = subtree(s.project, copy).find(n => n.instanceOf === button)!;
  s.commit(p => switchVariant(p, nested.id, { Estado: 'Disabled' }));
  s.commit(p => switchVariant(p, copy, { Size: 'Compact' }));
  assert.equal(get(s.project, nested.id).instanceOf, disabled);
});

test('eight levels stay stable and excessive expansion is rejected atomically', () => {
  const { s, card } = fixture(); let previous = card;
  for (let i = 0; i < 5; i++) s.commit(p => { const root = node('group', { parentId: 'f', name: `Level ${i}` }); p.nodes.push(root); instantiate(p, previous, root.id, 0, 0); previous = createComponent(p, root.id).id; });
  const before = clone(s.project); s.commit(p => updateNode(p, 'dot', { fill: '#123456' }));
  assert.ok(s.project.nodes.filter(n => n.type === 'ellipse').every(n => n.fill === '#123456'));
  assert.deepEqual(s.project.nodes.map(n => n.id), before.nodes.map(n => n.id));
  const snapshot = clone(s.project), history = s.undoStack.length;
  assert.throws(() => s.commit(p => { for (let i = 0; i < 400; i++) instantiate(p, previous, 'f', 0, 0); }), /3000/);
  assert.deepEqual(s.project, snapshot); assert.equal(s.undoStack.length, history);
});

test('structural writes inside instances fail clearly instead of disappearing', () => {
  const { s, copy } = fixture(), before = clone(s.project);
  assert.throws(() => s.commit(p => p.nodes.push(node('rect', { parentId: copy }))), /edita su maestro/);
  assert.throws(() => s.commit(p => duplicate(p, [texts(p, copy)[0].id])), /edita su maestro/);
  assert.deepEqual(s.project, before); assert.equal(s.undoStack.length, 0);
});

test('legacy v1 component documents remain readable', () => {
  const { s } = fixture(), legacy = clone(s.project) as any; legacy.version = 1; delete legacy.designThemes; delete legacy.activeThemeId;
  const upgraded = validate(legacy); assert.equal(upgraded.version, 2); assert.equal(upgraded.nodes.length, s.project.nodes.length);
  const store = new Store(upgraded); store.commit(p => updateNode(p, 'dot', { fill: '#334455' }));
  assert.ok(store.project.nodes.filter(n => n.type === 'ellipse').every(n => n.fill === '#334455'));
});

test('a variant changed inside the master preserves text overrides in existing outer uses', () => {
  const { s, button, copy, first } = fixture();
  s.commit(p => { createVariant(p, button, { Estado: 'Disabled' }); });
  const label = texts(s.project, copy)[0], ids = subtree(s.project, copy).map(n => n.id);
  s.commit(p => updateNode(p, label.id, { text: 'Texto del usuario' }));
  s.commit(p => switchVariant(p, first, { Estado: 'Disabled' }));
  assert.equal(get(s.project, label.id)?.text, 'Texto del usuario');
  assert.deepEqual(subtree(s.project, copy).map(n => n.id), ids);
});

test('prefabricated platform kits compose inside masters and keep their variant/theme contracts', async () => {
  const { getKitItems, insertKitItem } = await import('../src/kits');
  const { s, copy } = fixture();
  for (const platform of ['ios', 'android', 'macos', 'linux', 'web'] as const) {
    let id = '';
    s.commit(p => { id = insertKitItem(p, platform, getKitItems(platform)[0].id, 'card', 0, 0); });
    const inherited = subtree(s.project, copy).find(n => n.componentKey === id)!;
    assert.ok(inherited.instanceOf); assert.equal(inherited.kitId, platform);
    assert.throws(() => s.commit(p => insertKitItem(p, platform, getKitItems(platform)[0].id, copy, 0, 0)), /edita el maestro/);
  }
});
