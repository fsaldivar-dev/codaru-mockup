import { test, expect, type Page } from '@playwright/test';
import { blank, node, Store, createComponent, instantiate } from '../../src/model';

function fixture() {
  const s = new Store(blank()); s.project.name = 'Selección por niveles';
  s.commit(p => {
    p.nodes.push(
      node('frame', { id: 'fa', name: 'Pantalla A', x: 60, y: 100, width: 480, height: 520 }),
      node('frame', { id: 'fb', name: 'Pantalla B', x: 640, y: 100, width: 480, height: 520 }),
      node('rect', { id: 'a', name: 'Elemento A', parentId: 'fa', x: 30, y: 20, width: 100, height: 50 }),
      node('rect', { id: 'b', name: 'Elemento B', parentId: 'fa', x: 160, y: 20, width: 100, height: 50 }),
      node('rect', { id: 'locked', parentId: 'fa', x: 30, y: 420, width: 100, height: 40, locked: true }),
      node('rect', { id: 'hidden', parentId: 'fa', x: 160, y: 420, width: 100, height: 40, hidden: true }),
      node('group', { id: 'master', name: 'Tarjeta reusable', parentId: 'fa', x: 40, y: 120, width: 300, height: 220, fill: '@accent' }),
      node('rect', { id: 'm1', name: 'Hijo uno', parentId: 'master', x: 24, y: 32, width: 70, height: 50 }),
      node('rect', { id: 'm2', name: 'Hijo dos', parentId: 'master', x: 150, y: 32, width: 70, height: 50 }),
      node('group', { id: 'nested', name: 'Grupo interno', parentId: 'master', x: 24, y: 120, width: 230, height: 70, fill: '@surface' }),
      node('rect', { id: 'n1', name: 'Nieto uno', parentId: 'nested', x: 10, y: 10, width: 60, height: 40 }),
      node('rect', { id: 'n2', name: 'Nieto dos', parentId: 'nested', x: 100, y: 10, width: 60, height: 40 }),
    );
    const c = createComponent(p, 'master'); instantiate(p, c.id, 'fb', 40, 120);
  });
  return s.project;
}
const design = (page: Page) => page.evaluate(() => (window as any).codaru.getDocument());
const ids = (page: Page) => page.evaluate(() => (window as any).codaru.getSelection().map((n: any) => n.id).sort());
const box = (page: Page, id: string) => page.locator(`#artboards .design-node[data-node="${id}"]`);
async function expectIds(page: Page, expected: string[]) { await expect.poll(() => ids(page)).toEqual(expected.sort()); }
async function expectScope(page: Page, scope: string) { await expect(page.locator('#stage')).toHaveAttribute('data-scope', scope); }
async function marquee(page: Page, parent: string, from: [number, number], to: [number, number], shift = false) {
  const b = (await box(page, parent).boundingBox())!;
  const doc = await design(page); const n = doc.nodes.find((n: any) => n.id === parent);
  const z = b.width / n.width;
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.move(b.x + from[0] * z, b.y + from[1] * z); await page.mouse.down();
  await page.mouse.move(b.x + to[0] * z, b.y + to[1] * z, { steps: 6 }); await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
}
test.beforeEach(async ({ page }) => {
  await page.goto('/'); await page.evaluate(project => (window as any).codaru.importDocument(project), fixture());
  await expect(box(page, 'fa')).toBeVisible();
});

test('workspace selects whole frames through their descendants and moves multiple frames together', async ({ page }) => {
  const before = await design(page);
  await box(page, 'a').click(); await expectIds(page, ['fa']);
  await box(page, 'fb').click({ position: { x: 5, y: 5 }, modifiers: ['Shift'] }); await expectIds(page, ['fa', 'fb']);
  const a = (await box(page, 'fa').boundingBox())!;
  await page.mouse.move(a.x + 5, a.y + 100); await page.mouse.down(); await page.mouse.move(a.x + 37, a.y + 116); await page.mouse.up();
  const after = await design(page);
  const delta = (id: string) => after.nodes.find((n: any) => n.id === id).x - before.nodes.find((n: any) => n.id === id).x;
  expect(delta('fa')).toBeGreaterThan(0); expect(delta('fb')).toBe(delta('fa')); expect(delta('a')).toBe(0);
  await page.keyboard.press('Control+z'); expect(await design(page)).toEqual(before);
  const a2 = (await box(page, 'fa').boundingBox())!, b = (await box(page, 'fb').boundingBox())!;
  await page.mouse.move(a2.x - 12, a2.y - 38); await page.mouse.down();
  await page.mouse.move(b.x + b.width + 12, b.y + b.height + 12, { steps: 8 });
  await expectIds(page, ['fa', 'fb']); // Feedback before release.
  await page.mouse.up(); await expectScope(page, '');
  expect(await design(page)).toEqual(before);
});

