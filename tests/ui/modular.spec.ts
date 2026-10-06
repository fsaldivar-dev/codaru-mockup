import { test, expect, type Page } from '@playwright/test';
async function mount(page: Page, id = 'a', parts?: string[]) {
  await page.evaluate(({id,parts}) => (window as any).modularTest.mount(id, parts), { id, parts });
}
const part = (page: Page, name: string, id='a') => page.locator(`[data-instance="${id}"] [data-codaru-part="${name}"]`);
const state = (page: Page, id='a') => page.evaluate(id => (window as any).modularTest.records[id].editor.getState(), id);
test.beforeEach(async ({page}) => { await page.goto('/tests/fixtures/modular.html'); await page.waitForFunction(() => !!(window as any).modularTest); });

test('separate parts share human selection, inspector edits, undo and AI changes', async ({page}) => {
 await mount(page);
 await expect(page.locator('iframe')).toHaveCount(0);
 await part(page,'layers').locator('[data-layer="a-rect"]').click();
 await expect(part(page,'inspector').getByLabel('Nombre del elemento')).toHaveValue('Tarjeta a');
 expect((await state(page)).selection).toEqual(['a-rect']);
 const width = part(page,'inspector').getByRole('spinbutton',{name:'W',exact:true});
 await width.fill('220'); await width.press('Tab');
 expect((await state(page)).document.nodes.find((n:any)=>n.id==='a-rect').width).toBe(220);
 await part(page,'toolbar').getByRole('button',{name:'Deshacer · ⌘Z',exact:true}).click();
 await expect(width).toHaveValue('180');
 const result = await page.evaluate(async () => { const api=(window as any).modularTest.records.a.editor; const c=await api.agent('context'); return api.agent('apply',{expectedRevision:c.context.revision,operations:[{op:'update',id:'a-rect',patch:{width:208}}]}); });
 expect(result.ok).toBe(true); await expect(width).toHaveValue('208');
 expect(await page.evaluate(()=>(window as any).modularTest.records.a.changes.length)).toBe(3);
});

test('canvas-only host gets selection notifications and owns controls and shortcuts', async ({page}) => {
 await mount(page,'a',['canvas']);
 await page.evaluate(()=>(window as any).modularTest.records.a.editor.select(['a-rect']));
 await part(page,'canvas').locator('#stage').focus(); await page.keyboard.press('ArrowRight');
 expect((await state(page)).document.nodes.find((n:any)=>n.id==='a-rect').x).toBe(41);
 await page.locator('#host-button').focus();await page.keyboard.press('Delete');
 expect((await state(page)).document.nodes).toHaveLength(2);
 await page.getByLabel('Texto del IDE').fill('No borrar');await page.keyboard.press('ControlOrMeta+A');
 await expect(page.getByLabel('Texto del IDE')).toHaveValue('No borrar');
 await page.evaluate(()=>{ const e=(window as any).modularTest.records.a.editor;e.setTool('rect');e.setViewport({zoom:1.25}); });
 expect((await state(page)).tool).toBe('rect');expect((await state(page)).viewport.zoom).toBe(1.25);
 await expect(part(page,'canvas').locator('#stage')).toHaveAttribute('data-tool','rect');
});

test('appearance and part lifecycle preserve design, selection and isolated host styles', async ({page}) => {
 const hostStyle=()=>page.locator('#host-button').evaluate(el=>{const c=getComputedStyle(el);return {color:c.color,border:c.borderWidth,font:c.font}});
 const before=await hostStyle(); await mount(page);
 await page.evaluate(()=>(window as any).modularTest.records.a.editor.select(['a-rect']));
 const doc=(await state(page)).document;
 await page.evaluate(()=>{const r=(window as any).modularTest.records.a;r.view.setAppearance({theme:'dark',tokens:{accent:'#ed4411',radius:10}});r.handles.inspector.destroy();});
 await expect(part(page,'inspector')).toHaveCount(0);
 await page.evaluate(()=>{const r=(window as any).modularTest.records.a;r.handles.inspector=r.view.mount('inspector',r.slots.inspector);});
 await expect(part(page,'inspector').getByLabel('Nombre del elemento')).toHaveValue('Tarjeta a');
 expect((await state(page)).document).toEqual(doc);expect(await hostStyle()).toEqual(before);
 expect(await part(page,'inspector').evaluate(el=>getComputedStyle(el).getPropertyValue('--codaru-accent').trim())).toBe('#ed4411');
 await page.evaluate(()=>{const r=(window as any).modularTest.records.a;r.view.setAppearance({theme:'light'});});
 expect((await state(page)).document).toEqual(doc);
});

