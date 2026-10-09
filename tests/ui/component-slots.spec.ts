import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const artifacts='artifacts/component-slots';
test.beforeEach(async({page})=>{await page.goto('/examples/slots-host.html');await page.waitForFunction(()=>!!(window as any).slotsExample);});

test('inspector and host swap content, preserve text, undo and export the selected composition',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const inspector=page.locator('#inspector-slot'),select=inspector.getByLabel('Cabecera',{exact:true});
  const ids=await page.evaluate(()=>(window as any).slotsExample.ids);
  await expect(select).toHaveValue(ids.logo);await select.selectOption(ids.status);await page.locator('header strong').click();
  await expect(page.getByLabel('Cabecera desde el IDE')).toHaveValue(ids.status);
  await expect(page.locator('#canvas-slot')).toContainText('Disponible');
  await inspector.getByLabel('Título',{exact:true}).fill('Equipo disponible');await inspector.getByLabel('Título',{exact:true}).press('Tab');
  await page.getByLabel('Cabecera desde el IDE').selectOption(ids.avatar);await page.locator('header strong').click();
  await expect(select).toHaveValue(ids.avatar);await expect(inspector.getByLabel('Título',{exact:true})).toHaveValue('Equipo disponible');
  await page.getByRole('button',{name:'Deshacer',exact:true}).click();await expect(select).toHaveValue(ids.status);
  const result=await page.evaluate(async()=>{const{editor,ids}=(window as any).slotsExample;const png=await editor.exportAsset({ids:[ids.second],format:'png'});const zip=await editor.exportAsset({ids:[ids.second],format:'assets',platform:'all'});return{png,zip,svg:editor.exportSVG('screen'),document:editor.getDocument(),props:editor.getComponentProperties(ids.second)};});
  expect(result.svg).toContain('Disponible');expect(result.svg).toContain('Equipo disponible');expect(result.props[0].components).toHaveLength(3);
  await mkdir(artifacts,{recursive:true});await writeFile(`${artifacts}/card.png`,Buffer.from(result.png.content,'base64'));await writeFile(`${artifacts}/assets.zip`,Buffer.from(result.zip.content,'base64'));await writeFile(`${artifacts}/screen.svg`,result.svg);await writeFile(`${artifacts}/fixture.json`,JSON.stringify(result.document));await page.screenshot({path:`${artifacts}/embedded.png`});
  await inspector.getByRole('button',{name:'Restablecer Cabecera',exact:true}).click();await expect(select).toHaveValue(ids.avatar);await expect(inspector.getByLabel('Título',{exact:true})).toHaveValue('Equipo disponible');expect(errors).toEqual([]);
});

test('author configures choices and default in one dialog; invalid contracts keep the dialog open',async({page})=>{
  const ids=await page.evaluate(()=>(window as any).slotsExample.ids);
  await page.evaluate(()=>{const{editor}=(window as any).slotsExample;editor.select(['card']);});
  await page.getByRole('button',{name:'Configurar Cabecera',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Exponer propiedad'});
  await expect(dialog.getByLabel('Tipo de propiedad')).toHaveValue('slot');
  await dialog.getByLabel('Permitir Logo',{exact:true}).uncheck();
  await dialog.getByRole('button',{name:'Guardar propiedad'}).click();await expect(dialog.getByRole('alert')).toContainText('permitido');
  await dialog.getByLabel('Permitir Logo',{exact:true}).check();await dialog.getByLabel('Contenido predeterminado',{exact:true}).selectOption(ids.status);
  await dialog.getByRole('button',{name:'Guardar propiedad'}).click();await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:'Seleccionar tarjeta',exact:true}).click();await expect(page.locator('#inspector-slot').getByLabel('Cabecera',{exact:true})).toHaveValue(ids.logo);
  await page.locator('#inspector-slot').getByRole('button',{name:'Restablecer Cabecera',exact:true}).click();await expect(page.locator('#inspector-slot').getByLabel('Cabecera',{exact:true})).toHaveValue(ids.status);
});

