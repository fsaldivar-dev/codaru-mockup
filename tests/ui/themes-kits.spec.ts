import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const state=(page:Page)=>page.evaluate(()=>(window as any).codaru.getDocument());
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('[data-layer="screen-login"]')).toBeVisible();});

test('theme editor changes linked gradients, rejects aliases, creates modes and undoes',async({page})=>{
  await page.locator('[data-layer="primary-button"]').click();
  await page.getByLabel('Token de relleno',{exact:true}).selectOption('brand');
  const before=await state(page),instance=before.nodes.find((n:any)=>n.instanceOf);
  await page.getByRole('button',{name:'Temas',exact:true}).click();
  await page.getByRole('button',{name:'Degradados',exact:true}).click();
  await page.getByLabel('Color parada 2',{exact:true}).fill('#ed679b');await page.getByLabel('Color parada 2',{exact:true}).press('Tab');
  expect((await state(page)).designThemes.project.modes.light.gradients.brand.stops[1].color).toBe('#ed679b');
  for(const id of ['primary-button',instance.id])expect(await page.locator(`#artboards [data-node="${id}"]`).evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('237, 103, 155');
  await page.getByRole('button',{name:'↶ Deshacer cambio',exact:true}).click();expect((await state(page)).designThemes).toEqual(before.designThemes);
  await page.getByRole('button',{name:'+ Añadir parada',exact:true}).click();
  expect((await state(page)).designThemes.project.modes.light.gradients.brand.stops).toHaveLength(3);
  await page.getByLabel('Identificador del nuevo token').fill('hero');await page.getByRole('button',{name:'+ Crear token',exact:true}).click();
  let doc=await state(page);expect(doc.designThemes.project.modes.light.gradients.hero).toBeDefined();expect(doc.designThemes.project.modes.dark.gradients.hero).toBeDefined();
  await page.getByRole('button',{name:'Colores',exact:true}).click();
  await page.getByLabel('Valor del color').fill('@primary');await page.getByLabel('Valor del color').press('Tab');
  await expect(page.locator('.theme-error')).toContainText('cíclico');
  expect((await state(page)).themes.light.primary).toBe('#7955e8');
  await page.screenshot({path:'artifacts/theme-editor.png'});
  await page.getByRole('button',{name:'Listo',exact:true}).click();
});

test('kits reuse definitions, inherit changed frame themes and keep editable children',async({page})=>{
  await page.locator('[data-layer="screen-login"]').click();
  await page.getByRole('button',{name:'Componentes',exact:true}).click();
  await page.getByRole('button',{name:'Kits de diseño',exact:true}).click();
  await expect(page.locator('[data-kit-item]')).toHaveCount(20);
  for(const id of ['macos','android','linux','web','ios']){await page.getByLabel('Kit de diseño',{exact:true}).selectOption(id);await expect(page.locator('[data-kit-item]')).toHaveCount(20);}
  const before=await state(page);
  await page.locator('[data-kit-item="button"]').click();await page.locator('[data-kit-item="button"]').click();
  let doc=await state(page),roots=doc.nodes.filter((n:any)=>n.instanceOf&&n.kitId==='ios');
  expect(roots).toHaveLength(2);expect(doc.components).toHaveLength(before.components.length+1);expect(roots[0].instanceOf).toBe(roots[1].instanceOf);
  await page.getByRole('button',{name:'Entrar y seleccionar hijos ↵',exact:true}).click();await page.keyboard.press('ControlOrMeta+a');
  expect(await page.evaluate(()=>(window as any).codaru.getSelection().length)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Capas',exact:true}).click();await page.locator('[data-layer="screen-login"]').click();
  await page.getByLabel('Aplicar tema de kit',{exact:true}).selectOption('android');await expect(page.getByLabel('Tema de pantalla',{exact:true})).toHaveValue('kit-android-v1');
  await page.getByLabel('Modo de pantalla',{exact:true}).selectOption('dark');
  for(const root of roots){await expect(page.locator(`#artboards [data-node="${root.id}"]`)).toHaveAttribute('data-theme','kit-android-v1');await expect(page.locator(`#artboards [data-node="${root.id}"]`)).toHaveAttribute('data-theme-mode','dark');}
  await expect(page.locator('#artboards .design-node[data-node="screen-dashboard"]')).toHaveAttribute('data-theme','project');
  await page.waitForTimeout(350);doc=await state(page);await page.reload();expect(await state(page)).toEqual(doc);
});

test('material tokens survive HTML and SVG exports with independent theme profiles',async({page})=>{
  await page.getByRole('button',{name:'Temas',exact:true}).click();await page.getByRole('button',{name:'+ Duplicar tema',exact:true}).click();
  await page.getByLabel('Nombre del perfil',{exact:true}).fill('Cristal nocturno');await page.getByLabel('Nombre del perfil',{exact:true}).press('Tab');
  await page.getByLabel('Modo a editar').selectOption('dark');await page.getByRole('button',{name:'Materiales',exact:true}).click();
  await page.getByLabel('Desenfoque px').fill('24');await page.getByLabel('Desenfoque px').press('Tab');
  const custom=(await state(page)).designThemes;const profile=Object.values(custom).find((t:any)=>t.name==='Cristal nocturno') as any;
  await page.getByRole('button',{name:'Listo',exact:true}).click();await page.locator('[data-layer="screen-login"]').click();
  await page.getByLabel('Tema de pantalla').selectOption(profile.id);await page.getByLabel('Modo de pantalla').selectOption('dark');
  await page.locator('[data-layer="primary-button"]').click();await page.getByLabel('Material',{exact:true}).selectOption('glass');
  expect(await page.locator('#artboards [data-node="primary-button"]').evaluate(el=>getComputedStyle(el).backdropFilter)).toContain('blur(24px)');
  const html=await page.evaluate(()=>(window as any).codaru.exportHTML());expect(html).toContain('blur(24px)');expect(html).toContain('data-material="glass"');
  await page.locator('[data-layer="screen-login"]').click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar pantalla SVG',exact:true}).click();const file=await download;
  const svg=await readFile((await file.path())!,'utf8');expect(svg).toContain('data-material-fallback="tint-and-border"');
  const before=await state(page);const projectDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Guardar archivo · ⌘S',exact:true}).click();const json=await projectDownload;
  await page.locator('#import-file').setInputFiles((await json.path())!);await page.getByRole('button',{name:'Continuar',exact:true}).click();expect(await state(page)).toEqual(before);
});

test('all catalog frames render without runtime errors and legacy files migrate',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.locator('#import-file').setInputFiles('examples/kits-demo.codaru.json');await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await expect(page.locator('#artboards > [data-kind="frame"]')).toHaveCount(5);
  expect((await state(page)).components).toHaveLength(100);expect(errors).toEqual([]);
  await page.locator('#import-file').setInputFiles('examples/Forma.codaru.json');await page.getByRole('button',{name:'Continuar',exact:true}).click();
  expect((await state(page)).version).toBe(2);await expect(page.locator('[data-layer="primary-button"]')).toBeVisible();
});
