import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { blank, node, validate, Store } from '../src/model';
import { importFigma, isFigmaExport } from '../src/figma-import';
import { applyOperations } from '../src/agent';

const MIXED = Symbol('mixed');
const solid = (r: number, g: number, b: number, opacity = 1) => ({ type: 'SOLID', visible: true, opacity, color: { r, g, b } });
/** A small stand-in for Figma's plugin API: enough of the node shapes the plugin reads. */
function fakeFigma() {
  const base = (type: string, name: string, x: number, y: number, width: number, height: number, extra: Record<string, unknown> = {}) => ({ id: `${Math.floor(x)}:${name.length}${type.length}${Math.floor(y)}`, type, name, visible: true, locked: false, rotation: 0, opacity: 1, absoluteBoundingBox: { x, y, width, height }, width, height, fills: [], strokes: [], strokeWeight: 1, effects: [], ...extra });
  const title = base('TEXT', 'Título', 124, 240, 300, 40, { characters: 'Hola Figma', fontSize: 28, fontName: { family: 'Playfair Display', style: 'Bold' }, fontWeight: 700, lineHeight: { unit: 'PIXELS', value: 35 }, textAlignHorizontal: 'CENTER', fills: [solid(.1, .1, .2)], textStyleId: 'S:text-title', getRangeFontSize: () => 28 });
  const button = base('FRAME', 'Botón primario', 124, 300, 200, 48, { fills: [solid(.2, .4, 1)], fillStyleId: 'S:brand', cornerRadius: 12, layoutMode: 'HORIZONTAL', itemSpacing: 8, paddingTop: 12, paddingRight: 12, paddingBottom: 12, paddingLeft: 12, primaryAxisAlignItems: 'MIN', counterAxisAlignItems: 'MIN', layoutWrap: 'NO_WRAP', layoutGrow: 0,
    children: [base('TEXT', 'Etiqueta', 136, 312, 80, 24, { characters: 'Entrar', fontSize: 16, fontName: { family: 'Inter', style: 'Semi Bold' }, lineHeight: { unit: 'AUTO' }, textAlignHorizontal: 'LEFT', fills: [solid(1, 1, 1)] })] });
  const hero = base('RECTANGLE', 'Rectangle 12', 100, 200, 390, 300, { cornerRadius: MIXED, topLeftRadius: 24, topRightRadius: 24, bottomRightRadius: 0, bottomLeftRadius: 0, effects: [{ type: 'DROP_SHADOW', visible: true }],
    fills: [{ type: 'GRADIENT_LINEAR', visible: true, opacity: 1, gradientTransform: [[0, 1, 0], [-1, 0, 1]], gradientStops: [{ position: 0, color: { r: 1, g: 0, b: 0, a: 1 } }, { position: .5, color: { r: 0, g: 1, b: 0, a: 1 } }, { position: 1, color: { r: 0, g: 0, b: 1, a: .5 } }] }] });
  const centered = base('FRAME', 'Fila centrada', 124, 380, 300, 60, { layoutMode: 'HORIZONTAL', itemSpacing: 8, paddingTop: 4, paddingRight: 8, paddingBottom: 4, paddingLeft: 8, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', layoutWrap: 'NO_WRAP', children: [base('ELLIPSE', 'Ellipse 1', 130, 390, 40, 40, { fills: [solid(.9, .2, .2, .5)], rotation: 15 })] });
  const icon = base('VECTOR', 'Estrella', 440, 210, 24, 24, { exportAsync: async () => '<svg width="24" height="24" viewBox="0 0 24 24"><script>alert(1)</script><path d="M12 2l3 7h7l-5.500 5 2 8-6.500-4.500L5.500 22l2-8L2 9h7z" fill="#FFD166" onclick="x()"/></svg>' });
  const hidden = base('RECTANGLE', 'Oculta', 0, 0, 10, 10, { visible: false });
  const group = base('GROUP', 'Group 3', 110, 520, 100, 40, { children: [base('RECTANGLE', 'Chip', 110, 520, 100, 40, { fills: [solid(.5, .5, .5)], strokes: [solid(0, 0, 0)], strokeWeight: 2, cornerRadius: 20 })] });
  const screen = base('FRAME', 'Inicio', 100, 200, 390, 844, { fills: [solid(1, 1, 1)], cornerRadius: 0, children: [hero, title, button, centered, icon, hidden, group] });
  const component = base('COMPONENT', 'Tarjeta', 600, 200, 160, 90, { fills: [solid(.95, .95, 1)], cornerRadius: 16, children: [base('TEXT', 'Nombre', 612, 212, 120, 20, { characters: 'Proyecto', fontSize: 14, fontName: { family: 'Inter', style: 'Regular' }, lineHeight: { unit: 'PERCENT', value: 140 }, textAlignHorizontal: 'LEFT', fills: [solid(0, 0, 0)] })] });
  const set = base('COMPONENT_SET', 'Chip', 600, 400, 300, 60, { children: [base('COMPONENT', 'Estado=Activo', 610, 410, 80, 32, { fills: [solid(0, .6, .3)], cornerRadius: 16 }), base('COMPONENT', 'Estado=Inactivo', 700, 410, 80, 32, { fills: [solid(.8, .8, .8)], cornerRadius: 16 })] });
  const posted: any[] = [];
  const figma: any = {
    mixed: MIXED, root: { name: 'Mi app · v2' }, currentPage: { name: 'Pantallas', selection: [], children: [screen, component, set] },
    showUI() {}, closePlugin() {}, ui: { postMessage: (message: unknown) => posted.push(message), onmessage: undefined as any },
    getImageByHash: () => null, base64Encode: () => '',
    getLocalPaintStylesAsync: async () => [{ id: 'S:brand', name: 'Marca/Primario', paints: [solid(.2, .4, 1)] }, { id: 'S:glow', name: 'Marca/Brillo', paints: [{ type: 'GRADIENT_RADIAL', visible: true, opacity: 1, gradientTransform: [[1, 0, 0], [0, 1, 0]], gradientStops: [{ position: 0, color: { r: 1, g: 1, b: 1, a: 1 } }, { position: 1, color: { r: 0, g: 0, b: 0, a: 1 } }] }] }],
    getLocalTextStylesAsync: async () => [{ id: 'S:text-title', name: 'Títulos/H1', fontName: { family: 'Playfair Display', style: 'Bold' }, fontSize: 28, lineHeight: { unit: 'PIXELS', value: 35 } }],
  };
  return { figma, posted };
}
async function runPlugin(scope = 'page') {
  const { figma, posted } = fakeFigma();
  new Function('figma', '__html__', readFileSync('packages/figma-plugin/code.js', 'utf8'))(figma, '');
  figma.ui.onmessage({ type: 'export', scope });
  for (let i = 0; i < 50 && !posted.length; i++) await new Promise(resolve => setTimeout(resolve, 5));
  return posted[0];
}

test('the Figma plugin export is converted into screens, components, tokens and a cleanup report', async () => {
  const message = await runPlugin();
  assert.equal(message.type, 'done', message.message);
  const data = JSON.parse(message.json);
  assert.ok(isFigmaExport(data)); assert.equal(data.file, 'Mi app · v2'); assert.equal(message.summary.count, 16);
  mkdirSync('artifacts', { recursive: true }); writeFileSync('artifacts/ejemplo.figma.codaru.json', JSON.stringify(data, null, 1));
  const p = blank(); p.nodes.push(node('frame', { id: 'existing', x: 60, y: 100, width: 390, height: 660 }));
  const store = new Store(p); let report: ReturnType<typeof importFigma> | undefined;
  store.commit(draft => { report = importFigma(draft, data); });
  const doc = validate(store.project), find = (name: string) => doc.nodes.find(n => n.name === name)!;
  assert.deepEqual({ screens: report!.screens, components: report!.components, tokens: report!.tokens, illustrations: report!.illustrations }, { screens: 2, components: 3, tokens: 3, illustrations: 1 });
  const screen = find('Inicio');
  assert.equal(screen.type, 'frame'); assert.equal(screen.x, 570); assert.equal(screen.y, 100); assert.equal(screen.fill, '#ffffff');
  assert.ok(doc.nodes.every(n => /^[A-Za-z0-9_-]+$/.test(n.id)));
  const hero = doc.nodes.find(n => n.parentId === screen.id && n.type === 'rect')!;
  assert.equal(hero.name, 'Rectángulo'); assert.equal(hero.x, 0); assert.equal(hero.y, 0);
  assert.deepEqual([hero.radius, hero.radiusTR, hero.radiusBR, hero.radiusBL], [24, 24, 0, 0]);
  assert.equal(hero.gradient, 'linear'); assert.equal(hero.gradientAngle, 180); assert.equal(hero.shadow, true);
  assert.deepEqual(hero.gradientStops, [{ color: '#ff0000', position: 0 }, { color: '#00ff00', position: 50 }, { color: '#0000ff80', position: 100 }]);
  const title = find('Título');
  assert.match(title.fontFamily,/^font-playfair-display-/); assert.deepEqual([title.text, title.fontFamily, title.fontWeight, title.lineHeight, title.textAlign, title.typographyToken, title.x, title.y], ['Hola Figma', title.fontFamily, 700, 1.25, 'center', 'titulos-h1', 24, 40]);
  const button = find('Botón primario');
  assert.deepEqual([button.type, button.fill, button.fillToken, button.layout, button.padding, button.gap, button.radius], ['card', '@marca-primario', 'marca-primario', 'horizontal', 12, 8, 12]);
  assert.equal(doc.designThemes.project.modes.light.colors['marca-primario'], '#3366ff');
  assert.equal(doc.designThemes.project.modes.dark.gradients['marca-brillo'].type, 'radial');
  assert.equal(find('Fila centrada').layout, 'free');
  const circle = doc.nodes.find(n => n.type === 'ellipse')!; assert.equal(circle.fill, '#e6333380'); assert.equal(circle.name, 'Elipse');
  const star = find('Estrella'); assert.equal(star.type, 'vector'); assert.ok(star.svg!.includes('<path') && !star.svg!.includes('script') && !star.svg!.includes('onclick'));
  assert.equal(doc.nodes.some(n => n.name === 'Oculta'), false);
  const chip = find('Chip'); assert.deepEqual([chip.type, chip.strokeWidth, chip.stroke, find('Grupo').type], ['rect', 2, '#000000', 'group']);
  const sheet = find('Componentes de Figma');
  assert.deepEqual(doc.components.map(c => c.name).sort(), ['Chip / Estado=Activo', 'Chip / Estado=Inactivo', 'Tarjeta']);
  const chips = doc.components.filter(c => c.name.startsWith('Chip'));
  assert.equal(new Set(chips.map(c => c.set)).size, 1); assert.equal(chips[0].setName, 'Chip'); assert.deepEqual(chips.map(c => c.variant!.Estado).sort(), ['Activo', 'Inactivo']);
  assert.equal(doc.components.find(c => c.name === 'Tarjeta')!.set, undefined);
  assert.ok(doc.nodes.filter(n => n.parentId === sheet.id).every(n => n.componentId));
  for (const expected of ['Capas ocultas', 'Capas giradas', 'Auto layout', 'Sombras', 'Playfair Display']) assert.ok(report!.notes.some(note => note.includes(expected)), expected);
  store.undo();
  assert.equal(store.project.nodes.length, 1); assert.equal(store.project.designThemes.project.modes.light.colors['marca-primario'], undefined);
});

test('a Figma export can be applied by the agent and malformed files are rejected without changes', async () => {
  const data = JSON.parse((await runPlugin()).json);
  const store = new Store(blank());
  store.commit(draft => applyOperations(draft, [{ op: 'figma', data }]));
  assert.equal(store.project.nodes.filter(n => n.type === 'frame').length, 2);
  for (const bad of [{}, { format: 'codaru-figma-export', version: 2, nodes: [] }, { format: 'codaru-figma-export', version: 1, nodes: [] }, { format: 'codaru-figma-export', version: 1, nodes: [{ type: 'FRAME', visible: false }] }]) assert.throws(() => store.commit(draft => { importFigma(draft, bad); }));
  const hostile = { format: 'codaru-figma-export', version: 1, nodes: [{ id: '../../x', type: 'FRAME', name: '<img onerror=x>', x: 'NaN', width: 1e12, height: -5, fills: [{ type: 'SOLID', color: { r: 9, g: 'x' }, opacity: 40 }], image: 'javascript:alert(1)', children: [{ type: 'VECTOR', svg: '<svg onload="x()"><script>1</script></svg>' }, { type: 'TEXT', text: { characters: 7, fontSize: -4 } }] }] };
  store.commit(draft => { importFigma(draft, hostile); });
  const added = store.project.nodes.find(n => n.id.startsWith('fg-x'))!;
  assert.deepEqual([added.type, added.width, added.height, added.fill, added.image], ['frame', 100000, 1, '#ff0000', '']);
  assert.equal(store.project.nodes.some(n => n.type === 'vector' && n.parentId === added.id), false);
  await assert.rejects(async () => { const message = await runPlugin('selection'); if (message.type === 'error') throw new Error(message.message); }, /Selecciona/);
});
