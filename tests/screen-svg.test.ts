import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../src/demo';
import { demoDevices } from '../src/demo-devices';
import { node, validate } from '../src/model';
import { renderScreenToSVG, renderScreenToDataURL, svgDataURL, screens, wrapText, metricMeasure } from '../src/screen-svg';
import { parseMockupBlock } from '../src/preview';

test('renders a screen without window or document, from an object or JSON text, and validates it', () => {
  assert.equal(typeof (globalThis as any).document, 'undefined'); assert.equal(typeof (globalThis as any).window, 'undefined');
  const doc = demo(), svg = renderScreenToSVG(doc, { screen: 'screen-login', mode: 'static' });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="390" height="660" viewBox="0 0 390 660" role="img" aria-label="01 · Bienvenida">/);
  assert.ok(svg.includes('<title>01 · Bienvenida</title>'));
  for (const text of ['forma', 'Correo electrónico', 'Entrar a mi espacio', 'Hecho para crear a tu manera.']) assert.ok(svg.includes(text), text);
  assert.equal(renderScreenToSVG(JSON.stringify(doc), { screen: 'screen-login' }), svg, 'JSON text renders the same');
  assert.equal(renderScreenToSVG(doc, { screen: '01 · Bienvenida' }), svg, 'the exact name also resolves');
  assert.throws(() => renderScreenToSVG('{nope'), /JSON válido/);
  assert.throws(() => renderScreenToSVG({ format: 'otro' }), /no compatible/);
  assert.throws(() => renderScreenToSVG(doc, { screen: 'nope' }), /No existe la pantalla «nope». Disponibles: screen-login, screen-dashboard/);
  assert.throws(() => renderScreenToSVG(doc, { mode: 'prototype' as never }), /static/);
  assert.equal(doc.nodes.length, demo().nodes.length, 'the input is not modified');
});

