import { test, expect, type Page } from '@playwright/test';

// The headless SVG must look like the static preview. Both are drawn at 1:1, captured, and compared
// pixel by pixel; only antialiasing along glyph and curve edges may differ.
async function compare(page: Page, setup: { demo: 'demo' | 'demo-devices'; screen?: string; skin?: string; theme?: unknown }) {
  await page.setViewportSize({ width: 2800, height: 1200 });
  await page.evaluate(async ({ demo, screen, skin, theme }) => {
    const at = (path: string): Promise<any> => import(path);
    const pv = await at('/src/preview.ts'), sv = await at('/src/screen-svg.ts');
    const doc = demo === 'demo' ? (await at('/src/demo.ts')).demo() : (await at('/src/demo-devices.ts')).demoDevices();
    const id = screen ?? sv.screens(doc).find((s: any) => s.skin === skin)!.id;
    document.body.innerHTML = '<div style="display:flex;gap:40px;padding:20px;background:#fff;align-items:flex-start"><div id="preview" style="width:1000px"></div><img id="svg" alt=""></div>';
    pv.renderMockup(document.getElementById('preview')!, doc, { screen: id, mode: 'static', maxHeight: 3000, theme: theme as any });
    const img = document.getElementById('svg') as HTMLImageElement; img.src = sv.renderScreenToDataURL(doc, { screen: id, mode: 'static', theme: theme as any });
    await img.decode(); await document.fonts.ready;
    // Put the image at the same sub-pixel offset as the preview, so both captures round alike.
    const box = document.querySelector('#preview')!.querySelector('[data-codaru-mockup]')!.shadowRoot!.querySelector('.canvas > .design-node')!.getBoundingClientRect();
    Object.assign(img.style, { position: 'absolute', left: `${box.left + 1100}px`, top: `${box.top + scrollY}px` });
  }, setup);
  const box = await page.evaluate(() => { const r = document.querySelector('#preview')!.querySelector('[data-codaru-mockup]')!.shadowRoot!.querySelector('.canvas > .design-node')!.getBoundingClientRect(); return { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) }; });
  const left = await page.screenshot({ clip: box }), right = await page.screenshot({ clip: { ...box, x: box.x + 1100 } });
  if (process.env.SVG_DUMP) { const fs = await import('node:fs'); fs.writeFileSync(`${process.env.SVG_DUMP}/${setup.screen ?? setup.skin}-preview.png`, left); fs.writeFileSync(`${process.env.SVG_DUMP}/${setup.screen ?? setup.skin}-svg.png`, right); }
  return page.evaluate(async ([a, b]) => {
    const load = async (b64: string) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d')!; x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height); };
    const [p, s] = await Promise.all([load(a), load(b)]);
    if (p.width !== s.width || p.height !== s.height) return { sizes: `${p.width}x${p.height} vs ${s.width}x${s.height}`, ratio: 1, mean: 255 };
    let off = 0, total = 0;
    for (let i = 0; i < p.data.length; i += 4) { const d = Math.max(Math.abs(p.data[i] - s.data[i]), Math.abs(p.data[i + 1] - s.data[i + 1]), Math.abs(p.data[i + 2] - s.data[i + 2])); total += d; if (d > 64) off++; }
    const pixels = p.data.length / 4, grid: number[][] = Array.from({ length: 12 }, () => Array(12).fill(0));
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) { const i = (y * p.width + x) * 4, d = Math.max(Math.abs(p.data[i] - s.data[i]), Math.abs(p.data[i + 1] - s.data[i + 1]), Math.abs(p.data[i + 2] - s.data[i + 2])); if (d > 64) grid[Math.floor(y * 12 / p.height)][Math.floor(x * 12 / p.width)]++; }
    const cell = pixels / 144, hot = grid.map(row => row.map(v => v / cell > .05 ? '#' : v / cell > .01 ? '+' : '.').join('')).join('\n');
    return { sizes: `${p.width}x${p.height}`, ratio: off / pixels, mean: total / pixels, hot };
  }, [left.toString('base64'), right.toString('base64')]);
}

test.beforeEach(async ({ page }) => { await page.goto('/examples/markdown-preview.html'); });

for (const [name, setup] of [
  ['login screen', { demo: 'demo', screen: 'screen-login' }],
  ['dashboard with sidebar, cards and gradients', { demo: 'demo', screen: 'screen-dashboard' }],
  ['iPhone with status bar and Dynamic Island, dark', { demo: 'demo-devices', skin: 'iphone', theme: 'dark' }],
  ['Android with punch-hole camera', { demo: 'demo-devices', skin: 'android' }],
  ['brand tokens', { demo: 'demo', screen: 'screen-login', theme: { '--codaru-primary': '#e4572e', '--codaru-surface': '#fffaf2' } }],
] as const) {
  test(`renderScreenToSVG matches the static preview: ${name}`, async ({ page }, info) => {
    const result = await compare(page, setup as any);
    info.annotations.push({ type: 'diff', description: `${result.sizes} · ${(result.ratio * 100).toFixed(2)}% pixels differ · mean ${result.mean.toFixed(2)}` });
    console.log(`svg-vs-preview ${name}: ${result.sizes} ${(result.ratio * 100).toFixed(2)}% mean ${result.mean.toFixed(2)}`); if (result.ratio > .02) console.log((result as any).hot);
    expect(result.ratio).toBeLessThan(0.03);
    expect(result.mean).toBeLessThan(4);
  });
}

test('the data URL loads in an <img> and as a Markdown image, and token themes reach the preview', async ({ page }) => {
  const out = await page.evaluate(async () => {
    const at = (path: string): Promise<any> => import(path);
    const sv = await at('/src/screen-svg.ts'), pv = await at('/src/preview.ts'), { demo } = await at('/src/demo.ts');
    const url = sv.renderScreenToDataURL(demo(), { screen: 'screen-login', maxWidth: 195 });
    document.body.innerHTML = `<p><img id="md" src="${url}" alt="Bienvenida"></p><div id="host"></div>`;
    const img = document.getElementById('md') as HTMLImageElement; await img.decode();
    const markdown = `![Bienvenida](${url})`, parsed = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(markdown);
    const preview = pv.renderMockup(document.getElementById('host')!, demo(), { screen: 'screen-login', mode: 'static', theme: { primary: '#e4572e' } });
    const button = preview.element.shadowRoot!.querySelector('[data-node="primary-button"]') as HTMLElement;
    return { w: img.naturalWidth, h: img.naturalHeight, markdownOk: parsed?.[2] === url, buttonBg: getComputedStyle(button).backgroundColor };
  });
  expect(out).toEqual({ w: 195, h: 330, markdownOk: true, buttonBg: 'rgb(228, 87, 46)' });
});
