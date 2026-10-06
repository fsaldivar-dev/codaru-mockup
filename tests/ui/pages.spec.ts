import { test, expect } from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('[data-layer="screen-login"]')).toBeVisible();});

test('pages isolate screens on the canvas and in layers, flows can cross pages, and versions save, compare and restore',async({page})=>{
  await expect(page.locator('#pages .page-row')).toHaveCount(1);
  await expect(page.locator('#pages .page-row .count')).toHaveText('2');
  await page.getByRole('button',{name:'Nueva página'}).click();
  await expect(page.locator('#pages .page-row')).toHaveCount(2);
  await expect(page.locator('#pages .page-row.active .page-name')).toContainText('Página 2');
  await expect(page.locator('#artboards .design-node[data-kind="frame"]')).toHaveCount(0);
  await page.getByRole('button',{name:'Nueva pantalla'}).first().click();
  await expect(page.locator('#artboards .design-node[data-kind="frame"]')).toHaveCount(1);
  await expect(page.locator('#layers .frame-layer')).toHaveCount(1);
  // move a screen from Principal to the new page through the inspector
  await page.locator('#pages .page-name').first().click();
  await expect(page.locator('#artboards .design-node[data-kind="frame"]')).toHaveCount(2);
  await page.evaluate(()=>(window as any).codaru.select(['screen-dashboard']));
  const pageIds=await page.evaluate(()=>(window as any).codaru.getDocument().pages.map((p:any)=>p.id));
  await page.getByLabel('Página de esta pantalla').selectOption(pageIds[1]);
  await expect(page.locator('#artboards .design-node[data-kind="frame"]')).toHaveCount(1);
  await expect(page.locator('#pages .page-row').nth(1).locator('.count')).toHaveText('2');
  // the login button still points at the dashboard, now on another page
  await page.evaluate(()=>(window as any).codaru.select(['primary-button']));
  await expect(page.getByLabel('Navegar a pantalla')).toHaveValue('screen-dashboard');
  await expect(page.locator('#inspector')).toContainText('otra página');
  // rename and remove pages
  await page.locator('#pages .page-row').nth(1).hover();
  await page.locator('[data-page-rename]').nth(1).click();
  await page.locator('.page-input').fill('Pagos'); await page.locator('.page-input').press('Enter');
  await expect(page.locator('#pages .page-row').nth(1)).toContainText('Pagos');
  await page.locator('#pages .page-row').nth(1).hover();
  await page.locator('[data-page-remove]').nth(1).click();
  await expect(page.locator('#toast')).toContainText('muévelos');
  // versions: save, change, compare, restore
  await page.getByRole('button',{name:'Versiones'}).click();
  await page.getByLabel('Nombre de la versión').fill('Antes de pagos');
  await page.getByRole('button',{name:'Guardar versión'}).click();
  await expect(page.locator('.version-row')).toHaveCount(1);
  await page.getByRole('button',{name:'Cerrar versiones'}).click();
  await page.evaluate(async()=>{const api=(window as any).codaru;const c=await api.agent('context');await api.agent('apply',{expectedRevision:c.context.revision,operations:[{op:'update',id:'screen-login',patch:{name:'Login nuevo'}},{op:'add',node:{id:'extra',type:'frame',name:'Extra',x:1200,y:100,width:390,height:844}}]});});
  await page.getByRole('button',{name:'Versiones'}).click();
  await page.getByRole('button',{name:'Comparar'}).click();
  await expect(page.locator('.version-compare')).toContainText('Pantallas nuevas: Extra');
  await expect(page.locator('.version-compare')).toContainText('Pantallas cambiadas: Login nuevo');
  await page.getByRole('button',{name:'Restaurar'}).click();
  await expect(page.locator('#modal-root')).toBeEmpty();
  await expect.poll(async()=>page.evaluate(()=>{const d=(window as any).codaru.getDocument();return [d.nodes.find((n:any)=>n.id==='screen-login').name,d.nodes.some((n:any)=>n.id==='extra'),d.versions.length];})).toEqual(['01 · Bienvenida',false,1]);
  await page.getByRole('button',{name:'Deshacer · ⌘Z',exact:true}).click();
  await expect.poll(async()=>page.evaluate(()=>(window as any).codaru.getDocument().nodes.some((n:any)=>n.id==='extra'))).toBe(true);
});
