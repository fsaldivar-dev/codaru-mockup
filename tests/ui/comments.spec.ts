import {test,expect} from '@playwright/test';
test('selected objects receive a comment, pin, reply and history; camera follows and stale anchors survive',async({page})=>{
 await page.goto('/tests/fixtures/comments.html');await page.getByLabel('Texto del comentario').fill('Este control se oculta con el tema.');await page.getByRole('button',{name:'Publicar',exact:true}).click();
 await expect(page.getByRole('article').getByText('Este control se oculta con el tema.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Comentario 1: Continuar',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).commentTest.events.map((e:any)=>e.type))).toEqual(['comment.created']);
 await page.getByRole('button',{name:'Comentario 1: Continuar',exact:true}).click();expect(await page.evaluate(()=>(window as any).commentTest.editor.getSelection().map((n:any)=>n.id))).toEqual(['cta']);
 await page.getByLabel('Texto del comentario').fill('Buscar una mejor posición.');await page.getByRole('button',{name:'Publicar',exact:true}).click();await expect(page.locator('#panel').getByText('Buscar una mejor posición.',{exact:true})).toBeVisible();
 const left=await page.getByRole('button',{name:'Comentario 1: Continuar',exact:true}).evaluate(e=>(e as HTMLElement).style.left);await page.evaluate(()=>(window as any).commentTest.editor.setViewport({pan:{x:150,y:120},zoom:.8}));expect(await page.getByRole('button',{name:'Comentario 1: Continuar',exact:true}).evaluate(e=>(e as HTMLElement).style.left)).not.toBe(left);
 await page.evaluate(()=>(window as any).commentTest.editor.apply([{op:'update',id:'cta',patch:{x:60}}]));await expect(page.getByText('El layout cambió desde el comentario. La IA debe revisar el contexto actual.',{exact:true})).toBeVisible();
 await page.locator('#panel').getByRole('button',{name:'Resolver',exact:true}).click();await expect(page.locator('#panel').getByRole('button',{name:'Reabrir',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Comentario 1: Continuar',exact:true})).toHaveCount(0);await page.locator('#panel').getByRole('button',{name:'Reabrir',exact:true}).click();await expect(page.getByRole('button',{name:'Comentario 1: Continuar',exact:true})).toBeVisible();
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

test('annotation picks a child directly and keeps critique on the canvas without documenting or moving it',async({page})=>{
 await page.goto('/tests/fixtures/comments.html');
 await page.evaluate(()=>{const {editor,view}=(window as any).commentTest;editor.select(['screen']);view.fit(true);});
 const before=await page.evaluate(()=>(window as any).commentTest.editor.getDocument().nodes);
 await page.getByRole('button',{name:'Anotar en el lienzo',exact:true}).click();
 const title=page.locator('.design-node[data-node="title"]');await title.click();
 const note=page.getByRole('region',{name:'Anotación del diseño'});
 await expect(note).toBeVisible();
 expect(await page.evaluate(()=>(window as any).commentTest.editor.getSelection().map((n:any)=>n.id))).toEqual(['title']);
 await note.getByRole('button',{name:'Opciones de anotación',exact:true}).click();await note.getByRole('button',{name:'Se pierde',exact:true}).click();
 const text=note.getByLabel('Texto de la anotación');await expect(text).toHaveValue(/Este elemento se pierde/);
 await text.fill('Se pierde; genera otra propuesta de jerarquía.');await text.press('ArrowRight');await text.press('Space');await text.press('Backspace');
 await page.evaluate(()=>(window as any).commentTest.editor.setViewport({pan:{x:80,y:40},zoom:.8}));
 await expect(text).toHaveValue('Se pierde; genera otra propuesta de jerarquía.');
 expect(await page.evaluate(()=>(window as any).commentTest.events.length)).toBe(0);
 await note.getByRole('button',{name:'Comentar',exact:true}).click();
 await expect(note.getByText('Se pierde; genera otra propuesta de jerarquía.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).commentTest.editor.getComments().threads[0].anchor.nodeIds)).toEqual(['title']);
 expect(await page.evaluate(()=>(window as any).commentTest.events.map((e:any)=>e.type))).toEqual(['comment.created']);
 expect(await page.evaluate(()=>(window as any).commentTest.editor.getDocument().nodes)).toEqual(before);
 await note.getByRole('button',{name:'Cerrar anotación',exact:true}).click();await expect(note).toBeHidden();
 await page.getByRole('button',{name:/Comentario 1:/}).click();await expect(note).toBeVisible();
 await note.getByRole('button',{name:'Resolver',exact:true}).click();await expect(note.getByRole('button',{name:'Reabrir',exact:true})).toBeVisible();
});

test('canvas annotation works without a sidebar, preserves drafts on escape and delivers a render to the IDE',async({page})=>{
 await page.goto('/examples/identity-host.html');
 await page.evaluate(()=>{const {editor,comments,view}=(window as any).identityExample;editor.select(['entrelazo-mobile-enter']);view.fit(true);comments.annotate();});
 const note=page.getByRole('region',{name:'Anotación del diseño'});await expect(note).toBeVisible();
 await note.getByLabel('Texto de la anotación').fill('Se encima a otros botones. Quiero otra propuesta de interacción.');
 await note.getByLabel('Texto de la anotación').press('Escape');await expect(note).toBeHidden();
 expect(await page.evaluate(()=>(window as any).identityExample.editor.getComments().drafts[0].text)).toBe('Se encima a otros botones. Quiero otra propuesta de interacción.');
 // Resume in the panel, publish the existing draft, then open its marker.
 await page.getByRole('button',{name:'Comentarios',exact:true}).click();await page.getByRole('button',{name:'Publicar',exact:true}).click();
 await page.getByRole('button',{name:/Comentario 1:/}).click();await expect(note).toBeVisible();
 const nodes=await page.evaluate(()=>(window as any).identityExample.editor.getDocument().nodes);
 await note.getByRole('button',{name:'Pedir propuesta a la IA',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.locator('#request-images img')).toHaveCount(1);
 const request=await page.evaluate(()=>(window as any).identityExample.pending());expect(request.action).toBe('comment.review');expect(request.context.thread.anchor.nodeIds).toEqual(['entrelazo-mobile-enter']);expect(request.evidence[0].revision).toBe(request.context.currentRevision);
 await page.locator('#response').fill(JSON.stringify({text:'Probar una acción fija separada de la navegación. Esta es una propuesta sin aplicar.',authorName:'Agente de prueba'}));await page.getByRole('button',{name:'Entregar respuesta al laboratorio',exact:true}).click();
 await expect(note.getByText('Probar una acción fija separada de la navegación. Esta es una propuesta sin aplicar.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).identityExample.editor.getDocument().nodes)).toEqual(nodes);
});

test('standalone annotations survive teardown and release pointer capture handlers',async({page})=>{
 await page.goto('/tests/fixtures/comments.html');
 await page.evaluate(async()=>{const t=(window as any).commentTest;t.comments.destroy();const {createCommentsView}=await import('/src/'+'comments-view.ts');t.comments=createCommentsView(t.editor);t.comments.mountPins(t.view.getCanvasViewport());t.editor.select(['screen']);t.view.fit(true);t.comments.setAnnotationMode(true);});
 await page.locator('.design-node[data-node="title"]').click();const note=page.getByRole('region',{name:'Anotación del diseño'});await expect(note).toBeVisible();
 await note.getByLabel('Texto de la anotación').fill('Esto debe sentirse más claro.');await note.getByLabel('Texto de la anotación').press('Control+Enter');
 await expect(note.getByText('Esto debe sentirse más claro.',{exact:true})).toBeVisible();
 await note.getByLabel('Texto de la anotación').fill('Conservar esta crítica al desmontar.');
 await page.evaluate(()=>(window as any).commentTest.comments.destroy());await expect(note).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).commentTest.editor.getComments().drafts[0].text)).toBe('Conservar esta crítica al desmontar.');
 await page.evaluate(()=>{const {editor,view}=(window as any).commentTest;editor.select(['screen']);view.fit(true);});await page.locator('.design-node[data-node="title"]').click();
 // Normal workspace selection resumes at the frame instead of annotating a nested child.
 expect(await page.evaluate(()=>(window as any).commentTest.editor.getSelection().map((n:any)=>n.id))).toEqual(['screen']);
 expect(await page.evaluate(()=>(window as any).commentTest.editor.getComments().threads.length)).toBe(1);
});

test('an empty canvas note keeps its original target while other comments and selection change',async({page})=>{
 await page.goto('/tests/fixtures/comments.html');
 await page.evaluate(()=>{const t=(window as any).commentTest;t.comments.annotate(['title']);t.editor.apply([{op:'comment.create',id:'other-comment',anchor:t.editor.captureCommentAnchor(['cta']),message:{id:'other-message',text:'Una observación distinta.',author:{name:'QA',kind:'human'},at:new Date().toISOString()}}]);t.editor.select(['cta']);});
 const note=page.getByRole('region',{name:'Anotación del diseño'});await note.getByRole('button',{name:'Opciones de anotación',exact:true}).click();await expect(note.locator('.annotation-target')).toHaveText('Texto');await note.getByRole('button',{name:'Opciones de anotación',exact:true}).click();await note.getByLabel('Texto de la anotación').fill('Esta crítica pertenece al título.');await note.getByRole('button',{name:'Comentar',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).commentTest.editor.getComments().threads.find((t:any)=>t.messages[0].text==='Esta crítica pertenece al título.').anchor.nodeIds)).toEqual(['title']);
});

test('compact annotation matches the reference: pill, local marker, hidden options and viewport-safe positioning',async({page})=>{
 await page.goto('/tests/fixtures/comments.html');await page.evaluate(()=>{const {editor,view,comments}=(window as any).commentTest;editor.select(['screen']);view.fit(true);comments.annotate(['title']);});
 const note=page.getByRole('region',{name:'Anotación del diseño'});await expect(note.getByPlaceholder('Agrega un comentario…')).toBeVisible();await expect(note.locator('.annotation-tools')).toBeHidden();await expect(note.locator('.annotation-thread')).toHaveCount(0);
 const size=await note.boundingBox();expect(size!.height).toBeLessThanOrEqual(50);await expect(page.locator('.annotation-draft-pin')).toBeVisible();
 const node=await page.locator('.design-node[data-node="title"]').boundingBox();expect(size!.y).toBeGreaterThanOrEqual(node!.y+node!.height);
 await note.getByRole('button',{name:'Opciones de anotación',exact:true}).click();await expect(note.getByRole('button',{name:'Otra propuesta',exact:true})).toBeVisible();await note.getByRole('button',{name:'Otra propuesta',exact:true}).click();await expect(note.locator('.annotation-tools')).toBeHidden();await expect(note.getByLabel('Texto de la anotación')).toHaveValue(/Genera otra propuesta/);
 await note.getByLabel('Texto de la anotación').fill('Línea 1\nLínea 2\nLínea 3');await page.evaluate(()=>(window as any).commentTest.editor.setViewport({pan:{x:30,y:520},zoom:1}));
 const viewport=await page.locator('[data-codaru-part=canvas] .stage').boundingBox(),box=await note.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(viewport!.y+viewport!.height);expect(box!.x+box!.width).toBeLessThanOrEqual(viewport!.x+viewport!.width);
});


test('selected components offer direct feedback and annotation hover inspects the actual layer without a document edit',async({page})=>{
 await page.goto('/tests/fixtures/comments.html');
 const initial=await page.evaluate(()=>(window as any).commentTest.editor.getDocument());
 const launch=page.getByRole('button',{name:'Dar retroalimentación',exact:true});await expect(launch).toBeVisible();
 await launch.click();const note=page.getByRole('region',{name:'Anotación del diseño'});await expect(note.getByPlaceholder('Agrega un comentario…')).toBeVisible();
 await page.addStyleTag({content:'[data-codaru-part=canvas]::part(feedback-bar){border-color:#8499b4}'});await expect(note.locator('.annotation-bar')).toHaveCSS('border-top-color','rgb(132, 153, 180)');
 await note.getByRole('button',{name:'Opciones de anotación',exact:true}).click();await expect(note.locator('.annotation-target')).toHaveText('Continuar');await note.getByRole('button',{name:'Opciones de anotación',exact:true}).click();
 await note.getByLabel('Texto de la anotación').fill('Este control se encima. Necesita una propuesta más clara.');await note.getByRole('button',{name:'Comentar',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).commentTest.editor.getComments().threads[0].anchor.nodeIds)).toEqual(['cta']);
 expect(await page.evaluate(()=>(window as any).commentTest.editor.getDocument().nodes)).toEqual(initial.nodes);
 await note.getByRole('button',{name:'Cerrar anotación',exact:true}).click();await page.evaluate(()=>{const {editor,view}=(window as any).commentTest;editor.select(['screen']);view.fit(true);});await page.getByRole('button',{name:'Anotar en el lienzo',exact:true}).click();
 const before=await page.evaluate(()=>(window as any).commentTest.editor.getDocument());await page.locator('.design-node[data-node="title"]').hover();
 const info=page.locator('.annotation-inspect');await expect(info).toBeVisible();await expect(info).toContainText('300 × 60');await expect(info).toContainText('fuente');
 expect(await page.evaluate(()=>(window as any).commentTest.editor.getDocument())).toEqual(before);
 await page.locator('.design-node[data-node="title"]').click();await expect(info).toBeHidden();await expect(note.getByPlaceholder('Agrega un comentario…')).toBeVisible();
});

test('corrections collect from the compact bar, reorder, export and send one exact batch without moving layers',async({page})=>{
 await page.goto('/tests/fixtures/comments.html');const nodes=await page.evaluate(()=>(window as any).commentTest.editor.getDocument().nodes);
 await page.getByRole('button',{name:'Dar retroalimentación',exact:true}).click();const note=page.getByRole('region',{name:'Anotación del diseño'});await note.getByLabel('Texto de la anotación').fill('El botón se pierde.');await note.getByRole('button',{name:'Agregar a la cola',exact:true}).click();await expect(note).toBeHidden();
 await page.evaluate(()=>(window as any).commentTest.comments.annotate(['title']));await note.getByLabel('Texto de la anotación').fill('El título compite con el botón.');await note.getByRole('button',{name:'Agregar a la cola',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).commentTest.batches.length)).toBe(0);
 await page.getByRole('button',{name:'Cola de correcciones',exact:true}).click();const queue=page.getByRole('region',{name:'Cola de correcciones',exact:true});await expect(queue).toContainText('El botón se pierde.');await expect(page.getByRole('button',{name:'Dar retroalimentación',exact:true})).toBeHidden();await queue.getByRole('button',{name:'Subir corrección 2',exact:true}).click();
 await expect(queue.locator('.correction-item').first()).toContainText('El título compite');
 const download=page.waitForEvent('download');await queue.getByRole('button',{name:'Exportar JSON',exact:true}).click();expect((await download).suggestedFilename()).toBe('codaru-corrections.json');
 await queue.getByRole('button',{name:'Enviar correcciones',exact:true}).click();await expect(queue).toContainText('Cola recibida por el IDE');
 const result=await page.evaluate(()=>{const t=(window as any).commentTest;return {count:t.batches.length,ids:t.batches[0].items.map((i:any)=>i.context.thread.anchor.nodeIds[0]),texts:t.batches[0].items.map((i:any)=>i.context.thread.messages.at(-1).text),queue:t.editor.getComments().queue,nodes:t.editor.getDocument().nodes};});
 expect(result.count).toBe(1);expect(result.ids).toEqual(['title','cta']);expect(result.texts).toEqual(['El título compite con el botón.','El botón se pierde.']);expect(result.queue).toEqual([]);expect(result.nodes).toEqual(nodes);
});

test('failed sends survive teardown and retry; a later correction is not consumed by an earlier acknowledgement',async({page})=>{
 await page.goto('/tests/fixtures/comments.html');
 await page.evaluate(async()=>{const t=(window as any).commentTest;t.comments.destroy();const {createCommentsView}=await import('/src/'+'comments-view.ts');t.attempts=[];t.comments=createCommentsView(t.editor,{onCorrectionRequest:async(r:any)=>{t.attempts.push(r);if(t.attempts.length===1)throw new Error('IDE desconectado');await new Promise(resolve=>t.accept=resolve);}});t.comments.mountPins(t.view.getCanvasViewport());t.comments.annotate(['cta']);});
 const note=page.getByRole('region',{name:'Anotación del diseño'});await note.getByLabel('Texto de la anotación').fill('Primer ajuste.');await note.getByRole('button',{name:'Agregar a la cola',exact:true}).click();await page.getByRole('button',{name:'Cola de correcciones',exact:true}).click();const queue=page.getByRole('region',{name:'Cola de correcciones'});await queue.getByRole('button',{name:'Enviar correcciones',exact:true}).click();await expect(queue.getByRole('alert')).toContainText('IDE desconectado');
 expect(await page.evaluate(()=>(window as any).commentTest.editor.getComments().queue.length)).toBe(1);
 await queue.getByRole('button',{name:'Enviar correcciones',exact:true}).click();await expect(queue.getByRole('button',{name:'Enviando…',exact:true})).toBeDisabled();
 await page.evaluate(()=>{const t=(window as any).commentTest,id=t.editor.getComments().queue[0].threadId;t.editor.apply([{op:'comment.reply',id,message:{id:'later-critique',text:'Otra crítica durante el envío.',author:{name:'QA',kind:'human'},at:new Date().toISOString()}},{op:'comment.queue.add',id,messageId:'later-critique'}]);t.accept();});
 await expect(queue).toContainText('Cola recibida por el IDE');expect(await page.evaluate(()=>(window as any).commentTest.editor.getComments().queue[0].messageId)).toBe('later-critique');
 expect(await page.evaluate(()=>{const a=(window as any).commentTest.attempts;return a[0].id===a[1].id;})).toBe(true);
 await page.evaluate(async()=>{const t=(window as any).commentTest;t.comments.destroy();const {createCommentsView}=await import('/src/'+'comments-view.ts');t.comments=createCommentsView(t.editor);t.comments.mountQueue(document.querySelector('#panel'));});
 await expect(page.locator('[data-codaru-comments=queue]')).toContainText('Otra crítica durante el envío.');await expect(page.locator('[data-codaru-comments=queue]').getByRole('button',{name:'Enviar correcciones'})).toBeDisabled();
});

test('identity IDE receives exact ordered corrections and renders, then records real replies without editing geometry',async({page})=>{
 await page.goto('/examples/identity-host.html');const before=await page.evaluate(()=>(window as any).identityExample.editor.getDocument().nodes);
 const threadIds=await page.evaluate(()=>{const e=(window as any).identityExample.editor;for(const [id,nodeId,text] of [['first','entrelazo-007','El titular necesita otra jerarquía.'],['second','entrelazo-008','Este texto se pierde.']])e.apply([{op:'comment.create',id,anchor:e.captureCommentAnchor([nodeId]),message:{id:id+'-message',text,author:{name:'QA',kind:'human'},at:new Date().toISOString()}},{op:'comment.queue.add',id,messageId:id+'-message'}]);return e.getComments().queue.map((i:any)=>i.threadId);});
 await page.getByRole('button',{name:'Cola de correcciones',exact:true}).click();await page.getByRole('region',{name:'Cola de correcciones'}).getByRole('button',{name:'Enviar correcciones'}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('#request-images img')).toHaveCount(1);
 const request=await page.evaluate(()=>(window as any).identityExample.pending());expect(request.action).toBe('corrections.review');expect(request.context.items.map((i:any)=>i.item.threadId)).toEqual(threadIds);expect(request.evidence[0].dataURL).toMatch(/^data:image\/png;base64,/);
 await page.locator('#response').fill(JSON.stringify({replies:threadIds.map((threadId:string)=>({threadId,text:'Propuesta de QA para validar el transporte.',authorName:'QA del puente'}))}));await page.getByRole('button',{name:'Entregar respuesta al laboratorio',exact:true}).click();await expect(page.getByRole('dialog')).toBeHidden();await expect(page.getByRole('region',{name:'Cola de correcciones'})).toContainText('Cola recibida por el IDE');
 expect(await page.evaluate(()=>(window as any).identityExample.editor.getComments().threads.map((t:any)=>t.messages.at(-1).author.kind))).toEqual(['ai','ai']);expect(await page.evaluate(()=>(window as any).identityExample.editor.getDocument().nodes)).toEqual(before);
});

test('a replaced document with reused comment IDs cannot lose its new correction on an old acknowledgement',async({page})=>{
 await page.goto('/tests/fixtures/comments.html');await page.evaluate(async()=>{const t=(window as any).commentTest;t.comments.destroy();const {createCommentsView}=await import('/src/'+'comments-view.ts');t.comments=createCommentsView(t.editor,{onCorrectionRequest:async()=>new Promise(resolve=>t.accept=resolve)});t.comments.mountPins(t.view.getCanvasViewport());t.editor.apply([{op:'comment.create',id:'same-thread',anchor:t.editor.captureCommentAnchor(['cta']),message:{id:'same-message',text:'Crítica original.',author:{name:'QA',kind:'human'},at:new Date().toISOString()}},{op:'comment.queue.add',id:'same-thread',messageId:'same-message'}]);t.comments.openQueue();});
 const queue=page.getByRole('region',{name:'Cola de correcciones'});await queue.getByRole('button',{name:'Enviar correcciones'}).click();await expect(queue.getByRole('button',{name:'Enviando…'})).toBeDisabled();await page.evaluate(()=>{const t=(window as any).commentTest,p=t.editor.getDocument();p.comments.threads[0].messages[0].text='Crítica del documento nuevo.';t.editor.importDocument(p);t.accept();});await expect(queue.getByRole('alert')).toContainText('La cola se conserva');await expect(queue).toContainText('Crítica del documento nuevo.');expect(await page.evaluate(()=>(window as any).commentTest.editor.getComments().queue.length)).toBe(1);
 await queue.getByRole('button',{name:'Enviar correcciones'}).focus();await queue.getByRole('button',{name:'Enviar correcciones'}).press('Escape');await expect(queue).toBeHidden();
});
