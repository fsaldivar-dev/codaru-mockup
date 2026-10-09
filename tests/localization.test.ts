import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditor, getEditorSession } from '../src/editor-core';
import { blank, node, validate, createComponent, instantiate, updateNode, syncComponents } from '../src/model';
import { normalizeLocalization, resolveText, localizationIssues, type LocalizationConfig } from '../src/localization';

const config = (): LocalizationConfig => ({ locale: 'en', fallbackLocale: 'es', messages: { es: { title: 'Hola', missing: 'Respaldo' }, en: { title: 'Hello', empty: '' } } });
function fixture() { const p = blank(); p.nodes = [node('frame', { id: 'frame' }), node('text', { id: 'title', parentId: 'frame', text: 'Origen', textKey: 'title', width: 100, height: 40 })]; return p; }

test('locale resolution preserves empty strings and distinguishes fallback from missing translations', () => {
  const c = normalizeLocalization(config())!;
  assert.deepEqual(resolveText({ text: 'Origen', textKey: 'title' }, c), { text: 'Hello', source: 'translation', missing: false });
  assert.deepEqual(resolveText({ text: 'Origen', textKey: 'empty' }, c), { text: '', source: 'translation', missing: false });
  assert.deepEqual(resolveText({ text: 'Origen', textKey: 'missing' }, c), { text: 'Respaldo', source: 'fallback', missing: true });
  assert.deepEqual(resolveText({ text: 'Origen', textKey: 'unknown' }, c), { text: 'Origen', source: 'source', missing: true });
  assert.deepEqual(resolveText({ text: 'Origen', textKey: 'title' }, { ...c, locale: null }), { text: 'Origen', source: 'source', missing: false });
});

test('catalog validation and copies isolate host mutations and special property names', () => {
  const c = config(), copy = normalizeLocalization(c)!; c.messages.en.title = 'External';
  assert.equal(copy.messages.en.title, 'Hello');
  assert.throws(() => normalizeLocalization({ ...c, locale: 'fr' }), /idioma/i);
  assert.throws(() => normalizeLocalization({ ...c, fallbackLocale: 'fr' }), /respaldo/);
  assert.throws(() => normalizeLocalization({ ...c, messages: { en: { title: 1 as unknown as string } } }), /traducciones/);
  assert.throws(() => normalizeLocalization({ ...c, messages: { en: { ['x'.repeat(201)]: 'x' } } }), /claves/);
  const proto = normalizeLocalization({ locale: 'en', messages: { en: JSON.parse('{"__proto__":"Safe","constructor":"Also safe"}') } });
  assert.equal(resolveText({ text: '', textKey: '__proto__' }, proto).text, 'Safe');
  assert.equal(resolveText({ text: 'source', textKey: 'toString' }, proto).text, 'source');
});

test('preview changes do not change revision, persisted source, undo or another session', async () => {
  const changes: unknown[] = [], initial = config(), a = createEditor({ document: fixture(), localization: initial, onChange: d => changes.push(d) }), b = createEditor({ document: fixture(), localization: initial });
  const before = await a.agent('context'), source = a.getDocument();
  initial.messages.en.title = 'Outside';
  assert.equal(a.getPreviewDocument().nodes[1].text, 'Hello');
  a.setLocale('es'); assert.equal(a.getPreviewDocument().nodes[1].text, 'Hola');
  assert.equal(b.getPreviewDocument().nodes[1].text, 'Hello');
  assert.deepEqual(a.getDocument(), source); assert.equal(a.getState().canUndo, false); assert.equal(changes.length, 0);
  assert.equal((await a.agent('context')).context?.revision, before.context?.revision);
  const saved = await a.agent('export', { format: 'json' });
  assert.equal(JSON.parse(saved.content as string).nodes[1].text, 'Origen');
  a.getLocalization()!.messages.es.title = 'Mutation';
  a.getPreviewDocument().nodes[1].text = 'Mutation';
  assert.equal(a.getPreviewDocument().nodes[1].text, 'Hola');
  a.setLocalization(null); assert.equal(a.getPreviewDocument().nodes[1].text, 'Origen');
  assert.deepEqual(a.destroy(), source); b.destroy();
});

