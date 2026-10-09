import { implementationsDesign } from '../../examples/implementations-design';
import { slotsDesign } from '../../examples/slots-design';
import { propertiesDesign } from '../../examples/properties-design';
import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';

async function mount(page: Page, id: string, options: Record<string, unknown> = {}) {
  await page.evaluate(async ({ id, options }) => { const record = (window as any).embedTest.mount(id, options); await record.handle.ready; }, { id, options });
}
async function documentOf(page: Page, id: string) { return page.evaluate(id => (window as any).embedTest.records[id].api.getDocument(), id); }
const editor = (page: Page, id: string) => page.frameLocator(`[data-embed="${id}"]`);
test.beforeEach(async ({ page }) => { await page.goto('/tests/fixtures/embed.html'); await page.waitForFunction(() => !!(window as any).embedTest); });

test('initial document and explicit persistence are isolated from the standalone draft', async ({ page }) => {
  const original = await page.evaluate(() => {
    const t = (window as any).embedTest, data = JSON.stringify(t.project('Borrador independiente', 'standalone'));
    localStorage.setItem('codaru-mockup:project:v1', data); localStorage.setItem('must-not-use', 'host-owned'); return data;
  });
  await mount(page, 'plain', { documentName: 'Documento de host', editorUrl: '/index.html?storageKey=must-not-use' });
  expect((await documentOf(page, 'plain')).name).toBe('Documento de host');
  expect(await page.locator('[data-embed="plain"]').getAttribute('src')).toMatch(/codaruEmbed=1/);
  expect(await page.locator('[data-embed="plain"]').getAttribute('src')).not.toContain('storageKey');
  await page.evaluate(async () => { const r = (window as any).embedTest.records.plain; r.api.apply([{ op: 'update', id: 'plain-shape', patch: { x: 91 } }]); await r.handle.destroy(); });
  expect(await page.evaluate(() => localStorage.getItem('codaru-mockup:project:v1'))).toBe(original);
  expect(await page.evaluate(() => localStorage.getItem('must-not-use'))).toBe('host-owned');
  await mount(page, 'empty'); expect((await documentOf(page, 'empty')).nodes).toEqual([]);
  await mount(page, 'saved', { documentName: 'Persistencia elegida', storageKey: 'host:design:A' });
  await page.evaluate(async () => { const r = (window as any).embedTest.records.saved; r.api.apply([{ op: 'update', id: 'saved-shape', patch: { x: 117 } }]); await r.handle.destroy(); });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('host:design:A')!));
  expect(saved.nodes.find((n: any) => n.id === 'saved-shape').x).toBe(117);
  await mount(page, 'restored', { storageKey: 'host:design:A' }); expect(await documentOf(page, 'restored')).toEqual(saved);
  expect(await page.evaluate(() => localStorage.getItem('codaru-mockup:project:v1'))).toBe(original);
});

test('editor styles and keyboard shortcuts stay inside their iframe', async ({ page }) => {
  const appearance = () => page.evaluate(() => { const body = getComputedStyle(document.body), button = getComputedStyle(document.querySelector('#host-action')!); return { margin: body.margin, background: body.backgroundColor, family: body.fontFamily, buttonColor: button.color, buttonFont: button.font, padding: button.padding, border: button.borderWidth }; });
  const before = await appearance(); await mount(page, 'isolated', { documentName: 'Aislado' }); expect(await appearance()).toEqual(before);
  await page.evaluate(() => (window as any).embedTest.records.isolated.api.select(['isolated-shape']));
  await page.locator('#host-action').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Delete');
  expect((await documentOf(page, 'isolated')).nodes.find((n: any) => n.id === 'isolated-shape').x).toBe(40);
  expect(await page.evaluate(() => (window as any).embedTest.hostKeys)).toEqual([{ key: 'ArrowRight', prevented: false }, { key: 'Delete', prevented: false }]);
  await page.getByLabel('Texto del host').fill('Sigue siendo del host');
  await editor(page, 'isolated').locator('#stage').focus(); await page.keyboard.press('ArrowRight');
  expect((await documentOf(page, 'isolated')).nodes.find((n: any) => n.id === 'isolated-shape').x).toBe(41);
  expect(await page.evaluate(() => (window as any).embedTest.hostKeys.length)).toBe(2);
  await expect(page.getByLabel('Texto del host')).toHaveValue('Sigue siendo del host'); expect(await appearance()).toEqual(before);
});

