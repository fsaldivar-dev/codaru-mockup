import { test, expect, type Page } from '@playwright/test';

const camera = (page: Page) => page.locator('#world').evaluate(el => {
  const m = new DOMMatrix(getComputedStyle(el).transform);
  return { zoom: m.a, x: m.e, y: m.f };
});
const documentState = (page: Page) => page.evaluate(() => (window as any).codaru.getDocument());
const percentage = (page: Page) => page.getByLabel('Porcentaje de zoom', { exact: true });
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#artboards .design-node[data-node="screen-login"]')).toBeVisible();
});

test('wheel zoom stays under the pointer and does not alter the design or undo history', async ({ page }) => {
  const beforeDoc = await documentState(page);
  const stage = (await page.locator('#stage').boundingBox())!;
  const anchor = { x: Math.round(stage.width * .35), y: Math.round(stage.height * .4) };
  const before = await camera(page);
  await page.mouse.move(stage.x + anchor.x, stage.y + anchor.y);
  await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await camera(page)).zoom).toBeGreaterThan(before.zoom);
  const after = await camera(page);
  expect((anchor.x - after.x) / after.zoom).toBeCloseTo((anchor.x - before.x) / before.zoom, 2);
  expect((anchor.y - after.y) / after.zoom).toBeCloseTo((anchor.y - before.y) / before.zoom, 2);
  await page.mouse.wheel(0, 100);
  await expect.poll(async () => (await camera(page)).zoom).toBeCloseTo(before.zoom, 5);
  expect(await documentState(page)).toEqual(beforeDoc);
  await expect(page.getByRole('button', { name: 'Deshacer · ⌘Z', exact: true })).toBeDisabled();
});

test('editable percentage, presets, bounds and keyboard shortcuts control only the canvas', async ({ page }) => {
  const beforeDoc = await documentState(page);
  await percentage(page).fill('150%'); await percentage(page).press('Enter');
  await expect(percentage(page)).toHaveValue('150%'); expect((await camera(page)).zoom).toBe(1.5);
  await page.getByRole('button', { name: 'Acercar', exact: true }).click();
  await expect(percentage(page)).toHaveValue('180%');
  await page.getByRole('button', { name: 'Alejar', exact: true }).click();
  await expect(percentage(page)).toHaveValue('150%');
  await page.getByLabel('Opciones de zoom').selectOption('200'); expect((await camera(page)).zoom).toBe(2);
  await page.keyboard.press('0'); expect((await camera(page)).zoom).toBe(1);
  await page.keyboard.press('+'); expect((await camera(page)).zoom).toBe(1.2);
  await page.keyboard.press('-'); expect((await camera(page)).zoom).toBe(1);
  await page.keyboard.press('Control+='); expect((await camera(page)).zoom).toBe(1.2);
  await page.keyboard.press('Meta+0'); expect((await camera(page)).zoom).toBe(1);
  await percentage(page).fill('999'); await percentage(page).press('Enter');
  await expect(percentage(page)).toHaveValue('800%'); await expect(page.getByRole('button', { name: 'Acercar', exact: true })).toBeDisabled();
  await percentage(page).fill('2'); await percentage(page).press('Enter');
  await expect(percentage(page)).toHaveValue('10%'); await expect(page.getByRole('button', { name: 'Alejar', exact: true })).toBeDisabled();
  await percentage(page).fill('invalid'); await percentage(page).press('Enter');
  await expect(percentage(page)).toHaveValue('10%');
  await percentage(page).fill('175'); await percentage(page).press('Escape');
  await expect(percentage(page)).toHaveValue('10%');
  await percentage(page).fill('125,5%'); await percentage(page).press('Enter');
  expect((await camera(page)).zoom).toBe(1.255);
  expect(await documentState(page)).toEqual(beforeDoc);
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
});

test('fit selection uses nested document bounds and fit all restores both screens', async ({ page }) => {
  await page.locator('[data-layer="primary-button"]').click();
  await page.keyboard.press('Shift+Digit2');
  const stage = (await page.locator('#stage').boundingBox())!;
  const selected = (await page.locator('#artboards [data-node="primary-button"]').boundingBox())!;
  expect(selected.x).toBeGreaterThan(stage.x + 40);
  expect(selected.x + selected.width).toBeLessThan(stage.x + stage.width - 40);
  expect(selected.y).toBeGreaterThan(stage.y);
  expect(selected.y + selected.height).toBeLessThan(stage.y + stage.height - 60);
  expect((await camera(page)).zoom).toBeGreaterThan(1);
  await page.keyboard.press('Shift+Digit1');
  for (const id of ['screen-login', 'screen-dashboard']) {
    const frame = (await page.locator(`#artboards > .design-node[data-node="${id}"]`).boundingBox())!;
    expect(frame.x).toBeGreaterThanOrEqual(stage.x);
    expect(frame.x + frame.width).toBeLessThanOrEqual(stage.x + stage.width);
    expect(frame.y).toBeGreaterThanOrEqual(stage.y);
    expect(frame.y + frame.height).toBeLessThanOrEqual(stage.y + stage.height - 60);
  }
});

