import test from 'node:test';
import assert from 'node:assert/strict';
import { blank, Store } from '../src/model';
import { importDOM, isDOMSnapshot, componentizeRepeats } from '../src/dom-import';
import { applyOperations } from '../src/agent';
import { lintProject } from '../src/lint';

const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==';
function snapshot() {
  const font = (size: number, weight = 400, family = 'Georgia') => ({ family, size, weight, lineHeight: Math.round(size * 1.3), align: 'left' });
  return {
    format: 'codaru-dom-snapshot', version: 1, url: 'https://www.lumen.example/landing?x=1', title: 'Lumen · Landing', viewport: { width: 390, height: 844 }, height: 1200,
    body: { bg: '#faf8f3', font: 'Georgia', color: '#1d1b16' }, notes: ['Imágenes de fondo CSS: no se capturan; queda el color de fondo.'],
    elements: [
      { i: 0, p: null, kind: 'text', tag: 'span', x: 20, y: 16, w: 80, h: 24, text: 'lumen', font: font(20, 700), color: '#1d1b16', opacity: 100 },
      { i: 1, p: null, kind: 'svg', tag: 'svg', x: 342, y: 14, w: 28, h: 28, svg: '<svg viewBox="0 0 28 28"><script>alert(1)</script><circle cx="14" cy="14" r="12" fill="none" stroke="#1d1b16"/></svg>', color: '#1d1b16', opacity: 100 },
      { i: 2, p: null, kind: 'text', tag: 'h1', x: 20, y: 88, w: 350, h: 78, text: 'Luz para leer sin cansarte.', font: font(34, 400), color: '#1d1b16', opacity: 100 },
      { i: 3, p: null, kind: 'text', tag: 'p', x: 20, y: 178, w: 350, h: 48, text: 'Una lámpara que aprende tu horario.', font: font(16, 400, 'Helvetica'), color: '#6b6760', opacity: 100 },
      { i: 4, p: null, kind: 'button', tag: 'a', x: 20, y: 246, w: 160, h: 48, text: 'Reservar la mía', font: font(16, 600, 'Helvetica'), color: '#faf8f3', bg: '#1d1b16', radius: [24, 24, 24, 24], shadow: false, href: '#comprar', opacity: 100 },
      { i: 5, p: null, kind: 'box', tag: 'div', x: 20, y: 320, w: 350, h: 120, bg: '#ffffff', border: { width: 1, color: '#e6e1d6' }, radius: [16, 16, 16, 16], shadow: true, opacity: 100 },
      { i: 6, p: 5, kind: 'box', tag: 'span', x: 36, y: 336, w: 60, h: 22, gradient: { type: 'linear', angle: 135, stops: [{ color: '#c8a24a', position: 0 }, { color: '#8d6b1a', position: 100 }] }, radius: [8, 8, 8, 8], shadow: false, opacity: 100 },
      { i: 7, p: 6, kind: 'text', tag: 'span', x: 46, y: 339, w: 40, h: 16, text: 'Nuevo', font: font(12, 600, 'Helvetica'), color: '#ffffff', opacity: 100 },
      { i: 8, p: 5, kind: 'text', tag: 'h2', x: 36, y: 368, w: 300, h: 24, text: 'Modo lectura', font: font(18, 600, 'Helvetica'), color: '#1d1b16', opacity: 100 },
      { i: 9, p: null, kind: 'box', tag: 'div', x: 20, y: 460, w: 350, h: 120, bg: '#ffffff', border: { width: 1, color: '#e6e1d6' }, radius: [16, 16, 16, 16], shadow: true, opacity: 100 },
      { i: 10, p: 9, kind: 'text', tag: 'h2', x: 36, y: 476, w: 300, h: 24, text: 'Sin cables', font: font(18, 600, 'Helvetica'), color: '#1d1b16', opacity: 100 },
      { i: 11, p: null, kind: 'box', tag: 'div', x: 20, y: 600, w: 350, h: 120, bg: '#ffffff', border: { width: 1, color: '#e6e1d6' }, radius: [16, 16, 16, 16], shadow: true, opacity: 100 },
      { i: 12, p: 11, kind: 'text', tag: 'h2', x: 36, y: 616, w: 300, h: 24, text: 'Hecha para durar', font: font(18, 600, 'Helvetica'), color: '#1d1b16', opacity: 100 },
      { i: 13, p: null, kind: 'input', tag: 'input', x: 20, y: 760, w: 350, h: 46, text: 'Tu correo', font: font(16, 400, 'Helvetica'), color: '#1d1b16', border: { width: 1, color: '#e6e1d6' }, radius: [10, 10, 10, 10], shadow: false, opacity: 100 },
      { i: 14, p: null, kind: 'img', tag: 'img', x: 20, y: 830, w: 120, h: 80, image: GIF, alt: 'Lámpara', radius: [0, 0, 0, 0], opacity: 100 },
      { i: 15, p: null, kind: 'img', tag: 'img', x: 160, y: 830, w: 120, h: 80, image: '', src: 'https://cdn.example/x.jpg', alt: 'Remota', radius: [0, 0, 0, 0], opacity: 100 },
      { i: 16, p: null, kind: 'text', tag: 'em', x: 20, y: 930, w: 200, h: 20, text: 'cursiva', font: { ...font(14), italic: true }, color: '#6b6760', opacity: 100 },
    ],
  };
}

