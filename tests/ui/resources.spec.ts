import { test, expect } from '@playwright/test';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><script>alert(1)</script><path d="M9 18V5l12-2v13" stroke="#112233" fill="none"/><circle cx="6" cy="18" r="3" fill="#112233"/></svg>';

test.beforeEach(async({page})=>{
  await page.route('https://api.iconify.design/search**',route=>route.fulfill({json:{icons:['lucide:music','openmoji:piano','gpl-set:thing'],collections:{lucide:{name:'Lucide',license:{spdx:'ISC'},author:{name:'Lucide Contributors'}},openmoji:{name:'OpenMoji',license:{spdx:'CC-BY-SA-4.0'}},'gpl-set':{name:'GPL',license:{spdx:'GPL-3.0'}}}}}));
  await page.route('https://api.iconify.design/**/*.svg**',route=>route.fulfill({contentType:'image/svg+xml',body:SVG}));
  await page.route('https://api.openverse.org/v1/images/?**',route=>route.fulfill({json:{results:[{id:'8b6ca8d7-5310-4af7-83e0-f3b115f94cb3',title:'piano baru',license:'by-sa',license_version:'2.0',creator:'apaan',thumbnail:'https://api.openverse.org/v1/images/8b6ca8d7-5310-4af7-83e0-f3b115f94cb3/thumb/',width:500,height:375}]}}));
  await page.route('https://api.openverse.org/v1/images/*/thumb/**',route=>route.fulfill({contentType:'image/png',body:PNG}));
  await page.route('https://picsum.photos/**',route=>route.fulfill({contentType:'image/png',body:PNG}));
  await page.goto('/');await expect(page.locator('[data-layer="screen-login"]')).toBeVisible();
});

test('the Recursos tab searches free icons and photos and inserts them as credited layers',async({page})=>{
  await page.getByRole('button',{name:'Componentes'}).click();
  await page.locator('[data-library="resources"]').click();
  await expect(page.locator('#resource-search')).toBeVisible();
  await page.locator('#resource-search').fill('music');
  await expect(page.locator('.resource-tile')).toHaveCount(2);
  await expect(page.locator('.resource-tile').first()).toContainText('Lucide · ISC');
  await page.evaluate(()=>(window as any).codaru.select(['screen-login']));
  await page.locator('.resource-tile').first().click();
  await expect.poll(async()=>page.evaluate(()=>{const n=(window as any).codaru.getDocument().nodes.at(-1);return [n.type,n.name,n.parentId,n.svg?n.svg.includes('script'):null,n.color];})).toEqual(['vector','music · Lucide Contributors · ISC','screen-login',false,'@text']);
  await page.locator('#resource-source').selectOption('openverse');
  await page.locator('#resource-search').fill('piano');
  await expect(page.locator('.resource-tile.image')).toHaveCount(1);
  await expect(page.locator('.resource-tile.image small')).toContainText('apaan · CC BY-SA 2.0');
  await page.locator('.resource-tile.image').click();
  await expect.poll(async()=>page.evaluate(()=>{const n=(window as any).codaru.getDocument().nodes.at(-1);return [n.type,n.name,!!n.image&&n.image.startsWith('data:image/png;base64,')];})).toEqual(['image','piano baru · apaan · CC BY-SA 2.0',true]);
  await page.locator('#resource-source').selectOption('picsum');
  await expect(page.locator('.resource-tile.image')).toHaveCount(12);
  await page.locator('#resource-seed').fill('sonus');
  await page.getByRole('button',{name:'Otras fotos'}).click();
  await expect(page.locator('.resource-tile.image').first()).toContainText('Foto de relleno 1');
  await page.locator('.resource-tile.image').first().click();
  await expect.poll(async()=>page.evaluate(()=>(window as any).codaru.getDocument().nodes.at(-1).name)).toMatch(/Foto de relleno 1 · Unsplash vía Picsum · Unsplash License/);
  // offline: the search reports the situation instead of breaking the editor
  await page.route('https://api.iconify.design/search**',route=>route.abort());
  await page.locator('#resource-source').selectOption('iconify');
  await page.locator('#resource-search').fill('offline');
  await expect(page.locator('.resource-error')).toContainText('Sin conexión');
});
