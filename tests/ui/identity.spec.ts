import {test,expect,type Page} from '@playwright/test';
const part=(p:Page,name:string,id='a')=>p.locator(`[data-instance="${id}"] [data-codaru-identity-part="${name}"]`);
const lab=(p:Page,id='a')=>p.evaluate(id=>(window as any).identityTest.records[id].editor.getIdentityLab(),id);
test.beforeEach(async({page})=>{await page.goto('/tests/fixtures/identity.html');await page.waitForFunction(()=>!!(window as any).identityTest);await page.evaluate(()=>(window as any).identityTest.mount('a'));});
test('focused brief survives fragment and editor destruction, with shared undo and isolated sessions',async({page})=>{
 await page.evaluate(()=>(window as any).identityTest.mount('b'));
 await part(page,'brief').getByLabel('Qué quieres transmitir').fill('Elegancia singular');
 expect(await page.evaluate(()=>{const e=(window as any).identityTest.records.a.editor;try{e.apply([{op:'update',id:'a-rect',patch:{width:201}}]);return 'ok';}catch(e){return String(e);}})).toContain('ocupado');
 await page.evaluate(()=>{const r=(window as any).identityTest.records.a;r.handles.brief.destroy();r.handles.brief=r.lab.mount('brief',r.slots.brief);});
 await expect(part(page,'brief').getByLabel('Qué quieres transmitir')).toHaveValue('Elegancia singular');
 await page.evaluate(()=>(window as any).identityTest.records.a.editor.undo());expect((await lab(page)).brief.intent).toBe('');
 await part(page,'brief').getByLabel('Qué quieres transmitir').fill('Guardar al desmontar');
 const final=await page.evaluate(()=>(window as any).identityTest.records.a.editor.destroy());expect(final.identityLab.brief.intent).toBe('Guardar al desmontar');
 await expect(part(page,'brief')).toHaveCount(0);expect((await lab(page,'b')).brief.intent).toBe('');
});
test('real raster evidence is bound to critique; camera events do not rerender panels and design changes stale review',async({page})=>{
 await part(page,'reviews').getByRole('button',{name:'Solicitar crítica visual'}).click();
 await page.waitForFunction(()=>(window as any).identityTest.records.a.pending);
 const request=await page.evaluate(()=>{const r=(window as any).identityTest.records.a.requests[0];return {evidence:r.evidence,target:r.targetRevision};});
 expect(request.evidence).toHaveLength(1);expect(request.evidence[0].width).toBe(300);expect(request.evidence[0].height).toBe(400);expect(request.evidence[0].dataURL).toMatch(/^data:image\/png;base64,/);expect(request.evidence[0].revision).toBe(request.target);
 await page.evaluate(()=>{const r=(window as any).identityTest.records.a;r.pending({summary:'La jerarquía es clara; revisar espaciado.',findings:[{criterion:'Claridad',assessment:'needs_work',reason:'Mayor separación sobre la tarjeta.',nodeIds:['a-rect']}],evaluator:{provider:'Prueba técnica',model:'fixture de contrato'}});});
 await expect(part(page,'reviews').getByText('Revisión vigente')).toBeVisible();
 const rendered=await part(page,'reviews').locator('article').elementHandle();await page.evaluate(()=>{const e=(window as any).identityTest.records.a.editor;for(let i=0;i<40;i++)e.setViewport({zoom:1+i/100});});expect(await rendered!.evaluate(e=>e.isConnected)).toBe(true);
 await part(page,'reviews').getByRole('button',{name:'Ver elementos'}).click();expect(await page.evaluate(()=>(window as any).identityTest.records.a.editor.getSelection().map((n:any)=>n.id))).toEqual(['a-rect']);
 await page.evaluate(()=>(window as any).identityTest.records.a.editor.apply([{op:'update',id:'a-rect',patch:{x:45}}]));await expect(part(page,'reviews').getByText('Necesita nueva revisión')).toBeVisible();
});
test('refinement captures instruction and selection, keeps geometry unchanged, export includes decisions',async({page})=>{
 await part(page,'reviews').getByLabel('Qué quieres mejorar').fill('La tarjeta compite con los controles.');await part(page,'reviews').getByRole('button',{name:'Proponer ajuste de la selección'}).click();
 await expect(part(page,'reviews').getByText('Mover la tarjeta; conservar proporciones.')).toBeVisible();const current=await lab(page);expect(current.refinements[0].instruction).toBe('La tarjeta compite con los controles.');expect(current.refinements[0].nodeIds).toEqual(['a-rect']);
 expect(await page.evaluate(()=>(window as any).identityTest.records.a.editor.getDocument().nodes.find((n:any)=>n.id==='a-rect').x)).toBe(30);
 await part(page,'decisions').getByLabel('Criterio').fill('Elegancia');await part(page,'decisions').getByLabel('Observación', {exact:true}).fill('El ritmo es propio.');await part(page,'decisions').getByLabel('Siguiente paso', {exact:true}).fill('Conservar proporción.');await part(page,'decisions').getByRole('button',{name:'Registrar decisión'}).click();
 await expect(part(page,'decisions').getByText('El ritmo es propio.',{exact:true})).toBeVisible();await part(page,'handoff').getByRole('button',{name:'Exportar identidad'}).click();expect(await page.evaluate(()=>(window as any).identityTest.records.a.exported.lab.decisions.length)).toBe(1);
});
test('draft forms survive blur and reject incoming AI; appearance belongs only to chrome',async({page})=>{
 const before=await page.locator('#host-control').evaluate(e=>getComputedStyle(e).color);
 await part(page,'references').getByRole('button',{name:'Investigar con la IA del IDE'}).click();await expect(part(page,'references').getByText('Propuesta',{exact:true})).toBeVisible();
 await part(page,'references').getByRole('button',{name:'Aceptar referencia'}).click();expect((await lab(page)).references[0].status).toBe('accepted');
 await part(page,'references').getByText('Añadir referencia',{exact:true}).click();await part(page,'references').getByLabel('Título',{exact:true}).fill('Texto sin enviar');await page.locator('#host-control').click();
 await page.evaluate(()=>(window as any).identityTest.records.a.editor.setIdentityServices({}));await expect(part(page,'references').getByLabel('Título',{exact:true})).toHaveValue('Texto sin enviar');
 await page.evaluate(()=>(window as any).identityTest.records.a.lab.setAppearance({theme:'dark',tokens:{accent:'#A93663',radius:12}}));expect(await part(page,'references').evaluate(e=>getComputedStyle(e).getPropertyValue('--codaru-accent').trim())).toBe('#A93663');expect(await page.locator('#host-control').evaluate(e=>getComputedStyle(e).color)).toBe(before);
});
test('the IDE example opens real directions and passes rasters through its explicit bridge',async({page})=>{
 await page.goto('/examples/identity-host.html');await page.waitForFunction(()=>!!(window as any).identityExample);
 await page.getByRole('button',{name:'Direcciones',exact:true}).click();await page.locator('[data-codaru-identity-part="directions"]').getByRole('button',{name:'ENTRELAZO · La trama · Móvil',exact:true}).click();await expect(page.getByLabel('Pantalla de la dirección')).toHaveValue('entrelazo-mobile');
 await page.getByRole('button',{name:'Tema oscuro',exact:true}).click();expect(await page.locator('[data-codaru-identity-part="directions"]').evaluate(e=>getComputedStyle(e).getPropertyValue('--codaru-accent').trim())).toBe('#b5bfff');await page.getByRole('button',{name:'Tema claro',exact:true}).click();
 await page.getByRole('button',{name:'Decisiones',exact:true}).click();await expect(page.getByText('Mejoró; todavía no muestra la elegancia buscada.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Revisión',exact:true}).click();await page.getByRole('button',{name:'Solicitar crítica visual'}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('#request-images img')).toHaveCount(2);
 await page.locator('#response').fill(JSON.stringify({summary:'Respuesta para comprobar el contrato del puente.',findings:[{criterion:'Contrato',assessment:'pass',reason:'Datos de prueba técnica, no evaluación de diseño.',nodeIds:[]}],evaluator:{provider:'Prueba técnica',model:'fixture'}}));await page.getByRole('button',{name:'Entregar respuesta al laboratorio'}).click();await expect(page.getByText('Respuesta para comprobar el contrato del puente.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).identityExample.editor.getIdentityState().issues)).toEqual([]);
});
test('discarding an unsubmitted form releases the write guard without publishing a reference',async({page})=>{
 await part(page,'references').getByText('Añadir referencia',{exact:true}).click();await part(page,'references').getByLabel('Título',{exact:true}).fill('Sin guardar');await page.locator('#host-control').click();
 expect(await page.evaluate(()=>{const e=(window as any).identityTest.records.a.editor;try{e.updateIdentityBrief({intent:'No pisar'});return 'ok';}catch(e){return String(e);}})).toContain('ocupado');
 await part(page,'references').getByRole('button',{name:'Descartar borrador'}).click();await page.evaluate(()=>(window as any).identityTest.records.a.editor.updateIdentityBrief({intent:'Borrador liberado'}));expect((await lab(page)).references).toHaveLength(0);
});
test('optional panel invalidation never requests a full public snapshot for camera gestures',async({page})=>{
 const result=await page.evaluate(async()=>{const r=(window as any).identityTest.records.a;r.lab.destroy();r.editor.subscribe=()=>{throw new Error('No duplicar snapshots por gesto');};const module=await import('/src/'+'identity-view.ts');r.lab=module.createIdentityLabView(r.editor);r.handles.brief=r.lab.mount('brief',r.slots.brief);for(let i=0;i<50;i++)r.editor.setViewport({zoom:1+i/100});r.editor.updateIdentityBrief({intent:'Invalidación compartida'});return r.editor.getIdentityLab().brief.intent;});
 expect(result).toBe('Invalidación compartida');await expect(part(page,'brief').getByLabel('Qué quieres transmitir')).toHaveValue('Invalidación compartida');
});
