import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../src/demo';
import { node, roleOf, screens, validate, addPage, updateNode } from '../src/model';
import { lintProject } from '../src/lint';
import { applyOperations, handleAgentRequest, type AgentHost } from '../src/agent';

function hostFor(p: ReturnType<typeof demo>): AgentHost {
  return { project: () => p, selection: () => [], scope: () => null, busy: () => false, commit: edit => edit(p), select: () => {}, undo: () => {}, redo: () => {} };
}

test('frames default to screen with a device and annotation without one; explicit roles win and nested nodes inherit', () => {
  const p = demo();
  const device = node('frame', { id: 'phone', name: 'Phone', x: 0, y: 0, device: 'iphone-16' }), note = node('frame', { id: 'note', name: 'Leyenda', x: 900, y: 0 });
  const lib = node('frame', { id: 'lib', name: 'Biblioteca', x: 1800, y: 0, role: 'library' }), kid = node('text', { id: 'kid', parentId: 'lib', text: 'Hola' });
  p.nodes.push(device, note, lib, kid);
  assert.equal(roleOf(p, device), 'screen'); assert.equal(roleOf(p, note), 'annotation'); assert.equal(roleOf(p, lib), 'library'); assert.equal(roleOf(p, kid), 'library');
  assert.throws(() => validate({ ...p, nodes: [...p.nodes, node('frame', { id: 'bad', role: 'poster' as never })] }), /Rol de marco inválido/);
});

test('lint skips target, safe-area and hinge on annotations and libraries but still checks contrast', () => {
  const p = demo();
  const kids = (parent: string, prefix: string) => [
    node('button', { id: `${prefix}-tiny`, parentId: parent, x: 20, y: 400, width: 30, height: 30, text: 'Ir', fill: '@primary', color: '#ffffff' }),
    node('text', { id: `${prefix}-faint`, parentId: parent, x: 20, y: 500, width: 200, height: 20, text: 'Casi invisible', color: '#e4e4ec' }),
  ];
  p.nodes.push(node('frame', { id: 'scr', name: 'Pantalla', x: 0, y: 2000, width: 390, height: 844, fill: '@background', role: 'screen', safeArea: { top: 59, bottom: 34, left: 0, right: 0 } }), ...kids('scr', 'scr'));
  p.nodes.push(node('frame', { id: 'ann', name: 'Notas', x: 600, y: 2000, width: 390, height: 844, fill: '@background', role: 'annotation', safeArea: { top: 59, bottom: 34, left: 0, right: 0 } }), ...kids('ann', 'ann'));
  const issues = lintProject(validate(p));
  const rules = (id: string) => issues.filter(i => i.node === id).map(i => i.rule);
  assert.ok(rules('scr-tiny').includes('target')); assert.ok(!rules('ann-tiny').includes('target'));
  assert.ok(rules('scr-faint').includes('contrast')); assert.ok(rules('ann-faint').includes('contrast'));
  assert.ok(!issues.some(i => i.node.startsWith('ann') && ['safe-area', 'hinge'].includes(i.rule)));
});

test('screens() lists screen frames in reading order, page by page, and ignores annotations and hidden frames', () => {
  const p = demo();
  for (const n of p.nodes) if (n.parentId === null && n.type === 'frame') n.role = 'screen';
  const pagos = addPage(p, 'Pagos');
  p.nodes.push(node('frame', { id: 'b', name: 'B', x: 0, y: 1200, role: 'screen', page: pagos.id }), node('frame', { id: 'a', name: 'A', x: 0, y: 0, role: 'screen', page: pagos.id }), node('frame', { id: 'a2', name: 'A2', x: 500, y: 10, role: 'screen', page: pagos.id }));
  p.nodes.push(node('frame', { id: 'legend', name: 'Leyenda', x: 0, y: 3000, page: pagos.id }), node('frame', { id: 'ghost', name: 'Oculta', x: 0, y: 4000, role: 'screen', hidden: true, page: pagos.id }));
  const v = validate(p);
  assert.deepEqual(screens(v).map(n => n.id), ['screen-login', 'screen-dashboard', 'a', 'a2', 'b']);
});

