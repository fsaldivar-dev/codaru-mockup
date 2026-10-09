import { test, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test.beforeEach(async({page})=>{await page.goto('/tests/fixtures/modular.html');await page.waitForFunction(()=>!!(window as any).modularTest);});
test('exports a transparent illustration, independent native density files and a valid ZIP',async({page})=>{
 const result=await page.evaluate(async()=>{
   const t=(window as any).modularTest;t.mount('asset',['canvas','inspector','dialogs']);const editor=t.records.asset.editor;
   editor.select(['asset-rect']);
   const {exportAsset,assetBytes}=await import('/src/'+'asset-export.ts');
   const {blank,node}=await import('/src/'+'model.ts');const p=blank();
   p.nodes=[node('frame',{id:'f',role:'screen',fill:'#ff00ff',width:400,height:500}),node('group',{id:'art',name:'Welcome illustration',parentId:'f',x:40,y:100,width:80,height:60}),node('ellipse',{id:'shape',parentId:'art',x:10,y:10,width:30,height:30,fill:'#3366ff'})];
   const before=JSON.stringify(p),asset=await exportAsset(p,{ids:['art'],format:'assets',platform:'all'}),single=await exportAsset(p,{ids:['art'],format:'png',scale:2});
   const img=new Image();img.src='data:image/png;base64,'+single.content;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);
   return {asset,single:{width:img.width,height:img.height,signature:[...assetBytes(single).slice(0,8)],corner:[...ctx.getImageData(0,0,1,1).data],ink:[...ctx.getImageData(50,50,1,1).data]},unchanged:JSON.stringify(p)===before};
 });
 expect(result.unchanged).toBe(true);expect(result.single).toEqual({width:160,height:120,signature:[137,80,78,71,13,10,26,10],corner:[0,0,0,0],ink:[51,102,255,255]});
 const path=join(mkdtempSync(join(tmpdir(),'codaru-assets-test-')),'assets.zip');writeFileSync(path,Buffer.from(result.asset.content,'base64'));
 const inspected=JSON.parse(execFileSync('python3',['-c',`import zipfile,json,struct,sys
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 names=z.namelist()
 pngs={n:list(struct.unpack('>II',z.read(n)[16:24])) for n in names if n.endswith('.png')}
 catalog=json.loads(z.read('ios/Assets.xcassets/welcome_illustration.imageset/Contents.json'))
 print(json.dumps({'pngs':pngs,'catalog':catalog,'names':names}))`,path],{encoding:'utf8'}));
 expect(inspected.catalog.images.map((i:any)=>i.scale)).toEqual(['1x','2x','3x']);
 const scales={mdpi:1,hdpi:1.5,xhdpi:2,xxhdpi:3,xxxhdpi:4};for(const [bucket,scale] of Object.entries(scales)) expect(inspected.pngs[`android/res/drawable-${bucket}/welcome_illustration.png`]).toEqual([80*scale,60*scale]);
 expect(inspected.names).toContain('source/welcome_illustration.svg');expect(inspected.names).toContain('manifest.json');
});
test('native inspector and agent export selected assets through the shared API',async({page})=>{
 await page.evaluate(()=>{const t=(window as any).modularTest;t.mount('a');t.records.a.editor.select(['a-rect']);});
 const button=page.locator('[data-codaru-part="inspector"]').getByRole('button',{name:'iOS + Android · ZIP',exact:true});
 await expect(button).toBeVisible();const [download]=await Promise.all([page.waitForEvent('download'),button.click()]);expect(download.suggestedFilename()).toMatch(/-all\.zip$/);
 const result=await page.evaluate(async()=>{const e=(window as any).modularTest.records.a.editor;const before=e.getState();const asset=await e.agent('export',{format:'png',scale:2});return {ok:asset.ok,files:asset.files,unchanged:JSON.stringify(before)===JSON.stringify(e.getState())};});
 expect(result.ok).toBe(true);expect(result.unchanged).toBe(true);expect(result.files[0].scale).toBe(2);
});
test('oversized exports fail before allocating a raster and SVG export never removes host nodes',async({page})=>{
 const out=await page.evaluate(async()=>{
  const {demo}=await import('/src/'+'demo.ts'),{exportSVG}=await import('/src/'+'render.ts'),{exportAsset}=await import('/src/'+'asset-export.ts');
  const sentinel=document.createElement('span');sentinel.setAttribute('aria-hidden','true');sentinel.style.left='-99999px';document.body.append(sentinel);const p=demo();exportSVG(p,p.nodes.find((n:any)=>n.type==='frame')!);
  let error='';try{await exportAsset(p,{ids:['screen-dashboard'],width:8192});}catch(e){error=String(e);}return {retained:sentinel.isConnected,error};
 });expect(out.retained).toBe(true);expect(out.error).toMatch(/megapíxeles/);
});
