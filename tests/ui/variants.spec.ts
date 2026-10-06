import { test, expect } from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('[data-layer="screen-login"]')).toBeVisible();});

test('a master starts a variant set from the inspector and an instance switches between variants',async({page})=>{
  const masterId=await page.evaluate(()=>{const api=(window as any).codaru;const m=api.getDocument().nodes.find((n:any)=>n.componentId);api.select([m.id]);return m.id;});
  await expect(page.locator('.inspector-section').filter({hasText:'VARIANTES'})).toContainText('Un conjunto de variantes');
  await page.getByRole('button',{name:'◇ Nueva variante'}).click();
  await expect(page.getByLabel('Nombre del conjunto')).toHaveValue('Botón principal');
  await expect(page.getByLabel('Valor de Estado')).toHaveValue('Variante 2');
  await page.getByLabel('Valor de Estado').fill('Deshabilitado'); await page.getByLabel('Valor de Estado').press('Enter');
  await expect(page.getByLabel('Valor de Estado')).toHaveValue('Deshabilitado');
  const library=await page.evaluate(()=>{const api=(window as any).codaru;return api.getDocument().components.filter((c:any)=>c.set).map((c:any)=>c.variant.Estado).sort();});
  expect(library).toEqual(['Base','Deshabilitado']);
  await page.getByRole('button',{name:'Componentes'}).click();
  await expect(page.locator('.variant-caption')).toContainText('Botón principal');
  await expect(page.locator('.component-tile',{hasText:'Estado=Deshabilitado'})).toBeVisible();
  const instanceId=await page.evaluate(()=>{const api=(window as any).codaru;const i=api.getDocument().nodes.find((n:any)=>n.instanceOf);api.select([i.id]);return i.id;});
  await page.getByLabel('Variante · Estado').selectOption('Deshabilitado');
  await expect.poll(async()=>page.evaluate((id)=>{const d=(window as any).codaru.getDocument();const n=d.nodes.find((x:any)=>x.id===id);return d.components.find((c:any)=>c.id===n.instanceOf).variant.Estado;},instanceId)).toBe('Deshabilitado');
  await expect(page.getByLabel('Variante · Estado')).toHaveValue('Deshabilitado');
  await page.getByRole('button',{name:'Editar maestro'}).click();
  await expect(page.getByLabel('Valor de Estado')).toHaveValue('Deshabilitado');
  expect(masterId).toBeTruthy();
});
