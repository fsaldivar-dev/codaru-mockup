import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store, blank, clone, color, node, subtree, updateNode, validate } from '../src/model';
import { defaultDesignTheme, effectiveTheme, resolveNodeStyle } from '../src/themes';
import { ensureKitTheme, getKitItems, insertKitItem, kits, type KitVariant } from '../src/kits';

test('five original kits expose twenty templates each without eagerly importing definitions', () => {
  const p = blank();
  assert.deepEqual(kits.map(k => k.id), ['ios', 'macos', 'android', 'linux', 'web']);
  for (const kit of kits) {
    const items = getKitItems(kit.id);
    assert.equal(items.length, 20);
    assert.equal(new Set(items.map(i => i.id)).size, 20);
    assert.ok(items.every(i => i.width > 0 && i.height > 0 && i.name && i.category));
  }
  assert.equal(p.components.length, 0);
  assert.deepEqual(Object.keys(p.designThemes), ['project']);
  assert.equal(new Set(kits.map(k => getKitItems(k.id).find(i => i.id === 'button')!.height)).size, 5);
});

test('all one hundred templates and their three variants round-trip through Store with editable children', () => {
  for (const kit of kits) for (const item of getKitItems(kit.id)) for (const variant of ['default', 'selected', 'disabled'] as KitVariant[]) {
    const s = new Store(blank()); let id = '';
    s.commit(p => { id = insertKitItem(p, kit.id, item.id, null, 40, 60, variant); });
    const root = s.project.nodes.find(n => n.id === id)!;
    assert.equal(root.type, 'group');
    assert.equal(root.width, item.width); assert.equal(root.height, item.height);
    assert.equal(root.opacity, variant === 'disabled' ? 45 : 100);
    assert.equal(root.instanceOf, `kit-${kit.id}-${item.id}-${variant}-v1`);
    const editable = subtree(s.project, id);
    assert.ok(editable.length >= 3, `${kit.id}/${item.id} must contain editable shapes or text`);
    assert.ok(editable.every(n => !n.locked && !n.image && n.componentKey));
    assert.ok(editable.some(n => n.type === 'text' || n.type === 'rect' || n.type === 'ellipse'));
    assert.equal(s.project.components.length, 1);
    const serialized = JSON.parse(JSON.stringify(s.project));
    assert.deepEqual(validate(serialized), serialized);
    s.commit(p => { p.theme = 'dark'; });
    for (const n of s.project.nodes) assert.doesNotThrow(() => { color(s.project, n.fill, n); resolveNodeStyle(s.project, n); });
  }
});

test('insertion registers only the requested reusable definitions and preserves local edits', () => {
  const s = new Store(blank()); let first = '', second = '';
  s.commit(p => { first = insertKitItem(p, 'ios', 'button', null, 0, 0); second = insertKitItem(p, 'ios', 'button', null, 200, 0); });
  assert.equal(s.project.components.length, 1);
  const firstLabel = subtree(s.project, first).find(n => n.type === 'text')!;
  const secondLabel = subtree(s.project, second).find(n => n.type === 'text')!;
  s.commit(p => updateNode(p, firstLabel.id, { text: 'Mi acción' }));
  s.commit(p => { const template = p.components[0].template.find(n => n.id === secondLabel.componentKey)!; template.text = 'Texto compartido'; template.fontWeight = 700; });
  assert.equal(s.project.nodes.find(n => n.id === firstLabel.id)!.text, 'Mi acción');
  assert.equal(s.project.nodes.find(n => n.id === secondLabel.id)!.text, 'Texto compartido');
  assert.equal(s.project.nodes.find(n => n.id === firstLabel.id)!.fontWeight, 700);
  s.commit(p => { insertKitItem(p, 'ios', 'button', null, 400, 0, 'selected'); });
  assert.equal(s.project.components.length, 2);
  s.undo(); assert.equal(s.project.components.length, 1);
  s.redo(); assert.equal(s.project.components.length, 2);
});

