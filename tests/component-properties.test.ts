import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank, node, createComponent, createVariant, instantiate, subtree, updateNode, syncComponents, Store, remove, validate, clone } from '../src/model';
import { defineComponentProperty as define, getComponentProperties as properties, setComponentProperty as set, removeComponentProperty } from '../src/component-properties';
import { createEditor } from '../src/editor-core';
function fixture() {
  const p = blank();
  p.nodes.push(node('group', { id: 'button', name: 'Button' }), node('text', { id: 'label', name: 'Label', parentId: 'button', text: 'Abrir', textKey: 'open' }));
  const button = createComponent(p, 'button').id;
  const variant = createVariant(p, button, { Estado: 'Suave' }); updateNode(p, variant.masterId, { fill: '#eeeeee' });
  p.nodes.push(node('group', { id: 'card', name: 'Card' }), node('icon', { id: 'icon', parentId: 'card', iconPack: 'material', iconName: 'star' }));
  const a = instantiate(p, button, 'card', 0, 0), b = instantiate(p, button, 'card', 0, 100);
  const label = subtree(p, a).find(n => n.type === 'text')!.id;
  updateNode(p, label, { text: 'En tarjeta' });
  const card = createComponent(p, 'card').id;
  define(p, card, 'titulo', { type: 'text', targetId: label, label: 'Título' });
  define(p, card, 'icono', { type: 'icon', targetId: 'icon', label: 'Icono' });
  define(p, card, 'mostrar', { type: 'visibility', targetId: a, label: 'Mostrar botón' });
  define(p, card, 'estado', { type: 'variant', targetId: a, axis: 'Estado', label: 'Estado' });
  const copy = instantiate(p, card, null, 500, 0), other = instantiate(p, card, null, 900, 0);
  return { s: new Store(p), button, card, copy, other, a, b, label, variant };
}
const state = (s: Store, id: string, key: string) => properties(s.project, id).find(p => p.key === key)!;

test('properties bind scoped repeated instances, preserve localization, reset just their fields', () => {
  const { s, copy, other, label } = fixture(); const id = state(s, copy, 'titulo').resolvedTargetId!;
  s.commit(p => set(p, copy, 'titulo', 'Local'));
  assert.equal(state(s, copy, 'titulo').value, 'Local'); assert.equal(state(s, other, 'titulo').value, 'En tarjeta');
  assert.equal(state(s, copy, 'titulo').textKey, 'open');
  assert.deepEqual(subtree(s.project, copy).filter(n => n.type === 'text').map(n => n.text), ['Local', 'Abrir']);
  s.commit(p => { updateNode(p, id, { fontSize: 22 }); updateNode(p, label, { text: 'Nuevo maestro' }); });
  s.commit(p => set(p, copy, 'titulo', null));
  assert.equal(state(s, copy, 'titulo').value, 'Nuevo maestro'); assert.equal(state(s, copy, 'titulo').overridden, false);
  assert.equal(s.project.nodes.find(n => n.id === id)!.fontSize, 22); s.undo(); assert.equal(state(s, copy, 'titulo').value, 'Local');
});

test('icon pairs, empty text and hidden targets round-trip and undo together', () => {
  const { s, copy } = fixture();
  s.commit(p => { set(p, copy, 'icono', { pack: 'web', name: 'heart' }); set(p, copy, 'mostrar', false); set(p, copy, 'titulo', ''); });
  assert.deepEqual(state(s, copy, 'icono').value, { pack: 'web', name: 'heart' }); assert.equal(state(s, copy, 'titulo').value, ''); assert.equal(state(s, copy, 'mostrar').value, false);
  assert.deepEqual(validate(JSON.parse(JSON.stringify(s.project))), s.project);
  s.undo(); assert.equal(state(s, copy, 'mostrar').value, true); s.redo();
  s.commit(p => { set(p, copy, 'icono', null); set(p, copy, 'mostrar', true); });
  assert.deepEqual(state(s, copy, 'icono').value, { pack: 'material', name: 'star' });
});

test('nested variant remaps a text binding, keeps local text and can reset', () => {
  const { s, copy } = fixture(); const id = state(s, copy, 'titulo').resolvedTargetId!;
  s.commit(p => { set(p, copy, 'titulo', 'Local'); set(p, copy, 'estado', 'Suave'); });
  assert.equal(state(s, copy, 'estado').value, 'Suave'); assert.equal(state(s, copy, 'estado').overridden, true);
  assert.equal(state(s, copy, 'titulo').value, 'Local'); assert.equal(state(s, copy, 'titulo').resolvedTargetId, id);
  s.commit(p => set(p, copy, 'titulo', 'Local suave')); assert.equal(state(s, copy, 'titulo').value, 'Local suave');
  s.commit(p => set(p, copy, 'estado', null)); assert.equal(state(s, copy, 'estado').value, 'Base'); assert.equal(state(s, copy, 'titulo').value, 'Local suave');
});