test('two sessions stay isolated; destroy flushes focused input and removes every fragment',async ({page})=>{
 await mount(page,'a');await mount(page,'b',['canvas','layers']);
 await part(page,'layers').locator('[data-layer="a-rect"]').click();
 await part(page,'inspector').getByLabel('Nombre del elemento').fill('Edición pendiente');
 const snapshot = await page.evaluate(()=>{const r=(window as any).modularTest.records.a; const first=r.editor.destroy(); const second=r.editor.destroy();return {first,second};});
 expect(snapshot.first).toEqual(snapshot.second);expect(snapshot.first.nodes.find((n:any)=>n.id==='a-rect').name).toBe('Edición pendiente');
 await expect(page.locator('[data-instance="a"] [data-codaru-part]')).toHaveCount(0);
 expect((await state(page,'b')).selection).toEqual([]);expect((await state(page,'b')).document.nodes).toHaveLength(2);
});

test('view can be replaced on the same live session without losing history',async ({page})=>{
 await mount(page);await page.evaluate(async()=>{const r=(window as any).modularTest.records.a;r.editor.apply([{op:'update',id:'a-rect',patch:{width:222}}]);r.view.destroy();const {createEditorView}=await import('/src/' + 'modular.ts');r.view=createEditorView(r.editor,{appearance:{theme:'light'}});r.handles.canvas=r.view.mount('canvas',r.slots.canvas);});
 expect((await state(page)).canUndo).toBe(true);await page.evaluate(()=>(window as any).modularTest.records.a.editor.undo());
 expect((await state(page)).document.nodes.find((n:any)=>n.id==='a-rect').width).toBe(180);
 await expect(part(page,'canvas').locator('[data-node="a-rect"]')).toBeVisible();
});

test('canvas clicks drive detached panels; unmounting or relocating one fragment commits its pending field',async ({page})=>{
 await mount(page);
 await part(page,'canvas').locator('.design-node[data-node="a-frame"]').click({position:{x:300,y:300}});
 const selected=(await state(page)).selection;expect(selected).toHaveLength(1);
 await expect(part(page,'layers').locator(`[data-layer="${selected[0]}"]`)).toHaveClass(/selected/);
 await part(page,'layers').locator('[data-layer="a-rect"]').click();
 await part(page,'inspector').getByLabel('Nombre del elemento').fill('Pendiente');
 await page.evaluate(()=>{const r=(window as any).modularTest.records.a;r.handles.inspector.destroy();});
 expect((await state(page)).document.nodes.find((n:any)=>n.id==='a-rect').name).toBe('Pendiente');
 await page.evaluate(()=>{const r=(window as any).modularTest.records.a;const slot=document.createElement('div');slot.className='slot moved';slot.style.cssText='width:280px;height:400px';r.host.after(slot);r.handles.inspector=r.view.mount('inspector',slot);});
 await expect(page.locator('.moved [data-codaru-part="inspector"]').getByLabel('Nombre del elemento')).toHaveValue('Pendiente');
 expect(await page.evaluate(()=>{const r=(window as any).modularTest.records.a;try{r.view.mount('inspector',r.slots.inspector);return 'mounted';}catch(e){return (e as Error).message;}})).toContain('ya está montada');
 await page.evaluate(()=>(window as any).modularTest.records.a.editor.undo());
 expect((await state(page)).document.nodes.find((n:any)=>n.id==='a-rect').name).toBe('Tarjeta a');
});

test('an open dialog blocks host writes and unmounting dialogs releases the session',async ({page})=>{
 await mount(page);
 const apply=()=>page.evaluate(()=>{const e=(window as any).modularTest.records.a.editor;try{e.apply([{op:'update',id:'a-rect',patch:{width:199}}]);return 'ok';}catch(error){return (error as Error).message;}});
 await page.evaluate(()=>(window as any).modularTest.records.a.editor.command('themes'));
 await expect(part(page,'dialogs').getByRole('dialog',{name:'Editor de temas'})).toBeVisible();
 expect(await apply()).toContain('ocupado');
 await page.keyboard.press('Escape');
 await expect(part(page,'dialogs').getByRole('dialog')).toHaveCount(0);
 expect(await apply()).toBe('ok');
 await page.evaluate(()=>(window as any).modularTest.records.a.editor.command('themes'));
 await page.evaluate(()=>(window as any).modularTest.records.a.handles.dialogs.destroy());
 expect(await page.evaluate(()=>{const e=(window as any).modularTest.records.a.editor;try{e.apply([{op:'update',id:'a-rect',patch:{width:201}}]);return 'ok';}catch(error){return (error as Error).message;}})).toBe('ok');
 expect(await page.evaluate(()=>(window as any).modularTest.records.a.editor.command('themes').then(()=>'opened',(e:Error)=>e.message))).toContain('dialogs');
});

