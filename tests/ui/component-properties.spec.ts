import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const artifacts = 'artifacts/component-properties';
test.beforeEach(async ({ page }) => { await page.goto('/examples/properties-host.html'); await page.waitForFunction(() => !!(window as any).propertiesExample); });

test('inspector, host and AI edit the same public values, preserve localization and export assets', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const inspector = page.locator('#inspector-slot');
  const title = inspector.getByLabel('Título', { exact: true }); await expect(title).toHaveValue('Proyecto Bosque');
  await title.fill('Diseñado a mi manera'); await title.press('Tab');
  await expect(page.getByLabel('Título desde el IDE')).toHaveValue('Diseñado a mi manera');
  await page.getByLabel('Título desde el IDE').fill('Mi próximo proyecto'); await page.getByLabel('Título desde el IDE').press('Tab');
  await expect(title).toHaveValue('Mi próximo proyecto');
  await inspector.getByLabel('Icono · Kit').selectOption('web'); await inspector.getByLabel('Icono', { exact: true }).selectOption('heart');
  await inspector.getByLabel('Mostrar descripción', { exact: true }).uncheck(); await page.locator('header strong').click();
  await inspector.getByLabel('Estilo del botón').selectOption('Suave'); await page.locator('header strong').click();
  const result = await page.evaluate(async () => {
    const { editor, ids } = (window as any).propertiesExample;
    const ctx = await editor.agent('context', { scope: ids.second, depth: 0 });
    const applied = await editor.agent('apply', { expectedRevision: ctx.context.revision, operations: [{ op: 'component.property.set', id: ids.second, key: 'accion', value: 'Explorar posibilidades' }] });
    const props = editor.getComponentProperties(ids.second);
    const png = await editor.exportAsset({ ids: [ids.second], format: 'png' });
    return { applied, props, svg: editor.exportSVG('screen'), png, document: editor.getDocument() };
  });
  expect(result.applied.ok).toBe(true); expect(result.props.find((p: any) => p.key === 'icono').value).toEqual({ pack: 'web', name: 'heart' });
  expect(result.document.nodes.find((n: any) => n.id === 'card-copy').textKey).toBe('card.description');
  expect(result.svg).toContain('Explorar posibilidades');
  await expect(inspector.getByLabel('Texto del botón', { exact: true })).toHaveValue('Explorar posibilidades');
  await mkdir(artifacts, { recursive: true }); await writeFile(`${artifacts}/screen.svg`, result.svg); await writeFile(`${artifacts}/card.png`, Buffer.from(result.png.content, 'base64'));
  await writeFile(`${artifacts}/fixture.json`, JSON.stringify(result.document)); await page.screenshot({ path: `${artifacts}/embedded.png` });
  await inspector.getByRole('button', { name: 'Restablecer Título', exact: true }).click(); await expect(title).toHaveValue('Tu próximo proyecto');
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); await expect(title).toHaveValue('Mi próximo proyecto');
  expect(errors).toEqual([]);
});

test('authors expose a layer, repair validation in the dialog, configure and remove a binding', async ({ page }) => {
  await page.evaluate(() => (window as any).propertiesExample.editor.select(['card-copy']));
  await page.getByRole('button', { name: '+ Exponer propiedad en Tarjeta', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Exponer propiedad' });
  await expect(dialog.getByLabel('Tipo de propiedad')).toHaveValue('text');
  await dialog.getByLabel('Clave de propiedad').fill('titulo'); await dialog.getByLabel('Nombre visible').fill('Detalle');
  await dialog.getByRole('button', { name: 'Guardar propiedad' }).click(); await expect(dialog.getByRole('alert')).toContainText('ya existe');
  await dialog.getByLabel('Clave de propiedad').fill('detalle'); await dialog.getByRole('button', { name: 'Guardar propiedad' }).click(); await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Seleccionar tarjeta' }).click(); const detail = page.getByLabel('Detalle', { exact: true });
  await detail.fill('Otro inicio'); await detail.press('Tab'); await expect(page.locator('#inspector-slot')).toContainText('card.description');
  await page.evaluate(() => (window as any).propertiesExample.editor.select(['card']));
  await page.getByRole('button', { name: 'Configurar Detalle', exact: true }).click(); await dialog.getByLabel('Nombre visible').fill('Subtítulo');
  await expect(dialog.getByLabel('Clave de propiedad')).toHaveAttribute('readonly', ''); await dialog.getByRole('button', { name: 'Guardar propiedad' }).click();
  await page.getByRole('button', { name: 'Dejar de exponer Subtítulo' }).click();
  await page.getByRole('button', { name: 'Seleccionar tarjeta' }).click(); await expect(page.getByLabel('Subtítulo', { exact: true })).toHaveCount(0);
  const texts = await page.evaluate(() => (window as any).propertiesExample.editor.getDocument().nodes.filter((n: any) => n.text === 'Otro inicio'));
  expect(texts).toHaveLength(1);
});

test('unmount flushes focused property changes and dialog teardown releases the session', async ({ page }) => {
  const input = page.locator('#inspector-slot').getByLabel('Título', { exact: true }); await input.fill('Confirmado al desmontar');
  const result = await page.evaluate(() => { const { editor, view, ids } = (window as any).propertiesExample; view.destroy(); const props = editor.getComponentProperties(ids.second); editor.setComponentProperty(ids.second, 'titulo', 'Sin vista'); return { flushed: props[0].value, next: editor.getComponentProperties(ids.second)[0].value }; });
  expect(result).toEqual({ flushed: 'Confirmado al desmontar', next: 'Sin vista' });
});

test('agent respects a focused control and modal; hidden property can be made visible again', async ({ page }) => {
  await page.locator('#inspector-slot').getByLabel('Título', { exact: true }).focus();
  const edit = () => page.evaluate(async () => { const { editor, ids } = (window as any).propertiesExample; const ctx = await editor.agent('context'); return editor.agent('apply', { expectedRevision: ctx.context.revision, operations: [{ op: 'component.property.set', id: ids.second, key: 'titulo', value: 'No autorizado durante edición' }] }); });
  expect((await edit()).error.code).toBe('editor_busy'); await page.locator('header strong').click();
  const check = page.locator('#inspector-slot').getByLabel('Mostrar descripción', { exact: true }); await check.uncheck(); await check.check(); await page.locator('header strong').click();
  await page.evaluate(() => (window as any).propertiesExample.editor.select(['card'])); await page.getByRole('button', { name: '+ Exponer propiedad', exact: true }).click();
  expect((await edit()).error.code).toBe('editor_busy'); await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
});