test('the SVG is well formed, self-contained and sized by maxWidth', () => {
  const svg = renderScreenToSVG(demo(), { screen: 'screen-dashboard', maxWidth: 345 });
  assert.match(svg, /^<svg [^>]*width="345" height="330" viewBox="0 0 690 660"/);
  assert.ok(!/(?:href|src)="(?!data:|#)/.test(svg), 'no external references');
  const opened = (svg.match(/<(?!\/)(?!!)[a-zA-Z][^>]*?(?<!\/)>/g) ?? []).length, closed = (svg.match(/<\/[a-zA-Z][^>]*>/g) ?? []).length;
  assert.equal(opened, closed, 'every element that opens closes');
  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map(m => m[1]); assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  assert.ok(ids.filter(id => id !== 'codaru-icon-licenses').every(id => id.startsWith('cscreen-dashboard-')), 'ids are scoped to the screen so several SVGs can share a page');
  assert.equal(renderScreenToSVG(demo(), { screen: 'screen-dashboard', maxWidth: 2000 }).slice(0, 120), renderScreenToSVG(demo(), { screen: 'screen-dashboard' }).slice(0, 120), 'never scales up');
});

test('the data URL works in <img src> and in a Markdown image link', () => {
  const url = renderScreenToDataURL(demo(), { screen: 'screen-login' });
  assert.match(url, /^data:image\/svg\+xml;charset=utf-8,%3Csvg/);
  assert.ok(!/[\s()'"<>#]/.test(url), 'no character that ends a Markdown link or an HTML attribute');
  assert.equal(decodeURIComponent(url.slice(url.indexOf(',') + 1)), renderScreenToSVG(demo(), { screen: 'screen-login' }));
  assert.equal(svgDataURL('<svg a="(1)"/>'), 'data:image/svg+xml;charset=utf-8,%3Csvg%20a%3D%221%22%2F%3E'.replace('%3D%221%22', '=%22%281%29%22').replace('%2F', '/'));
});

test('screens() lists stable ids with name, role and page, and reordering never changes them', () => {
  const doc = demo();
  const before = screens(doc).map(s => ({ id: s.id, name: s.name, role: s.role, page: s.page }));
  assert.deepEqual(before, [{ id: 'screen-login', name: '01 · Bienvenida', role: 'screen', page: 'pagina-1' }, { id: 'screen-dashboard', name: '02 · Tu espacio', role: 'screen', page: 'pagina-1' }]);
  const shuffled = structuredClone(doc); shuffled.nodes.reverse();
  const login = shuffled.nodes.find(n => n.id === 'screen-login')!, dash = shuffled.nodes.find(n => n.id === 'screen-dashboard')!; [login.x, dash.x] = [dash.x, login.x];
  const after = screens(shuffled);
  assert.deepEqual(after.map(s => s.id).sort(), before.map(s => s.id).sort(), 'same ids');
  assert.deepEqual(after.map(s => s.id), ['screen-dashboard', 'screen-login'], 'order follows the new positions');
  assert.equal(renderScreenToSVG(shuffled, { screen: 'screen-login' }).length > 0, true);
  assert.deepEqual(parseMockupBlock('archivo: a.codaru.json\npantalla: screen-login'), { file: 'a.codaru.json', screen: 'screen-login', mode: 'prototype' });
  assert.equal(screens(JSON.stringify(doc)).length, 2, 'accepts JSON text');
});

test('themes: light or dark, and Codaru color tokens written as CSS variables or bare names', () => {
  const doc = demo(), light = renderScreenToSVG(doc, { screen: 'screen-login', theme: 'light' }), dark = renderScreenToSVG(doc, { screen: 'screen-login', theme: 'dark' });
  assert.notEqual(light, dark); assert.ok(dark.includes(doc.themes.dark.surface.toLowerCase()));
  const branded = renderScreenToSVG(doc, { screen: 'screen-login', theme: { '--codaru-primary': '#ff5500', '--surface': '#fffaf0', text: '#111111' } });
  assert.ok(branded.includes('#ff5500') && branded.includes('#fffaf0') && branded.includes('#111111'));
  assert.ok(!branded.includes(doc.themes.light.primary.toLowerCase()), 'the old primary is gone');
  const darkBrand = renderScreenToSVG(doc, { screen: 'screen-login', theme: { mode: 'dark', primary: '#00aa88' } });
  assert.ok(darkBrand.includes('#00aa88') && darkBrand.includes(doc.themes.dark.surface.toLowerCase()));
  assert.throws(() => renderScreenToSVG(doc, { theme: { primary: 'rojo' } }), /Color inválido para primary/);
  assert.throws(() => renderScreenToSVG(doc, { theme: { 'bad key!': '#fff' } }), /Token de tema inválido/);
  assert.throws(() => renderScreenToSVG(doc, { theme: 'sepia' as never }), /light, dark/);
});

test('borders sit inside the box, children are offset by the border, frames clip and device chrome is drawn', () => {
  const p = demo();
  p.nodes.push(node('frame', { id: 'boxed', name: 'Con borde', parentId: null, x: 0, y: 900, width: 200, height: 100, stroke: '#ff0000', strokeWidth: 4, radius: 12, role: 'screen' }), node('rect', { id: 'inner', parentId: 'boxed', x: 0, y: 0, width: 300, height: 20, fill: '#00ff00' }));
  const svg = renderScreenToSVG(p, { screen: 'boxed' });
  assert.ok(svg.includes('stroke="#ff0000" stroke-width="4"')); assert.match(svg, /<path d="M12 2H188A10 10 0 0 1 198 12[^"]*" fill="none" stroke="#ff0000"/, 'stroke path inset by half the border');
  assert.match(svg, /<path d="M14 4H294A10 10 0 0 1 304 14[^"]*" fill="#00ff00"/, 'child starts inside the border'); assert.match(svg, /<g clip-path="url\(#cboxed-[a-f0-9]+-k\d+\)">/);
  const phone = demoDevices(), shot = renderScreenToSVG(phone, { screen: screens(phone).find(s => s.skin?.startsWith('iphone'))!.id });
  assert.ok(shot.includes('>9:41</text>') && shot.includes('fill="#050506"'), 'status bar and Dynamic Island');
  assert.ok(!shot.includes('236, 72, 120') && !shot.includes('#ec4878'), 'no safe-area editing aids');
});

test('text wraps like CSS pre-wrap with overflow-wrap anywhere', () => {
  const font = { family: 'system', size: 16, weight: 400 };
  assert.deepEqual(wrapText('Hola mundo', 1000, font), ['Hola mundo']);
  assert.deepEqual(wrapText('uno dos tres', metricMeasure('uno dos', font) + 1, font), ['uno dos', 'tres']);
  assert.deepEqual(wrapText('a\n\nb', 100, font), ['a', '', 'b']);
  const long = wrapText('supercalifragilístico', 60, font); assert.ok(long.length > 1 && long.join('') === 'supercalifragilístico');
  assert.ok(metricMeasure('Mundo', { ...font, weight: 700 }) > metricMeasure('Mundo', font));
  assert.equal(metricMeasure('abcd', { family: 'ui-monospace, Menlo', size: 10, weight: 400 }), 24);
  assert.equal(metricMeasure('é', font), metricMeasure('e', font));
});