test('host persistence restores slot choices and compatible local text after remount and reload',async({page})=>{
  await page.goto('/examples/slots-host.html?persist=playwright');await page.waitForFunction(()=>!!(window as any).slotsExample);
  const ids=await page.evaluate(()=>(window as any).slotsExample.ids);
  await page.getByLabel('Cabecera desde el IDE').selectOption(ids.status);await page.locator('header strong').click();
  await page.evaluate(()=>{const{editor,ids}=(window as any).slotsExample;const prop=editor.getComponentProperties(ids.second)[0];const label=editor.getDocument().nodes.find((n:any)=>n.parentId===prop.resolvedTargetId&&n.name==='Label');editor.apply([{op:'update',id:label.id,patch:{text:'Disponible para ti'}}]);});
  await page.reload();await page.waitForFunction(()=>!!(window as any).slotsExample);await expect(page.getByLabel('Cabecera desde el IDE')).toHaveValue(ids.status);await expect(page.locator('#canvas-slot')).toContainText('Disponible para ti');
  await page.evaluate(()=>{const{editor,view,ids}=(window as any).slotsExample;view.destroy();editor.setComponentProperty(ids.second,'cabecera',ids.avatar);});
  await page.reload();await page.waitForFunction(()=>!!(window as any).slotsExample);await expect(page.getByLabel('Cabecera desde el IDE')).toHaveValue(ids.avatar);await expect(page.locator('#canvas-slot')).toContainText('Disponible para ti');
});

test('AI discovers allowed content and respects an open slot-authoring dialog',async({page})=>{
  const ctx=await page.evaluate(async()=>{const{editor,ids}=(window as any).slotsExample;return editor.agent('context',{scope:ids.second,depth:0});});
  expect(ctx.context.nodes[0].properties[0].type).toBe('slot');expect(ctx.context.nodes[0].properties[0].components.map((c:any)=>c.name)).toEqual(['Avatar','Logo','Estado']);
  await page.evaluate(()=>(window as any).slotsExample.editor.select(['card']));await page.getByRole('button',{name:'Configurar Cabecera',exact:true}).click();
  const result=await page.evaluate(async()=>{const{editor,ids}=(window as any).slotsExample;const ctx=await editor.agent('context');return editor.agent('apply',{expectedRevision:ctx.context.revision,operations:[{op:'component.property.set',id:ids.second,key:'cabecera',value:ids.status}]});});
  expect(result.error.code).toBe('editor_busy');await page.getByRole('button',{name:'Cancelar',exact:true}).click();
});

test('a creator exposes a new slot from a nested instance using the visual dialog',async({page})=>{
  await page.evaluate(()=>{const{editor,ids}=(window as any).slotsExample;editor.setComponentProperty(ids.second,'cabecera',null);editor.apply([{op:'component.property.remove',componentId:ids.card,key:'cabecera'}]);editor.select([ids.slot]);});
  await page.getByRole('button',{name:'+ Exponer propiedad en Tarjeta',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Exponer propiedad'});
  await dialog.getByLabel('Tipo de propiedad').selectOption('slot');await dialog.getByLabel('Clave de propiedad').fill('cabecera');await dialog.getByLabel('Nombre visible').fill('Cabecera flexible');await dialog.getByLabel('Permitir Estado',{exact:true}).check();
  await dialog.getByRole('button',{name:'Guardar propiedad'}).click();await expect(dialog).toHaveCount(0);await page.getByRole('button',{name:'Seleccionar tarjeta',exact:true}).click();
  const control=page.locator('#inspector-slot').getByLabel('Cabecera flexible',{exact:true});await expect(control.locator('option')).toHaveCount(2);
  await control.selectOption({label:'Estado'});await page.locator('header strong').click();await expect(page.locator('#canvas-slot')).toContainText('Disponible');
});
