import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demo } from '../src/demo';
import { Store, blank, clone, node, validate, updateNode, createVariant, defineVariant, switchVariant, variantAxes, variantLabel, renameVariantSet, setDesignSystemNotes, setComponentDoc } from '../src/model';
import { ensureKitVariant, getKitItems, insertKitItem } from '../src/kits';
import { applyOperations, handleAgentRequest, type AgentHost } from '../src/agent';

test('a master starts a variant set, instances switch and keep overrides by layer name, undo restores', () => {
  const s = new Store(demo());
  const master = s.project.nodes.find(n => n.componentId)!, instanceId = s.project.nodes.find(n => n.instanceOf)!.id;
  const originalParent = master.parentId;
  let created!: { componentId: string; masterId: string; containerId: string };
  s.commit(p => { created = createVariant(p, master.componentId!, { Estado: 'Deshabilitado' }); updateNode(p, created.masterId, { opacity: 45 }); });
  const base = s.project.components.find(c => c.id === master.componentId)!, variant = s.project.components.find(c => c.id === created.componentId)!;
  assert.equal(base.set, variant.set); assert.equal(base.setName, master.name); assert.deepEqual(base.variant, { Estado: 'Base' }); assert.deepEqual(variant.variant, { Estado: 'Deshabilitado' });
  assert.deepEqual(variantAxes(s.project, base.set!), { Estado: ['Base', 'Deshabilitado'] });
  const variantMaster = s.project.nodes.find(n => n.id === created.masterId)!, container = s.project.nodes.find(n => n.id === `variants-${base.set}`)!, movedMaster = s.project.nodes.find(n => n.id === master.id)!;
  assert.equal(container.type, 'group'); assert.equal(container.parentId, originalParent); assert.equal(container.name, `${master.name} · variantes`); assert.equal(container.layout, 'horizontal');
  assert.equal(movedMaster.parentId, container.id); assert.equal(variantMaster.parentId, container.id); assert.ok(variantMaster.x > movedMaster.x); assert.equal(variantMaster.name, `${master.name} / Estado=Deshabilitado`);
  assert.equal(created.containerId, container.id);
  s.commit(p => updateNode(p, instanceId, { text: 'Mi texto' }));
  const before = clone(s.project.nodes.find(n => n.id === instanceId)!), index = s.project.nodes.findIndex(n => n.id === instanceId);
  s.commit(p => switchVariant(p, instanceId, { Estado: 'Deshabilitado' }));
  const inst = s.project.nodes.find(n => n.id === instanceId)!;
  assert.equal(inst.instanceOf, created.componentId); assert.equal(inst.opacity, 45); assert.equal(inst.text, 'Mi texto'); assert.ok(inst.overrides!.includes('text')); assert.equal(inst.width, before.width);
  assert.equal(inst.x, before.x); assert.equal(inst.y, before.y); assert.equal(inst.targetId, before.targetId); assert.equal(s.project.nodes.findIndex(n => n.id === instanceId), index);
  assert.equal(switchVariant(clone(s.project), instanceId, { Estado: 'Deshabilitado' }), created.componentId, 'same variant is a no-op');
  assert.throws(() => switchVariant(clone(s.project), instanceId, { Estado: 'Inexistente' }), /No hay una variante/);
  assert.throws(() => createVariant(clone(s.project), master.componentId!, { Estado: 'Deshabilitado' }), /Ya existe/);
  assert.throws(() => defineVariant(clone(s.project), master.componentId!, { 'a=b': 'x' }), /sin "=" ni ","/);
  s.undo(); assert.equal(s.project.nodes.find(n => n.id === instanceId)!.instanceOf, master.componentId);
  // a second axis reaches every member with "Base", and the set can be renamed
  s.commit(p => { defineVariant(p, created.componentId, { Tamaño: 'Grande' }); renameVariantSet(p, base.set!, 'Botón'); });
  assert.deepEqual(s.project.components.find(c => c.id === base.id)!.variant, { Estado: 'Base', Tamaño: 'Base' });
  assert.ok(s.project.components.every(c => c.set !== base.set || c.setName === 'Botón'));
  assert.equal(variantLabel({ Estado: 'Base', Tamaño: 'Grande' }), 'Estado=Base, Tamaño=Grande');
  const bad = clone(s.project); bad.components[0].variant = { Estado: 'a,b' }; assert.throws(() => validate(bad), /sin "=" ni ","/);
  const badSet = clone(s.project); badSet.components[0].set = 'no válido!'; assert.throws(() => validate(badSet), /Conjunto de variantes inválido/);
});

