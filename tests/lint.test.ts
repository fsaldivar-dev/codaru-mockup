import test from 'node:test';
import assert from 'node:assert/strict';
import { blank, node, Store, type DesignNode } from '../src/model';
import { contrastRatio, lintProject, lintSummary } from '../src/lint';
import { handleAgentRequest, type AgentHost } from '../src/agent';
import { demo } from '../src/demo';
import { demoDevices } from '../src/demo-devices';

function project(kids: Partial<DesignNode>[], frame: Partial<DesignNode> = {}) {
  const p = blank();
  p.nodes.push(node('frame', { id: 'f', name: 'Inicio', x: 0, y: 0, width: 390, height: 800, fill: '@background', ...frame }), ...kids.map((kid, i) => node((kid.type ?? 'text') as DesignNode['type'], { id: `n${i}`, parentId: 'f', x: 20, y: 60 + i * 70, ...kid })));
  return p;
}
const rules = (p: ReturnType<typeof project>) => lintProject(p).map(issue => `${issue.rule}:${issue.node}:${issue.severity}${issue.mode ? ':' + issue.mode : ''}`);

test('contrast is checked against the real background in light and dark, and only where it fails', () => {
  assert.equal(contrastRatio('#000000', '#ffffff').toFixed(1), '21.0');
  const p = project([
    { text: 'Correcto', color: '@text' },
    { text: 'Gris claro', color: '#c8c8d0' },
    { text: 'Fijo oscuro', color: '#1c1b22' },
    { text: 'Grande', color: '#8a8a94', fontSize: 28 },
    { type: 'button', text: 'Blanco sobre primario', color: '#ffffff', fill: '@primary' },
    { type: 'card', fill: '#20202a', width: 200, height: 60 },
  ]);
  p.nodes.push(node('text', { id: 'inside', parentId: 'n5', x: 8, y: 8, text: 'Sobre tarjeta', color: '#2c2c36' }));
  const found = rules(p);
  assert.ok(!found.some(rule => rule.startsWith('contrast:n0')), 'token text passes in both modes');
  assert.ok(found.includes('contrast:n1:error:light'), found.join(' '));
  assert.ok(found.includes('contrast:n2:error:dark'));
  assert.ok(!found.some(rule => rule === 'contrast:n2:error:light' || rule === 'contrast:n2:warning:light'));
  assert.ok(!found.some(rule => rule.startsWith('contrast:n3:') && rule.endsWith(':light')), 'large text only needs 3:1');
  assert.ok(found.includes('contrast:inside:error'), 'a fixed pair failing equally in both modes is reported once');
  const issue = lintProject(p).find(item => item.node === 'n2')!;
  assert.match(issue.message, /modo oscuro/); assert.match(issue.fix, /color fijo.*@text/);
  // A weak token is a theme problem, not a fixed color: the advice says so.
  const weak = project([{ text: 'Secundario', color: '@muted' }]); weak.designThemes.project.modes.light.colors.muted = '#b4b4c0'; weak.themes.light.muted = '#b4b4c0';
  const muted = lintProject(weak).find(item => item.rule === 'contrast')!;
  assert.equal(muted.mode, 'light'); assert.match(muted.fix, /El token @muted.*Temas/);
});

