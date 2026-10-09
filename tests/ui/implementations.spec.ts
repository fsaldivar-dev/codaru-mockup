import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.goto('/examples/implementations-host.html');
  await page.waitForFunction(() => !!(window as any).implementationsExample);
});

test('inspector delegates each platform to its host without editing the design', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const before = await page.evaluate(() => (window as any).implementationsExample.editor.getDocument());
  const panel = page.locator('#inspector-slot');
  for (const [platform, symbol, code] of [['ios', 'CardView', 'import SwiftUI'], ['android', 'Card', '@Composable'], ['web', 'Card', 'ReactNode']]) {
    await panel.getByRole('button', { name: `Abrir implementación ${platform}`, exact: true }).click();
    await expect(page.locator('#source-title')).toHaveText(`${symbol} · ${platform}`);
    await expect(page.locator('#source-code')).toContainText(code);
  }
  const result = await page.evaluate(() => { const t = (window as any).implementationsExample; return { doc: t.editor.getDocument(), requests: t.requests }; });
  expect(result.doc).toEqual(before); expect(result.requests.map((r: any) => r.platform)).toEqual(['ios', 'android', 'web']);
  expect(result.requests.every((r: any) => !('document' in r) && !('code' in r))).toBe(true);
  await panel.getByRole('button', { name: 'Abrir implementación ios', exact: true }).click();
  await mkdir('artifacts/implementations', { recursive: true });
  await writeFile('artifacts/implementations/fixture.json', JSON.stringify(result.doc));
  await page.screenshot({ path: 'artifacts/implementations/embedded.png' });
  expect(errors).toEqual([]);
});

test('author creates, validates, edits and removes shared links with undo', async ({ page }) => {
  const panel = page.locator('#inspector-slot');
  await panel.getByRole('button', { name: 'Editar vínculos en el maestro' }).click();
  await panel.getByRole('button', { name: '+ Vincular implementación' }).click();
  const dialog = page.getByRole('dialog', { name: 'Vincular implementación' });
  await dialog.getByLabel('Símbolo', { exact: true }).fill('LinuxCard');
  await dialog.getByRole('button', { name: 'Guardar vínculo' }).click();
  await expect(dialog.getByRole('alert')).toContainText('ya tiene un vínculo');
  await dialog.getByLabel('Plataforma', { exact: true }).fill('linux');
  await dialog.getByLabel('Archivo relativo', { exact: true }).fill('../outside.cpp');
  await dialog.getByRole('button', { name: 'Guardar vínculo' }).click(); await expect(dialog.getByRole('alert')).toContainText('ruta relativa');
  await dialog.getByLabel('Archivo relativo', { exact: true }).fill('src/Card.cpp');
  await dialog.getByRole('button', { name: 'Guardar vínculo' }).click(); await expect(dialog).toHaveCount(0);
  await panel.getByRole('button', { name: 'Editar implementación linux', exact: true }).click();
  await dialog.getByLabel('Símbolo', { exact: true }).fill('DesktopCard');
  await dialog.getByRole('button', { name: 'Guardar vínculo' }).click();
  await page.getByRole('button', { name: 'Seleccionar tarjeta', exact: true }).click();
  await expect(panel).toContainText('DesktopCard');
  await panel.getByRole('button', { name: 'Abrir implementación linux', exact: true }).click();
  await expect(page.locator('#dialogs-slot #toast')).toContainText('solo resuelve');
  await panel.getByRole('button', { name: 'Editar vínculos en el maestro' }).click();
  await panel.getByRole('button', { name: 'Desvincular implementación linux', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Abrir implementación linux', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); await expect(panel).toContainText('DesktopCard');
});

test('scoped agent reads links while respecting author dialogs; explicit host persistence survives reload', async ({ page }) => {
  await page.goto('/examples/implementations-host.html?persist=playwright');
  await page.waitForFunction(() => !!(window as any).implementationsExample);
  await page.evaluate(() => { const t = (window as any).implementationsExample; t.editor.setImplementation(t.ids.card, 'macos', { symbol: 'MacCard', module: 'Desktop' }); });
  await page.reload(); await page.waitForFunction(() => !!(window as any).implementationsExample);
  await expect(page.locator('#inspector-slot')).toContainText('MacCard');
  await page.locator('#inspector-slot').getByRole('button', { name: 'Editar vínculos en el maestro' }).click();
  await page.getByRole('button', { name: 'Editar implementación macos', exact: true }).click();
  const response = await page.evaluate(async () => { const t = (window as any).implementationsExample, ctx = await t.editor.agent('context', { scope: t.ids.second, depth: 0 }); return { ctx, apply: await t.editor.agent('apply', { expectedRevision: ctx.context.revision, operations: [{ op: 'component.implementation.set', componentId: t.ids.card, platform: 'macos', reference: null }] }) }; });
  expect(response.ctx.context.nodes[0].implementation.implementations.macos.symbol).toBe('MacCard');
  expect(response.apply.error.code).toBe('editor_busy');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
});

test('view removal flushes text and keeps navigation available; absent handlers are explicit', async ({ page }) => {
  const title = page.locator('#inspector-slot').getByLabel('Título', { exact: true });
  await title.fill('Conservado al desmontar');
  const result = await page.evaluate(async () => {
    const t = (window as any).implementationsExample; t.view.destroy();
    await t.editor.requestImplementation(t.ids.second, 'ios');
    const { createEditor, createEditorView } = await import(/* @vite-ignore */ ['/src', 'modular.ts'].join('/'));
    const other = createEditor({ document: t.editor.getDocument() });
    other.select([t.ids.second]);
    const view = createEditorView(other, { appearance: { theme: 'light' } }); view.mount('inspector', document.getElementById('inspector-slot')!);
    return t.editor.getComponentProperties(t.ids.second).find((p: any) => p.key === 'titulo').value;
  });
  expect(result).toBe('Conservado al desmontar'); await expect(page.locator('#source-title')).toContainText('CardView');
  await expect(page.getByRole('button', { name: 'Abrir implementación ios', exact: true })).toBeDisabled();
  await expect(page.locator('#inspector-slot')).toContainText('cuando el IDE la conecte');
});
