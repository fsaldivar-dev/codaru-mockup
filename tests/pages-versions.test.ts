import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../src/demo';
import { Store, blank, clone, node, validate, updateNode, pagesOf, activePage, rootsOnPage, pageView, addPage, renamePage, removePage, movePage, buildVersion, addVersion, removeVersion, applyVersion, unpackVersion, compareVersion } from '../src/model';
import { applyOperations, handleAgentRequest, type AgentHost } from '../src/agent';

test('documents without pages get «Página 1», roots can move between pages and empty pages can be removed', () => {
  const p = demo();
  assert.deepEqual(pagesOf(p), [{ id: 'pagina-1', name: 'Página 1' }]); assert.equal(activePage(p).id, 'pagina-1');
  assert.equal(rootsOnPage(p, 'pagina-1').length, p.nodes.filter(n => n.parentId === null).length);
  const page = addPage(p, '  Onboarding  ');
  assert.equal(page.name, 'Onboarding'); assert.equal(pagesOf(p).length, 2); assert.equal(pagesOf(p)[0].id, 'pagina-1');
  updateNode(p, 'screen-dashboard', { page: page.id });
  assert.deepEqual(rootsOnPage(p, page.id).map(n => n.id), ['screen-dashboard']);
  const view = pageView(p, page.id);
  assert.ok(view.nodes.every(n => n.id === 'screen-dashboard' || n.parentId !== null)); assert.ok(view.nodes.length > 1 && view.nodes.length < p.nodes.length);
  assert.ok(!pageView(p, 'pagina-1').nodes.some(n => n.id === 'screen-dashboard'));
  assert.throws(() => removePage(p, page.id), /moveTo/);
  assert.throws(() => removePage(p, page.id, page.id), /otra página/);
  renamePage(p, page.id, 'Alta'); assert.equal(pagesOf(p)[1].name, 'Alta');
  movePage(p, page.id, 0); assert.equal(pagesOf(p)[0].id, page.id);
  updateNode(p, 'screen-dashboard', { page: 'pagina-1' }); removePage(p, page.id); assert.equal(pagesOf(p).length, 1);
  assert.throws(() => removePage(p, 'pagina-1'), /al menos una/);
  assert.throws(() => addPage(p, 'x', 'bad id!'), /inválido/);
  const bad = clone(p); bad.activePageId = 'nope'; assert.equal(validate(bad).activePageId, 'pagina-1');
  const broken = clone(p); broken.pages = [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }]; assert.throws(() => validate(broken), /Páginas inválidas/);
});

test('versions pack the design with gzip, restore through a commit and report screen-level differences', async () => {
  const s = new Store(demo());
  const v1 = await buildVersion(s.project, 'Entrega v1', 'Primera entrega');
  assert.match(v1.id, /^v-/); assert.equal(v1.name, 'Entrega v1'); assert.equal(v1.note, 'Primera entrega'); assert.equal(v1.screens, 2);
  assert.ok(v1.data.length < s.serialize().length / 3, 'compressed');
  s.commit(p => addVersion(p, v1));
  s.commit(p => { updateNode(p, 'screen-login', { name: 'Bienvenida 2' }); p.nodes.push(node('frame', { id: 'extra', name: 'Extra', x: 1000, y: 100 })); });
  const payload = await unpackVersion(v1.data);
  assert.equal(payload.nodes!.length, demo().nodes.length); assert.equal(payload.versions, undefined);
  const diff = compareVersion(s.project, payload);
  assert.deepEqual(diff.added, ['Extra']); assert.deepEqual(diff.changed, ['Bienvenida 2']); assert.deepEqual(diff.removed, []);
  s.commit(p => applyVersion(p, payload));
  assert.equal(s.project.nodes.find(n => n.id === 'screen-login')!.name, demo().nodes.find(n => n.id === 'screen-login')!.name);
  assert.ok(!s.project.nodes.some(n => n.id === 'extra')); assert.equal(s.project.versions!.length, 1, 'restoring keeps the version list');
  s.undo(); assert.ok(s.project.nodes.some(n => n.id === 'extra'));
  s.commit(p => removeVersion(p, v1.id)); assert.equal(s.project.versions, undefined);
  const tooMany = blank(); tooMany.versions = Array.from({ length: 30 }, (_, i) => ({ ...v1, id: `v-${i}` })); assert.throws(() => addVersion(tooMany, v1), /Máximo 30/);
  await assert.rejects(unpackVersion('AAAA'), /./);
});