test('kit themes have distinct modes, preserve user edits and yield to an explicit frame theme', () => {
  const s = new Store(blank()); let id = '', kitThemeId = '';
  s.commit(p => { kitThemeId = ensureKitTheme(p, 'android'); p.designThemes[kitThemeId].modes.light.colors.primary = '#125634'; });
  const saved = clone(s.project.designThemes[kitThemeId]);
  s.commit(p => { ensureKitTheme(p, 'android'); id = insertKitItem(p, 'android', 'button', null, 0, 0); });
  assert.deepEqual(s.project.designThemes[kitThemeId], saved);
  const shape = subtree(s.project, id).find(n => n.name === 'Fondo de botón')!;
  assert.equal(color(s.project, shape.fill, shape), '#125634');
  s.commit(p => { p.theme = 'dark'; });
  assert.equal(color(s.project, shape.fill, shape), saved.modes.dark.colors.primary);
  let frameId = '', insideId = '';
  s.commit(p => {
    const custom = defaultDesignTheme('custom', 'Tema de la pantalla'); custom.modes.light.colors.primary = '#aa4400'; custom.modes.dark.colors.primary = '#eeaa77';
    p.designThemes.custom = custom;
    const frame = node('frame', { themeId: 'custom', themeMode: 'light' }); frameId = frame.id; p.nodes.push(frame);
    insideId = insertKitItem(p, 'android', 'card', frameId, 16, 16);
  });
  assert.equal(s.project.nodes.find(n => n.id === frameId)!.themeId, 'custom');
  assert.equal(s.project.nodes.find(n => n.id === insideId)!.themeId, undefined);
  const customShape = subtree(s.project, insideId).find(n => n.fill === '@primary')!;
  assert.equal(color(s.project, '@primary', customShape), '#aa4400');
  s.commit(p => updateNode(p, frameId, { themeMode: 'dark' }));
  assert.equal(color(s.project, '@primary', customShape), '#eeaa77');
  // A frame may receive a theme after insertion; it also overrides a kit fallback already present.
  s.commit(p => updateNode(p, id, { parentId: frameId }));
  assert.equal(effectiveTheme(s.project, s.project.nodes.find(n => n.id === shape.id)).id, 'custom');
});

test('all kits inherit default project tokens in an explicitly themed frame', () => {
  for (const kit of kits) {
    const s = new Store(blank());
    s.commit(p => {
      const frame = node('frame', { themeId: 'project', width: 900, height: 900 }); p.nodes.push(frame);
      for (const item of getKitItems(kit.id)) insertKitItem(p, kit.id, item.id, frame.id, 0, 0);
    });
    assert.equal(s.project.components.length, 20);
    assert.ok(s.project.nodes.filter(n => n.instanceOf).every(n => effectiveTheme(s.project, n).id === 'project'));
  }
});

test('insertion rejects invalid containers and structural edits to instances without mutating the document', () => {
  const s = new Store(blank()); let id = '', plainGroup = '';
  s.commit(p => { id = insertKitItem(p, 'web', 'button', null, 0, 0); const g = node('group'); plainGroup = g.id; p.nodes.push(g); });
  const before = clone(s.project);
  assert.throws(() => s.commit(p => { insertKitItem(p, 'web', 'field', id, 0, 0); }), /edita el maestro/);
  assert.deepEqual(s.project, before);
  assert.throws(() => insertKitItem(s.project, 'web', 'button', 'missing', 0, 0), /Contenedor/);
  assert.throws(() => insertKitItem(s.project, 'web', 'missing', null, 0, 0), /desconocido/);
  assert.throws(() => insertKitItem(s.project, 'web', 'button', null, Infinity, 0), /Posición/);
  s.commit(p => { insertKitItem(p, 'linux', 'toggle', plainGroup, 0, 0, 'selected'); });
  assert.equal(s.project.components.length, 2);
});
