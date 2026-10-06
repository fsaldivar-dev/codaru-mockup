import { test, expect } from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('[data-layer="screen-login"]')).toBeVisible();});

test('the Sistema tab shows the narrative, tokens and components with variants, and edits land in the document',async({page})=>{
  await page.evaluate(()=>{const api=(window as any).codaru;const m=api.getDocument().nodes.find((n:any)=>n.componentId);api.select([m.id]);});
  await page.getByRole('button',{name:'◇ Nueva variante'}).click();
  await page.locator('.sidebar-tabs').getByRole('button',{name:'Sistema'}).click();
  const view=page.locator('#system-view');
  await expect(view).toBeVisible();
  await expect(view.locator('h1')).toHaveText('Forma · Tu espacio creativo');
  await expect(page.locator('.mode-switch [data-mode="system"]')).toHaveClass(/active/);
  await expect(view.locator('.sys-swatch')).toHaveCount(14);
  const card=view.locator('.sys-card').filter({hasText:'Botón principal'});
  await expect(card.locator('.sys-card-head span')).toHaveText('2 variantes');
  await expect(card.locator('figure .sys-preview')).toHaveCount(2);
  await expect(card.locator('figcaption').nth(1)).toHaveText('Estado=Variante 2');
  await view.getByLabel('Producto, negocio y nicho').fill('Academia de música para adultos'); await view.getByLabel('Producto, negocio y nicho').blur();
  await card.getByLabel(/Buenas prácticas/).fill('Uno por pantalla\nTexto de verbo'); await card.getByLabel(/Buenas prácticas/).blur();
  await expect(card.locator('li.do')).toHaveCount(2);
  const doc=await page.evaluate(()=>{const d=(window as any).codaru.getDocument();return {summary:d.designSystem?.summary,docs:d.components.filter((c:any)=>c.set).map((c:any)=>c.doc?.do)};});
  expect(doc.summary).toBe('Academia de música para adultos'); expect(doc.docs).toEqual(['Uno por pantalla\nTexto de verbo','Uno por pantalla\nTexto de verbo']);
  await page.locator('#system-index').getByRole('button',{name:'Componentes'}).click();
  await page.locator('.mode-switch [data-mode="design"]').click();
  await expect(view).toBeHidden();
  await expect(page.locator('.sidebar-tabs [data-tab="layers"]')).toHaveClass(/active/);
  await page.locator('.sidebar-tabs').getByRole('button',{name:'Componentes'}).click();
  await expect(page.locator('.component-tile .sys-preview').first()).toBeVisible();
});