test('inside a frame marquee, shift click and select all only include its available direct children', async ({ page }) => {
  const before = await design(page);
  await box(page, 'fa').dblclick({ position: { x: 5, y: 5 } }); await expectScope(page, 'fa');
  await marquee(page, 'fa', [10, 10], [280, 90]); await expectIds(page, ['a', 'b']);
  await box(page, 'm1').click({ modifiers: ['Shift'] }); await expectIds(page, ['a', 'b', 'master']);
  await box(page, 'a').click({ modifiers: ['Shift'] }); await expectIds(page, ['b', 'master']);
  await page.keyboard.press('Control+a'); await expectIds(page, ['a', 'b', 'master']);
  await marquee(page, 'fa', [10, 10], [470, 500]); await expectIds(page, ['a', 'b', 'master']);
  expect(await design(page)).toEqual(before);
  await page.keyboard.press('Escape'); await expectScope(page, ''); await expectIds(page, ['fa']);
  await page.keyboard.press('Control+a'); await expectIds(page, ['fa', 'fb']);
});

test('component children and nested groups support multiple selection at 200% with undo', async ({ page }) => {
  await box(page, 'fa').dblclick({ position: { x: 5, y: 5 } });
  await box(page, 'm1').click(); await expectIds(page, ['master']);
  await page.keyboard.press('Shift+Digit2');
  await page.getByLabel('Opciones de zoom').selectOption('200');
  await page.keyboard.press('Enter'); await expectScope(page, 'master');
  await expect(page.getByRole('navigation', { name: 'Nivel de selección' })).toContainText('Workspace/Pantalla A/Tarjeta reusable');
  await marquee(page, 'master', [8, 8], [240, 100]); await expectIds(page, ['m1', 'm2']);
  const before = await design(page);
  await page.keyboard.press('ArrowRight');
  const moved = await design(page);
  for (const id of ['m1', 'm2']) {
    expect(moved.nodes.find((n: any) => n.id === id).x).toBe(before.nodes.find((n: any) => n.id === id).x + 1);
    expect(moved.nodes.find((n: any) => n.componentKey === id).x).toBe(moved.nodes.find((n: any) => n.id === id).x);
  }
  await page.keyboard.press('Control+z'); expect(await design(page)).toEqual(before);
  await box(page, 'n1').click(); await expectIds(page, ['nested']);
  await box(page, 'n1').dblclick(); await expectScope(page, 'nested');
  await box(page, 'n1').click(); await box(page, 'n2').click({ modifiers: ['Shift'] }); await expectIds(page, ['n1', 'n2']);
  await page.keyboard.press('Control+a'); await expectIds(page, ['n1', 'n2']);
  await page.screenshot({ path: 'artifacts/selection-component.png' });
  await page.keyboard.press('Escape'); await expectScope(page, 'master'); await expectIds(page, ['nested']);
  await page.keyboard.press('Escape'); await expectScope(page, 'fa'); await expectIds(page, ['master']);
  await page.keyboard.press('Escape'); await expectScope(page, ''); await expectIds(page, ['fa']);
});

test('instance multi-selection edits its children without changing the master', async ({ page }) => {
  const before = await design(page), instance = before.nodes.find((n: any) => n.instanceOf);
  const childIds = ['m1', 'm2'].map(key => before.nodes.find((n: any) => n.componentKey === key).id);
  await box(page, 'fb').dblclick({ position: { x: 5, y: 5 } });
  await box(page, instance.id).dblclick({ position: { x: 5, y: 5 } }); await expectScope(page, instance.id);
  await marquee(page, instance.id, [8, 8], [240, 100]); await expectIds(page, childIds);
  await page.keyboard.press('ArrowRight');
  const after = await design(page);
  for (const id of childIds) expect(after.nodes.find((n: any) => n.id === id).x).toBe(before.nodes.find((n: any) => n.id === id).x + 1);
  for (const id of ['m1', 'm2']) expect(after.nodes.find((n: any) => n.id === id)).toEqual(before.nodes.find((n: any) => n.id === id));
  await page.keyboard.press('Control+z'); expect(await design(page)).toEqual(before);
});

test('scope breadcrumb, outside click and cancel restore a predictable selection without edits', async ({ page }) => {
  const before = await design(page);
  await page.locator('[data-layer="master"]').click();
  await page.getByRole('button', { name: 'Entrar y seleccionar hijos ↵' }).click(); await expectScope(page, 'master');
  await box(page, 'm1').click(); await expectIds(page, ['m1']);
  const b = (await box(page, 'master').boundingBox())!;
  await page.mouse.move(b.x + 3, b.y + 3); await page.mouse.down(); await page.mouse.move(b.x + b.width - 5, b.y + b.height - 5);
  await page.keyboard.press('Escape'); await page.mouse.up(); await expectScope(page, 'master'); await expectIds(page, ['m1']);
  await page.getByRole('navigation', { name: 'Nivel de selección' }).getByRole('button', { name: 'Pantalla A', exact: true }).click();
  await expectScope(page, 'fa'); await expectIds(page, []);
  await box(page, 'fb').click({ position: { x: 5, y: 5 } }); await expectScope(page, ''); await expectIds(page, ['fb']);
  await page.locator('[data-layer="m1"]').click(); await expectScope(page, 'master'); await expectIds(page, ['m1']);
  await page.locator('[data-layer="m2"]').click({ modifiers: ['Shift'] }); await expectIds(page, ['m1', 'm2']);
  expect(await design(page)).toEqual(before);
});
