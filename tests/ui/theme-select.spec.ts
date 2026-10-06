import { test, expect } from '@playwright/test';

test('the theme indicator lists the defined themes and switches the active one without opening the editor',async({page})=>{
  await page.goto('/');await expect(page.locator('[data-layer="screen-login"]')).toBeVisible();
  await page.evaluate(async()=>{const api=(window as any).codaru;const c=await api.agent('context');await api.agent('apply',{expectedRevision:c.context.revision,operations:[{op:'kit',kit:'ios',item:'button',parentId:'screen-login',x:24,y:700}]});});
  const select=page.getByLabel('Tema del diseño');
  await expect(select.locator('option')).toHaveCount(2);
  await expect(select).toHaveValue('project');
  await select.selectOption('kit-ios-v1');
  await expect.poll(async()=>page.evaluate(()=>(window as any).codaru.getDocument().activeThemeId)).toBe('kit-ios-v1');
  await expect(page.locator('#modal-root [role="dialog"]')).toHaveCount(0);
  await expect(select.locator('option[selected]')).toContainText('Claro');
  await page.getByRole('button',{name:'Cambiar entre claro y oscuro'}).click();
  await expect(select.locator('option[selected]')).toContainText('Oscuro');
});