test('host CSS variables theme the fragments, API tokens win, and null restores inheritance',async ({page})=>{
 await mount(page,'a',['canvas','toolbar']);
 const accent=()=>part(page,'toolbar').evaluate(el=>getComputedStyle(el.shadowRoot!.firstElementChild!.nextElementSibling!).getPropertyValue('--codaru-accent').trim());
 expect(await accent()).toBe('#007aff');
 await page.evaluate(()=>{const r=(window as any).modularTest.records.a;r.host.style.setProperty('--codaru-accent','#118833');r.view.setAppearance({tokens:{accent:null}});});
 expect(await accent()).toBe('#118833');
 await page.evaluate(()=>(window as any).modularTest.records.a.handles.toolbar.setAppearance({tokens:{accent:'#aa2200'}}));
 expect(await accent()).toBe('#aa2200');
 expect(await part(page,'canvas').evaluate(el=>getComputedStyle(el).getPropertyValue('--codaru-accent').trim())).toBe('#118833');
 expect(await page.evaluate(()=>document.head.querySelectorAll('style').length)).toBe(1);
});

test('the modular IDE example shares selection, undo and appearance between host and fragments',async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/examples/modular-host.html');await page.waitForSelector('html[data-codaru-ready="true"]');
 const demo=()=>page.evaluate(()=>(window as any).codaruModularDemo.editor.getState());
 const themes=JSON.stringify((await demo()).document.themes);
 await expect(page.locator('iframe')).toHaveCount(0);await expect(page.locator('#undo')).toBeDisabled();
 await page.locator('#layers-panel [data-codaru-part="layers"] [data-layer]').first().click();
 const id=(await demo()).selection[0];const width=page.locator('#host-width');
 await expect(width).toBeEnabled();const original=await width.inputValue();
 await width.fill('333');await width.press('Tab');
 expect((await demo()).document.nodes.find((n:any)=>n.id===id).width).toBe(333);
 await page.locator('#undo').click();await expect(width).toHaveValue(original);
 await page.locator('#inspector-toggle').click();
 await expect(page.locator('#inspector-slot [data-codaru-part]')).toHaveCount(0);
 await page.locator('#inspector-toggle').click();
 await expect(page.locator('#inspector-slot [data-codaru-part="inspector"]').getByLabel('Nombre del elemento')).toBeVisible();
 await page.locator('#appearance-toggle').click();
 await expect(page.locator('#canvas-slot [data-codaru-part="canvas"]')).toHaveAttribute('data-codaru-theme','dark');
 expect(JSON.stringify((await demo()).document.themes)).toBe(themes);expect((await demo()).selection).toEqual([id]);
 await page.locator('#library-tab').click();await expect(page.locator('#library-panel')).toBeVisible();await expect(page.locator('#layers-panel')).toBeHidden();
 await page.locator('#theme-tokens').click();
 await expect(page.locator('#dialogs-slot').getByRole('dialog',{name:'Editor de temas'})).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#dialogs-slot').getByRole('dialog')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('viewbar controls mount on their own, act exactly once and return to the bar when destroyed',async ({page})=>{
 await mount(page,'a',['canvas','viewbar','dialogs']);
 const bar=part(page,'viewbar');
 await bar.getByRole('button',{name:'Cambiar tema del diseño'}).click();
 expect((await state(page)).document.theme).toBe('dark');
 await page.evaluate(()=>{const r=(window as any).modularTest.records.a;for(const name of ['modes','fit']){const slot=document.createElement('div');slot.className='slot own-'+name;r.host.before(slot);r.handles[name]=r.view.mount(name,slot);}});
 await expect(bar.locator('.mode-switch')).toHaveCount(0);await expect(bar.locator('.fit-button')).toHaveCount(0);
 await expect(bar.locator('.divider')).toBeHidden();await expect(bar.locator('#theme-name')).toBeVisible();
 await page.locator('.own-modes [data-codaru-part="modes"]').getByRole('button',{name:/Flujos/}).click();
 expect((await state(page)).mode).toBe('flow');
 await expect(page.locator('.own-modes [data-codaru-part="modes"]').getByRole('button',{name:/Flujos/})).toHaveClass(/active/);
 await page.evaluate(()=>(window as any).modularTest.records.a.editor.setViewport({zoom:3}));
 await page.locator('.own-fit [data-codaru-part="fit"]').getByRole('button',{name:'Ajustar'}).click();
 expect((await state(page)).viewport.zoom).toBeLessThan(3);
 await page.evaluate(()=>{const r=(window as any).modularTest.records.a;r.handles.modes.destroy();r.handles.fit.destroy();});
 await expect(page.locator('.own-modes [data-codaru-part]')).toHaveCount(0);
 await expect(bar.locator('.mode-switch button')).toHaveCount(3);await expect(bar.locator('.divider')).toBeVisible();
 await bar.getByRole('button',{name:'Diseño',exact:true}).click();expect((await state(page)).mode).toBe('design');
 await bar.getByRole('button',{name:'Cambiar tema del diseño'}).click();
 expect((await state(page)).document.theme).toBe('light');
});
