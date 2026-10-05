import { test, expect } from '@playwright/test';

const shots = process.env.BUILDING_SHOTS;

test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('[data-layer="screen-login"]')).toBeVisible();});

test('agent batches show particles, a progress pill with a magnifier and skeletons for empty frames',async({page})=>{
  await page.evaluate(async()=>{const api=(window as any).codaru;api.select(['screen-login']);const c=await api.agent('context');await api.agent('apply',{expectedRevision:c.context.revision,operations:[
    {op:'add',node:{id:'built-frame',type:'frame',name:'Nueva · IA',x:1300,y:100,width:390,height:844,fill:'@surface'}},
    {op:'add',node:{id:'built-title',type:'text',parentId:'screen-login',x:32,y:430,width:326,height:84,text:'Construyendo\nen vivo',fontSize:34,fontWeight:700,lineHeight:1.2}},
    {op:'add',node:{id:'built-card',type:'card',parentId:'screen-login',x:32,y:540,width:326,height:140,fill:'@background',radius:20}},
    {op:'add',node:{id:'built-button',type:'button',parentId:'screen-login',x:32,y:740,width:326,height:52,text:'Empezar',fill:'@primary',color:'@surface',radius:26}}]});});
  const pill=page.locator('.building-pill');
  await expect(pill).toBeVisible();
  await expect(pill.locator('.building-text')).toHaveText('Diseñando · 2 pantallas, 4 cambios');
  await expect(page.locator('#artboards .design-node[data-node="built-frame"]')).toHaveClass(/building-skeleton/);
  await expect(page.locator('#artboards .design-node[data-node="built-title"]')).toHaveClass(/building-in/);
  await expect(page.locator('.building-layer')).toHaveClass(/active/);
  // The particle layer actually draws: sample the canvas for painted pixels while the burst runs.
  const painted=await page.evaluate(()=>{const c=document.querySelector<HTMLCanvasElement>('.building-layer')!;const d=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)n++;return n;});
  expect(painted).toBeGreaterThan(50);
  if(shots)await page.screenshot({path:`${shots}/building-particles.png`});
  await pill.hover();
  await expect(pill.locator('.building-lens')).toHaveCSS('opacity','1');
  if(shots)await page.screenshot({path:`${shots}/building-lens.png`});
  // Filling the frame removes its skeleton; a second batch keeps counting.
  await page.evaluate(async()=>{const api=(window as any).codaru;const c=await api.agent('context');await api.agent('apply',{expectedRevision:c.context.revision,operations:[{op:'add',node:{id:'built-child',type:'text',parentId:'built-frame',x:24,y:80,width:300,height:40,text:'Hola'}}]});});
  await expect(pill.locator('.building-text')).toHaveText('Diseñando · 2 pantallas, 5 cambios');
  await expect(page.locator('#artboards .design-node[data-node="built-frame"]')).not.toHaveClass(/building-skeleton/);
  // Human edits never trigger the agent feedback.
  await page.mouse.move(300,300);
  await expect(page.locator('.building-layer')).not.toHaveClass(/active/,{timeout:3000});
  await expect(pill).toBeHidden({timeout:6000});
  await page.evaluate(()=>{const api=(window as any).codaru;api.apply([{op:'update',id:'built-child',patch:{text:'Adiós'}}]);});
  await expect(pill).toBeHidden();
});