test('targets, small text, overflow, safe areas, hinges, overlaps and near misses are reported', () => {
  const p = project([
    { type: 'button', name: 'Diminuto', text: 'x', width: 24, height: 24, y: 200 },
    { name: 'Letra chica', text: 'nota', fontSize: 9, y: 240 },
    { type: 'rect', name: 'Fuera', x: 360, y: 300, width: 80 },
    { name: 'Bajo la isla', text: 'Hola', y: 10 },
    { name: 'Cruza', text: 'Texto sobre el pliegue', x: 150, y: 400, width: 120 },
    { type: 'button', name: 'A', text: 'A', x: 20, y: 500, width: 120, height: 48 },
    { type: 'button', name: 'B', text: 'B', x: 100, y: 520, width: 120, height: 48 },
    { type: 'rect', name: 'Casi', x: 22, y: 600, width: 40, height: 40 },
    { name: 'Largo', text: 'Un texto bastante largo que no cabe en una caja tan pequeña como esta', x: 20, y: 660, width: 120, height: 20 },
    { type: 'rect', name: 'Casi marca', x: 20, y: 720, width: 40, height: 40, fill: '#7a56e8' },
  ], { safeArea: { top: 59, right: 0, bottom: 34, left: 0 }, fold: { axis: 'vertical', gap: 0 } });
  const found = rules(p);
  for (const expected of ['target:n0:error', 'text-size:n1:warning', 'overflow:n2:warning', 'safe-area:n3:warning', 'hinge:n4:warning', 'overlap:n6:warning', 'alignment:n7:info', 'text-fit:n8:info', 'off-theme:n9:info']) assert.ok(found.includes(expected), `${expected} in ${found.join(' ')}`);
  assert.match(lintProject(p).find(item => item.rule === 'off-theme' && item.node === 'n9')!.fix, /@primary/);
  const summary = lintSummary(lintProject(p));
  assert.ok(summary.errors >= 1 && summary.warnings >= 5, JSON.stringify(summary)); assert.ok(summary.byRule.hinge >= 1 && summary.byRule.target === 1);
  assert.equal(lintProject(p, { frame: 'f' }).length, lintProject(p).length);
  const hidden = project([{ text: 'Oculto', color: '#ffffff', hidden: true }]);
  assert.equal(lintProject(hidden).length, 0);
});

test('the bundled examples pass the review without errors, and the agent exposes it', async () => {
  // Text over the brand color uses tokens and text over a sibling surface is judged against it,
  // so neither example has contrast errors in light or dark mode.
  for (const [label, example] of [['Forma', demo()], ['dispositivos', demoDevices()]] as const) {
    const errors = lintProject(example).filter(issue => issue.severity === 'error');
    assert.deepEqual(errors.map(issue => `${issue.rule} ${issue.message}`), [], label);
  }
  const store = new Store(project([{ text: 'Gris claro', color: '#c8c8d0' }]));
  const host: AgentHost = { project: () => store.project, selection: () => [], scope: () => null, busy: () => false, commit: edit => { store.commit(edit); }, select: () => {}, undo: () => store.undo(), redo: () => store.redo() } as AgentHost;
  const response = await handleAgentRequest(host, { command: 'lint', params: {} }) as any;
  assert.equal(response.ok, true); assert.equal(response.summary.errors, 1); assert.equal(response.issues[0].node, 'n0'); assert.ok(response.rules.contrast);
  const scoped = await handleAgentRequest(host, { command: 'lint', params: { frame: 'nope' } }) as any;
  assert.equal(scoped.ok, false);
});

test('a muddy primary color is reported as a palette without accent, a dark or saturated one is not', () => {
  const p = project([{ text: 'Hola', color: '@text' }]);
  const set = (light: string, dark: string) => { p.designThemes.project.modes.light.colors.primary = light; p.designThemes.project.modes.dark.colors.primary = dark; p.themes.light.primary = light; p.themes.dark.primary = dark; };
  set('#7a5438', '#d9b48e');
  const muddy = lintProject(p).filter(i => i.rule === 'palette');
  assert.equal(muddy.length, 2);
  assert.equal(muddy[0].severity, 'warning'); assert.equal(muddy[0].node, 'project'); assert.equal(muddy[0].frame, null);
  assert.match(muddy[0].message, /apagado/);
  set('#5b3df5', '#a99bff'); assert.equal(lintProject(p).filter(i => i.rule === 'palette').length, 0, 'saturated accent');
  set('#111111', '#f7f4ec'); assert.equal(lintProject(p).filter(i => i.rule === 'palette').length, 0, 'black anchor');
  set('#257b67', '#7bcbb1'); assert.equal(lintProject(p).filter(i => i.rule === 'palette').length, 0, 'teal');
  set('#e6e2dc', '#2a2826');
  const faint = lintProject(p).filter(i => i.rule === 'palette');
  assert.equal(faint.length, 2); assert.equal(faint[0].severity, 'error'); assert.match(faint[0].message, /no se distingue del fondo/);
  assert.equal(lintProject(demo()).filter(i => i.rule === 'palette').length, 0);
  assert.equal(lintProject(demoDevices()).filter(i => i.rule === 'palette').length, 0);
});