test('space plus wheel pans, while Ctrl+wheel and WebKit pinch scale around a fixed point', async ({ page }) => {
  const stage = (await page.locator('#stage').boundingBox())!;
  await page.mouse.move(stage.x + 200, stage.y + 200);
  const before = await camera(page);
  await page.keyboard.down('Space'); await page.mouse.wheel(20, 80); await page.keyboard.up('Space');
  await expect.poll(async () => (await camera(page)).y).toBeCloseTo(before.y - 80, 2);
  expect((await camera(page)).zoom).toBe(before.zoom);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -20); await page.keyboard.up('Control');
  await expect.poll(async () => (await camera(page)).zoom).toBeGreaterThan(before.zoom);
  const beforePinch = await camera(page);
  const dispatch = (type: string, scale: number) => page.locator('#stage').evaluate((el, args) => {
    const r = el.getBoundingClientRect();
    const event = new Event(args.type, { bubbles: true, cancelable: true });
    Object.assign(event, { scale: args.scale, clientX: r.left + 200, clientY: r.top + 200 });
    el.dispatchEvent(event);
  }, { type, scale });
  await dispatch('gesturestart', 1);
  await dispatch('gesturechange', 1.5);
  await dispatch('gesturechange', 2);
  await dispatch('gestureend', 2);
  const afterPinch = await camera(page);
  expect(afterPinch.zoom).toBeCloseTo(beforePinch.zoom * 2, 5);
  expect((200 - afterPinch.x) / afterPinch.zoom).toBeCloseTo((200 - beforePinch.x) / beforePinch.zoom, 2);
  expect((200 - afterPinch.y) / afterPinch.zoom).toBeCloseTo((200 - beforePinch.y) / beforePinch.zoom, 2);
});

test('zoom preserves an active inline text edit and drawing remains accurate at 200%', async ({ page }) => {
  await page.locator('[data-layer="screen-login"]').click();
  await page.getByRole('button', { name: 'Entrar y seleccionar hijos ↵' }).click();
  const button = page.locator('#artboards [data-node="primary-button"]');
  await button.dblclick();
  const editor = button.locator('[contenteditable="true"]');
  await expect(editor).toBeFocused();
  await page.keyboard.type('Nuevo texto');
  const b = (await button.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  const before = await camera(page); await page.mouse.wheel(0, -80);
  await expect.poll(async () => (await camera(page)).zoom).toBeGreaterThan(before.zoom);
  await expect(editor).toBeFocused(); await expect(editor).toHaveText('Nuevo texto');
  await page.keyboard.press('Escape');
  expect((await documentState(page)).nodes.find((n: any) => n.id === 'primary-button').text).toBe('Nuevo texto');
  await page.locator('[data-layer="screen-login"]').click();
  await page.keyboard.press('Shift+Digit2');
  await page.getByLabel('Opciones de zoom').selectOption('200');
  const stage = (await page.locator('#stage').boundingBox())!;
  const start = { x: stage.x + stage.width / 2 - 80, y: stage.y + stage.height / 2 - 60 };
  await page.getByRole('button', { name: 'Rectángulo · R', exact: true }).click();
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x + 160, start.y + 80); await page.mouse.up();
  const rect = (await documentState(page)).nodes.at(-1);
  expect(rect.type).toBe('rect'); expect(rect.width).toBe(80); expect(rect.height).toBe(40);
  expect(rect.parentId).toBe('screen-login');
  const handle = (await page.locator('.resize-handle.se').boundingBox())!;
  const grip = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
  await page.mouse.move(grip.x, grip.y); await page.mouse.down();
  await page.mouse.move(grip.x + 40, grip.y + 24); await page.mouse.up();
  const resized = (await documentState(page)).nodes.find((n: any) => n.id === rect.id);
  expect(resized.width).toBe(100); expect(resized.height).toBe(52);
  await page.keyboard.press('Control+z');
  expect((await documentState(page)).nodes.find((n: any) => n.id === rect.id).width).toBe(80);
});
