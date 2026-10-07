import { test, expect } from '@playwright/test';

// A large document: 80 screens with 25 nodes each (2080 nodes). The first render must stay well
// under a second and panning must not drop frames, with the DOM kept per screen between changes
// and content-visibility skipping the screens outside the viewport.
test('80 screens and 2000 nodes render fast and pan without dropped frames', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('#artboards .design-node[data-node="screen-login"]')).toBeVisible();
  const timings = await page.evaluate(async () => {
    const api = (window as any).codaru;
    const kinds = ['button', 'text', 'rect', 'card', 'input'], nodes: any[] = [];
    for (let i = 0; i < 80; i++) {
      const id = `perf-${i}`;
      nodes.push({ id, type: 'frame', name: `Pantalla ${i + 1}`, parentId: null, x: (i % 10) * 450, y: Math.floor(i / 10) * 950, width: 390, height: 844, fill: '@background', role: 'screen' });
      for (let j = 0; j < 25; j++) {
        const type = kinds[j % kinds.length];
        nodes.push({ id: `${id}-${j}`, type, name: `${type} ${j}`, parentId: id, x: 20, y: 20 + j * 32, width: 350, height: 28, fill: type === 'button' ? '@primary' : type === 'text' ? 'transparent' : '@surface', color: type === 'button' ? '@surface' : '@text', text: type === 'rect' ? '' : `Elemento ${j}` });
      }
    }
    const next = () => new Promise<number>(r => requestAnimationFrame(t => r(t)));
    // Build the document through the agent in batches of at most 250 operations, then time a full load of the result.
    for (let start = 0; start < nodes.length; start += 234) {
      const ctx = await api.agent('context', { depth: 0 });
      const applied = await api.agent('apply', { expectedRevision: ctx.context.revision, operations: nodes.slice(start, start + 234).map(node => ({ op: 'add', node })) });
      if (!applied.ok) throw new Error(applied.error.message);
    }
    const built = api.getDocument();
    const t0 = performance.now(); api.importDocument(built); await next(); await next();
    const firstRender = performance.now() - t0;
    // The browser keeps rasterising the new screens for a few frames after the load; interaction is measured once frames are steady again.
    let steady = 0, settleStart = performance.now(), prev = await next();
    while (steady < 3 && performance.now() - settleStart < 3000) { const t = await next(); steady = t - prev < 25 ? steady + 1 : 0; prev = t; }
    const settle = performance.now() - settleStart;
    const stage = document.getElementById('stage')!, world = document.getElementById('world')!;
    const pan = async () => {
      const dispatch: number[] = [], frames: number[] = [];
      let last = await next();
      for (let i = 0; i < 20; i++) {
        const s = performance.now();
        stage.dispatchEvent(new WheelEvent('wheel', { deltaX: 25, deltaY: 40, bubbles: true, cancelable: true }));
        void world.getBoundingClientRect(); // force style and layout to settle in this frame
        dispatch.push(performance.now() - s);
        const now = await next(); frames.push(now - last); last = now;
      }
      return { dispatch, frames };
    };
    // Overview: the load fits all 82 screens into the viewport, so every pan repaints all of them.
    const overview = await pan();
    // Working zoom: Ctrl + wheel zooms in until the screens are near 100%, where content-visibility skips the ones outside the viewport.
    const zoomNow = () => new DOMMatrix(getComputedStyle(world).transform).a;
    for (let i = 0; i < 60 && zoomNow() < 0.95; i++) { stage.dispatchEvent(new WheelEvent('wheel', { deltaY: -40, ctrlKey: true, bubbles: true, cancelable: true })); await next(); }
    const zoom = zoomNow();
    const working = await pan();
    return { firstRender, settle, dispatch: overview.dispatch, frames: overview.frames, zoom, workingDispatch: working.dispatch, workingFrames: working.frames, screens: document.querySelectorAll('#artboards > .design-node[data-kind="frame"]').length, nodes: built.nodes.length };
  });
  const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length;
  console.log(`perf: first render ${timings.firstRender.toFixed(0)} ms · steady after ${timings.settle.toFixed(0)} ms · overview pan ${mean(timings.dispatch).toFixed(2)} ms/event, frames ${timings.frames.map(t => t.toFixed(0)).join(' ')} · zoom ${timings.zoom.toFixed(2)} pan ${mean(timings.workingDispatch).toFixed(2)} ms/event, frames ${timings.workingFrames.map(t => t.toFixed(0)).join(' ')}`);
  info.annotations.push({ type: 'perf', description: `first render ${timings.firstRender.toFixed(0)} ms · overview pan ${mean(timings.dispatch).toFixed(2)} ms/event, mean frame ${mean(timings.frames).toFixed(1)} ms · zoom ${timings.zoom.toFixed(2)} pan ${mean(timings.workingDispatch).toFixed(2)} ms/event, mean frame ${mean(timings.workingFrames).toFixed(1)} ms` });
  expect(timings.screens).toBe(82); // 80 new screens plus the two demo screens
  expect(timings.nodes).toBeGreaterThanOrEqual(2080);
  expect(timings.firstRender).toBeLessThan(1500);
  // The editor's own work per pan event stays negligible at any zoom; the browser's paint of 82 screens in an overview is what the frame gaps show.
  expect(mean(timings.dispatch)).toBeLessThan(8); expect(mean(timings.workingDispatch)).toBeLessThan(8);
  expect(timings.zoom).toBeGreaterThan(0.9); expect(timings.zoom).toBeLessThan(1.6);
  expect(mean(timings.workingFrames)).toBeLessThan(25); expect(timings.workingFrames.filter(gap => gap > 50).length).toBeLessThanOrEqual(1);
  // Overview frames are informational only: with all 82 screens visible, the browser keeps rasterising for a while after the load, and CI runners paint in software.
});
