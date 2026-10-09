import { test, expect } from '@playwright/test';

test('existing host tokens and CSS parts survive density changes, folding and remounting', async ({ page }) => {
  await page.goto('/tests/fixtures/modular.html');
  await page.waitForFunction(() => !!(window as any).modularTest);
  const before = await page.locator('#host-button').evaluate(el => getComputedStyle(el).cssText || getComputedStyle(el).border);
  await page.evaluate(() => {
    const t = (window as any).modularTest;
    const a = t.mount('a'), b = t.mount('b');
    a.host.style.setProperty('--codaru-accent', '#008060');
    a.host.style.setProperty('--codaru-panel-padding', '18px');
    const style = document.createElement('style');
    style.textContent = '[data-instance="a"] [data-codaru-part="inspector"]::part(inspector){border-top:3px solid rgb(20,70,90)}';
    document.head.append(style);
    a.view.setAppearance({ tokens: { accent: null }, density: 'comfortable' });
    a.editor.select(['a-rect']); b.editor.select(['b-rect']);
  });
  const panel = page.locator('[data-instance="a"] [data-codaru-part="inspector"]');
  const doc = await page.evaluate(() => (window as any).modularTest.records.a.editor.getDocument());
  await expect(panel.locator('#inspector')).toHaveCSS('border-top-width', '3px');
  await expect(panel.locator('.node-heading')).toHaveCSS('padding-left', '18px');
  await expect(panel.getByRole('spinbutton', { name: 'W', exact: true })).toHaveCSS('font-size', '12px');
  await panel.locator('[data-panel-section="RELLENO"] .section-toggle').click();
  await expect(panel.getByRole('button', { name: 'Relleno: color', exact: true })).toBeHidden();
  await expect(page.locator('[data-instance="b"]').getByRole('button', { name: 'Relleno: color', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const a = (window as any).modularTest.records.a;
    a.editor.select(['a-frame']); a.editor.select(['a-rect']);
    a.handles.inspector.destroy(); a.handles.inspector = a.view.mount('inspector', a.slots.inspector);
  });
  await expect(panel.locator('[data-panel-section="RELLENO"] .section-toggle')).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => (window as any).modularTest.records.a.editor.getDocument())).toEqual(doc);
  expect(await page.locator('#host-button').evaluate(el => getComputedStyle(el).cssText || getComputedStyle(el).border)).toBe(before);
});

test('full editor and fragments share appearance while iframe tokens restore host inheritance', async ({ page }) => {
  await page.goto('/tests/fixtures/embed.html');
  await page.waitForFunction(() => !!(window as any).embedTest);
  await page.evaluate(async () => {
    const t = (window as any).embedTest;
    const moduleURL = '/src/modular.ts';
    const { createEditor, createEditorView } = await import(/* @vite-ignore */ moduleURL);
    const appearance = { theme: 'light', density: 'comfortable', tokens: { accent: '#006b70', fontSize: 16, radius: 9, panelPadding: 14 } };
    const r = t.mount('styled', { documentName: 'Apariencia', appearance });
    await r.handle.ready; r.api.select(['styled-shape']);
    const slot = document.createElement('div'); slot.id = 'modular-appearance'; slot.style.cssText = 'width:300px;height:600px'; document.body.append(slot);
    const editor = createEditor({ document: r.api.getDocument() }); editor.select(['styled-shape']);
    const view = createEditorView(editor, { appearance }); view.mount('inspector', slot);
    t.modularAppearance = { editor, view };
    t.appearanceDocument = r.api.getDocument();
  });
  const full = page.frameLocator('[data-embed="styled"]');
  const fragment = page.locator('#modular-appearance');
  for (const selector of ['.node-name', '.number-field input', '.section-heading', '.full-field select']) {
    const read = (el: Element) => { const s = getComputedStyle(el); return { font: s.fontSize, color: s.color, radius: s.borderRadius }; };
    expect(await full.locator(selector).first().evaluate(read)).toEqual(await fragment.locator(selector).first().evaluate(read));
  }
  await page.evaluate(() => {
    const r = (window as any).embedTest.records.styled;
    document.getElementById('slot-styled')!.style.setProperty('--codaru-accent', '#aa3300');
    r.handle.setAppearance({ theme: 'dark', tokens: { accent: null } });
  });
  await expect(full.locator('.preview-button')).toHaveCSS('background-color', 'rgb(170, 51, 0)');
  expect(await page.evaluate(() => (window as any).embedTest.records.styled.api.getDocument())).toEqual(await page.evaluate(() => (window as any).embedTest.appearanceDocument));
  await expect(fragment.locator('.section-heading').first()).toHaveCSS('color', 'rgb(36, 36, 41)');
});