test('agents manage pages and versions through apply and read them in context', async () => {
  const p = demo();
  const host: AgentHost = { project: () => p, selection: () => [], scope: () => null, busy: () => false, commit: edit => edit(p), select: () => {}, undo: () => {}, redo: () => {} };
  const ctx = async () => (await handleAgentRequest(host, { command: 'context', params: { depth: 0 } }) as any).context;
  let c = await ctx();
  assert.deepEqual(c.pages, [{ id: 'pagina-1', name: 'Página 1', frames: 2, nodes: p.nodes.length }]); assert.equal(c.activePageId, 'pagina-1'); assert.equal(c.frames[0].page, 'pagina-1');
  let r = await handleAgentRequest(host, { command: 'apply', params: { expectedRevision: c.revision, operations: [{ op: 'page', action: 'create', name: 'Pagos', id: 'pagos' }, { op: 'update', id: 'screen-dashboard', patch: { page: 'pagos' } }, { op: 'add', node: { id: 'cobro', type: 'frame', name: 'Cobro', page: 'pagos', x: 600, y: 100, width: 390, height: 844 } }, { op: 'page', action: 'activate', id: 'pagos' }, { op: 'version.save', name: 'Con pagos' }] } }) as any;
  assert.equal(r.ok, true, r.error?.message);
  c = await ctx();
  assert.equal(c.activePageId, 'pagos'); assert.deepEqual(c.frames.filter((f: any) => f.page === 'pagos').map((f: any) => f.id), ['screen-dashboard', 'cobro']);
  assert.equal(c.versions.length, 1); assert.equal(c.versions[0].name, 'Con pagos');
  const list = await handleAgentRequest(host, { command: 'versions', params: { compare: c.versions[0].id } }) as any;
  assert.equal(list.ok, true); assert.deepEqual(list.compare.added, []);
  r = await handleAgentRequest(host, { command: 'apply', params: { expectedRevision: c.revision, operations: [{ op: 'remove', ids: ['cobro'] }, { op: 'version.restore', id: c.versions[0].id }] } }) as any;
  assert.equal(r.ok, true, r.error?.message); assert.ok(p.nodes.some(n => n.id === 'cobro'), 'restore brought the screen back');
  assert.throws(() => applyOperations(p, [{ op: 'page', action: 'remove', id: 'pagos' }]), /op 0 \(page\): .*moveTo/);
  applyOperations(p, [{ op: 'page', action: 'remove', id: 'pagos', moveTo: 'pagina-1' }]); assert.equal(pagesOf(p).length, 1); assert.equal(p.nodes.find(n => n.id === 'cobro')!.page, 'pagina-1');
  assert.equal((await ctx()).pages[0].frames, 3);
  const bad = await handleAgentRequest(host, { command: 'apply', params: { expectedRevision: (await ctx()).revision, operations: [{ op: 'version.restore', id: 'nope' }] } }) as any;
  assert.equal(bad.ok, false); assert.match(bad.error.message, /Versión no encontrada/);
});

test('documents saved with pageId open with the same screens on the same pages', () => {
  const p = demo(); p.pages = [{ id: 'pagina-1', name: 'Página 1' }, { id: 'pagos', name: 'Pagos' }];
  (p.nodes.find(n => n.id === 'screen-dashboard') as any).pageId = 'pagos';
  const v = validate(p);
  assert.equal(v.nodes.find(n => n.id === 'screen-dashboard')!.page, 'pagos'); assert.ok(!('pageId' in v.nodes.find(n => n.id === 'screen-dashboard')!));
  assert.equal(v.nodes.find(n => n.id === 'screen-login')!.page, 'pagina-1');
  const legacy = demo(); delete legacy.pages; delete legacy.activePageId; assert.deepEqual(pagesOf(validate(legacy)), [{ id: 'pagina-1', name: 'Página 1' }]);
});
