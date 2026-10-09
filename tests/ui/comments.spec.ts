import {test,expect} from '@playwright/test';
test('selected objects receive a comment, pin, reply and history; camera follows and stale anchors survive',async({page})=>{
 await page.goto('/tests/fixtures/comments.html');await page.getByLabel('Texto del comentario').fill('Este control se oculta con el tema.');await page.getByRole('button',{name:'Publicar',exact:true}).click();
 await expect(page.getByRole('article').getByText('Este control se oculta con el tema.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Comentario 1: Continuar',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).commentTest.events.map((e:any)=>e.type))).toEqual(['comment.created']);
 await page.getByRole('button',{name:'Comentario 1: Continuar',exact:true}).click();expect(await page.evaluate(()=>(window as any).commentTest.editor.getSelection().map((n:any)=>n.id))).toEqual(['cta']);
 await page.getByLabel('Texto del comentario').fill('Buscar una mejor posición.');await page.getByRole('button',{name:'Publicar',exact:true}).click();await expect(page.getByText('Buscar una mejor posición.',{exact:true})).toBeVisible();
 const left=await page.getByRole('button',{name:'Comentario 1: Continuar',exact:true}).evaluate(e=>(e as HTMLElement).style.left);await page.evaluate(()=>(window as any).commentTest.editor.setViewport({pan:{x:150,y:120},zoom:.8}));expect(await page.getByRole('button',{name:'Comentario 1: Continuar',exact:true}).evaluate(e=>(e as HTMLElement).style.left)).not.toBe(left);
 await page.evaluate(()=>(window as any).commentTest.editor.apply([{op:'update',id:'cta',patch:{x:60}}]));await expect(page.getByText('El layout cambió desde el comentario. La IA debe revisar el contexto actual.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Resolver',exact:true}).click();await expect(page.getByRole('button',{name:'Reabrir',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Comentario 1: Continuar',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Reabrir',exact:true}).click();await expect(page.getByRole('button',{name:'Comentario 1: Continuar',exact:true})).toBeVisible();
 await page.evaluate(()=>(window as any).commentTest.editor.apply([{op:'remove',ids:['cta']}]));await expect(page.getByText('Una capa se eliminó o cambió de pantalla. El hilo conserva su ancla original.',{exact:true})).toBeVisible();
});
test('unsubmitted drafts survive fragment/session teardown without publishing a hook',async({page})=>{
 await page.goto('/tests/fixtures/comments.html');await page.getByLabel('Texto del comentario').fill('No perder esta observación.');await page.getByRole('button',{name:'Desmontar / remontar',exact:true}).click();await expect(page.getByLabel('Texto del comentario')).toHaveValue('No perder esta observación.');expect(await page.evaluate(()=>(window as any).commentTest.events.length)).toBe(0);
 await page.getByLabel('Texto del comentario').fill('Guardado al cerrar el editor.');const final=await page.evaluate(()=>(window as any).commentTest.editor.destroy());expect(final.comments.drafts[0].text).toBe('Guardado al cerrar el editor.');expect(final.comments.threads.length).toBe(0);
});
test('full editor exposes comments and saved drafts; example hook bridge never edits geometry',async({page})=>{
 await page.goto('/examples/identity-host.html');const before=await page.evaluate(()=>(window as any).identityExample.editor.getDocument().nodes);await page.getByRole('button',{name:'Comentarios',exact:true}).click();await page.getByLabel('Texto del comentario').fill('La navegación se siente escondida.');await page.getByRole('button',{name:'Publicar',exact:true}).click();await expect(page.getByRole('article').getByText('La navegación se siente escondida.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Pedir propuesta a la IA',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.locator('#response').fill(JSON.stringify({text:'Probar una jerarquía mayor conservando la rotulación.',authorName:'Agente de prueba'}));await page.getByRole('button',{name:'Entregar respuesta al laboratorio',exact:true}).click();await expect(page.getByText('Probar una jerarquía mayor conservando la rotulación.',{exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as any).identityExample.commentEvents.map((e:any)=>e.type))).toEqual(['comment.created','comment.replied']);
 await page.evaluate(()=>{const {editor,comments}=(window as any).identityExample;editor.apply([{op:'comment.create',id:'mobile-comment',anchor:editor.captureCommentAnchor(['entrelazo-mobile-enter']),message:{id:'mobile-message',text:'Revisar el acceso móvil.',author:{name:'QA',kind:'human'},at:new Date().toISOString()}}]);comments.open('mobile-comment');});
 await page.getByRole('button',{name:'Mostrar elemento',exact:true}).click();
 await expect(page.getByLabel('Pantalla de la dirección')).toHaveValue('entrelazo-mobile');
 expect(await page.evaluate(()=>(window as any).identityExample.editor.getSelection().map((n:any)=>n.id))).toEqual(['entrelazo-mobile-enter']);
 expect(await page.evaluate(()=>(window as any).identityExample.editor.getDocument().nodes)).toEqual(before);
 await page.goto('/?codaruEmbed=1');await page.getByRole('button',{name:'Comentarios',exact:true}).click();await expect(page.getByRole('heading',{name:/Comentarios/})).toBeVisible();
});

test('comments inherit the host CSP nonce for panel and pins',async({page})=>{
 await page.goto('/tests/fixtures/comments.html?csp=1');
 await page.getByLabel('Texto del comentario').fill('Visible bajo CSP.');await page.getByRole('button',{name:'Publicar',exact:true}).click();
 expect(await page.locator('[data-codaru-comments=panel]').evaluate(e=>e.shadowRoot?.querySelector('style')?.nonce)).toBe('comments-qa');
 expect(await page.locator('[data-codaru-comments=pins]').evaluate(e=>e.shadowRoot?.querySelector('style')?.nonce)).toBe('comments-qa');
 expect(await page.locator('[data-codaru-comments=pins]').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
 const pin=page.getByRole('button',{name:'Comentario 1: Continuar',exact:true});await expect(pin).toBeVisible();expect(await pin.evaluate(e=>getComputedStyle(e).position)).toBe('absolute');
 expect(await page.locator('[data-codaru-comments=panel]').evaluate(e=>getComputedStyle(e.shadowRoot!.querySelector('.comments-panel')!).padding)).not.toBe('0px');
});

test('full iframe import replaces optional metadata and restores hooks without publishing',async({page})=>{
 await page.goto('/tests/fixtures/embed.html');
 await page.evaluate(()=>(window as any).embedTest.mount('comments-import',{documentName:'Importación de comentarios'}));await page.waitForFunction(()=>!!(window as any).embedTest.records['comments-import'].api);
 const result=await page.evaluate(async()=>{const api=(window as any).embedTest.records['comments-import'].api;const clean=api.getDocument(),target=clean.nodes.find((n:any)=>n.parentId===null);api.select([target.id]);const events:any[]=[];api.subscribeComments((e:any)=>events.push(e.type));api.apply([{op:'comment.create',id:'import-test',anchor:api.captureCommentAnchor(),message:{id:'message-import',text:'Comentario del documento anterior',author:{name:'QA',kind:'human'},at:new Date().toISOString()}}]);api.importDocument(clean);return {events,threads:api.getComments().threads.length};});
 expect(result).toEqual({events:['comment.created','comments.restored'],threads:0});
});

test('switching documents never brings a previous draft or selected thread into the new project',async({page})=>{
 await page.goto('/tests/fixtures/comments.html');await page.getByLabel('Texto del comentario').fill('Pertenece al primer proyecto.');await page.getByRole('button',{name:'Desmontar / remontar',exact:true}).click();
 await page.evaluate(()=>{const e=(window as any).commentTest.editor;const clean=e.getDocument();delete clean.comments;e.importDocument(clean);});await expect(page.getByLabel('Texto del comentario')).toHaveValue('');
 await page.evaluate(()=>(window as any).commentTest.editor.select(['cta']));await page.getByLabel('Texto del comentario').fill('Comentario del nuevo documento.');await page.getByRole('button',{name:'Publicar',exact:true}).click();await expect(page.getByRole('article').getByText('Comentario del nuevo documento.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).commentTest.editor.getComments().drafts)).toEqual([]);
});