test('kit items form a variant set per state and missing states are materialized on demand', () => {
  const p = blank(); p.nodes.push(node('frame', { id: 'f', name: 'Inicio', width: 390, height: 844 }));
  const item = getKitItems('ios')[0];
  const id = insertKitItem(p, 'ios', item.id, 'f', 24, 24);
  const c = p.components.find(c => c.id === p.nodes.find(n => n.id === id)!.instanceOf)!;
  assert.equal(c.set, `kit-ios-${item.id}`); assert.equal(c.setName, item.name); assert.deepEqual(c.variant, { Estado: 'Normal' });
  assert.equal(ensureKitVariant(p, 'otro-set', { Estado: 'Seleccionado' }), undefined);
  const selected = ensureKitVariant(p, c.set!, { Estado: 'Seleccionado' })!;
  assert.deepEqual(p.components.find(x => x.id === selected)!.variant, { Estado: 'Seleccionado' });
  switchVariant(p, id, { Estado: 'Seleccionado' });
  assert.equal(p.nodes.find(n => n.id === id)!.instanceOf, selected);
  validate(p);
});

test('agents define, create and switch variants, and the context lists sets', async () => {
  const p = demo();
  const master = p.nodes.find(n => n.componentId)!, instanceId = p.nodes.find(n => n.instanceOf)!.id;
  applyOperations(p, [{ op: 'variant.define', componentId: master.componentId, variant: { Estado: 'Normal' }, setName: 'Botón' }, { op: 'variant.create', componentId: master.componentId, variant: { Estado: 'Cargando' } }]);
  const loading = p.components.find(c => c.variant?.Estado === 'Cargando')!;
  assert.equal(loading.setName, 'Botón');
  applyOperations(p, [{ op: 'variant.switch', id: instanceId, variant: { Estado: 'Cargando' } }]);
  assert.equal(p.nodes.find(n => n.id === instanceId)!.instanceOf, loading.id);
  assert.throws(() => applyOperations(p, [{ op: 'variant.switch', id: instanceId, variant: { Estado: 'Nada' } }]), /No hay una variante/);
  const host: AgentHost = { project: () => p, selection: () => [instanceId], scope: () => null, busy: () => false, commit: edit => edit(p), select: () => {}, undo: () => {}, redo: () => {} };
  const ctx = await handleAgentRequest(host, { command: 'context', params: { depth: 0 } }) as any;
  assert.ok(ctx.context.components.some((c: any) => c.id === loading.id && c.setName === 'Botón' && c.variant.Estado === 'Cargando'));
  assert.deepEqual(ctx.context.nodes[0].variant, { Estado: 'Cargando' });
});

test('design-system notes and component docs are bounded, shared across a set and reachable by agents', () => {
  const p = demo();
  const master = p.nodes.find(n => n.componentId)!;
  applyOperations(p, [{ op: 'designSystem.set', summary: 'App de academia de música', brand: 'Negro y oro: precisión y oficio', principles: 'Una acción por pantalla\nEl oro solo en detalles' }]);
  assert.deepEqual(p.designSystem, { summary: 'App de academia de música', brand: 'Negro y oro: precisión y oficio', principles: 'Una acción por pantalla\nEl oro solo en detalles' });
  applyOperations(p, [{ op: 'designSystem.set', brand: null }]);
  assert.equal(p.designSystem!.brand, undefined); assert.equal(p.designSystem!.summary, 'App de academia de música');
  assert.throws(() => setDesignSystemNotes(p, { tone: 'x' }), /Campo desconocido/);
  assert.throws(() => setDesignSystemNotes(p, { summary: 'x'.repeat(4001) }), /4000/);
  applyOperations(p, [{ op: 'variant.create', componentId: master.componentId, variant: { Estado: 'Deshabilitado' } }, { op: 'component.doc', componentId: master.componentId, usage: 'La acción principal de la pantalla', do: 'Uno por pantalla', dont: 'No lo uses para navegar' }]);
  const set = p.components.filter(c => c.set);
  assert.equal(set.length, 2); assert.ok(set.every(c => c.doc?.usage === 'La acción principal de la pantalla' && c.doc.dont === 'No lo uses para navegar'));
  setComponentDoc(p, set[1].id, { do: null });
  assert.ok(set.every(c => c.doc?.do === undefined && c.doc?.usage));
  validate(p);
  const bad = clone(p); (bad.components[0] as any).doc = { usage: 1 }; assert.throws(() => validate(bad), /texto/);
  const stale = clone(p); (stale as any).designSystem = { summary: '' }; assert.equal(validate(stale).designSystem, undefined);
});
