import { test, expect, type Page } from '@playwright/test';

const state=(page:Page)=>page.evaluate(()=>(window as any).codaru.getDocument());
const art=`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" onload="window.pwned=1"><script>window.pwned=1</script>
<g id="sun"><circle cx="60" cy="60" r="28" fill="#f5a524"/><path id="ray" d="M60 10V26" stroke="#f5a524" stroke-width="6" stroke-linecap="round"/></g></svg>`;
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('[data-layer="screen-login"]')).toBeVisible();});

test('an uploaded SVG becomes an illustration whose layers are animated in the animator and play in the prototype',async({page})=>{
  await page.locator('[data-layer="screen-login"]').click();
  await page.locator('#image-file').setInputFiles({name:'sol.svg',mimeType:'image/svg+xml',buffer:Buffer.from(art)});
  await expect(page.getByLabel('Nombre del elemento')).toHaveValue('sol');
  let node=(await state(page)).nodes.find((n:any)=>n.type==='vector');
  expect(node.svg).not.toContain('script');expect(node.svg).not.toContain('onload');expect(await page.evaluate(()=>(window as any).pwned)).toBeUndefined();
  await expect(page.locator(`#artboards [data-node="${node.id}"] svg [data-layer="sun"]`)).toHaveCount(1);
  await page.getByRole('button',{name:'Abrir animador'}).click();
  const dialog=page.getByRole('dialog',{name:'Animador'});await expect(dialog).toBeVisible();
  await dialog.getByLabel('Añadir animación').selectOption('spin');
  await dialog.getByLabel('Capa',{exact:true}).selectOption('sun');
  await dialog.getByLabel('Duración ms').fill('1000');await dialog.getByLabel('Duración ms').press('Tab');
  await dialog.getByLabel('Fotograma 2: Giro°').fill('180');await dialog.getByLabel('Fotograma 2: Giro°').press('Tab');
  node=(await state(page)).nodes.find((n:any)=>n.type==='vector');
  expect(node.animations).toHaveLength(1);
  expect(node.animations[0]).toMatchObject({target:'sun',duration:1000,iterations:0,keyframes:[{at:0,rotate:0},{at:100,rotate:180}]});
  await expect.poll(()=>dialog.locator('.animator-stage [data-layer="sun"]').evaluate(el=>el.getAnimations().length)).toBe(1);
  await dialog.getByRole('button',{name:'■ Detener'}).click();
  expect(await dialog.locator('.animator-stage [data-layer="sun"]').evaluate(el=>el.getAnimations().length)).toBe(0);
  await dialog.getByLabel('Fotograma 2: posición %').fill('0');await dialog.getByLabel('Fotograma 2: posición %').press('Tab');
  await expect(dialog.getByRole('alert')).toContainText('orden creciente');
  expect((await state(page)).nodes.find((n:any)=>n.type==='vector').animations[0].keyframes[1].at).toBe(100);
  await dialog.getByRole('button',{name:'Listo'}).click();await expect(dialog).toHaveCount(0);
  await expect(page.locator(`#artboards [data-node="${node.id}"]`)).not.toHaveAttribute('data-motion');
  await page.getByRole('button',{name:'Presentar',exact:true}).click();
  await expect.poll(()=>page.locator('#preview-canvas [data-layer="sun"]').evaluate(el=>el.getAnimations().length)).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Deshacer · ⌘Z',exact:true}).click();
  expect((await state(page)).nodes.find((n:any)=>n.type==='vector').animations[0].duration).toBe(1000);
});

