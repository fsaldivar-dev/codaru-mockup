import { test, expect } from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('[data-layer="screen-login"]')).toBeVisible();});

test('the inspector shows the values a typography token resolves to, and editing one detaches the token without moving the rest',async({page})=>{
  const before=await page.evaluate(async()=>{const api=(window as any).codaru;let p=api.getDocument();const id=p.nodes.find((x:any)=>x.name==='Título'&&x.parentId==='screen-login').id;const c=await api.agent('context');await api.agent('apply',{expectedRevision:c.context.revision,operations:[{op:'update',id,patch:{typographyToken:'heading'}}]});p=api.getDocument();const n=p.nodes.find((x:any)=>x.id===id);api.select([id]);const t=p.designThemes[p.activeThemeId].modes.light.typography[n.typographyToken];return {id,token:n.typographyToken,raw:n.fontSize,size:t.fontSize,weight:t.fontWeight,family:t.fontFamily};});
  expect(before.raw).not.toBe(before.size);
  await expect(page.getByLabel('Tamaño')).toHaveValue(String(before.size));
  await expect(page.getByLabel('Peso')).toHaveValue(String(before.weight));
  await expect(page.locator('[data-linked="typography"]')).toContainText(before.token);
  await page.getByLabel('Peso').fill('400');await page.getByLabel('Peso').press('Enter');
  const after=await page.evaluate((id)=>{const n=(window as any).codaru.getDocument().nodes.find((x:any)=>x.id===id);return {token:n.typographyToken,size:n.fontSize,weight:n.fontWeight,family:n.fontFamily};},before.id);
  expect(after).toEqual({token:undefined,size:before.size,weight:400,family:before.family});
  await expect(page.locator('[data-linked="typography"]')).toHaveCount(0);
  await expect(page.getByLabel('Token de tipografía')).toHaveValue('');
});