test('a page snapshot becomes one screen with a derived theme, linked tokens and bounded layers', () => {
  const p = blank(); p.nodes.push({ ...p.nodes[0] ?? {} } as never); p.nodes.length = 0;
  assert.equal(isDOMSnapshot(snapshot()), true);
  const report = importDOM(p, snapshot());
  const frame = p.nodes.find(n => n.type === 'frame')!;
  assert.equal(report.screens, 1); assert.equal(frame.name, 'Lumen · Landing'); assert.equal(frame.width, 390); assert.equal(frame.height, 1200);
  assert.equal(frame.themeId, 'dom-lumen-example');
  const theme = p.designThemes['dom-lumen-example'];
  assert.equal(theme.name, 'Importado · lumen.example');
  assert.deepEqual(theme.modes.light.colors, { primary: '#1d1b16', surface: '#ffffff', background: '#faf8f3', text: '#1d1b16', muted: '#6b6760', border: '#e6e1d6', accent: '#dfdfde' });
  assert.ok(Object.keys(theme.modes.light.typography).includes('texto-18-600'));
  const title = p.nodes.find(n => n.text === 'Luz para leer sin cansarte.')!;
  assert.equal(title.fontFamily, 'serif'); assert.equal(title.fontSize, 34); assert.equal(title.color, '@text'); assert.equal(title.x, 20); assert.equal(title.parentId, frame.id);
  const button = p.nodes.find(n => n.type === 'button')!;
  assert.equal(button.text, 'Reservar la mía'); assert.equal(button.fill, '@primary'); assert.equal(button.color, '@background');
  assert.equal(p.nodes.find(n => n.text === 'lumen')!.color, '@text'); assert.equal(button.radius, 24);
  const card = p.nodes.find(n => n.type === 'card')!;
  assert.equal(card.fill, '@surface'); assert.equal(card.stroke, '@border'); assert.equal(card.strokeWidth, 1); assert.equal(card.shadow, true);
  const badge = p.nodes.find(n => n.gradient === 'linear')!;
  assert.equal(badge.parentId, card.id); assert.equal(badge.x, 16); assert.equal(badge.y, 16); assert.deepEqual(badge.gradientStops!.map(s => s.color), ['#c8a24a', '#8d6b1a']);
  const badgeText = p.nodes.find(n => n.text === 'Nuevo')!; assert.equal(badgeText.parentId, badge.id); assert.equal(badgeText.x, 10);
  const heading = p.nodes.find(n => n.text === 'Modo lectura')!; assert.equal(heading.typographyToken, 'texto-18-600');
  assert.equal(p.nodes.find(n => n.type === 'vector')!.svg!.includes('script'), false);
  assert.equal(p.nodes.find(n => n.type === 'input')!.text, 'Tu correo');
  assert.equal(report.images, 1); assert.equal(report.illustrations, 1);
  assert.equal(p.nodes.find(n => n.name === 'Remota (no capturada)')!.type, 'rect');
  assert.ok(report.notes.some(n => /Cursivas/.test(n))); assert.ok(report.notes.some(n => /Imágenes no capturadas/.test(n))); assert.ok(report.notes.some(n => /Georgia|Helvetica/.test(n)));
  assert.equal(componentizeRepeats(p, frame.id), 1);
  assert.equal(p.components.length, 1);
  new Store(p);
});

test('the dom operation is available to agents and the import places the page beside the current screens', () => {
  const p = blank(); p.nodes.push({ ...blank().nodes[0] } as never); p.nodes.length = 0;
  applyOperations(p, [{ op: 'add', node: { id: 'f', type: 'frame', name: 'Inicio', x: 60, y: 100, width: 390, height: 844 } }, { op: 'dom', data: snapshot() }]);
  const imported = p.nodes.find(n => n.type === 'frame' && n.id !== 'f')!;
  assert.equal(imported.x, 60 + 390 + 120); assert.equal(imported.y, 100);
  assert.throws(() => applyOperations(p, [{ op: 'dom', data: { format: 'otro' } }]), /codaru-dom-snapshot/);
  assert.ok(lintProject(p).every(i => i.rule !== 'off-theme' || i.severity === 'info'));
});