test('a connection plays its transition in the prototype and in exported HTML',async({page})=>{
  await page.locator('[data-layer="primary-button"]').click();
  await page.getByLabel('Transición',{exact:true}).selectOption('slide-left');
  await page.getByLabel('Duración de la transición').fill('400');await page.getByLabel('Duración de la transición').press('Tab');
  expect((await state(page)).nodes.find((n:any)=>n.id==='primary-button').transition).toEqual({type:'slide-left',duration:400,easing:'ease-out'});
  await page.getByRole('button',{name:'Presentar',exact:true}).click();
  await page.locator('#preview-canvas [data-node="primary-button"]').click();
  await expect(page.locator('#preview-select')).toHaveValue('screen-dashboard');
  await expect(page.locator('#preview-canvas > *')).toHaveCount(2);
  expect(await page.locator('#preview-canvas [data-node="screen-dashboard"]').evaluate(el=>el.getAnimations().length)).toBe(1);
  await expect(page.locator('#preview-canvas > *')).toHaveCount(1);
  await page.getByRole('button',{name:'Pantalla anterior'}).click();
  await expect(page.locator('#preview-select')).toHaveValue('screen-login');await expect(page.locator('#preview-canvas > *')).toHaveCount(2);
  await page.keyboard.press('Escape');
  const html=await page.evaluate(()=>(window as any).codaru.exportHTML());
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(html);
  await page.locator('[data-node="primary-button"]').first().click();
  await expect(page.locator('#screen-dashboard')).toBeVisible();await expect(page.locator('#viewport > *')).toHaveCount(3);
  await expect(page.locator('#viewport > *')).toHaveCount(2);await expect(page.locator('#screen-login')).toBeHidden();
  await page.locator('#back').click();await expect(page.locator('#screen-login')).toBeVisible();
  expect(errors).toEqual([]);
});

test('skeleton presets animate the fill color and a loading shine on a regular element',async({page})=>{
  await page.locator('[data-layer="primary-button"]').click();
  await page.getByRole('button',{name:'Abrir animador'}).click();
  const dialog=page.getByRole('dialog',{name:'Animador'});
  await dialog.getByLabel('Añadir animación').selectOption('skeleton');
  await dialog.getByLabel('Fotograma 2: relleno',{exact:true}).fill('@muted');await dialog.getByLabel('Fotograma 2: relleno',{exact:true}).press('Tab');
  await dialog.getByLabel('Fotograma 1: relleno, selector').click();
  const picker=page.getByRole('dialog',{name:'Selector de color'});await picker.getByLabel('HEX').fill('#ff0000');await picker.getByLabel('HEX').press('Enter');await page.keyboard.press('Escape');await expect(picker).toHaveCount(0);await expect(dialog).toBeVisible();
  await dialog.getByLabel('Fotograma 1: borde',{exact:true}).fill('#00ff00');await dialog.getByLabel('Fotograma 1: borde',{exact:true}).press('Tab');
  await dialog.getByLabel('Añadir animación').selectOption('shimmer');
  const animations=(await state(page)).nodes.find((n:any)=>n.id==='primary-button').animations;
  expect(animations[0].keyframes).toEqual([{at:0,fill:'#ff0000',stroke:'#00ff00'},{at:100,fill:'@muted'}]);
  expect(animations[1].keyframes).toEqual([{at:0,shine:0},{at:100,shine:100}]);
  await dialog.getByLabel('Fotograma 1: relleno',{exact:true}).fill('no-es-color');await dialog.getByLabel('Fotograma 1: relleno',{exact:true}).press('Tab');
  await dialog.getByRole('button',{name:'Listo'}).click();
  await page.getByRole('button',{name:'Presentar',exact:true}).click();
  const button=page.locator('#preview-canvas [data-node="primary-button"]');
  await expect.poll(()=>button.evaluate(el=>el.getAnimations().length)).toBe(2);
  const sample=()=>button.evaluate(el=>getComputedStyle(el).backgroundColor);
  const first=await sample();await expect.poll(sample).not.toBe(first);
  expect(await button.evaluate(el=>el.style.backgroundImage)).toContain('linear-gradient(100deg');
  expect(await button.evaluate(el=>el.getAnimations().some(a=>(a.effect as KeyframeEffect).getKeyframes().some(k=>'backgroundPosition' in k||'backgroundPositionX' in k)))).toBe(true);
});
