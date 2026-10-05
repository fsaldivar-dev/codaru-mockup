import { test, expect } from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('[data-layer="screen-login"]')).toBeVisible();});

test('the design review lists issues per screen, draws a heat map and jumps to each element',async({page})=>{
  await page.evaluate(async()=>{const api=(window as any).codaru,c=await api.agent('context');await api.agent('apply',{expectedRevision:c.context.revision,operations:[{op:'add',node:{id:'faint',type:'text',name:'Texto tenue',parentId:'screen-login',x:32,y:600,width:200,height:24,text:'Apenas se lee',color:'#dcdce4'}},{op:'add',node:{id:'tiny',type:'button',name:'Mini',parentId:'screen-login',x:300,y:600,width:26,height:26,text:'+'}}]});api.select([]);});
  await page.getByRole('button',{name:'Revisar el diseño'}).click();
  const panel=page.locator('.review-panel');
  await expect(panel.getByRole('status')).toContainText('errores');
  await expect(panel.locator('.review-frame').first()).toContainText('01 · Bienvenida');
  await expect(panel.locator('.review-issue.error').filter({hasText:'Texto tenue'})).toContainText('modo claro');
  await expect(panel.locator('.review-issue').filter({hasText:'zona táctil de 26 × 26'})).toContainText('Mini');
  expect(await page.locator('#artboards .heat-layer .heat-spot').count()).toBeGreaterThan(3);
  await expect(page.locator('#artboards .heat-spot.error[data-heat="faint"]')).toHaveCount(1);
  await panel.locator('.review-issue').filter({hasText:'zona táctil de 26 × 26'}).click();
  await expect(page.getByLabel('Nombre del elemento')).toHaveValue('Mini');
  await page.locator('#stage').click({position:{x:5,y:5}});
  await page.getByLabel('Mapa de calor en el lienzo').uncheck();
  await expect(page.locator('#artboards .heat-layer')).toHaveCount(0);
  await page.evaluate(async()=>{const api=(window as any).codaru,c=await api.agent('context');await api.agent('apply',{expectedRevision:c.context.revision,operations:[{op:'update',id:'faint',patch:{color:'@text'}}]});api.select([]);});
  await page.getByRole('button',{name:'Volver a revisar'}).click();
  await expect(panel.locator('.review-issue').filter({hasText:'Texto tenue'})).toHaveCount(0);
  await panel.getByRole('button',{name:'Cerrar'}).click();
  await expect(page.getByRole('button',{name:'Revisar el diseño'})).toBeVisible();
  const lint=await page.evaluate(()=>(window as any).codaru.agent('lint',{frame:'screen-login'}));
  expect(lint.ok).toBe(true);expect(lint.issues.every((issue:any)=>issue.frame==='screen-login')).toBe(true);
});