test('two editor instances have independent documents, selections and human changes', async ({ page }) => {
  await mount(page, 'a', { documentName: 'Proyecto A' }); await mount(page, 'b', { documentName: 'Proyecto B' });
  await page.evaluate(() => { const r = (window as any).embedTest.records; r.a.api.select(['a-shape']); r.a.api.apply([{ op: 'update', id: 'a-shape', patch: { fill: '#225577' } }]); });
  expect((await documentOf(page, 'a')).nodes.find((n: any) => n.id === 'a-shape').fill).toBe('#225577');
  expect((await documentOf(page, 'b')).nodes.find((n: any) => n.id === 'b-shape').fill).toBe('@primary');
  expect(await page.evaluate(() => (window as any).embedTest.records.b.api.getSelection())).toEqual([]);
  await editor(page, 'b').getByLabel('Nombre del proyecto', { exact: true }).fill('Proyecto B humano');
  await editor(page, 'b').getByLabel('Nombre del proyecto', { exact: true }).press('Tab');
  expect((await documentOf(page, 'a')).name).toBe('Proyecto A'); expect((await documentOf(page, 'b')).name).toBe('Proyecto B humano');
  const changes = await page.evaluate(() => { const r = (window as any).embedTest.records; return { a: r.a.changes.map((p: any) => p.name), b: r.b.changes.map((p: any) => p.name) }; });
  expect(changes).toEqual({ a: ['Proyecto A'], b: ['Proyecto B humano'] });
});

test('AI edits notify the host and destruction flushes a focused edit for remounting', async ({ page }) => {
  await mount(page, 'ai', { documentName: 'Trabajo compartido' });
  const response = await page.evaluate(async () => {
    const api = (window as any).embedTest.records.ai.api, current = await api.agent('context');
    return api.agent('apply', { expectedRevision: current.context.revision, operations: [{ op: 'update', id: 'ai-shape', patch: { fill: '#337755', width: 188 } }] });
  });
  expect(response.ok).toBe(true);
  const changes = await page.evaluate(() => (window as any).embedTest.records.ai.changes);
  expect(changes).toHaveLength(1); expect(changes[0].nodes.find((n: any) => n.id === 'ai-shape').width).toBe(188);
  await page.evaluate(() => { (window as any).embedTest.records.ai.changes[0].name = 'Mutación externa'; });
  expect((await documentOf(page, 'ai')).name).toBe('Trabajo compartido');
  await editor(page, 'ai').getByLabel('Nombre del proyecto', { exact: true }).fill('Última edición enfocada');
  const disposed = await page.evaluate(async () => {
    const t = (window as any).embedTest, r = t.records.ai, first = r.handle.destroy(), second = r.handle.destroy();
    const snapshot = await first; let closed = false; try { r.api.apply([{ op: 'remove', ids: ['ai-shape'] }]); } catch { closed = true; }
    t.snapshot = snapshot; return { samePromise: first === second, snapshot, closed };
  });
  expect(disposed.samePromise).toBe(true); expect(disposed.closed).toBe(true); expect(disposed.snapshot.name).toBe('Última edición enfocada');
  await expect(page.locator('[data-embed="ai"]')).toHaveCount(0);
  await page.evaluate(async () => { const t = (window as any).embedTest; await t.mount('again', { document: t.snapshot }).handle.ready; });
  expect(await documentOf(page, 'again')).toEqual(disposed.snapshot);
});

test('the host invoke bridge handles native commands without enabling an extra CLI poller', async ({ page }) => {
  await mount(page, 'native', { documentName: 'Puente nativo', withInvoke: true, nativeAgent: false });
  await editor(page, 'native').getByRole('button', { name: 'Guardar archivo · ⌘S', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).embedTest.records.native.calls.length)).toBe(1);
  const call = await page.evaluate(() => (window as any).embedTest.records.native.calls[0]);
  expect(call.command).toBe('plugin:codaru|save_document'); expect(JSON.parse(call.args.content).name).toBe('Puente nativo');
  expect(call.args.extension).toBe('json');
  await page.evaluate(async () => { await (window as any).embedTest.records.native.handle.destroy(); });
  expect(await page.evaluate(() => (window as any).embedTest.records.native.calls.map((c: any) => c.command))).toEqual(['plugin:codaru|save_document']);
});

test('early destruction rejects readiness and cross-origin URLs are refused', async ({ page }) => {
  const early = await page.evaluate(async () => {
    const r = (window as any).embedTest.mount('pending'); const disposal = r.handle.destroy();
    try { await r.handle.ready; return { ready: true }; } catch (error) { return { ready: false, name: (error as Error).name, snapshot: await disposal }; }
  });
  expect(early).toEqual({ ready: false, name: 'AbortError', snapshot: undefined });
  await expect(page.locator('[data-embed="pending"]')).toHaveCount(0);
  await expect(page.evaluate(() => (window as any).embedTest.mount('cross-origin', { editorUrl: 'https://example.invalid/editor.html' }))).rejects.toThrow(/mismo origen/);
});

