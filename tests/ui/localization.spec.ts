import { test, expect, type Page } from '@playwright/test';

const part = (page: Page, name: string) => page.locator(`[data-codaru-part="${name}"]`);
const preview = (page: Page, id: string) => part(page, 'canvas').locator(`[data-node="${id}"] > .node-text`);
async function open(page: Page) {
  await page.goto('/examples/localization-host.html');
  await page.waitForFunction(() => !!(window as any).localizationExample);
}

test('IDE locale preview, present and exports keep source text, revision and undo intact', async ({ page }) => {
  await open(page);
  const source = await page.evaluate(async () => { const e=(window as any).localizationExample.editor; return { doc:e.getDocument(),context:await e.agent('context') }; });
  await part(page,'locale').getByLabel('Idioma de vista previa').selectOption('en');
  await expect(preview(page,'title')).toHaveText('Make room for\nwhat matters');
  await expect(part(page,'inspector').getByLabel('Contenido del texto')).toHaveValue('Organiza tu día,\nsin esfuerzo');
  const after = await page.evaluate(async () => { const e=(window as any).localizationExample.editor; return {doc:e.getDocument(), state:e.getState(), context:await e.agent('context'), html:e.exportHTML(), svg:e.exportSVG('welcome'), asset:await e.exportAsset({ids:['start'],format:'svg'})}; });
  expect(after.doc).toEqual(source.doc); expect(after.context.context.revision).toBe(source.context.context.revision); expect(after.state.canUndo).toBe(false);
  expect(after.svg).toContain('what matters'); expect(after.html).toContain('Get started'); expect(after.asset.content).toContain('Get started');
  await page.getByRole('button',{name:'Presentar',exact:true}).click();
  await expect(part(page,'dialogs').locator('#preview-canvas')).toContainText('Get started');
  await page.keyboard.press('Escape');
  await part(page,'locale').getByLabel('Idioma de vista previa').selectOption('');
  await expect(preview(page,'title')).toHaveText('Organiza tu día,\nsin esfuerzo');
  await expect(page.locator('#host-status')).toContainText('0 cambios');
});

test('real rendered overflow and missing keys lead back to the layer and IDE catalog editor', async ({ page }) => {
  await open(page); await part(page,'locale').getByLabel('Idioma de vista previa').selectOption('de');
  const issues = await page.evaluate(() => (window as any).localizationExample.editor.getLocalizationIssues());
  expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({kind:'overflow',node:'title',measurement:'dom'}),expect.objectContaining({kind:'missing',node:'subtitle'})]));
  await part(page,'locale').getByRole('button',{name:/Revisar localización/}).click();
  await part(page,'dialogs').getByRole('button',{name:/Descripción.*welcome.subtitle/}).click();
  await expect(part(page,'inspector').getByLabel('Clave de localización')).toHaveValue('welcome.subtitle');
  await expect(part(page,'inspector').locator('[data-localization-issue="missing"]')).toBeVisible();
  await part(page,'inspector').getByRole('button',{name:'Abrir clave en el IDE'}).click();
  await expect(page.locator('#host-key')).toHaveText('welcome.subtitle');
  await page.getByLabel('Traducción',{exact:true}).fill('Mehr Zeit für dich.');
  await page.getByRole('button',{name:'Actualizar vista previa'}).click();
  await expect(preview(page,'subtitle')).toHaveText('Mehr Zeit für dich.');
  await expect(part(page,'inspector').locator('[data-localization-issue="missing"]')).toHaveCount(0);
  await expect(page.locator('#host-status')).toContainText('0 cambios');
});

test('binding edits are undoable and pending keys flush when fragments are destroyed', async ({ page }) => {
  await open(page);
  const key=part(page,'inspector').getByLabel('Clave de localización');
  await key.fill('welcome.start'); await key.press('Tab');
  await expect(preview(page,'title')).toHaveText('Comenzar');
  await page.evaluate(()=>(window as any).localizationExample.editor.undo());
  await expect(key).toHaveValue('welcome.title');
  await key.fill('pending.key');
  const result = await page.evaluate(() => (window as any).localizationExample.editor.destroy());
  expect(result.nodes.find((n:any)=>n.id==='title').textKey).toBe('pending.key');
  expect(result.nodes.find((n:any)=>n.id==='title').text).toBe('Organiza tu día,\nsin esfuerzo');
  expect(result.localization).toBeUndefined(); await expect(page.locator('[data-codaru-part]')).toHaveCount(0);
});

