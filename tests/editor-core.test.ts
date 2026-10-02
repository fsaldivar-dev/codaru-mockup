import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditor, getEditorSession, type EditorState, type EditorViewHooks } from '../src/editor-core';
import { blank, node, type Project } from '../src/model';

function fixture() {
  const document = blank();
  document.nodes.push(
    node('frame', { id: 'home' }), node('frame', { id: 'detail', x: 600 }),
    node('group', { id: 'card', parentId: 'home' }),
    node('text', { id: 'title', parentId: 'card', text: 'Hola' }),
    node('button', { id: 'button', parentId: 'card', y: 60 }),
  );
  return document;
}
function hooks(overrides: Partial<EditorViewHooks> = {}): EditorViewHooks {
  return { render() {}, camera() {}, flush() {}, isBusy: () => false, dispose() {}, ...overrides };
}

test('a session works without a DOM, owns its document, and isolates other sessions', () => {
  assert.equal(typeof document, 'undefined');
  const initial = fixture(), first = createEditor({ document: initial }), second = createEditor({ document: initial });
  initial.nodes[0].name = 'Outside';
  first.apply([{ op: 'update', id: 'title', patch: { text: 'Edited' } }]);
  const copy = first.getDocument(); copy.nodes[0].name = 'Outside snapshot';
  assert.equal(first.getDocument().nodes[0].name, 'Pantalla');
  assert.equal(second.getDocument().nodes.find(n => n.id === 'title')?.text, 'Hola');
  assert.equal(first.getState().canUndo, true);
  first.undo(); assert.equal(first.getDocument().nodes.find(n => n.id === 'title')?.text, 'Hola');
  assert.equal(first.getState().canRedo, true);
  first.redo(); assert.equal(first.getDocument().nodes.find(n => n.id === 'title')?.text, 'Edited');
  assert.throws(() => first.exportHTML(), /DOM/);
  assert.throws(() => first.exportSVG('home'), /DOM/);
  first.destroy(); second.destroy();
});

test('selection scopes let a native inspector move between frames, groups, and their children', () => {
  const editor = createEditor({ document: fixture() });
  editor.select(['home', 'detail']);
  assert.deepEqual(editor.getState().selection, ['home', 'detail']);
  assert.equal(editor.getSelectionScope(), null);
  editor.enterScope('home'); editor.select(['title', 'button'], 'home');
  assert.deepEqual(editor.getState().selection, ['card']);
  editor.enterScope('card'); editor.select(['title', 'button']);
  assert.deepEqual(editor.getState().selection, ['title', 'button']);
  assert.equal(editor.getSelectionScope(), 'card');
  const selection = editor.getSelection(); selection[0].name = 'External';
  assert.notEqual(editor.getSelection()[0].name, 'External');
  editor.exitScope();
  assert.deepEqual(editor.getState().selection, ['card']);
  assert.equal(editor.getSelectionScope(), 'home');
  editor.apply([{ op: 'remove', ids: ['card'] }]);
  assert.deepEqual(editor.getState().selection, []);
  editor.exitScope(); assert.deepEqual(editor.getState().selection, ['home']);
  assert.throws(() => editor.enterScope('missing'), /contenedor/);
  editor.destroy();
});

test('transactions validate atomically, preserve history on failure, and discard external draft references', () => {
  const editor = createEditor({ document: fixture() }), before = editor.getDocument();
  assert.throws(() => editor.apply([
    { op: 'update', id: 'title', patch: { text: 'Should roll back' } },
    { op: 'update', id: 'button', patch: { width: -10 } },
  ]));
  assert.deepEqual(editor.getDocument(), before);
  assert.equal(editor.getState().canUndo, false);
  let retained!: Project;
  editor.commit(draft => { retained = draft; draft.name = 'My project'; });
  retained.name = 'Mutated after commit';
  assert.equal(editor.getDocument().name, 'My project');
  editor.undo(); assert.deepEqual(editor.getDocument(), before);
  const v1 = { ...before, version: 1 }; delete (v1 as Partial<Project>).designThemes;
  editor.importDocument(v1);
  assert.equal(editor.getDocument().version, 2);
  editor.destroy();
});

