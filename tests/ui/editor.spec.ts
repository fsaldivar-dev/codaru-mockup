import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';

async function state(page: Page) { return page.evaluate(()=> (window as any).codaru.getDocument()); }
test.beforeEach(async ({page})=>{ await page.goto('/'); await expect(page.locator('[data-layer="screen-login"]')).toBeVisible(); });

test('manual drawing, dragging, resizing, text editing and undo survive reload', async ({page})=>{
  const screen=page.locator('#artboards > .design-node[data-node="screen-login"]');const bounds=(await screen.boundingBox())!;
  await page.getByRole('button',{name:'Rectángulo · R',exact:true}).click();
  await page.mouse.move(bounds.x+45,bounds.y+205);await page.mouse.down();await page.mouse.move(bounds.x+130,bounds.y+248);await page.mouse.up();
  let doc=await state(page);let rect=doc.nodes.at(-1);expect(rect.type).toBe('rect');expect(rect.parentId).toBe('screen-login');
  await page.getByLabel('Nombre del elemento',{exact:true}).fill('Tarjeta prueba');await page.getByLabel('Nombre del elemento',{exact:true}).press('Tab');
  await page.getByLabel('Radio',{exact:true}).fill('18');await page.getByLabel('Radio',{exact:true}).press('Tab');
  const box=page.locator(`#artboards [data-node="${rect.id}"]`);let b=(await box.boundingBox())!;
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+30,b.y+b.height/2+20);await page.mouse.up();
  let moved=(await state(page)).nodes.find((n:any)=>n.id===rect.id);expect(moved.x).toBeGreaterThan(rect.x);
  const handle=(await page.locator('.resize-handle.se').boundingBox())!;await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+40,handle.y+25);await page.mouse.up();
  const resized=(await state(page)).nodes.find((n:any)=>n.id===rect.id);expect(resized.width).toBeGreaterThan(moved.width);
  await page.getByRole('button',{name:'Deshacer · ⌘Z',exact:true}).click();expect((await state(page)).nodes.find((n:any)=>n.id===rect.id).width).toBe(moved.width);
  await page.waitForTimeout(400);await page.reload();expect((await state(page)).nodes.find((n:any)=>n.id===rect.id).radius).toBe(18);
});
test('master styling updates instance while its content stays customized',async({page})=>{
  await page.locator('[data-layer="primary-button"]').click();
  await page.getByLabel('Relleno: valor',{exact:true}).fill('#227c9d');await page.getByLabel('Relleno: valor',{exact:true}).press('Tab');
  let doc=await state(page);const instance=doc.nodes.find((n:any)=>n.instanceOf);expect(instance.fill).toBe('#227c9d');expect(instance.text).toContain('Volver');
  await page.getByRole('button',{name:'Deshacer · ⌘Z',exact:true}).click();doc=await state(page);expect(doc.nodes.find((n:any)=>n.instanceOf).fill).toBe('@primary');
  await page.getByLabel('Tipo',{exact:true}).selectOption('linear');
  await page.getByLabel('Segundo color: valor',{exact:true}).fill('#f2b4ca');await page.getByLabel('Segundo color: valor',{exact:true}).press('Tab');
  expect(await page.locator('#artboards [data-node="primary-button"]').evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
});
test('theme changes, clickable prototype and keyboard navigation',async({page})=>{
  await page.getByRole('button',{name:'Cambiar entre claro y oscuro',exact:true}).click();expect((await state(page)).theme).toBe('dark');
  await page.getByRole('button',{name:'Presentar',exact:true}).click();
  await page.locator('#preview-canvas [data-node="primary-button"]').click();await expect(page.locator('#preview-select')).toHaveValue('screen-dashboard');
  const back=page.locator('#preview-canvas [data-target="screen-login"]');await back.focus();await page.keyboard.press('Enter');await expect(page.locator('#preview-select')).toHaveValue('screen-login');
  await page.keyboard.press('Escape');await expect(page.locator('.preview-backdrop')).toHaveCount(0);
});
test('JSON file roundtrip and standalone HTML preserve screens and navigation',async({page})=>{
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Guardar archivo · ⌘S',exact:true}).click();const dl=await downloadPromise;const path=await dl.path();
  expect(dl.suggestedFilename()).toContain('.codaru.json');
  const before=await state(page);await page.locator('#import-file').setInputFiles(path!);await page.getByRole('button',{name:'Continuar',exact:true}).click();expect(await state(page)).toEqual(before);
  const html=await page.evaluate(()=>(window as any).codaru.exportHTML());await mkdir('artifacts',{recursive:true});await writeFile('artifacts/Forma.html',html);await page.setContent(html);
  await page.locator('[data-node="primary-button"]').click();await expect(page.locator('#screen-dashboard')).toBeVisible();await expect(page.locator('#screen-login')).toBeHidden();
});
test('group, component, instance and layout are reachable through controls',async({page})=>{
  const doc=await state(page);const email=doc.nodes.find((n:any)=>n.name==='Correo'),label=doc.nodes.find((n:any)=>n.name==='Label · Correo');
  await page.locator(`[data-layer="${email.id}"]`).click();await page.locator(`[data-layer="${label.id}"]`).click({modifiers:['Shift']});
  await page.getByRole('button',{name:'Agrupar',exact:true}).click();await page.getByLabel('Organización',{exact:true}).selectOption('vertical');
  await page.getByRole('button',{name:'◇ Crear componente',exact:true}).click();let after=await state(page);expect(after.components).toHaveLength(2);
  await page.getByRole('button',{name:'◇ Insertar instancia',exact:true}).click();after=await state(page);expect(after.nodes.filter((n:any)=>n.instanceOf)).toHaveLength(2);
});
test('SVG export and screenshot render without runtime errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.locator('[data-layer="screen-login"]').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar pantalla SVG',exact:true}).click();const dl=await pending;expect(dl.suggestedFilename()).toContain('.svg');
  await mkdir('artifacts',{recursive:true});await copyFile((await dl.path())!,'artifacts/Bienvenida.svg');
  await page.locator('#stage').click({position:{x:15,y:20}});await page.screenshot({path:'artifacts/editor.png',fullPage:true});expect(errors).toEqual([]);
});

test('inline text editing and moving content between screens retain editability',async({page})=>{
  await page.getByRole('button',{name:'Texto',exact:true}).click();
  let doc=await state(page);const textId=doc.nodes.at(-1).id;
  const text=page.locator(`#artboards [data-node="${textId}"]`);
  await text.dblclick();await page.keyboard.type('Hola desde el lienzo');await page.keyboard.press('Escape');
  expect((await state(page)).nodes.find((n:any)=>n.id===textId).text).toBe('Hola desde el lienzo');
  const from=(await page.locator(`#artboards [data-node="${textId}"]`).boundingBox())!;
  const dest=(await page.locator('#artboards > .design-node[data-node="screen-dashboard"]').boundingBox())!;
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(dest.x+70,dest.y+60,{steps:10});await page.mouse.up();
  expect((await state(page)).nodes.find((n:any)=>n.id===textId).parentId).toBe('screen-dashboard');
  await page.getByRole('button',{name:'Deshacer · ⌘Z',exact:true}).click();expect((await state(page)).nodes.find((n:any)=>n.id===textId).parentId).toBe('screen-login');
});