test('default edits propagate and new outer variants remap their property definitions', () => {
  const { s, copy, card } = fixture(); let next = '';
  s.commit(p => { set(p, 'card', 'titulo', 'Heredado'); next = createVariant(p, card, { Size: 'Grande' }).componentId; });
  assert.equal(state(s, copy, 'titulo').value, 'Heredado');
  const c = s.project.components.find(c => c.id === next)!;
  assert.notEqual(c.properties!.titulo.targetId, s.project.components.find(c => c.id === card)!.properties!.titulo.targetId);
  assert.ok(properties(s.project, c.masterId).every(p => p.available));
});

test('deleted bindings remain explicit and unavailable; removing contract keeps visual overrides', () => {
  const { s, copy, card } = fixture(); s.commit(p => set(p, copy, 'titulo', 'Local'));
  const id = state(s, copy, 'titulo').resolvedTargetId!;
  s.commit(p => removeComponentProperty(p, card, 'titulo'));
  assert.equal(s.project.nodes.find(n => n.id === id)!.text, 'Local');
  s.commit(p => remove(p, ['icon'])); assert.equal(state(s, copy, 'icono').available, false);
  assert.throws(() => s.commit(p => set(p, copy, 'icono', { pack: 'material', name: 'star' })), /ya no existe/);
});

test('malformed contracts and bad values reject atomically without polluting prototypes', () => {
  const { s, card, copy } = fixture(); const before = JSON.stringify(s.project);
  for (const [key, prop] of [['constructor', { type: 'text', label: 'x', targetId: 'label' }], ['x', { type: 'text', targetId: 'icon', label: 'x' }], ['x', { type: 'variant', targetId: 'card', axis: 'Estado', label: 'x' }]] as const) assert.throws(() => s.commit(p => define(p, card, key, prop)));
  for (const [key, value] of [['titulo', true], ['mostrar', 'false'], ['icono', { pack: 'web', name: 'does-not-exist' }], ['estado', 'missing']] as const) assert.throws(() => s.commit(p => { set(p, copy, 'titulo', 'Must rollback'); set(p, copy, key, value); }));
  assert.equal(JSON.stringify(s.project), before);
  const bad = clone(s.project); bad.components.find(c => c.id === card)!.properties = JSON.parse('{"__proto__":{"type":"text","label":"x","targetId":"icon"}}'); assert.throws(() => validate(bad));
});

test('core host and agent share semantic API, revision checks, bounded context and isolated snapshots', async () => {
  const { s, copy } = fixture(), editor = createEditor({ document: s.project }), second = createEditor({ document: s.project });
  const context = await editor.agent('context', { scope: copy, depth: 0 });
  const batch = { expectedRevision: context.context!.revision, operations: [{ op: 'component.property.set', id: copy, key: 'titulo', value: 'X'.repeat(300) }] };
  assert.equal((await editor.agent('apply', { ...batch, dryRun: true })).ok, true);
  assert.equal(editor.getComponentProperties(copy)[0].value, 'En tarjeta');
  assert.equal((await editor.agent('apply', batch)).ok, true);
  assert.equal((await editor.agent('apply', batch)).error!.code, 'revision_conflict');
  const next = await editor.agent('context', { scope: copy, depth: 0 });
  const props = (next.context!.nodes as Array<{ properties: Array<{ value: string; textTruncated?: boolean }> }>)[0].properties;
  assert.equal(props[0].value.length, 240); assert.equal(props[0].textTruncated, true);
  const snapshots = editor.getComponentProperties(copy); snapshots[0].value = 'Wrong';
  assert.equal(second.getComponentProperties(copy)[0].value, 'En tarjeta');
  editor.setComponentProperty(copy, 'titulo', 'Native controls'); editor.undo(); assert.equal(editor.getComponentProperties(copy)[0].value, 'X'.repeat(300));
  editor.destroy(); assert.throws(() => editor.getComponentProperties(copy)); second.destroy();
});

test('localization catalog controls preview while semantic text edits retain source key', () => {
  const { s, copy } = fixture(); const editor = createEditor({ document: s.project, localization: { locale: 'en', messages: { en: { open: 'Open' } } } });
  editor.setComponentProperty(copy, 'titulo', 'Fuente'); const prop = editor.getComponentProperties(copy)[0];
  assert.equal(prop.textKey, 'open'); assert.equal(editor.getPreviewDocument().nodes.find(n => n.id === prop.resolvedTargetId)!.text, 'Open');
  editor.setLocale(null); assert.equal(editor.getPreviewDocument().nodes.find(n => n.id === prop.resolvedTargetId)!.text, 'Fuente'); editor.destroy();
});
