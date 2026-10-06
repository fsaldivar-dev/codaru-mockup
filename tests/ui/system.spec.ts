import { test, expect } from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('[data-layer="screen-login"]')).toBeVisible();});

test('the Sistema tab is a documentation site: contents with progress, foundation pages and component pages with options, anatomy and examples',async({page})=>{
  await page.evaluate(async()=>{const api=(window as any).codaru;const m=api.getDocument().nodes.find((n:any)=>n.componentId);api.select([m.id]);});
  await page.getByRole('button',{name:'◇ Nueva variante'}).click();
  await page.locator('.sidebar-tabs').getByRole('button',{name:'Sistema'}).click();
  const view=page.locator('#system-view');
  await expect(view).toBeVisible();
  await expect(view.locator('h1')).toHaveText('Forma · Tu espacio creativo');
  await expect(view.locator('.sys-progress')).toContainText('0 de 1 componentes documentados');
  await view.getByLabel('Producto, negocio y nicho').fill('Academia de música para adultos'); await view.getByLabel('Producto, negocio y nicho').blur();
  await expect(view.locator('.sys-read').filter({hasText:'Producto, negocio y nicho'})).toContainText('Academia de música para adultos');
  // foundations: color page measures contrasts, typography page renders the scale
  await page.locator('#system-index').getByRole('button',{name:'Color'}).click();
  await expect(view.locator('h1')).toHaveText('Color');
  await expect(view.locator('.sys-table td.ok').first()).toBeVisible();
  await page.locator('#system-index').getByRole('button',{name:'Tipografía'}).click();
  await expect(view.locator('.sys-type').first()).toContainText('Forma · Tu espacio creativo');
  // component page: options per axis, anatomy, four questions, do/don't with an example layer
  await page.locator('#system-index').getByRole('button',{name:/Botón principal/}).click();
  await expect(view.locator('h1')).toHaveText('Botón principal');
  await expect(view.locator('.sys-head .eyebrow')).toHaveText('COMPONENTE · 2 VARIANTES');
  await expect(view.locator('.sys-variants figure .sys-preview')).toHaveCount(2);
  await expect(view.locator('.sys-variants figcaption').nth(1)).toHaveText('Variante 2');
  await view.getByLabel(/Qué es y qué hace/).fill('La acción que hace avanzar la pantalla.'); await view.getByLabel(/Qué es y qué hace/).blur();
  await expect(view.locator('.sys-head p')).toHaveText('La acción que hace avanzar la pantalla.');
  await view.getByLabel(/Buenas prácticas/).fill('Uno por pantalla [ejemplo: screen-login]\nTexto de verbo'); await view.getByLabel(/Buenas prácticas/).blur();
  await expect(view.locator('li.do')).toHaveCount(2);
  await expect(view.locator('li.do .sys-example .sys-preview')).toHaveCount(1);
  await view.getByRole('button',{name:'Editar'}).click();
  await view.getByLabel(/Malas prácticas/).fill('Dos principales [ejemplo: no-existe]'); await view.getByLabel(/Malas prácticas/).blur();
  await view.getByRole('button',{name:'Terminar edición'}).click();
  await expect(view.locator('li.dont .sys-missing')).toContainText('no-existe');
  const doc=await page.evaluate(()=>{const d=(window as any).codaru.getDocument();return {summary:d.designSystem?.summary,docs:d.components.filter((c:any)=>c.set).map((c:any)=>[c.doc?.description,c.doc?.do])};});
  expect(doc.summary).toBe('Academia de música para adultos');
  expect(doc.docs).toEqual([['La acción que hace avanzar la pantalla.','Uno por pantalla [ejemplo: screen-login]\nTexto de verbo'],['La acción que hace avanzar la pantalla.','Uno por pantalla [ejemplo: screen-login]\nTexto de verbo']]);
  // reading mode hides the fields; Editar brings them back; the index tracks progress
  await expect(view.getByLabel(/Qué es y qué hace/)).toHaveCount(0);
  await view.getByRole('button',{name:'Editar'}).click();
  await expect(view.getByLabel(/Qué es y qué hace/)).toHaveValue('La acción que hace avanzar la pantalla.');
  await view.getByRole('button',{name:'Terminar edición'}).click();
  await page.locator('#system-index').getByRole('button',{name:/Inicio/}).click();
  await expect(view.locator('.sys-progress')).toContainText('1 de 1 componentes documentados');
  await page.locator('.mode-switch [data-mode="design"]').click();
  await expect(view).toBeHidden();
  await expect(page.locator('.sidebar-tabs [data-tab="layers"]')).toHaveClass(/active/);
});