test('find locates nodes by name or text, filtered by type, frame and page, and context/lint/export accept a page', async () => {
  const p = demo(); const host = hostFor(p);
  const pagos = addPage(p, 'Pagos'); updateNode(p, 'screen-dashboard', { page: pagos.id });
  let r = await handleAgentRequest(host, { command: 'find', params: { query: 'bienvenid' } }) as any;
  assert.equal(r.ok, true); assert.ok(r.count >= 1); assert.ok(r.results.every((hit: any) => hit.id && hit.type && hit.page));
  r = await handleAgentRequest(host, { command: 'find', params: { query: 'e', type: 'button', frame: 'screen-login', limit: 1 } }) as any;
  assert.equal(r.results.length, 1); assert.equal(r.results[0].type, 'button'); assert.equal(r.results[0].frame, 'screen-login');
  r = await handleAgentRequest(host, { command: 'find', params: { query: 'e', page: pagos.id } }) as any;
  assert.ok(r.results.length > 0); assert.ok(r.results.every((hit: any) => hit.page === pagos.id));
  r = await handleAgentRequest(host, { command: 'find', params: {} }) as any; assert.equal(r.ok, false); assert.match(r.error.message, /query/);
  const ctx = await handleAgentRequest(host, { command: 'context', params: { page: pagos.id, depth: 0 } }) as any;
  assert.deepEqual(ctx.context.nodes.map((n: any) => n.id), ['screen-dashboard']);
  assert.equal(ctx.context.pages.find((x: any) => x.id === pagos.id).frames, 1); assert.equal(ctx.context.frames.find((f: any) => f.id === 'screen-dashboard').page, pagos.id);
  assert.ok(ctx.context.frames.every((f: any) => ['screen', 'annotation', 'library'].includes(f.role)));
  const lint = await handleAgentRequest(host, { command: 'lint', params: { page: pagos.id } }) as any;
  assert.equal(lint.ok, true); assert.ok(lint.issues.every((i: any) => i.frame === 'screen-dashboard' || i.frame === undefined), JSON.stringify(lint.issues.slice(0, 3)));
  const out = await handleAgentRequest(host, { command: 'export', params: { format: 'json', page: pagos.id } }) as any;
  assert.equal(out.ok, true); assert.ok(JSON.parse(out.content).nodes.every((n: any) => n.id === 'screen-dashboard' || n.parentId !== null));
  const missing = await handleAgentRequest(host, { command: 'export', params: { format: 'json', page: 'nope' } }) as any; assert.equal(missing.ok, false);
});

test('apply errors name the operation index, the field and the expected value, and a dry run reports every failure', async () => {
  const p = demo(); const host = hostFor(p);
  assert.throws(() => applyOperations(p, [{ op: 'update', id: 'screen-login', patch: { name: 'Ok' } }, { op: 'update', id: 'screen-login', patch: { fill: 'rojo' } }]), { message: 'op 1 (update): patch.fill debe ser HEX, "transparent" o "@alias"; llegó "rojo"' });
  assert.throws(() => applyOperations(p, [{ op: 'add', node: { type: 'text', width: 'ancho' } }]), /op 0 \(add\): node\.width debe ser un número; llegó "ancho"/);
  assert.throws(() => applyOperations(p, [{ op: 'update', id: 'screen-login', patch: { layout: 'grid' } }]), /op 0 \(update\): patch\.layout debe ser free\|vertical\|horizontal; llegó "grid"/);
  assert.throws(() => applyOperations(p, [{ op: 'update', id: 'nope', patch: {} }]), /op 0 \(update\): No existe/);
  // applyOperations is the raw mutator; atomicity is the host's job, so the document is captured after the direct calls.
  const before = JSON.stringify(p);
  const rev = (await handleAgentRequest(host, { command: 'context', params: { depth: 0 } }) as any).context.revision;
  const dry = await handleAgentRequest(host, { command: 'apply', params: { expectedRevision: rev, dryRun: true, operations: [
    { op: 'update', id: 'screen-login', patch: { fill: 'rojo' } }, { op: 'update', id: 'screen-login', patch: { name: 'Bien' } }, { op: 'update', id: 'nope', patch: { x: 1 } }, { op: 'add', node: { type: 'frame', role: 'poster' } },
  ] } }) as any;
  assert.equal(dry.ok, false); assert.equal(dry.dryRun, true); assert.deepEqual(dry.errors.map((e: any) => e.index), [0, 2, 3]);
  assert.match(dry.errors[0].message, /patch\.fill debe ser HEX/); assert.match(dry.errors[3 - 1].message, /node\.role debe ser screen\|annotation\|library/); assert.match(dry.error.message, /3 operaciones fallan/);
  assert.equal(JSON.stringify(p), before, 'a failed batch leaves the document untouched');
  const ok = await handleAgentRequest(host, { command: 'apply', params: { expectedRevision: rev, dryRun: true, operations: [{ op: 'update', id: 'screen-login', patch: { name: 'Bien' } }] } }) as any;
  assert.equal(ok.ok, true); assert.equal(JSON.stringify(p), before, 'dry runs never commit');
  const live = await handleAgentRequest(host, { command: 'apply', params: { expectedRevision: rev, operations: [{ op: 'update', id: 'screen-login', patch: { name: 'Bien' } }, { op: 'update', id: 'screen-login', patch: { opacity: 'alta' } }] } }) as any;
  assert.equal(live.ok, false); assert.match(live.error.message, /op 1 \(update\): patch\.opacity debe ser un número; llegó "alta"/); assert.equal(JSON.stringify(p), before, 'batches stay atomic');
});
