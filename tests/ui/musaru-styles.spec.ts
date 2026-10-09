import { test, expect } from '@playwright/test';
import { blank, node } from '../../src/model';

test('style laboratory keeps distinct themes editable and presents each screen without document writes',async({page})=>{
  test.setTimeout(180_000);
  await page.goto('/examples/musaru-styles/index.html');
  await page.waitForFunction(()=>!!(window as any).musaruStyles);
  const before=await page.evaluate(()=>(window as any).musaruStyles.editor.getDocument());
  const catalog=await page.getByRole('combobox',{name:'Estilo de Musaru'}).locator('option').evaluateAll(options=>options.map(o=>({id:(o as HTMLOptionElement).value,name:o.textContent})));
  expect(catalog).toHaveLength(23);expect(new Set(catalog.map(c=>c.id)).size).toBe(23);
  for(const item of catalog){
    await page.getByRole('combobox',{name:'Estilo de Musaru'}).selectOption(item.id);
    await page.getByRole('combobox',{name:'Vista de Musaru'}).selectOption('desktop');
    await page.getByRole('button',{name:'Presentar',exact:true}).click();
    const desktopId=await page.locator('#preview-select').inputValue();
    const desktop=page.locator('#preview-canvas > [data-node="'+desktopId+'"]');
    await expect(desktop).toHaveAttribute('data-theme',/musaru-/);
    expect(await desktop.locator('[data-kind="vector"]').count()).toBeGreaterThan(8);
    await desktop.screenshot({path:'artifacts/musaru-styles/browser-'+item.id+'-desktop.png'});
    await desktop.locator('[data-kind="text"][data-target$="-mobile"]').first().click();
    await expect(page.locator('#preview-select')).toHaveValue(desktopId+'-mobile');
    await expect(page.locator('#preview-canvas > *')).toHaveCount(1);
    const mobile=page.locator('#preview-canvas > [data-node="'+desktopId+'-mobile"]');
    const track=before.nodes.find((node:any)=>node.id===desktopId+'-mobile-track');
    expect(track?.text).toBeTruthy();
    await expect(mobile).toContainText(track.text);
    expect(await mobile.evaluate(el=>(el as HTMLElement).style.width)).toBe('390px');
    await mobile.screenshot({path:'artifacts/musaru-styles/browser-'+item.id+'-mobile.png'});
    await mobile.locator('[data-target="'+desktopId+'"]').click();
    await expect(page.locator('#preview-select')).toHaveValue(desktopId);
    await expect(page.locator('#preview-canvas > *')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.getByRole('combobox',{name:'Vista de Musaru'}).selectOption('mobile');
    await page.getByRole('button',{name:'Presentar',exact:true}).click();
    await expect(page.locator('#preview-select')).toHaveValue(desktopId+'-mobile');
    await page.keyboard.press('Escape');
  }
  expect(await page.evaluate(()=>(window as any).musaruStyles.editor.getDocument())).toEqual(before);
});

test('native example entry flushes and preserves the host project across laboratory navigation',async({page})=>{
  const project=blank();project.name='Proyecto del IDE · conservar';
  project.nodes.push(node('frame',{id:'host-project',name:'Mi pantalla',width:390,height:844}));
  await page.addInitScript(project=>{if(!localStorage.getItem('codaru-mockup:project:v1'))localStorage.setItem('codaru-mockup:project:v1',JSON.stringify(project));},project);
  await page.goto('/examples/tauri-host.html');
  await expect(page.getByRole('button',{name:'Musaru · estilos',exact:true})).toBeEnabled();
  const before=await page.evaluate(()=>localStorage.getItem('codaru-mockup:project:v1'));
  await page.getByRole('button',{name:'Musaru · estilos',exact:true}).click();
  await page.waitForFunction(()=>!!(window as any).musaruStyles);
  await expect(page.getByRole('combobox',{name:'Estilo de Musaru'})).toBeVisible();
  await page.evaluate(()=>(window as any).musaruStyles.editor.apply([{op:'update',id:'style-pop-mobile-track',patch:{text:'Cambio conservado en el laboratorio'}}]));
  await page.getByRole('button',{name:'← Mi proyecto',exact:true}).click();
  await expect(page.getByRole('button',{name:'Musaru · estilos',exact:true})).toBeEnabled();
  expect(JSON.parse((await page.evaluate(()=>localStorage.getItem('codaru-mockup:project:v1')))!)).toEqual(JSON.parse(before!));
  await page.getByRole('button',{name:'Musaru · estilos',exact:true}).click();
  await page.waitForFunction(()=>!!(window as any).musaruStyles);
  expect(await page.evaluate(()=>(window as any).musaruStyles.editor.getDocument().nodes.find((n:any)=>n.id==='style-pop-mobile-track').text)).toBe('Cambio conservado en el laboratorio');
});
