import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const script = readFileSync('packages/claude-plugin/skills/codaru-clone/scripts/snapshot.js', 'utf8');

test('snapshot.js captures a page and the editor imports it as a screen with its own theme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tests/fixtures/landing.html');
  const snap = await page.evaluate(src => { new Function(src)(); return (window as any).codaruSnapshot(); }, script);
  expect(snap.format).toBe('codaru-dom-snapshot'); expect(snap.viewport.width).toBe(390); expect(snap.body.bg).toBe('#faf8f3');
  const kinds = snap.elements.map((e: any) => e.kind);
  expect(kinds).toContain('svg'); expect(kinds).toContain('button'); expect(kinds).toContain('input'); expect(kinds).toContain('img');
  expect(snap.elements.find((e: any) => e.text === 'lumen').font.family).toBe('Georgia');
  expect(snap.elements.some((e: any) => e.text === 'oculta' || e.alt === 'oculta')).toBe(false);
  const badge = snap.elements.find((e: any) => e.kind === 'box' && e.gradient); expect(badge.gradient.stops.length).toBe(2);
  const cta = snap.elements.find((e: any) => e.text === 'Reservar la mía'); expect(cta.kind).toBe('button'); expect(cta.bg).toBe('#1d1b16'); expect(cta.radius[0]).toBeGreaterThanOrEqual(22);
  expect(snap.elements.filter((e: any) => e.kind === 'img')[0].image).toMatch(/^data:image\/(webp|png)/);

  await page.setViewportSize({ width: 1512, height: 940 });
  await page.goto('/'); await expect(page.locator('[data-layer="screen-login"]')).toBeVisible();
  const result = await page.evaluate(async data => { const api = (window as any).codaru, c = await api.agent('context'); return api.agent('apply', { expectedRevision: c.context.revision, operations: [{ op: 'dom', data }] }); }, snap);
  expect(result.ok).toBe(true);
  await expect(page.locator('[data-layer^="dom-"]').first()).toBeVisible();
  const doc = await page.evaluate(() => (window as any).codaru.getDocument());
  const frame = doc.nodes.find((n: any) => n.name === 'Lumen · Landing');
  expect(frame.width).toBe(390); expect(doc.designThemes[frame.themeId].name).toBe('Importado · 127.0.0.1');
  expect(doc.designThemes[frame.themeId].modes.light.colors.primary).toBe('#1d1b16');
  expect(doc.nodes.filter((n: any) => n.type === 'button').map((n: any) => n.text)).toEqual(expect.arrayContaining(['Reservar la mía', 'Saber más', 'Avísame']));
  expect(doc.nodes.filter((n: any) => n.type === 'card' && n.parentId === frame.id).length).toBe(3);
  expect(doc.nodes.find((n: any) => n.type === 'vector')).toBeTruthy();
});
