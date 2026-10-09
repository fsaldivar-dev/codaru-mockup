import {test,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('capture or replay an explicit visual review of a freshly compiled ARU asset',async({page})=>{
 test.skip(!process.env.CODARU_REVIEW_ASSET,'Manual AI review evidence is explicitly requested; ordinary tests never claim an AI verdict.');
 const asset=JSON.parse(await readFile(process.env.CODARU_REVIEW_ASSET!,'utf8'));
 const audit=process.env.CODARU_REVIEW_VERDICT?JSON.parse(await readFile(process.env.CODARU_REVIEW_VERDICT,'utf8')):null;
 await page.goto('/tests/fixtures/modular.html');await page.waitForFunction(()=>!!(window as any).modularTest);
 await page.evaluate(async({asset,audit})=>{
  const r=(window as any).modularTest.mount('review',['canvas','library']);
  const {prepareAruAsset}=await import('/src/'+'aru-asset.ts');const prepared=prepareAruAsset(asset);
  r.editor.setResourceServices({compile:async()=>asset.svg,evaluate:async(request:any)=>{
   (window as any).actualReviewRequest=request;
   if(!audit)return new Promise(()=>{});
   if(audit.revision!==request.revision)throw new Error('The reviewed content changed.');
   for(let i=0;i<request.previews.length;i++){
    const bytes=Uint8Array.from(atob(request.previews[i].dataURL.slice(22)),c=>c.charCodeAt(0));
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
    if(digest!==audit.previewHashes[i])throw new Error('The rendered pixels differ from the reviewed evidence.');
   }
   return audit.verdict;
  }});
  const id=await r.editor.stageResource({name:'Musaru · icono de la app',kind:'app-icon',purpose:'Icono de un reproductor de música, auriculares y disco reconocibles a 24 px, estilo orgánico con esmalte verde',svg:prepared.svg,source:prepared.aruSource,width:256,height:256});
  (window as any).actualReviewPromise=r.editor.reviewResource(id);
  (window as any).actualReviewId=id;
 },{asset,audit});
 await page.waitForFunction(()=>!!(window as any).actualReviewRequest);
 const request=await page.evaluate(()=>(window as any).actualReviewRequest);
 const directory='artifacts/resource-review';await mkdir(directory,{recursive:true});
 await writeFile(`${directory}/request.json`,JSON.stringify(request,null,2)+'\n');
 const hashes=[];
 for(const [i,p]of request.previews.entries()){
  const bytes=Buffer.from(p.dataURL.slice(22),'base64');hashes.push(createHash('sha256').update(bytes).digest('hex'));
  await writeFile(`${directory}/${i}-${p.role}.png`,bytes);
 }
 await writeFile(`${directory}/bindings.json`,JSON.stringify({revision:request.revision,previewHashes:hashes},null,2)+'\n');
 if(audit){const result=await page.evaluate(()=>(window as any).actualReviewPromise);expect(result.status).toBe(audit.verdict.status);const ready=await page.evaluate(()=>(window as any).modularTest.records.review.editor.getResource((window as any).actualReviewId));expect(ready.review.evaluator).toEqual(audit.verdict.evaluator);
  const exported=await page.evaluate(()=>(window as any).modularTest.records.review.editor.exportResource((window as any).actualReviewId,{format:'assets',platform:'all'}));
  await writeFile(`${directory}/musaru-approved-ios-android.zip`,Buffer.from(exported.content,'base64'));
  expect(exported.files.some((f:any)=>f.path.includes('imageset/Contents.json'))).toBe(true);expect(exported.files.some((f:any)=>f.path.includes('drawable-xxxhdpi/'))).toBe(true);
 }
});
