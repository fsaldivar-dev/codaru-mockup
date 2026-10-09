import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEditor, getEditorSession } from '../src/editor-core';
import { clone, createVariant, detach, duplicate, validate, type Project, subtree } from '../src/model';
import { getComponentImplementations as get, setComponentImplementation as set } from '../src/implementations';
import { implementationsDesign } from '../examples/implementations-design';
import type { ImplementationRequest } from '../src/contracts';

const fixture = () => { const f = implementationsDesign(); return { ...f, editor: createEditor({ document: f.document }) }; };
test('shared definition links update all instances, undo, round-trip and isolate snapshots and editors', () => {
  const { document, ids, editor } = fixture(), other = createEditor({ document });
  const reference = { symbol: 'UpdatedCard', path: 'src/Card.swift' };
  editor.setImplementation(ids.card, 'ios', reference); reference.symbol = 'External';
  assert.equal(editor.getImplementations(ids.first)!.implementations.ios.symbol, 'UpdatedCard');
  const snapshot = editor.getImplementations(ids.second)!; snapshot.implementations.ios.symbol = 'Snapshot';
  assert.equal(editor.getImplementations('card')!.implementations.ios.symbol, 'UpdatedCard');
  assert.equal(other.getImplementations(ids.second)!.implementations.ios.symbol, 'CardView');
  assert.deepEqual(validate(JSON.parse(JSON.stringify(editor.getDocument()))), editor.getDocument());
  editor.undo(); assert.equal(editor.getImplementations(ids.second)!.implementations.ios.symbol, 'CardView');
  editor.redo(); assert.equal(editor.getImplementations(ids.second)!.implementations.ios.symbol, 'UpdatedCard');
  editor.setImplementation(ids.card, 'ios', null); assert.ok(!editor.getImplementations(ids.second)!.implementations.ios);
  for (const platform of ['web', 'android']) editor.setImplementation(ids.card, platform, null);
  assert.equal(editor.getDocument().components.find(c => c.id === ids.card)!.implementations, undefined);
  editor.destroy(); other.destroy();
});

test('nearest nested boundary wins even without links; replacement slots resolve their current definition', () => {
  const { ids, editor } = fixture();
  const cardText = subtree(editor.getDocument(), ids.second).find(n => n.componentKey === 'card-title')!;
  assert.equal(editor.getImplementations(cardText.id)!.componentId, ids.card);
  const slot = editor.getComponentProperties(ids.second).find(p => p.type === 'slot')!.resolvedTargetId!;
  assert.deepEqual(editor.getImplementations(slot)!.implementations, {});
  editor.setImplementation(ids.logo, 'web', { symbol: 'Logo' });
  assert.equal(editor.getImplementations(slot)!.implementations.web.symbol, 'Logo');
  editor.setComponentProperty(ids.second, 'cabecera', ids.status);
  assert.equal(editor.getImplementations(slot)!.componentId, ids.status);
  assert.deepEqual(editor.getImplementations(slot)!.implementations, {});
  assert.equal(editor.getImplementations('screen'), null);
  assert.throws(() => editor.getImplementations('missing'));
  editor.destroy();
});

test('new variants copy links independently; duplicate, detach and orphan templates preserve the right ownership', () => {
  const { ids, editor } = fixture(); let variant = '', copy = '';
  editor.commit(p => { variant = createVariant(p, ids.card, { Size: 'Large' }).componentId; copy = duplicate(p, [ids.second])[0]; });
  assert.equal(editor.getImplementations(copy)!.componentId, ids.card);
  editor.setImplementation(variant, 'ios', { symbol: 'LargeCard' });
  assert.equal(editor.getImplementations(ids.second)!.implementations.ios.symbol, 'CardView');
  editor.commit(p => detach(p, copy)); assert.equal(editor.getImplementations(copy), null);
  const orphan = editor.getDocument(); const masterNodes = new Set(subtree(orphan, 'card').map(n => n.id));
  orphan.nodes = orphan.nodes.filter(n => !masterNodes.has(n.id));
  assert.equal(get(validate(orphan), ids.second)!.implementations.ios.symbol, 'CardView');
  editor.destroy();
});

