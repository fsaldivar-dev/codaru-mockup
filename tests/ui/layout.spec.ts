import { test, expect, type Page } from '@playwright/test';

const state=(page:Page)=>page.evaluate(()=>(window as any).codaru.getDocument());
const get=async(page:Page,id:string)=>(await state(page)).nodes.find((n:any)=>n.id===id);
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('[data-layer="screen-login"]')).toBeVisible();});

test('the inspector controls distribution, alignment, per-side padding, wrapping, hug and size limits',async({page})=>{
  await page.evaluate(async()=>{const api=(window as any).codaru,c=await api.agent('context');await api.agent('apply',{expectedRevision:c.context.revision,operations:[{op:'add',node:{id:'bar',type:'card',name:'Barra',parentId:'screen-login',x:20,y:580,width:340,height:60}},{op:'add',node:{id:'one',type:'rect',name:'Uno',parentId:'bar',width:40,height:20}},{op:'add',node:{id:'two',type:'rect',name:'Dos',parentId:'bar',width:60,height:30}}]});api.select(['bar']);});
  await page.getByLabel('Organización').selectOption('horizontal');
  expect([(await get(page,'one')).x,(await get(page,'one')).height]).toEqual([20,20]);
  await page.getByLabel('Reparto horizontal').selectOption('between');
  await page.getByLabel('Alineación vertical').selectOption('center');
  expect([(await get(page,'one')).x,(await get(page,'one')).y,(await get(page,'two')).x]).toEqual([20,20,260]);
  await page.getByRole('button',{name:'Padding por lado'}).click();
  await page.getByLabel('Padding izquierdo').fill('50');await page.getByLabel('Padding izquierdo').press('Tab');
  expect((await get(page,'bar')).paddingSides).toEqual({top:20,right:20,bottom:20,left:50});expect((await get(page,'one')).x).toBe(50);
  await page.getByLabel('Ajustar el ancho al contenido').check();
  expect((await get(page,'bar')).width).toBe(50+40+16+60+20);
  await page.getByLabel('Pasar a otra línea si no caben').check();expect((await get(page,'bar')).wrap).toBe(true);
  await page.getByRole('button',{name:'Usar un solo padding'}).click();
  expect((await get(page,'bar')).paddingSides).toBeUndefined();expect((await get(page,'bar')).padding).toBe(20);
  await page.getByLabel('Ajustar el ancho al contenido').uncheck();
  await page.getByLabel('Reparto horizontal').selectOption('start');
  await page.getByLabel('W',{exact:true}).fill('300');await page.getByLabel('W',{exact:true}).press('Tab');
  await page.evaluate(()=>(window as any).codaru.select(['two']));
  await page.getByLabel('Tamaño en contenedor').selectOption('fill');
  const filled=(await get(page,'two')).width;expect(filled).toBeGreaterThan(60);
  await page.getByText('Tamaño mínimo y máximo').click();
  await page.getByLabel('Ancho máx.').fill('90');await page.getByLabel('Ancho máx.').press('Tab');
  expect([(await get(page,'two')).maxWidth,(await get(page,'two')).width]).toEqual([90,90]);
  await page.getByLabel('Ancho máx.').fill('');await page.getByLabel('Ancho máx.').press('Tab');
  expect((await get(page,'two')).maxWidth).toBeUndefined();expect((await get(page,'two')).width).toBe(filled);
  expect(await page.locator('#artboards [data-node="two"]').evaluate(el=>el.style.width)).toBe(`${filled}px`);
});
