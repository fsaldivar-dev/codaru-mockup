import test from 'node:test';
import assert from 'node:assert/strict';
import { blank, node, validate, Store } from '../src/model';
import { sanitizeSVG, scopeSVG, vectorLayers, vectorSize, validateAnimations, validateTransition, animationPresets } from '../src/motion';
import { applyOperations } from '../src/agent';

const art = `<?xml version="1.0"?><!-- logo --><svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" onload="alert(1)">
  <style>.a{fill:url(https://evil.example/x)}</style><script>alert(1)</script>
  <defs><linearGradient id="sky"><stop offset="0" stop-color="#fff"/><stop offset="1" style="stop-color:#09f"/></linearGradient></defs>
  <g id="sun"><circle cx="30" cy="30" r="12" fill="url(#sky)" onclick="steal()"/><path d="M0 0L10 10" style="stroke:#f80;stroke-width:2" class="a"/></g>
  <foreignObject><div>html</div></foreignObject><image href="https://evil.example/a.png"/><a href="javascript:alert(1)"><rect width="5" height="5"/></a>
  <use href="#sun"/><use href="https://evil.example/s.svg#x"/><text x="4" y="70">Hola & "adiós"</text><rect width="9" height="9" fill="url(javascript:alert(1))"/>
</svg>`;

test('SVG import keeps drawable content, drops active content and is canonical', () => {
  const svg = sanitizeSVG(art);
  for (const banned of ['script', 'style', 'onload', 'onclick', 'foreignObject', 'image', 'evil', 'javascript', 'class=', '<a ']) assert.ok(!svg.includes(banned), banned);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">'));
  assert.ok(svg.includes('fill="url(#sky)"') && svg.includes('stroke="#f80"') && svg.includes('stop-color="#09f"'));
  assert.ok(svg.includes('Hola &amp; &quot;adiós&quot;'));
  assert.equal(sanitizeSVG(svg), svg);
  assert.deepEqual(vectorSize(svg), { width: 120, height: 80 });
  assert.deepEqual(vectorLayers(svg).map(l => [l.id, l.tag, l.depth]), [['sun', 'g', 0], ['capa-1', 'circle', 1], ['capa-2', 'path', 1], ['capa-3', 'use', 0], ['capa-4', 'use', 0], ['capa-5', 'text', 0], ['capa-6', 'rect', 0]]);
  const scoped = scopeSVG(svg, 'n1');
  assert.ok(scoped.includes('id="n1-sun" data-layer="sun"') && scoped.includes('url(#n1-sky)') && scoped.includes('href="#n1-sun"'));
  for (const bad of ['', '<div/>', '<svg><g></svg>', '<svg viewBox="0 0 1 1"><![CDATA[x]]></svg>', '<svg></svg>', '<svg viewBox="0 0 1 1"/><svg viewBox="0 0 1 1"/>']) assert.throws(() => sanitizeSVG(bad), bad);
});

test('documents accept only sanitized illustrations, valid animations and transitions', () => {
  const p = blank(), svg = sanitizeSVG(art);
  p.nodes.push(node('frame', { id: 'home' }), node('frame', { id: 'detail', x: 500 }), node('vector', { id: 'art', parentId: 'home', svg }));
  const spin = { id: 'spin', target: 'sun', ...animationPresets.spin.make() };
  p.nodes[2].animations = [spin]; p.nodes[2].targetId = 'detail'; p.nodes[2].transition = { type: 'slide-left', duration: 300, easing: 'ease-out' };
  const valid = validate(p);
  assert.deepEqual(validate(JSON.parse(JSON.stringify(valid))), valid);
  const broken = (edit: (n: any) => void) => { const copy = structuredClone(valid); edit(copy.nodes[2]); return () => validate(copy); };
  assert.throws(broken(n => { n.svg = art; }), /Ilustración/);
  assert.throws(broken(n => { delete n.svg; }), /Ilustración/);
  assert.throws(broken(n => { n.animations[0].target = 'nope'; }), /capa/);
  assert.throws(broken(n => { n.animations[0].keyframes[1].at = 0; }), /orden/);
  assert.throws(broken(n => { n.animations[0].keyframes[0].onfinish = 'x'; }), /desconocida/);
  assert.throws(broken(n => { n.animations[0].keyframes[0].fill = 'url(x)'; }), /color/);
  assert.throws(broken(n => { n.transition.type = 'explode'; }), /Transición/);
  assert.throws(() => validateTransition({ type: 'fade', duration: 99999, easing: 'ease' }));
  assert.throws(() => validateAnimations([spin, spin], ['sun']), /repetido/);
  const rect = structuredClone(valid); rect.nodes.push(node('rect', { id: 'box', parentId: 'home', animations: [{ id: 'a', target: '', ...animationPresets.appear.make() }] }));
  validate(rect);
  rect.nodes.at(-1)!.animations![0].target = 'sun';
  assert.throws(() => validate(rect), /capa/);
});