test('bindings validate, survive old documents, instances, overrides and history', () => {
  const p = fixture(); p.nodes.push(node('group', { id: 'group', parentId: 'frame' })); p.nodes[1].parentId = 'group';
  const component = createComponent(p, 'group');
  const instance = instantiate(p, component.id, null, 500, 0);
  const child = p.nodes.find(n => n.parentId === instance)!;
  assert.equal(child.textKey, 'title');
  updateNode(p, child.id, { textKey: 'instance.title' });
  updateNode(p, 'title', { textKey: 'master.title' }); syncComponents(p);
  assert.equal(p.nodes.find(n => n.id === child.id)?.textKey, 'instance.title'); validate(p);
  const editor = createEditor({ document: p });
  editor.apply([{ op: 'update', id: 'title', patch: { textKey: undefined } }]);
  assert.equal(editor.getDocument().nodes.find(n => n.id === 'title')?.textKey, undefined);
  editor.undo(); assert.equal(editor.getDocument().nodes.find(n => n.id === 'title')?.textKey, 'master.title');
  assert.throws(() => editor.apply([{ op: 'update', id: 'title', patch: { textKey: '' } }]), /textKey/);
  assert.throws(() => editor.apply([{ op: 'update', id: 'frame', patch: { textKey: 'bad' } }]), /textKey/);
  const old = fixture(); delete old.nodes[1].textKey; Object.assign(old, { version: 1 });
  assert.equal(validate(old).nodes[1].textKey, undefined); editor.destroy();
});

test('warnings omit hidden subtrees and estimate overflow without a DOM', () => {
  const p = fixture(), c = config(); c.messages.en.title = 'Long translation '.repeat(40);
  assert.deepEqual(localizationIssues(p, c).map(i => [i.kind, i.measurement]), [['overflow', 'metrics']]);
  delete c.messages.en.title;
  assert.equal(localizationIssues(p, c)[0].kind, 'missing');
  p.nodes[0].hidden = true; assert.deepEqual(localizationIssues(p, c), []);
  p.nodes[0].hidden = false; assert.deepEqual(localizationIssues(p, { ...c, locale: null }), []);
});

test('host intents and AI discovery do not transfer catalog ownership or interrupt edits', async () => {
  const requests: unknown[] = [], c = config();
  for (let i = 0; i < 102; i++) c.messages.en['entry.' + i] = 'x'.repeat(300);
  const editor = createEditor({ document: fixture(), localization: c, onTranslationRequest: r => { requests.push(r); } });
  await editor.requestTranslation('title');
  assert.deepEqual(requests, [{ nodeId: 'title', key: 'title', locale: 'en', sourceText: 'Origen', previewText: 'Hello' }]);
  const keys = await editor.agent('catalog', { kind: 'texts', query: 'entry.' });
  assert.equal(keys.truncated, true); assert.equal((keys.keys as any[]).length, 100); assert.equal((keys.keys as any[])[0].textTruncated, true);
  const context = (await editor.agent('context', { scope: 'title' })).context as any;
  assert.equal(context.nodes[0].textKey, 'title'); assert.equal(context.nodes[0].translation.text, 'Hello');
  const applied = await editor.agent('apply', { expectedRevision: context.revision, operations: [{ op: 'update', id: 'title', patch: { textKey: null } }] });
  assert.equal(applied.ok, true); assert.equal(editor.getDocument().nodes[1].textKey, undefined); editor.undo();
  const unbind = getEditorSession(editor).bindView({ isBusy: () => true, render() {}, camera() {}, flush() {}, dispose() {} });
  assert.equal((await editor.agent('locale', { locale: 'es' })).error?.code, 'editor_busy');
  assert.throws(() => editor.setLocalization(config()), /ocupado/);
  unbind(); assert.equal((await editor.agent('locale', { locale: null })).ok, true); assert.equal(editor.getPreviewDocument().nodes[1].text, 'Origen');
  editor.destroy(); await assert.rejects(editor.requestTranslation('title'), /desmontado/);
});