test('component controls scale with host fonts and narrow panels keep their fields inside the container', async ({ page }) => {
  await page.goto('/examples/implementations-host.html');
  await page.waitForFunction(() => !!(window as any).implementationsExample);
  await page.evaluate(() => {
    document.getElementById('inspector-slot')!.style.width = '220px';
    (window as any).implementationsExample.view.setAppearance({ tokens: { fontSize: 16, radius: 10 } });
  });
  const panel = page.locator('#inspector-slot');
  await expect(panel.getByLabel('Título', { exact: true })).toHaveCSS('font-size', '16px');
  await expect(panel.getByRole('spinbutton', { name: 'W', exact: true })).toHaveCSS('font-size', '16px');
  expect(await panel.locator('#inspector').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await panel.getByRole('button', { name: 'Abrir implementación ios', exact: true }).click();
  await expect(page.locator('#source-title')).toHaveText('CardView · ios');
});

test('slot checkboxes align with their labels and color channels fit complete values', async ({ page }) => {
  await page.goto('/examples/slots-host.html');
  await page.waitForFunction(() => !!(window as any).slotsExample);
  await page.evaluate(() => (window as any).slotsExample.editor.select(['card']));
  await page.getByRole('button', { name: 'Configurar Cabecera', exact: true }).click();
  const checkbox = page.getByLabel('Permitir Avatar', { exact: true });
  const geometry = await checkbox.evaluate(el => {
    const box = el.getBoundingClientRect();
    const text = [...el.parentElement!.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())!;
    const range = document.createRange(); range.selectNode(text);
    return { width: box.width, gap: range.getBoundingClientRect().left - box.right };
  });
  expect(geometry.width).toBeLessThanOrEqual(16); expect(geometry.gap).toBeGreaterThanOrEqual(0); expect(geometry.gap).toBeLessThanOrEqual(12);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Relleno: color', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Selector de color' });
  for (const label of ['Canal R', 'Canal G', 'Canal B', 'Opacidad %']) {
    const field = picker.getByLabel(label, { exact: true });
    expect((await field.boundingBox())!.width).toBeGreaterThanOrEqual(48);
  }
});

test('theme redraws retain keyboard focus and invalid appearance updates do not poison future mounts', async ({ page }) => {
  await page.goto('/tests/fixtures/modular.html');
  await page.waitForFunction(() => !!(window as any).modularTest);
  await page.evaluate(() => (window as any).modularTest.mount('a'));
  await page.evaluate(() => (window as any).modularTest.records.a.editor.command('themes'));
  const gradients = page.getByRole('button', { name: 'Degradados', exact: true });
  await gradients.click(); await expect(gradients).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  const errors = await page.evaluate(() => {
    const a = (window as any).modularTest.records.a, errors = [];
    try { a.view.setAppearance({ density: 'invalid', tokens: { fontSize: 40 } }); } catch (error) { errors.push(String(error)); }
    a.handles.inspector.destroy(); a.handles.inspector = a.view.mount('inspector', a.slots.inspector);
    const slot = document.createElement('div'); a.host.append(slot);
    try { a.view.mount('library', slot, { appearance: { tokens: { gap: -1 } } }); } catch (error) { errors.push(String(error)); }
    a.view.mount('library', slot);
    return errors;
  });
  expect(errors).toHaveLength(2);
  await expect(page.locator('[data-codaru-part="inspector"]')).toHaveAttribute('data-codaru-theme', 'light');
  await expect(page.locator('[data-codaru-part="library"]')).toHaveCount(1);
});
