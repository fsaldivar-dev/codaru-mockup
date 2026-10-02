import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('[data-layer="screen-login"]')).toBeVisible();});

test('icon families insert real vectors, search live, follow theme colors and survive SVG export',async({page})=>{
  await page.locator('[data-layer="screen-login"]').click();
  await page.getByRole('button',{name:'Componentes',exact:true}).click();await page.getByRole('button',{name:'Iconos',exact:true}).click();
  for(const pack of ['mac','material','linux','web']){
    await page.getByLabel('Kit de iconos',{exact:true}).selectOption(pack);await expect(page.locator('[data-icon-item]')).toHaveCount(24);
    await page.locator('[data-icon-item="home"]').click();
    const icon=await page.evaluate(()=>(window as any).codaru.getSelection()[0]);expect(icon.type).toBe('icon');expect(icon.iconPack).toBe(pack);
    await expect(page.locator(`#artboards [data-node="${icon.id}"] svg`)).toHaveCount(1);
  }
  await page.getByLabel('Buscar iconos',{exact:true}).fill('home');await expect(page.locator('[data-icon-item]')).toHaveCount(1);
  await page.getByLabel('Color del icono: valor',{exact:true}).fill('@primary');await page.getByLabel('Color del icono: valor',{exact:true}).press('Tab');
  await page.getByLabel('W',{exact:true}).fill('48');await page.getByLabel('W',{exact:true}).press('Tab');
  const selected=await page.evaluate(()=>(window as any).codaru.getSelection()[0]);expect(selected.width).toBe(48);expect(selected.color).toBe('@primary');
  await page.getByRole('button',{name:'Capas',exact:true}).click();await page.locator('[data-layer="screen-login"]').click();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar pantalla SVG',exact:true}).click();const dl=await pending;
  const svg=await readFile((await dl.path())!,'utf8');expect(svg).toContain('<path');expect(svg).toContain('Lucide');
});

test('agent operations use the live editor and produce context, atomic undo and revision conflict',async({page})=>{
  const first=await page.evaluate(()=>(window as any).codaru.agent('context'));
  const request={expectedRevision:first.context.revision,operations:[{op:'add',node:{id:'agent-frame',type:'frame',name:'Pantalla de IA',x:1350,y:100}},{op:'icon',pack:'web',name:'home',parentId:'agent-frame',x:24,y:24},{op:'add',node:{id:'agent-button',type:'button',parentId:'agent-frame',text:'Ir a bienvenida',x:24,y:96}},{op:'flow',from:'agent-button',to:'screen-login'}]};
  const dry=await page.evaluate(params=>(window as any).codaru.agent('apply',{...params,dryRun:true}),request);expect(dry.ok).toBe(true);await expect(page.locator('[data-layer="agent-frame"]')).toHaveCount(0);
  const applied=await page.evaluate(params=>(window as any).codaru.agent('apply',params),request);expect(applied.ok).toBe(true);expect(applied.context.scope).toBe('agent-frame');expect(applied.context.flows.some((f:any)=>f.from==='agent-button')).toBe(true);
  await expect(page.locator('#artboards .design-node[data-node="agent-frame"]')).toBeAttached();
  const stale=await page.evaluate(params=>(window as any).codaru.agent('apply',params),request);expect(stale.error.code).toBe('revision_conflict');
  await page.evaluate(()=>(window as any).codaru.agent('undo'));await expect(page.locator('[data-layer="agent-frame"]')).toHaveCount(0);
  await page.getByRole('button',{name:'IA / CLI',exact:true}).click();await expect(page.getByRole('dialog',{name:'Flujo de IA y CLI'})).toBeVisible();
  const busy=await page.evaluate(()=>(window as any).codaru.agent('undo'));expect(busy.error.code).toBe('editor_busy');
  await page.keyboard.press('Escape');
});