test('subscriptions have independent snapshots, deduplicate updates, and separate persistence from UI state', () => {
  const changes: Project[] = [], states: EditorState[] = [];
  const editor = createEditor({ document: fixture(), onChange: value => { changes.push(structuredClone(value)); value.name = 'Callback mutation'; } });
  editor.subscribe(value => { value.document.name = 'Subscriber mutation'; value.selection.push('outside'); });
  const off = editor.subscribe(value => states.push(value));
  assert.equal(states.length, 1);
  editor.select(['title']); editor.select(['title']);
  editor.setTool('rect'); editor.setMode('flow'); editor.setViewport({ zoom: 1.5, pan: { x: 12, y: -30 } });
  assert.equal(states.length, 5);
  assert.equal(changes.length, 0);
  assert.equal(states.at(-1)?.document.name, 'Mi primer mockup');
  assert.deepEqual(states.at(-1)?.selection, ['title']);
  editor.commit(p => { p.name = 'Committed'; });
  editor.commit(p => { p.name = 'Committed'; });
  assert.equal(changes.length, 1);
  assert.equal(editor.getDocument().name, 'Committed');
  off(); editor.setTool('cursor');
  assert.equal(states.length, 6);
  editor.destroy();
});

test('host selection synchronization is deferred without recursive subscriber calls', async () => {
  const editor = createEditor({ document: fixture() });
  let depth = 0, maximumDepth = 0, calls = 0;
  editor.subscribe(state => {
    depth++; maximumDepth = Math.max(maximumDepth, depth); calls++;
    if (state.selection.length) editor.select(state.selection);
    if (state.document.name === 'Trigger') editor.commit(p => { p.name = 'Handled'; });
    depth--;
  });
  editor.select(['title']);
  editor.commit(p => { p.name = 'Trigger'; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(maximumDepth, 1);
  assert.equal(editor.getDocument().name, 'Handled');
  assert.equal(calls, 4);
  editor.destroy();
});

test('one view shares state, blocks writes during a gesture, and can be unbound and remounted', async () => {
  const editor = createEditor({ document: fixture() }), session = getEditorSession(editor);
  let renders = 0, cameras = 0, busy = false;
  assert.equal(session.hasView(), false);
  const unbind = session.bindView(hooks({ render: () => { renders++; session.notify(false); }, camera: () => { cameras++; }, isBusy: () => busy }));
  assert.equal(session.hasView(), true);
  assert.throws(() => session.bindView(hooks()), /ya tiene/);
  editor.select(['title']); editor.setViewport({ zoom: 2 });
  assert.equal(renders, 1); assert.equal(cameras, 1); assert.deepEqual(session.state.selected, ['title']);
  busy = true;
  assert.throws(() => editor.commit(p => { p.name = 'Blocked'; }), /ocupado/);
  const blocked = await editor.agent('undo'); assert.equal(blocked.error?.code, 'editor_busy');
  busy = false; unbind();
  assert.equal(session.hasView(), false);
  let command = '';
  const unbindAgain = session.bindView(hooks({ command: async action => { command = action; } }));
  await editor.command('fit'); assert.equal(command, 'fit');
  unbindAgain(); await assert.rejects(editor.command('fit'), /vista montada/);
  editor.destroy();
});

test('host UI changes cannot replace an active editor field or interfere with gesture coordinates', async () => {
  const editor = createEditor({ document: fixture() }), session = getEditorSession(editor);
  let interacting = false, cameras = 0, command = '';
  editor.select(['title']);
  session.bindView(hooks({
    isBusy: () => true, isInteracting: () => interacting, camera: () => { cameras++; },
    command: async value => { command = value; },
  }));
  const before = editor.getState();
  assert.throws(() => editor.select(['button']), /ocupado/);
  assert.throws(() => editor.enterScope('home'), /ocupado/);
  assert.throws(() => editor.setTool('text'), /ocupado/);
  assert.throws(() => editor.setMode('flow'), /ocupado/);
  await assert.rejects(editor.command('undo'), /ocupado/);
  assert.deepEqual(editor.getState(), before);
  // Synchronizing an unchanged host selection is harmless and must not rebuild focused fields.
  editor.select(['title']); editor.setTool('cursor'); editor.setMode('design');
  editor.setViewport({ zoom: 2 }); assert.equal(cameras, 1);
  interacting = true;
  assert.throws(() => editor.setViewport({ zoom: 3 }), /ocupado/);
  assert.equal(editor.getState().viewport.zoom, 2);
  await editor.command('close-preview'); assert.equal(command, 'close-preview');
  editor.destroy();
});

test('failed view flush still disposes resources and retains the final valid document', () => {
  const editor = createEditor({ document: fixture() }), session = getEditorSession(editor);
  let disposed = 0;
  session.bindView(hooks({
    flush() { session.store.commit(p => { p.name = 'Saved before host error'; }); throw new Error('Host flush failed'); },
    dispose() { disposed++; },
  }));
  assert.throws(() => editor.destroy(), /Host flush failed/);
  assert.equal(editor.destroy().name, 'Saved before host error');
  assert.equal(disposed, 1);
  assert.throws(() => session.hasView(), /desmontado/);
});

test('destroy flushes the current edit, disposes once, and preserves a defensive final snapshot', () => {
  const changes: string[] = [];
  const editor = createEditor({ document: fixture(), onChange: p => changes.push(p.name) }), session = getEditorSession(editor);
  let disposed = 0;
  session.bindView(hooks({
    flush() { session.store.commit(p => { p.name = 'Flushed edit'; }); session.notify(true); },
    dispose() { disposed++; },
  }));
  const final = editor.destroy(); final.name = 'Outside';
  assert.equal(editor.destroy().name, 'Flushed edit');
  assert.deepEqual(changes, ['Flushed edit']); assert.equal(disposed, 1);
  assert.throws(() => editor.getDocument(), /desmontado/);
  assert.throws(() => editor.getSelection(), /desmontado/);
  assert.throws(() => editor.setViewport({ zoom: 2 }), /desmontado/);
  assert.throws(() => editor.commit(() => {}), /desmontado/);
  assert.throws(() => editor.subscribe(() => {}), /desmontado/);
  assert.throws(() => getEditorSession(editor), /desmontado/);
});

test('headless agent reuses revision, dry-run, atomic apply, catalog and history contracts', async () => {
  const editor = createEditor();
  const initial = await editor.agent('context'), revision = initial.context!.revision;
  const operations = [{ op: 'add', node: { type: 'frame', id: 'screen', name: 'Home' } }];
  const dry = await editor.agent('apply', { expectedRevision: revision, operations, dryRun: true });
  assert.equal(dry.ok, true); assert.equal(editor.getDocument().nodes.length, 0); assert.equal(editor.getState().canUndo, false);
  const applied = await editor.agent('apply', { expectedRevision: revision, operations });
  assert.equal(applied.ok, true); assert.equal(editor.getDocument().nodes.length, 1);
  const stale = await editor.agent('apply', { expectedRevision: revision, operations });
  assert.equal(stale.error?.code, 'revision_conflict');
  await editor.agent('select', { ids: ['screen'] }); assert.deepEqual(editor.getState().selection, ['screen']);
  assert.equal((await editor.agent('catalog', { kind: 'icons', kit: 'web' })).ok, true);
  const exported = await editor.agent('export', { format: 'json' });
  assert.equal(JSON.parse(exported.content as string).nodes[0].id, 'screen');
  await editor.agent('undo'); assert.equal(editor.getDocument().nodes.length, 0);
  await editor.agent('redo'); assert.equal(editor.getDocument().nodes.length, 1);
  editor.destroy(); await assert.rejects(editor.agent('context'), /desmontado/);
});