test('iframe reload reports an error and preserves the previous document snapshot', async ({ page }) => {
  await mount(page, 'reload', { documentName: 'No reemplazar' });
  await page.evaluate(() => { const r = (window as any).embedTest.records.reload; r.api.apply([{ op: 'update', id: 'reload-shape', patch: { x: 123 } }]); r.handle.element.contentWindow.location.reload(); });
  await expect.poll(() => page.evaluate(() => (window as any).embedTest.records.reload.errors.length)).toBe(1);
  await expect(page.locator('[data-embed="reload"]')).toHaveCount(0);
  const snapshot = await page.evaluate(async () => (window as any).embedTest.records.reload.handle.destroy());
  expect(snapshot.name).toBe('No reemplazar'); expect(snapshot.nodes.find((n: any) => n.id === 'reload-shape').x).toBe(123);
  expect(await page.evaluate(() => (window as any).embedTest.events.length)).toBe(1);
});


test('destroy stops the optional native agent poller owned by this instance', async ({ page }) => {
  await mount(page, 'polling', { documentName: 'CLI del host', withInvoke: true });
  await expect.poll(() => page.evaluate(() => (window as any).embedTest.records.polling.calls.length)).toBeGreaterThanOrEqual(1);
  const count = await page.evaluate(async () => { const r = (window as any).embedTest.records.polling; await r.handle.destroy(); return r.calls.length; });
  // One complete 500 ms polling interval must pass after disposal without another host invocation.
  await page.waitForTimeout(650);
  expect(await page.evaluate(() => (window as any).embedTest.records.polling.calls.length)).toBe(count);
  expect(await page.evaluate(() => (window as any).embedTest.records.polling.calls.every((c: any) => c.command === 'plugin:codaru|agent_poll'))).toBe(true);
});

test('@package generated bundle mounts using its own editor assets and default URL', async ({ page }) => {
  test.skip(!existsSync(new URL('../../packages/editor/dist/codaru.js', import.meta.url)), 'Run npm run package:build before checking the distributable.');
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.goto('/tests/fixtures/embed-package.html');
  await page.waitForFunction(() => !!(window as any).packageTest?.api);
  expect(await page.locator('iframe').getAttribute('src')).toMatch(/\/packages\/editor\/dist\/editor\/index.html\?codaruEmbed=1$/);
  const result = await page.evaluate(async () => {
    const t = (window as any).packageTest, current = await t.api.agent('context');
    const result = await t.api.agent('apply', { expectedRevision: current.context.revision, operations: [{ op: 'add', node: { id: 'packaged-frame', type: 'frame', name: 'Desde el paquete', x: 40, y: 40 } }, { op: 'icon', pack: 'web', name: 'home', parentId: 'packaged-frame', x: 24, y: 24 }] });
    return { ok: result.ok, count: t.api.getDocument().nodes.length, changes: t.changes.length };
  });
  expect(result).toEqual({ ok: true, count: 2, changes: 1 });
  await expect(page.frameLocator('iframe').locator('#artboards [data-kind="icon"] svg')).toHaveCount(1);
  expect(requests.some(path => path.startsWith('/packages/editor/dist/editor/assets/') && path.endsWith('.js'))).toBe(true);
  expect(requests.filter(path => path.startsWith('/src/'))).toEqual([]);
  const snapshot = await page.evaluate(async () => (window as any).packageTest.handle.destroy());
  expect(snapshot.nodes).toHaveLength(2); await expect(page.locator('iframe')).toHaveCount(0); expect(errors).toEqual([]);
});


test('iframe exposes semantic component controls and persists the same shared operations', async ({ page }) => {
  const fixture = propertiesDesign(); await mount(page, 'properties', { document: fixture.document });
  const result = await page.evaluate(({ id, component }) => {
    const api = (window as any).embedTest.records.properties.api;
    api.setComponentProperty(id, 'titulo', 'Desde iframe');
    api.apply([{ op: 'component.property.define', componentId: component, key: 'detalle', property: { type: 'text', label: 'Detalle', targetId: 'card-copy' } }, { op: 'component.property.set', id, key: 'detalle', value: 'Texto con clave' }]);
    return api.getComponentProperties(id);
  }, { id: fixture.ids.second, component: fixture.ids.card });
  expect(result.find((p: any) => p.key === 'titulo').value).toBe('Desde iframe');
  expect(result.find((p: any) => p.key === 'detalle').textKey).toBe('card.description');
  await expect(editor(page, 'properties').locator('#stage')).toContainText('Desde iframe');
  const final = await page.evaluate(async () => (window as any).embedTest.records.properties.handle.destroy());
  expect(final.nodes.some((n: any) => n.text === 'Texto con clave')).toBe(true);
});