test('malformed metadata rejects atomically on edits and imports, including bounds and unsafe paths', () => {
  const { ids, editor } = fixture(), before = editor.getDocument();
  const values: unknown[] = [undefined, [], {}, { symbol: '' }, { symbol: 'x'.repeat(201) }, { symbol: 'a\nb' }, { symbol: 'Card', module: '' }, { symbol: 'Card', code: 'execute()' }];
  for (const path of ['/Users/me/Card.swift', '../Card.swift', 'src/../Card.swift', 'https://host/Card', 'C:\\Card', './Card', 'src//Card', '%2e%2e/Card', 'Card?foo']) values.push({ symbol: 'Card', path });
  for (const reference of values) assert.throws(() => editor.apply([{ op: 'update', id: 'card-title', patch: { text: 'Must roll back' } }, { op: 'component.implementation.set', componentId: ids.card, platform: 'ios', reference: reference as any }]));
  for (const platform of ['__proto__', 'constructor', 'prototype', 'UPPER', '', 'x'.repeat(33)]) assert.throws(() => editor.setImplementation(ids.card, platform, { symbol: 'Card' }));
  assert.throws(() => editor.setImplementation('missing', 'web', { symbol: 'Card' }));
  const invalid = clone(before); invalid.components[0].implementations = JSON.parse('{"__proto__":{"symbol":"Injected"}}');
  assert.throws(() => validate(invalid));
  invalid.components[0].implementations = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`platform-${i}`, { symbol: 'C' }]));
  assert.throws(() => validate(invalid)); assert.deepEqual(editor.getDocument(), before);
  editor.destroy();
});

test('host navigation emits only an isolated intent, propagates errors and never changes history', async () => {
  const { document, ids } = implementationsDesign(), requests: ImplementationRequest[] = [];
  const editor = createEditor({ document, onImplementationRequest: request => { requests.push(structuredClone(request)); request.reference.symbol = 'Mutated by host'; } });
  const before = editor.getState(); await editor.requestImplementation(ids.second, 'ios');
  assert.deepEqual(requests, [{ nodeId: ids.second, ownerId: ids.second, componentId: ids.card, platform: 'ios', reference: document.components.find(c => c.id === ids.card)!.implementations!.ios }]);
  assert.deepEqual(editor.getState(), before);
  const second = createEditor({ document }); await assert.rejects(second.requestImplementation(ids.second, 'ios'), /IDE no configuró/);
  await assert.rejects(editor.requestImplementation(ids.second, 'linux'), /no tiene implementación/);
  getEditorSession(editor).setImplementationHandler(() => { throw new Error('Symbol missing'); });
  await assert.rejects(editor.requestImplementation(ids.second, 'ios'), /Symbol missing/);
  editor.destroy(); await assert.rejects(editor.requestImplementation(ids.second, 'ios'), /desmontado/); second.destroy();
});

test('agent discovers the operation, validates dry-run, conflicts and busy state and scopes references to emitted nodes', async () => {
  const { ids, editor } = fixture(); editor.setImplementation(ids.status, 'linux', { symbol: 'SecretOutsideScope' });
  const ctx = await editor.agent('context', { scope: ids.second, depth: 0 });
  assert.ok(JSON.stringify(ctx).includes('CardView')); assert.ok(!JSON.stringify(ctx).includes('SecretOutsideScope'));
  assert.ok(JSON.stringify(await editor.agent('schema')).includes('component.implementation.set'));
  const batch = { expectedRevision: ctx.context!.revision, operations: [{ op: 'component.implementation.set', componentId: ids.card, platform: 'macos', reference: { symbol: 'MacCard' } }] };
  assert.equal((await editor.agent('apply', { ...batch, dryRun: true })).ok, true); assert.ok(!editor.getImplementations(ids.second)!.implementations.macos);
  assert.equal((await editor.agent('apply', batch)).ok, true);
  assert.equal((await editor.agent('apply', batch)).error!.code, 'revision_conflict');
  const unbind = getEditorSession(editor).bindView({ render() {}, camera() {}, flush() {}, dispose() {}, isBusy: () => true });
  const current = await editor.agent('context');
  assert.equal((await editor.agent('apply', { ...batch, expectedRevision: current.context!.revision })).error!.code, 'editor_busy');
  assert.throws(() => editor.setImplementation(ids.card, 'web', null), /ocupado/);
  unbind(); editor.destroy();
});

test('v1/v2 documents without metadata remain readable and serializable', () => {
  const { document } = implementationsDesign(); for (const c of document.components) delete c.implementations;
  const old = { ...document, version: 1 } as unknown as Project;
  assert.equal(validate(old).version, 2); assert.deepEqual(validate(document), validate(JSON.parse(JSON.stringify(document))));
});
