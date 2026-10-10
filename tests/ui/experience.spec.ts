import {test,expect} from '@playwright/test';
const part=(page:any,name:string)=>page.locator(`[data-codaru-experience-part="${name}"]`);
test.beforeEach(async({page})=>{await page.goto('/examples/experience-host.html');await page.waitForFunction(()=>!!(window as any).experienceExample);});
test('accessible fields retain edits on fragment teardown and shared history; other sessions remain isolated',async({page})=>{
 await part(page,'accessibility').getByLabel('Nombre accesible',{exact:true}).fill('Escuchar la canción');
 const final=await page.evaluate(()=>{const r=(window as any).experienceExample;r.experience.destroy();return r.editor.getDocument();});expect(final.nodes.find((n:any)=>n.id==='play').experience.accessibility.name).toBe('Escuchar la canción');
 await page.evaluate(async()=>{const path='/src/experience-view.ts';const {createExperienceView}=await import(path);const r=(window as any).experienceExample;r.experience=createExperienceView(r.editor);r.experience.mount('accessibility',document.querySelector('#accessibility'));});
 await expect(part(page,'accessibility').getByLabel('Nombre accesible',{exact:true})).toHaveValue('Escuchar la canción');
 await page.evaluate(()=>(window as any).experienceExample.editor.undo());await expect(part(page,'accessibility').getByLabel('Nombre accesible',{exact:true})).toHaveValue('Reproducir Slow Bloom');
 await part(page,'accessibility').getByLabel('Descripción',{exact:true}).fill('Conservar al desmontar');const closed=await page.evaluate(()=>(window as any).experienceExample.editor.destroy());expect(closed.nodes.find((n:any)=>n.id==='play').experience.accessibility.description).toBe('Conservar al desmontar');await expect(part(page,'accessibility')).toHaveCount(0);
});
test('event definitions identify real result handlers, export typed properties and deliver to the host without analytics collection',async({page})=>{
 await page.getByRole('button',{name:'Analítica',exact:true}).click();const analytics=part(page,'analytics');await expect(analytics.getByText('Después de confirmar el resultado exitoso',{exact:false})).toBeVisible();await analytics.getByRole('button',{name:'+ Evento',exact:true}).click();
 const e=analytics.locator('[data-event="1"]');await e.getByLabel('Nombre del evento').fill('player.save.intent');await e.getByLabel('Cuándo emitir').selectOption('submit');await e.getByLabel('Propósito').fill('Medir guardados aceptados');await e.getByLabel('Consentimiento').selectOption('not-required');
 await analytics.getByRole('button',{name:'Enviar al IDE'}).click();const received=await page.evaluate(()=>(window as any).experienceExample.handoffs[0]);expect(received.format).toBe('codaru-experience/1');expect(received.entries).toHaveLength(1);expect(received.entries[0].instrumentation[1].event.name).toBe('player.save.intent');expect(received.entries[0].instrumentation[1].where).toContain('validar y aceptar');expect(received.entries[0].spec.analytics[0].properties.track_id).toEqual({type:'string',source:'track.id'});
 await expect(page.locator('#status')).toContainText('Sin envío de analítica');const download=page.waitForEvent('download');await analytics.getByRole('button',{name:'Exportar plan JSON'}).click();expect((await download).suggestedFilename()).toBe('product-contract.codaru.json');
});
test('invalid JSON remains visible and blocks mutation or teardown until corrected or discarded',async({page})=>{
 await page.getByRole('button',{name:'Analítica',exact:true}).click();const analytics=part(page,'analytics');const input=analytics.getByLabel('Propiedades · esquema JSON');await input.fill('{"private":');await input.blur();await expect(analytics.locator('[role=alert]')).not.toBeEmpty();
 expect(await page.evaluate(()=>{const r=(window as any).experienceExample;try{r.experience.destroy();return false;}catch{return true;}})).toBe(true);await expect(input).toHaveValue('{"private":');
 expect(await page.evaluate(async()=>{const r=(window as any).experienceExample,ctx=await r.editor.agent('context');return (await r.editor.agent('apply',{expectedRevision:ctx.context.revision,operations:[{op:'update',id:'save',patch:{width:10}}]})).error.code;})).toBe('editor_busy');
 await analytics.getByRole('button',{name:'Descartar borrador'}).click();await expect(analytics.locator('[role=alert]')).toBeEmpty();expect(await page.evaluate(()=>(window as any).experienceExample.editor.getDocument().nodes.find((n:any)=>n.id==='save').width)).toBe(334);
});
test('test contracts include platform IDs and manual checks; camera changes preserve controls',async({page})=>{
 await page.getByRole('button',{name:'Pruebas',exact:true}).click();const tests=part(page,'tests');await tests.getByLabel('Identificador de prueba').fill('player-confirmed-play');await tests.getByLabel('Criterios de aceptación').fill('No emitir éxito si falla\nMostrar error accesible');await tests.getByRole('button',{name:'Enviar al IDE'}).click();
 const sent=await page.evaluate(()=>(window as any).experienceExample.handoffs[0]);expect(sent.entries[0].tests.bindings.android).toContain('player-confirmed-play');expect(sent.entries[0].tests.assertions.filter((a:any)=>a.kind==='acceptance')).toHaveLength(2);expect(sent.runtimeChecks.join(' ')).toContain('lectores de pantalla');
 const handle=await tests.getByLabel('Identificador de prueba').elementHandle();await page.evaluate(()=>{const r=(window as any).experienceExample;for(let i=0;i<30;i++)r.editor.setViewport({zoom:.5+i/100});});expect(await handle!.evaluate((el:any)=>el.isConnected)).toBe(true);
});
test('full editor sheet uses the same standalone fragments and commits before closing',async({page})=>{
 await page.locator('[data-codaru-part="inspector"]').getByRole('button',{name:'Configurar contrato'}).click();const dialogs=page.locator('[data-codaru-part="dialogs"]');await expect(dialogs.getByRole('dialog',{name:'Contrato del producto'})).toBeVisible();
 await dialogs.locator('[data-codaru-experience-part="accessibility"]').getByLabel('Descripción',{exact:true}).fill('Del inspector al contrato');await dialogs.getByRole('button',{name:'Cerrar',exact:true}).click();await expect(dialogs.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).experienceExample.editor.getDocument().nodes.find((n:any)=>n.id==='play').experience.accessibility.description)).toBe('Del inspector al contrato');
});
test('native-style focus loss keeps the handoff control alive for its first click',async({page})=>{
 await page.getByRole('button',{name:'Pruebas',exact:true}).click();const tests=part(page,'tests');await tests.getByLabel('Identificador de prueba').fill('native-first-click');
 const button=await tests.getByRole('button',{name:'Enviar al IDE'}).elementHandle();
 await tests.getByLabel('Identificador de prueba').evaluate((el:HTMLInputElement)=>{el.dispatchEvent(new FocusEvent('focusout',{bubbles:true,relatedTarget:null}));el.blur();});
 expect(await button!.evaluate((el:HTMLElement)=>el.isConnected)).toBe(true);await button!.click();
 expect(await page.evaluate(()=>(window as any).experienceExample.handoffs.length)).toBe(1);
 await expect(page.locator('#status')).toContainText('El IDE recibió 1 elementos');
});
test('prototype export exposes localized accessible names and stable test locators without emitting events',async({page})=>{
 const result=await page.evaluate(async()=>{const r=(window as any).experienceExample;r.editor.setExperience('play',{accessibility:{role:'button',name:'Play source',nameKey:'player.play'},testId:'play-export',analytics:[{name:'track.play',trigger:'success',purpose:'Confirmed playback'}]});r.editor.setLocalization({locale:'es',messages:{es:{'player.play':'Escuchar Slow Bloom'}}});const path='/src/render.ts';const {exportHTML}=await import(path);const html=exportHTML(r.editor.getPreviewDocument());const doc=new DOMParser().parseFromString(html,'text/html'),control=doc.querySelector('[data-testid="play-export"]');return {name:control?.getAttribute('aria-label'),role:control?.getAttribute('role'),code:html.includes('track.play')};});expect(result).toEqual({name:'Escuchar Slow Bloom',role:'button',code:false});
});