test('detached locale parts isolate two sessions, can remount and respect focused edits', async ({ page }) => {
  await page.goto('/tests/fixtures/modular.html');
  await page.waitForFunction(() => !!(window as any).modularTest);
  await page.evaluate(() => {
    const t=(window as any).modularTest;
    for(const id of ['a','b']) {
      const r=t.mount(id,['canvas','locale','inspector']);
      r.editor.setLocalization({locale:'en',messages:{en:{title:'English '+id},es:{title:'Español '+id}}});
      r.editor.apply([{op:'add',node:{id:id+'-text',type:'text',parentId:id+'-frame',text:'Source',textKey:'title',y:180}}]);
    }
  });
  expect(await page.evaluate(() => (window as any).modularTest.records.a.editor.command('locale-review').then(()=>'opened',(e:Error)=>e.message))).toContain('dialogs');
  const a = page.locator('[data-instance="a"]'), b = page.locator('[data-instance="b"]');
  await a.getByLabel('Idioma de vista previa').selectOption('es');
  await expect(a.locator('[data-node="a-text"] > .node-text')).toHaveText('Español a');
  await expect(b.locator('[data-node="b-text"] > .node-text')).toHaveText('English b');
  await page.evaluate(()=>{const r=(window as any).modularTest.records.a;r.handles.locale.destroy();r.handles.locale=r.view.mount('locale',r.slots.locale);r.editor.select(['a-text']);});
  await expect(a.getByLabel('Idioma de vista previa')).toHaveValue('es');
  await a.getByLabel('Contenido del texto').fill('Pending source');
  const result=await page.evaluate(()=> (window as any).modularTest.records.a.editor.agent('locale',{locale:'en'}));
  expect(result.error.code).toBe('editor_busy');
  await a.getByLabel('Contenido del texto').press('Tab');
  await a.getByLabel('Idioma de vista previa').selectOption('en');
  await expect(a.locator('[data-node="a-text"] > .node-text')).toHaveText('English a');
});

test('iframe accepts host catalogs and intents; JSON exports and destruction retain bindings only', async ({ page }) => {
  await page.goto('/tests/fixtures/embed.html');
  await page.waitForFunction(() => !!(window as any).embedTest);
  await page.evaluate(async()=>{
    const t=(window as any).embedTest, {node}=await import('/src/'+'model.ts'), doc=t.project('Localized iframe','i');
    doc.nodes.push(node('text',{id:'i-title',parentId:'i-screen',text:'Hola',textKey:'title',y:180}));
    const r=t.mount('i',{document:doc,localization:{locale:'en',messages:{en:{title:'Hello'}}},onTranslationRequest:(request:any)=>t.events.push(request)});
    await r.handle.ready; r.api.select(['i-title']);
  });
  const f=page.frameLocator('[data-embed="i"]');
  await expect(f.locator('[data-node="i-title"] > .node-text')).toHaveText('Hello');
  await f.getByRole('button',{name:'Abrir clave en el IDE'}).click();
  expect(await page.evaluate(()=>(window as any).embedTest.events)).toContainEqual(expect.objectContaining({key:'title',sourceText:'Hola',previewText:'Hello'}));
  const result=await page.evaluate(async()=>{const r=(window as any).embedTest.records.i; const json=await r.api.agent('export',{format:'json'});const doc=await r.handle.destroy();return {json:JSON.parse(json.content),doc};});
  expect(result.json.nodes.find((n:any)=>n.id==='i-title').text).toBe('Hola');
  expect(result.doc.nodes.find((n:any)=>n.id==='i-title').textKey).toBe('title');
});

test('fragment styles reuse the host style nonce under a Tauri-like CSP', async ({page}) => {
  await page.route('**/tests/fixtures/modular.html', async route => {
    const response=await route.fetch();
    await route.fulfill({response,headers:{...response.headers(),'content-security-policy':"style-src 'self' 'nonce-codaru-test-style'"},body:(await response.text()).replace('<style>','<style nonce="codaru-test-style">')});
  });
  await page.goto('/tests/fixtures/modular.html');
  await page.waitForFunction(()=>!!(window as any).modularTest);
  await page.evaluate(()=>{const r=(window as any).modularTest.mount('a',['canvas','locale','inspector']);r.editor.setLocalization({locale:'en',messages:{en:{title:'Hello'}}});});
  expect(await part(page,'locale').locator('.locale-switch').evaluate(el=>getComputedStyle(el).display)).toBe('flex');
  expect(await part(page,'locale').evaluate(el=>(el.shadowRoot!.querySelector('style') as HTMLStyleElement).nonce)).toBe('codaru-test-style');
});
