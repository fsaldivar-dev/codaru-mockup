import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Store, blank, clone, color, createComponent, duplicate, instantiate, node, updateNode, validate } from '../src/model';
import { getIconItems, iconPacks, iconSVG, insertIcon } from '../src/icon-library';
import { iconLicenseNotice } from '../src/icon-data';
import { exportSVG } from '../src/render';

test('four packs expose 96 recognizable, standalone vectors with trusted geometry only', () => {
  assert.deepEqual(iconPacks.map(pack => pack.id), ['mac', 'material', 'linux', 'web']);
  for (const pack of iconPacks) {
    const items = getIconItems(pack.id);
    assert.equal(items.length, 24); assert.equal(new Set(items.map(item => item.id)).size, 24);
    for (const item of items) {
      assert.ok(item.name && item.tags.length >= 2);
      const svg = iconSVG(pack.id, item.id, '#123456', 48);
      assert.match(svg, /viewBox="0 0 24 24"/); assert.match(svg, /width="48" height="48"/);
      assert.match(svg, /(?:path|circle|rect|polyline|polygon|line) /);
      assert.doesNotMatch(svg, /<script|<foreignObject|<image|href=|url\(|onload=|style=/i);
      assert.match(svg, /#123456/);
    }
  }
  assert.equal(new Set(iconPacks.map(pack => iconSVG(pack.id, 'home'))).size, 4);
});

test('icon references, geometry and colors cannot inject arbitrary SVG or external resources', () => {
  for (const [pack, name] of [['web', '<script>'], ['missing', 'home'], ['__proto__', 'home'], ['web', '__proto__']]) {
    assert.throws(() => iconSVG(pack, name), /Referencia/);
  }
  for (const color of ['red" onload="alert(1)', 'url(https://example.com/icon)', '@primary', 'rgb(0,0,0)', '#12345']) assert.throws(() => iconSVG('web', 'home', color), /Color/);
  for (const size of [0, -2, NaN, Infinity, 100001]) assert.throws(() => iconSVG('web', 'home', '#fff', size), /Tamaño/);
  assert.doesNotThrow(() => iconSVG('web', 'home', '#aabbccdd', 1));
  assert.doesNotThrow(() => iconSVG('web', 'home', 'currentColor', 24));
  const s = new Store(blank()); let id = '';
  s.commit(p => { id = insertIcon(p, 'material', 'home', null, 12, 16); }); const before = clone(s.project);
  for (const patch of [{ iconName: 'unknown' }, { iconPack: undefined }, { iconPack: 'web"' }]) {
    assert.throws(() => s.commit(p => updateNode(p, id, patch)), /icono/); assert.deepEqual(s.project, before);
  }
  assert.throws(() => insertIcon(s.project, 'web', 'home', 'missing', 0, 0), /Contenedor/);
  assert.throws(() => insertIcon(s.project, 'web', 'home', null, NaN, 0), /Geometría/);
});

test('all icon nodes survive Store, serialization, duplication, theme mode changes and undo', () => {
  const s = new Store(blank());
  s.commit(p => {
    const frame = node('frame', { id: 'frame', themeMode: 'dark' }); p.nodes.push(frame);
    for (const pack of iconPacks) for (const item of getIconItems(pack.id)) insertIcon(p, pack.id, item.id, frame.id, 16, 20, 36);
  });
  assert.equal(s.project.nodes.filter(n => n.type === 'icon').length, 96);
  const id = s.project.nodes.find(n => n.type === 'icon')!.id;
  s.commit(p => updateNode(p, id, { width: 80, height: 40, opacity: 35, color: '@primary' }));
  const icon = s.project.nodes.find(n => n.id === id)!;
  assert.equal(color(s.project, icon.color, icon), s.project.themes.dark.primary);
  const serialized = JSON.parse(JSON.stringify(s.project)); assert.deepEqual(validate(serialized), serialized);
  let copyId = ''; s.commit(p => { [copyId] = duplicate(p, [id]); });
  assert.equal(s.project.nodes.find(n => n.id === copyId)!.iconName, icon.iconName);
  assert.equal(s.project.nodes.find(n => n.id === copyId)!.color, '@primary');
  s.undo(); assert.ok(!s.project.nodes.some(n => n.id === copyId)); s.redo(); assert.ok(s.project.nodes.some(n => n.id === copyId));
  const defaultIcon = node('icon'); assert.equal(defaultIcon.iconPack, 'web'); assert.equal(defaultIcon.iconName, 'home'); assert.equal(defaultIcon.width, 24);
});

test('icon identity is editable in components and instance overrides remain local', () => {
  const p = blank(), master = node('icon', { id: 'master', iconPack: 'mac', iconName: 'home' }); p.nodes.push(master);
  const component = createComponent(p, master.id), a = instantiate(p, component.id, null, 80, 0), b = instantiate(p, component.id, null, 160, 0);
  const s = new Store(p);
  s.commit(p => updateNode(p, a, { iconPack: 'material', iconName: 'settings', color: '@primary' }));
  s.commit(p => updateNode(p, 'master', { iconPack: 'linux', iconName: 'user', width: 48, height: 48 }));
  assert.equal(s.project.nodes.find(n => n.id === a)!.iconPack, 'material'); assert.equal(s.project.nodes.find(n => n.id === a)!.iconName, 'settings');
  assert.equal(s.project.nodes.find(n => n.id === b)!.iconPack, 'linux'); assert.equal(s.project.nodes.find(n => n.id === b)!.iconName, 'user');
  assert.equal(s.project.nodes.find(n => n.id === a)!.width, 48);
  s.undo(); assert.equal(s.project.nodes.find(n => n.id === b)!.iconName, 'home');
  const g = node('group'); s.commit(p => { p.nodes.push(g); createComponent(p, g.id); });
  s.commit(p => { insertIcon(p, 'web', 'mail', g.id, 0, 0); });
  let instance = ''; s.commit(p => { instance = instantiate(p, p.nodes.find(n => n.id === g.id)!.componentId!, null, 0, 100); });
  assert.throws(() => s.commit(p => { insertIcon(p, 'web', 'mail', instance, 0, 0); }), /maestro/);
});

test('SVG export keeps nested icon placement, non-square bounds, theme color, opacity and exact license notices', () => {
  const p = blank(), frame = node('frame', { id: 'frame', x: 100, y: 200, themeMode: 'dark' }), group = node('group', { id: 'group', parentId: frame.id, x: 30, y: 40 });
  p.nodes.push(frame, group);
  const id = insertIcon(p, 'web', 'search', group.id, 5, 6, 48);
  updateNode(p, id, { width: 80, height: 40, color: '@primary', opacity: 35 }); p.themes.dark.primary = '#aabbcc';
  const svg = exportSVG(p, frame);
  assert.match(svg, /<g opacity="0.35"/); assert.match(svg, /<svg x="35" y="46"[^>]*width="80" height="40"[^>]*viewBox="0 0 24 24"/);
  assert.match(svg, /stroke="#aabbcc"/); assert.doesNotMatch(svg, /@primary/);
  assert.match(svg, /codaru-icon-licenses/); assert.match(svg, /ISC License/); assert.match(svg, /Permission to use, copy, modify/);
  assert.doesNotMatch(svg, /Apache License/);
  insertIcon(p, 'material', 'home', frame.id, 100, 50);
  assert.match(exportSVG(p, frame), /Apache License/);
});

test('vendored notices match exact source license hashes and exported upstream texts', () => {
  const sources = JSON.parse(readFileSync(new URL('../vendor/licenses/icon-sources.json', import.meta.url), 'utf8'));
  for (const pack of ['material', 'web']) {
    const source = sources[pack]; assert.match(source.commit, /^[a-f0-9]{40}$/); assert.equal(source.files.length, 24);
    const name = pack === 'material' ? 'material-Apache-2.0' : 'lucide-ISC';
    const text = readFileSync(new URL(`../vendor/licenses/${name}.txt`, import.meta.url), 'utf8');
    assert.equal(createHash('sha256').update(text).digest('hex'), source.licenseSha256);
    assert.ok(iconLicenseNotice([pack]).includes(text));
  }
  assert.equal(iconLicenseNotice(['mac', 'linux']), '');
});
