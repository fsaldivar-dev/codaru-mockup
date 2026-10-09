import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const artifacts = 'artifacts/nested-components';
test.beforeEach(async ({ page }) => { await page.goto('/examples/nested-host.html'); await page.waitForFunction(() => !!(window as any).nestedExample); });

test('embedded fragments edit nested text, propagate a master, preserve selection, export and undo', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const state = () => page.evaluate(() => (window as any).nestedExample.editor.getState());
  const ids = await page.evaluate(() => (window as any).nestedExample.ids);
  await page.getByRole('button', { name: 'Editar texto local', exact: true }).click();
  const field = page.getByLabel('Contenido del texto'); await expect(field).toHaveValue('Continuar mi proyecto');
  await field.fill('Mi siguiente paso'); await field.press('Tab');
  await page.getByRole('button', { name: 'Cambiar color del maestro' }).click();
  expect((await state()).selection).toEqual([ids.localLabel]); await expect(field).toHaveValue('Mi siguiente paso');
  const snapshot = await state(), buttons = snapshot.document.nodes.filter((n: any) => n.instanceOf === ids.button);
  expect(buttons.length).toBeGreaterThan(2); expect(buttons.every((n: any) => n.fill === '#177c68')).toBe(true);
  for (const button of buttons) await expect(page.locator(`#canvas-slot [data-node="${button.id}"]`).first()).toHaveCSS('background-color', 'rgb(23, 124, 104)');
  const exported = await page.evaluate(async () => {
    const { editor, ids } = (window as any).nestedExample;
    const png = await editor.exportAsset({ ids: [ids.second], format: 'png', scale: 1 });
    const assets = await editor.exportAsset({ ids: [ids.second], format: 'assets', platform: 'all', name: 'nested-card' });
    return { svg: editor.exportSVG('screen'), html: editor.exportHTML(), png, assets };
  });
  expect(exported.svg).toContain('Mi siguiente paso'); expect(exported.svg).toContain('#177c68'); expect(exported.html).toContain('Mi siguiente paso');
  expect(exported.png.encoding).toBe('base64'); expect(exported.assets.encoding).toBe('base64');
  await mkdir(artifacts, { recursive: true }); await writeFile(`${artifacts}/screen.svg`, exported.svg);
  await writeFile(`${artifacts}/card.png`, Buffer.from(exported.png.content, 'base64'));
  await writeFile(`${artifacts}/assets.zip`, Buffer.from(exported.assets.content, 'base64'));
  await page.screenshot({ path: `${artifacts}/embedded.png` });
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect((await state()).document.nodes.find((n: any) => n.id === 'button').fill).toBe('#7255db');
  await expect(field).toHaveValue('Mi siguiente paso'); expect(errors).toEqual([]);
});

test('the library inserts inside a selected master and synchronizes its existing uses', async ({ page }) => {
  const ids = await page.evaluate(() => (window as any).nestedExample.ids);
  await page.evaluate(() => (window as any).nestedExample.editor.select(['card']));
  await page.locator(`#library-slot [data-component="${ids.symbol}"]`).click();
  const result = await page.evaluate(() => { const { editor, ids } = (window as any).nestedExample; const state = editor.getState(); return { state, ids }; });
  const inserted = result.state.document.nodes.find((n: any) => n.id === result.state.selection[0]);
  expect(inserted.parentId).toBe('card'); expect(inserted.instanceOf).toBe(ids.symbol);
  expect(result.state.document.nodes.filter((n: any) => n.componentKey === inserted.id)).toHaveLength(2);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  expect(await page.evaluate(id => (window as any).nestedExample.editor.getDocument().nodes.some((n: any) => n.id === id), inserted.id)).toBe(false);
});

test('selection enters each nested container and variant controls preserve local text', async ({ page }) => {
  const ids = await page.evaluate(() => (window as any).nestedExample.ids);
  const nestedButton = await page.evaluate(() => { const { editor, ids } = (window as any).nestedExample; return editor.getDocument().nodes.find((n: any) => n.parentId === ids.second && n.instanceOf === ids.button).id; });
  await page.locator('#inspector-slot').getByRole('button', { name: 'Entrar y seleccionar hijos ↵' }).click();
  expect(await page.evaluate(() => (window as any).nestedExample.editor.getState().scope)).toBe(ids.second);
  await page.locator(`#canvas-slot [data-node="${nestedButton}"]`).first().click();
  await page.locator('#inspector-slot').getByRole('button', { name: 'Entrar y seleccionar hijos ↵' }).click();
  expect(await page.evaluate(() => (window as any).nestedExample.editor.getState().scope)).toBe(nestedButton);
  await page.evaluate(id => (window as any).nestedExample.editor.select([id]), nestedButton);
  const selects = page.locator('#inspector-slot select[data-variant-switch]');
  await expect(selects).toHaveCount(1); await selects.selectOption('Suave'); await page.locator('header strong').click();
  expect(await page.evaluate(id => (window as any).nestedExample.editor.getDocument().nodes.find((n: any) => n.id === id).instanceOf, nestedButton)).toBe(ids.quiet);
  expect(await page.evaluate(id => (window as any).nestedExample.editor.getDocument().nodes.find((n: any) => n.id === id).text, ids.localLabel)).toBe('Continuar mi proyecto');
});

test('changing a nested variant in the master preserves selected text in its outer instances', async ({ page }) => {
  await page.getByRole('button', { name: 'Editar texto local', exact: true }).click();
  const result = await page.evaluate(async () => {
    const { editor, ids } = (window as any).nestedExample;
    const masterUse = editor.getDocument().nodes.find((n: any) => n.parentId === 'card' && n.instanceOf === ids.button);
    const ctx = await editor.agent('context');
    return editor.agent('apply', { expectedRevision: ctx.context.revision, operations: [{ op: 'variant.switch', id: masterUse.id, variant: { Estado: 'Suave' } }] });
  });
  expect(result.ok).toBe(true);
  await expect(page.getByLabel('Contenido del texto')).toHaveValue('Continuar mi proyecto');
  const preserved = await page.evaluate(() => { const { editor, ids } = (window as any).nestedExample; return editor.getState().selection[0] === ids.localLabel && editor.getDocument().nodes.find((n: any) => n.id === ids.localLabel)?.text === 'Continuar mi proyecto'; });
  expect(preserved).toBe(true);
});

test('a prefabricated kit component can be added to a master from a detached library', async ({ page }) => {
  await page.evaluate(() => (window as any).nestedExample.editor.select(['card']));
  await page.locator('#library-slot').getByRole('button', { name: 'Kits de diseño', exact: true }).click();
  await page.getByLabel('Kit de diseño', { exact: true }).selectOption('android');
  await page.locator('#library-slot [data-kit-item="button"]').click();
  const added = await page.evaluate(() => { const { editor } = (window as any).nestedExample; const state = editor.getState(); const root = state.document.nodes.find((n: any) => n.id === state.selection[0]); return { parent: root.parentId, kit: root.kitId, inherited: state.document.nodes.filter((n: any) => n.componentKey === root.id).length }; });
  expect(added).toEqual({ parent: 'card', kit: 'android', inherited: 2 });
});
