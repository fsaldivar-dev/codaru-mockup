import {test,expect} from '@playwright/test';
import {sanitizeSVG} from '../../src/motion';

test('fragmented library imports external style, exposes mobile guides and exports without changing layout',async({page})=>{
 await page.goto('/tests/fixtures/modular.html');await page.waitForFunction(()=>!!(window as any).modularTest);
 const style=await page.evaluate(async()=>{
  (window as any).modularTest.mount('a',['canvas','library','dialogs']);
  const {defaultDesignTheme}=await import('/src/'+'themes.ts');
  return {format:'codaru-style/1',id:'editorial',name:'Editorial de tinta',version:'1.0',description:'Tinta y papel; jerarquía de una revista.',theme:defaultDesignTheme('editorial','Editorial'),guidance:{composition:['Asimetría editorial'],typography:['Serif con titulares grandes'],controls:['Fichas impresas'],mobile:['Portada vertical, índice propio en lugar de sidebar'],motion:[],avoid:['Tarjetas repetidas']},aru:{palette:['#212120'],instructions:['Siluetas de tinta']}};
 });
 const library=page.locator('[data-instance="a"] [data-codaru-part="library"]');await library.getByRole('button',{name:'Estilos',exact:true}).click();
 await library.locator('[data-style-file]').setInputFiles({name:'editorial.codaru-style.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(style))});
 await expect(library.getByLabel('Estilo del proyecto')).toHaveValue('editorial');await expect(library.getByText('Portada vertical, índice propio en lugar de sidebar',{exact:true})).toBeVisible();
 const before=await page.evaluate(()=>(window as any).modularTest.records.a.editor.getDocument().nodes);
 await page.evaluate(()=>(window as any).modularTest.records.a.editor.select(['a-frame']));await library.getByRole('button',{name:'Usar tokens en pantalla seleccionada',exact:true}).click();
 const after=await page.evaluate(()=>(window as any).modularTest.records.a.editor.getDocument().nodes);
 expect(after[0].themeId).toBe('style-editorial');expect(after.map(({themeId,...n}:any)=>n)).toEqual(before);
 const download=page.waitForEvent('download');await library.getByRole('button',{name:'Exportar estilo JSON',exact:true}).click();expect((await download).suggestedFilename()).toBe('editorial.codaru-style.json');
});

test('a disposed iframe refuses new catalogue operations and cannot finish an in-flight admission',async({page})=>{
 await page.goto('/tests/fixtures/embed.html');await page.waitForFunction(()=>!!(window as any).embedTest);
 const result=await page.evaluate(async(svg)=>{
  const first=(window as any).embedTest.mount('lifecycle',{documentName:'IDE'});const api=await first.handle.ready;
  const id=await api.stageResource({name:'Circle',kind:'icon',purpose:'Indicator',width:24,height:24,svg});
  let finish:any;api.setResourceServices({evaluate:()=>new Promise(resolve=>finish=resolve)});
  const pending=api.reviewResource(id).then(()=>false,()=>true);while(!finish)await new Promise(resolve=>setTimeout(resolve,0));
  await first.handle.destroy();finish({status:'approved',reasons:[],evaluator:{provider:'test-double',model:'lifecycle'},checks:{appearance:'pass',readability:'pass',clipping:'pass',style:'pass',fidelity:'not_applicable',animation:'not_applicable'}});
  let refused=false;try{await api.stageResource({});}catch{refused=true;}
  return {refused,interrupted:await pending};
 },sanitizeSVG('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>'));expect(result).toEqual({refused:true,interrupted:true});
});
