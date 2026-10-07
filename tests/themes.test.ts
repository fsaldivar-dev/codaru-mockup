import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank, clone, color, createComponent, instantiate, node, Store, updateNode, validate } from '../src/model';
import { defaultDesignTheme, effectiveTheme, resolveColor, resolveNodeStyle } from '../src/themes';
import { exportSVG } from '../src/render';

test('v1 migration is non-mutating and preserves legacy colors, geometry and gradients', () => {
  const current = blank();
  current.theme = 'dark'; current.themes.dark.primary = '#113355';
  current.nodes.push(node('frame', { id: 'screen', fill: '@background' }), node('rect', { id: 'shape', parentId: 'screen', gradient: 'linear', gradientAngle: 75, gradientEnd: '#abcdef', radiusTR: 30 }));
  const { designThemes: _themes, activeThemeId: _active, ...document } = current;
  const legacy = { ...document, version: 1 }; const before = clone(legacy);
  const migrated = validate(legacy);
  assert.deepEqual(legacy, before); assert.equal(migrated.version, 2); assert.equal(migrated.activeThemeId, 'project');
  assert.deepEqual(migrated.nodes, legacy.nodes); assert.deepEqual(migrated.themes, legacy.themes);
  assert.equal(color(migrated, '@primary', migrated.nodes[1]), '#113355');
  assert.ok(migrated.designThemes.project.modes.dark.materials.glass);
  assert.deepEqual(validate(JSON.parse(JSON.stringify(migrated))), migrated);
  assert.throws(() => validate({ ...migrated, version: 3 }), /versión/);
});

test('store transactions keep the normalized document returned by validation', () => {
  const s = new Store(blank());
  s.commit(p => { p.themes.light.primary = '#246810'; Object.assign(p, { version: 1, designThemes: undefined, activeThemeId: undefined }); });
  assert.equal(s.project.version, 2); assert.equal(s.project.activeThemeId, 'project');
  assert.equal(s.project.designThemes.project.modes.light.colors.primary, '#246810');
  assert.equal(s.undoStack.length, 1); s.undo(); assert.equal(color(s.project, '@primary'), '#7955e8');
});

test('themes inherit independently by profile and mode through frames and groups', () => {
  const p = blank(); p.designThemes.ocean = defaultDesignTheme('ocean', 'Océano');
  p.designThemes.ocean.modes.dark.colors.primary = '#123456';
  const frame = node('frame', { themeId: 'ocean', themeMode: 'dark' });
  const group = node('group', { parentId: frame.id });
  const child = node('button', { parentId: group.id }); p.nodes.push(frame, group, child);
  assert.equal(effectiveTheme(p, child).id, 'ocean'); assert.equal(effectiveTheme(p, child).mode, 'dark');
  assert.equal(resolveColor(p, '@primary', child), '#123456');
  group.themeMode = 'light'; assert.equal(effectiveTheme(p, child).mode, 'light');
  child.themeId = 'project'; assert.equal(resolveColor(p, '@primary', child), p.themes.light.primary);
  assert.equal(effectiveTheme(p, child).mode, 'light');
  child.themeMode = 'inherit'; group.themeMode = 'inherit'; assert.equal(effectiveTheme(p, child).mode, 'dark');
  assert.deepEqual(validate(p), p);
});

test('kit theme is a fallback and a later frame theme takes precedence', () => {
  const p = blank(); p.designThemes.kit = defaultDesignTheme('kit', 'Kit'); p.designThemes.ocean = defaultDesignTheme('ocean', 'Océano');
  const frame = node('frame', { themeMode: 'dark' }), master = node('button'); p.nodes.push(frame, master);
  const component = createComponent(p, master.id), id = instantiate(p, component.id, frame.id, 20, 20);
  const kit = p.nodes.find(n => n.id === id)!; updateNode(p, id, { kitId: 'basic', themeId: 'kit' });
  assert.equal(effectiveTheme(p, kit).id, 'kit'); assert.equal(effectiveTheme(p, kit).mode, 'dark');
  frame.themeId = 'ocean'; assert.equal(effectiveTheme(p, kit).id, 'ocean');
  assert.equal(effectiveTheme(p, kit).mode, 'dark');
  assert.deepEqual(validate(p), p);
});

test('legacy palette edits reach aliases and gradient references without affecting other profiles', () => {
  const p = blank(); p.designThemes.ocean = defaultDesignTheme('ocean', 'Océano');
  p.designThemes.project.modes.light.colors.cta = '@primary';
  const n = node('button', { fill: '@cta' }); p.nodes.push(n);
  p.themes.light.primary = '#115599';
  assert.equal(color(p, '@cta', n), '#115599');
  p.activeThemeId = 'ocean'; assert.equal(color(p, '@primary'), '#7955e8');
  n.themeId = 'project'; assert.equal(color(p, '@primary', n), '#115599');
  assert.equal(color(p, '#abcd', n), '#abcd');
});

