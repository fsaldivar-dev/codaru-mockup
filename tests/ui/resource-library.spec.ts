import {test,expect} from '@playwright/test';
import {sanitizeSVG} from '../../src/motion';

for (const pending of ['catalogue','thumbnail'] as const) {
 test(`late resource ${pending} preserves the library tab chosen while loading`,async({page})=>{
  await page.goto('/tests/fixtures/modular.html');await page.waitForFunction(()=>!!(window as any).modularTest);
  await page.evaluate(({svg,pending})=>{
   const r=(window as any).modularTest.mount('a',['library']);
   r.editor.apply([{op:'add',node:{type:'vector',id:'slow-icon',parentId:'a-frame',svg,name:'Dibujo pendiente',width:24,height:24}}]);
   const key=pending==='catalogue'?'getResourceLibrary':'getResource';
   const original=r.editor[key].bind(r.editor);
   const waiting=new Promise<void>(resolve=>(window as any).releaseResourceLoad=resolve);
   r.editor[key]=async(...args:any[])=>{(window as any).resourceLoadStarted=true;await waiting;return original(...args);};
  },{svg:sanitizeSVG('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#8045ed"/></svg>'),pending});
  const library=page.locator('[data-instance="a"] [data-codaru-part="library"]');
  await library.getByRole('button',{name:'Recursos',exact:true}).click();
  await page.waitForFunction(()=>(window as any).resourceLoadStarted);
  await library.getByRole('button',{name:'Estilos',exact:true}).click();
  await page.evaluate(async()=>{(window as any).releaseResourceLoad();await new Promise(resolve=>setTimeout(resolve,0));await new Promise(requestAnimationFrame);});
  await expect(library.getByRole('button',{name:'Estilos',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(library.getByRole('button',{name:'Importar estilo JSON',exact:true})).toBeVisible();
  await expect(library.getByRole('textbox',{name:'Buscar dibujos propios'})).toHaveCount(0);
  await library.getByRole('button',{name:'Recursos',exact:true}).click();
  await expect(library.getByRole('button',{name:/Dibujo pendiente Pendiente de IA/})).toBeVisible();
 });
}

test('library shows document drawings, renders real PNG for the host evaluator and gates reuse/export',async({page})=>{
 await page.goto('/tests/fixtures/modular.html'); await page.waitForFunction(()=>!!(window as any).modularTest);
 await page.evaluate(async(svg)=>{
  const r=(window as any).modularTest.mount('a',['canvas','library','dialogs']);
  r.editor.apply([{op:'add',node:{type:'vector',id:'play-icon',parentId:'a-frame',svg,aruSource:{version:1,filename:'play.aru',text:'test-source'},name:'Iniciar reproducción',width:24,height:24}}]);
  // Deliberate test evaluator: proves host wiring and actual pixels, not AI quality acceptance.
  r.editor.setResourceServices({compile:async()=>svg,evaluate:async(request:any)=>{
   (window as any).reviewEvidence=request;
   return {status:'approved',reasons:['Test de contrato'],evaluator:{provider:'test-double',model:'contract-fixture'},checks:{appearance:'pass',readability:'pass',clipping:'pass',style:'pass',fidelity:'not_applicable',animation:'not_applicable'}};
  }});
 },sanitizeSVG('<svg viewBox="0 0 24 24"><path id="play" d="M5 2L22 12L5 22Z" fill="#8045ed"/></svg>'));
 const library=page.locator('[data-instance="a"] [data-codaru-part="library"]');
 await library.getByRole('button',{name:'Recursos',exact:true}).click();
 await library.getByRole('button',{name:/Iniciar reproducción Pendiente de IA/}).click();
 await expect(library.getByRole('button',{name:'Insertar en el diseño',exact:true})).toBeDisabled();
 await expect(library.getByRole('button',{name:'SVG',exact:true})).toBeDisabled();
 await library.getByRole('button',{name:'Validar con IA',exact:true}).click();
 await expect(library.getByRole('button',{name:'Insertar en el diseño',exact:true})).toBeEnabled();
 const evidence=await page.evaluate(async()=>{
  const request=(window as any).reviewEvidence;
  const samples=[];
  for(const p of request.previews){const image=new Image();image.src=p.dataURL;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let painted=0;for(let i=3;i<data.length;i+=4)if(data[i])painted++;samples.push({role:p.role,width:p.width,painted});}
  return {sourceMatches:request.technical.sourceMatches,samples};
 });
 expect(evidence.sourceMatches).toBe(true);expect(evidence.samples.every(p=>p.painted>30)).toBe(true);expect(evidence.samples.map(p=>p.role)).toEqual(['actual','small']);
 const download=page.waitForEvent('download');await library.getByRole('button',{name:'SVG',exact:true}).click();expect((await download).suggestedFilename()).toMatch(/\.svg$/);
 await library.getByRole('button',{name:'Insertar en el diseño',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).modularTest.records.a.editor.getDocument().nodes.filter((n:any)=>n.type==='vector').length)).toBe(2);
 await page.evaluate(()=>(window as any).modularTest.records.a.editor.undo());
 expect(await page.evaluate(()=>(window as any).modularTest.records.a.editor.getDocument().nodes.filter((n:any)=>n.type==='vector').length)).toBe(1);
});

test('full iframe delegates visual review and catalogue persistence to the host, with isolated instances',async({page})=>{
 await page.goto('/tests/fixtures/embed.html');await page.waitForFunction(()=>!!(window as any).embedTest);
 const result=await page.evaluate(async(svg)=>{

  const persisted:any[]=[];let pixels=false;
  const first=(window as any).embedTest.mount('resources',{documentName:'IDE',resourceServices:{evaluate:async(request:any)=>{pixels=request.previews.every((p:any)=>p.dataURL.startsWith('data:image/png;base64,'));return {status:'approved',reasons:['Contrato del iframe'],evaluator:{provider:'test-double',model:'iframe-fixture'},checks:{appearance:'pass',readability:'pass',clipping:'pass',style:'pass',fidelity:'not_applicable',animation:'not_applicable'}};}},onResourceLibraryChange:(records:any)=>persisted.push(records)});
  const second=(window as any).embedTest.mount('isolated',{documentName:'Otro IDE'});
  const api=await first.handle.ready, other=await second.handle.ready;
  const before=api.getDocument();const id=await api.stageResource({name:'Círculo',kind:'icon',purpose:'Indicador circular',svg,width:24,height:24});
  const review=await api.reviewResource(id);const catalogue=await api.agent('catalog',{kind:'resources'});
  const exported=await api.agent('export',{resource:id,format:'svg'});
  return {pixels,status:review.status,persisted:persisted.at(-1)[0].status,documentUnchanged:JSON.stringify(before)===JSON.stringify(api.getDocument()),otherCount:(await other.getResourceLibrary()).length,catalogue:catalogue.resources.length,exported:exported.ok,svg:exported.content.includes('<svg')};
 },sanitizeSVG('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#6f4ee0"/></svg>'));
 expect(result).toEqual({pixels:true,status:'approved',persisted:'approved',documentUnchanged:true,otherCount:0,catalogue:1,exported:true,svg:true});
});