test('iframe exposes slot choices and renders replacement content through its public API',async({page})=>{
  const fixture=slotsDesign();await mount(page,'slots',{document:fixture.document});
  const result=await page.evaluate(({id,choice})=>{const api=(window as any).embedTest.records.slots.api;api.setComponentProperty(id,'cabecera',choice);api.select([id]);return api.getComponentProperties(id)[0];},{id:fixture.ids.second,choice:fixture.ids.status});
  expect(result.type).toBe('slot');expect(result.components).toHaveLength(3);expect(result.value).toBe(fixture.ids.status);
  await expect(editor(page,'slots').locator('#inspector').getByLabel('Cabecera',{exact:true})).toHaveValue(fixture.ids.status);
  await expect(editor(page,'slots').locator('#stage')).toContainText('Disponible');
  const saved=await page.evaluate(async()=>(window as any).embedTest.records.slots.handle.destroy());
  expect(saved.components.find((c:any)=>c.id===fixture.ids.card).properties.cabecera.type).toBe('slot');
});

test('@package slots work through the distributed iframe without source imports',async({page})=>{
  const fixture=slotsDesign();const requested:string[]=[];page.on('request',r=>requested.push(new URL(r.url()).pathname));
  await page.goto('/tests/fixtures/embed-package.html');await page.waitForFunction(()=>!!(window as any).packageTest?.api);
  const result=await page.evaluate(({document,id,choice})=>{const api=(window as any).packageTest.api;api.importDocument(document);api.setComponentProperty(id,'cabecera',choice);api.select([id]);return api.getComponentProperties(id)[0];},{document:fixture.document,id:fixture.ids.second,choice:fixture.ids.status});
  expect(result.value).toBe(fixture.ids.status);await expect(page.frameLocator('iframe').locator('#inspector').getByLabel('Cabecera',{exact:true})).toHaveValue(fixture.ids.status);
  await expect(page.frameLocator('iframe').locator('#stage')).toContainText('Disponible');
  expect(requested.filter(path=>path.startsWith('/src/'))).toEqual([]);
  await page.evaluate(()=>(window as any).packageTest.handle.destroy());
});


test('@package implementation links cross the iframe boundary with isolated host intents', async ({ page }) => {
  const fixture = implementationsDesign(), requests: string[] = [];
  page.on('request', r => requests.push(new URL(r.url()).pathname));
  await page.goto('/tests/fixtures/embed-package.html'); await page.waitForFunction(() => !!(window as any).packageTest?.api);
  const result = await page.evaluate(async ({ document, id, componentId }) => {
    const t = (window as any).packageTest;
    t.api.importDocument(document); t.api.select([id]);
    t.api.setImplementation(componentId, 'macos', { symbol: 'MacCard', module: 'App' });
    await t.api.requestImplementation(id, 'macos');
    return { links: t.api.getImplementations(id), intent: t.implementationRequests[0] };
  }, { document: fixture.document, id: fixture.ids.second, componentId: fixture.ids.card });
  expect(result.links.implementations.macos.symbol).toBe('MacCard'); expect(result.intent.reference).toEqual({ symbol: 'MacCard', module: 'App' });
  await page.frameLocator('iframe').getByRole('button', { name: 'Abrir implementación ios', exact: true }).click();
  expect(await page.evaluate(() => (window as any).packageTest.implementationRequests.map((r: any) => r.platform))).toEqual(['macos', 'ios']);
  expect(requests.filter(path => path.startsWith('/src/'))).toEqual([]);
  const saved = await page.evaluate(async () => {
    const t = (window as any).packageTest, doc = await t.handle.destroy();
    let error = ''; try { await t.api.requestImplementation(t.implementationRequests[0].nodeId, 'ios'); } catch (e) { error = String(e); }
    return { doc, error, count: t.implementationRequests.length };
  });
  expect(saved.doc.components.find((c: any) => c.id === fixture.ids.card).implementations.macos.symbol).toBe('MacCard');
  expect(saved.error).toContain('desmontado'); expect(saved.count).toBe(2);
});