test('agent operations import SVG, animate layers and set transitions in one undoable batch', () => {
  const p = blank(); p.nodes.push(node('frame', { id: 'home' }), node('frame', { id: 'detail', x: 500 }), node('button', { id: 'go', parentId: 'home' }));
  const store = new Store(p);
  store.commit(draft => applyOperations(draft, [
    { op: 'vector', id: 'art', svg: art, parentId: 'home', x: 10, y: 20, width: 60, name: 'Sol' },
    { op: 'animate', id: 'art', animations: [{ id: 'draw', target: 'capa-2', ...animationPresets.draw.make() }] },
    { op: 'flow', from: 'go', to: 'detail', transition: { type: 'fade', duration: 250, easing: 'ease' } },
  ]));
  const added = store.project.nodes.find(n => n.id === 'art')!;
  assert.equal(added.type, 'vector'); assert.equal(added.width, 60); assert.equal(added.height, 40); assert.equal(added.animations![0].target, 'capa-2');
  assert.equal(store.project.nodes.find(n => n.id === 'go')!.transition!.type, 'fade');
  assert.throws(() => store.commit(draft => applyOperations(draft, [{ op: 'animate', id: 'art', animations: [{ id: 'x', target: 'missing', ...animationPresets.spin.make() }] }])), /capa/);
  store.commit(draft => applyOperations(draft, [{ op: 'animate', id: 'art', animations: null }, { op: 'flow', from: 'go', to: 'detail', transition: null }, { op: 'update', id: 'art', patch: { svg: '<svg viewBox="0 0 2 2"><rect width="2" height="2" onclick="x()"/></svg>' } }]));
  assert.equal(store.project.nodes.find(n => n.id === 'art')!.animations, undefined);
  assert.equal(store.project.nodes.find(n => n.id === 'go')!.transition, undefined);
  assert.equal(store.project.nodes.find(n => n.id === 'art')!.svg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2" id="capa-1"/></svg>');
  store.undo(); store.undo();
  assert.equal(store.project.nodes.some(n => n.id === 'art'), false);
});

test('custom gradients accept 2 to 16 ordered stops with valid colors', () => {
  const p = blank(); p.nodes.push(node('frame', { id: 'home' }), node('rect', { id: 'box', parentId: 'home', gradient: 'linear', gradientStops: [{ color: '#2a7b9b', position: 0 }, { color: '@accent', position: 50 }, { color: '#eddd5380', position: 100 }] }));
  const valid = validate(p);
  const broken = (stops: unknown) => () => { const copy = structuredClone(valid); (copy.nodes[1] as any).gradientStops = stops; validate(copy); };
  assert.throws(broken([{ color: '#fff', position: 0 }]), /2 y 16/);
  assert.throws(broken([{ color: '#fff', position: 60 }, { color: '#000', position: 40 }]), /Parada/);
  assert.throws(broken([{ color: 'red', position: 0 }, { color: '#000', position: 100 }]), /Parada/);
  assert.throws(broken([{ color: '#fff', position: 0, url: 'x' }, { color: '#000', position: 100 }]), /Parada/);
  assert.throws(broken([{ color: '@missing', position: 0 }, { color: '#000', position: 100 }]));
  const store = new Store(valid);
  store.commit(draft => applyOperations(draft, [{ op: 'update', id: 'box', patch: { gradientStops: null } }]));
  assert.equal(store.project.nodes[1].gradientStops, undefined);
});

test('fold hinges are limited to screens and unfold is a valid transition', () => {
  const p = blank(); p.nodes.push(node('frame', { id: 'open', device: 'android-fold-open', width: 673, height: 841, fold: { axis: 'vertical', gap: 0 } }), node('rect', { id: 'box', parentId: 'open' }));
  const valid = validate(p);
  validateTransition({ type: 'unfold', duration: 500, easing: 'ease-in-out' });
  const broken = (edit: (nodes: any[]) => void) => () => { const copy = structuredClone(valid); edit(copy.nodes); validate(copy); };
  assert.throws(broken(nodes => { nodes[1].fold = { axis: 'vertical', gap: 0 }; }), /Pliegue/);
  assert.throws(broken(nodes => { nodes[0].fold = { axis: 'diagonal', gap: 0 }; }), /Pliegue/);
  assert.throws(broken(nodes => { nodes[0].fold.gap = 900; }), /Pliegue/);
  assert.throws(broken(nodes => { nodes[0].fold.panels = 4; }), /Pliegue/);
  { const copy = structuredClone(valid); (copy.nodes[0] as any).fold.panels = 3; validate(copy); }
  assert.throws(broken(nodes => { nodes[0].device = 'No Válido'; }), /Dispositivo/);
  const store = new Store(valid);
  store.commit(draft => applyOperations(draft, [{ op: 'update', id: 'open', patch: { fold: null, device: null } }]));
  assert.equal(store.project.nodes[0].fold, undefined); assert.equal(store.project.nodes[0].device, undefined);
});

test('codaru-mockup blocks accept Spanish or English keys and reject typos', async () => {
  const { parseMockupBlock } = await import('../src/preview');
  assert.deepEqual(parseMockupBlock('archivo: diseno/forma.codaru.json\npantalla: screen-login\nmodo: prototipo\n'), { mode: 'prototype', file: 'diseno/forma.codaru.json', screen: 'screen-login' });
  assert.deepEqual(parseMockupBlock('# nota\nfile: "a b.json"\nscreen: Inicio: principal\nmode: static\ntheme: dark\nheight: 300'), { mode: 'static', file: 'a b.json', screen: 'Inicio: principal', theme: 'dark', maxHeight: 300 });
  assert.equal(parseMockupBlock('archivo: x.json').mode, 'prototype');
  for (const bad of ['pantalla: a', 'archivo: x\nmodo: video', 'archivo: x\ncolor: rojo', 'archivo: x\nalto: 5', 'sin dos puntos']) assert.throws(() => parseMockupBlock(bad));
});