test('bound typography, colors and radii stay live as tokens change', () => {
  const p = blank(), n = node('button', { fillToken: 'primary', typographyToken: 'body', radiusToken: 'control', gradient: 'linear' });
  p.nodes.push(n);
  const set = p.designThemes.project.modes.light;
  set.typography.body.fontSize = 21; set.radii.control = 28; p.themes.light.primary = '#224466';
  assert.deepEqual(resolveNodeStyle(p, n), { fill: '#224466', gradient: 'none', fontFamily: 'system', fontSize: 21, fontWeight: 400, lineHeight: 1.4, radius: 28 });
  assert.equal(n.fontSize, 16); assert.equal(n.radius, 10); assert.equal(n.fill, '@primary');
});

test('invalid aliases, references and token bounds roll back transactions atomically', () => {
  const p = blank(); p.nodes.push(node('button', { id: 'button', materialToken: 'glass' })); const s = new Store(p);
  const before = clone(s.project);
  const invalid = [
    () => s.commit(p => { p.designThemes.project.modes.light.colors.a = '@b'; p.designThemes.project.modes.light.colors.b = '@a'; }),
    () => s.commit(p => { p.themes.light.primary = '@missing'; }),
    () => s.commit(p => updateNode(p, 'button', { fillToken: 'missing' })),
    () => s.commit(p => updateNode(p, 'button', { materialToken: 'missing' })),
    () => s.commit(p => updateNode(p, 'button', { typographyToken: 'missing' })),
    () => s.commit(p => updateNode(p, 'button', { radiusToken: 'missing' })),
    () => s.commit(p => updateNode(p, 'button', { themeId: 'missing' })),
    () => s.commit(p => { delete p.designThemes.project.modes.light.materials.glass; }),
    () => s.commit(p => { p.designThemes.project.modes.light.materials.glass.blur = 41; }),
    () => s.commit(p => { p.designThemes.project.modes.light.gradients.brand.stops[1].position = -1; }),
    () => s.commit(p => { p.designThemes.project.modes.light.gradients.brand.stops[1].color = '@missing'; }),
    () => s.commit(p => { p.designThemes.project.modes.light.colors['bad;name'] = '#ffffff'; }),
  ];
  for (const edit of invalid) { assert.throws(edit); assert.deepEqual(s.project, before); assert.equal(s.undoStack.length, 0); }
});

test('token bindings and clearing bindings work as component instance overrides', () => {
  const p = blank(); const master = node('button', { id: 'master', typographyToken: 'body', radiusToken: 'control' }); p.nodes.push(master);
  const c = createComponent(p, master.id), id = instantiate(p, c.id, null, 250, 20); const s = new Store(p);
  s.commit(p => updateNode(p, id, { materialToken: 'glass', fillToken: 'brand', typographyToken: 'heading', radiusToken: undefined, themeMode: 'dark' }));
  s.commit(p => updateNode(p, 'master', { typographyToken: 'body', radiusToken: 'panel', text: 'Actualizado' }));
  const instance = s.project.nodes.find(n => n.id === id)!;
  assert.equal(instance.materialToken, 'glass'); assert.equal(instance.fillToken, 'brand'); assert.equal(instance.typographyToken, 'heading');
  assert.equal(instance.radiusToken, undefined); assert.equal(instance.themeMode, 'dark'); assert.equal(instance.text, 'Actualizado');
  assert.equal(resolveNodeStyle(s.project, instance).fontSize, 28);
  assert.deepEqual(validate(JSON.parse(JSON.stringify(s.project))), JSON.parse(JSON.stringify(s.project)));
  s.undo(); assert.equal(s.project.nodes.find(n => n.id === id)!.text, 'Continuar');
});

test('SVG exports all gradient stops in inherited theme and declares glass fallback', () => {
  const p = blank(), frame = node('frame', { themeMode: 'dark' });
  const n = node('rect', { parentId: frame.id, fillToken: 'brand', materialToken: 'glass', radiusToken: 'panel' });
  p.nodes.push(frame, n); p.themes.dark.primary = '#123456';
  p.designThemes.project.modes.dark.gradients.brand.stops.splice(1, 0, { color: '#445566', position: 35 });
  const svg = exportSVG(p, frame);
  assert.match(svg, /offset="0" stop-color="#123456"/); assert.match(svg, /offset="0.35" stop-color="#445566"/);
  assert.match(svg, /offset="1"/); assert.match(svg, /data-material-fallback="tint-and-border"/);
  assert.match(svg, /stop-opacity="0.68"/); assert.match(svg, /desenfoque del fondo/); // the glass alpha rides on each stop, as in the HTML view
  assert.doesNotMatch(svg, /@primary|backdrop-filter/);
});
