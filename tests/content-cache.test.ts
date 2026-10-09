import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentCache, sameData } from '../src/content-cache';
import { isSanitizedSVG, sanitizeSVG, vectorLayers } from '../src/motion';

test('bounded exact-content cache evicts least recently used and oversized payloads', () => {
  const cache = new ContentCache<number>(2, 10);
  cache.set('aa', 1); cache.set('bb', 2); assert.equal(cache.get('aa'), 1);
  cache.set('cc', 3); assert.equal(cache.get('bb'), undefined);
  cache.set('oversized', 9); assert.equal(cache.get('oversized'), undefined);
  assert.equal(cache.get('aa'), 1); assert.equal(cache.get('cc'), 3);
  cache.set('aa', 4, 6); assert.equal(cache.get('cc'), undefined); assert.equal(cache.get('aa'), 4);
});

test('canonical validation never trusts changed content or mutable layer summaries', () => {
  const svg = sanitizeSVG('<svg viewBox="0 0 24 24"><rect id="shape" width="24" height="24" fill="#123456"/></svg>');
  assert.equal(isSanitizedSVG(svg), true);
  // Same length but unsafe URL: a cache must never identify SVG by its byte count.
  const unsafe = svg.replace('fill="#123456"', 'onload="evilx"');
  assert.equal(unsafe.length, svg.length); assert.equal(isSanitizedSVG(unsafe), false);
  const layers = vectorLayers(svg); layers[0].id = 'poisoned'; layers.push({ id: 'fake', tag: 'rect', depth: 0 });
  assert.deepEqual(vectorLayers(svg).map(l => l.id), ['shape']);
});

test('node comparison notices nested changes and equal-length payload replacement', () => {
  const a = { id: 'n', svg: 'red', data: [{ x: 1, text: 'same' }] };
  assert.equal(sameData(a, structuredClone(a)), true);
  assert.equal(sameData(a, { ...a, svg: 'tan' }), false);
  assert.equal(sameData(a, { ...a, data: [{ x: 2, text: 'same' }] }), false);
  assert.equal(sameData([1], { 0: 1 }), false);
});

test('prepared transactions reject forged/reused tokens and isolate retained drafts and snapshots', async () => {
  const { Store, blank, node } = await import('../src/model');
  const store = new Store(blank()); let retained: any;
  const staged = store.prepare(p => { retained = p; p.nodes.push(node('text', { id: 'title', text: 'Validated' })); });
  retained.nodes[0].text = 'Wrong';
  const copy = staged.getDocument(); copy.nodes[0].text = 'Wrong snapshot';
  assert.equal(store.project.nodes.length, 0);
  assert.throws(() => store.commitPrepared({ getDocument: () => copy }), /inválida/);
  store.commitPrepared(staged);
  assert.equal(store.project.nodes[0].text, 'Validated'); assert.equal(store.undoStack.length, 1);
  assert.throws(() => store.commitPrepared(staged), /ya aplicada/);
  assert.throws(() => store.prepare(p => { p.nodes[0].width = -1; }), /Tamaño/);
  assert.equal(store.project.nodes[0].width > 0, true); assert.equal(store.undoStack.length, 1);
  store.undo(); assert.equal(store.project.nodes.length, 0); store.redo(); assert.equal(store.project.nodes[0].text, 'Validated');
});
