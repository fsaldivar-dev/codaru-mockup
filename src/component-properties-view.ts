import { ancestors, subtree, variantAxes, type ComponentProperty, type DesignNode, type Project } from './model';
import { defineComponentProperty, getComponentProperties, setComponentProperty } from './component-properties';
import { iconPacks, getIconItems } from './icon-data';
import { escape as esc } from './render';

export function componentPropertyPanel(p: Project, n: DesignNode) {
  const master = n.componentId ? n : ancestors(p, n.id).find(n => n.componentId);
  const props = n.componentId || n.instanceOf ? getComponentProperties(p, n.id) : [];
  if (!props.length && !master) return '';
  const locked = n.locked || ancestors(p, n.id).some(n => n.locked);
  return `<section class="inspector-section component-properties"><div class="section-heading"><span>PROPIEDADES DEL COMPONENTE</span></div><fieldset ${locked ? 'disabled' : ''}>${props.map(prop => {
    const attrs = `data-public-property="${esc(prop.key)}" aria-label="${esc(prop.label)}"`;
    let control = '';
    if (!prop.available) control = `<p class="property-warning">${esc(prop.reason)}</p>`;
    else if (prop.type === 'text') control = `<textarea ${attrs} maxlength="10000" rows="2">${esc(String(prop.value))}</textarea>${prop.textKey ? `<p class="field-note">Texto de origen · clave <code>${esc(prop.textKey)}</code></p>` : ''}`;
    else if (prop.type === 'visibility') control = `<label class="check-field"><input ${attrs} type="checkbox" ${prop.value ? 'checked' : ''}/>Visible</label>`;
    else if (prop.type === 'slot') control = `<select ${attrs}>${prop.components!.map(c => `<option value="${esc(c.id)}" ${c.id === prop.value ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><p class="field-note">${n.componentId ? 'Contenido predeterminado' : prop.overridden ? 'Contenido de esta instancia' : 'Heredado del maestro'} · ${prop.components!.length} opciones</p>`;
    else if (prop.type === 'variant') control = `<select ${attrs}>${prop.options!.map(value => `<option ${value === prop.value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select>`;
    else {
      const value = prop.value as { pack: string; name: string };
      control = `<div class="property-icon-fields"><select data-public-property="${esc(prop.key)}" data-icon-part="pack" aria-label="${esc(prop.label)} · Kit">${iconPacks.map(pack => `<option value="${pack.id}" ${pack.id === value.pack ? 'selected' : ''}>${esc(pack.name)}</option>`).join('')}</select><select ${attrs} data-icon-part="name">${getIconItems(value.pack).map(item => `<option value="${esc(item.id)}" ${item.id === value.name ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></div>`;
    }
    return `<div class="public-property"><div class="property-heading"><span>${esc(prop.label)}</span>${prop.overridden && prop.available ? `<button data-property-reset="${esc(prop.key)}" title="Restablecer ${esc(prop.label)}" aria-label="Restablecer ${esc(prop.label)}">↺</button>` : ''}${n.componentId ? `<button data-property-edit="${esc(prop.key)}" data-property-component="${esc(n.componentId)}" aria-label="Configurar ${esc(prop.label)}">Editar</button><button data-property-remove="${esc(prop.key)}" data-property-component="${esc(n.componentId)}" aria-label="Dejar de exponer ${esc(prop.label)}">×</button>` : ''}</div>${control}<small class="property-key">${esc(prop.key)}</small></div>`;
  }).join('')}${master ? `<button class="wide-button" data-property-create="${esc(master.componentId)}" data-property-target="${esc(n.id)}">+ Exponer propiedad${master !== n ? ` en ${esc(master.name)}` : ''}</button>` : ''}${!props.length && master === n ? '<p class="field-note">Elige las capas que podrán personalizarse desde las instancias y tu IDE.</p>' : ''}</fieldset></section>`;
}

/** Dialog is scoped to this view. It holds no global document or session references. */
export function openComponentPropertyEditor(root: HTMLElement, get: () => Project, componentId: string, targetId: string | undefined, key: string | undefined, commit: (edit: (p: Project) => void) => void, close: () => void) {
  const p = get(), c = p.components.find(c => c.id === componentId); if (!c) return;
  const layers = subtree(p, c.masterId); if (!layers.length) return;
  const existing = key ? c.properties?.[key] : undefined;
  root.innerHTML = `<div class="modal-backdrop"><form class="dialog property-dialog" role="dialog" aria-modal="true" aria-label="Exponer propiedad"><button type="button" class="dialog-close icon-button" data-action="close-preview" aria-label="Cerrar">×</button><span class="eyebrow">${esc(c.name)}</span><h2>${existing ? 'Editar propiedad' : 'Exponer una propiedad'}</h2><p>Elige qué podrá cambiar cada instancia.</p><label class="full-field"><span>Capa vinculada</span><select name="target" aria-label="Capa vinculada">${layers.map(n => `<option value="${esc(n.id)}" ${n.id === (existing?.targetId ?? targetId) ? 'selected' : ''}>${esc(n.name)} · ${esc(n.type)} · ${esc(n.id)}</option>`).join('')}</select></label><div class="field-grid"><label class="full-field"><span>Tipo</span><select name="type" aria-label="Tipo de propiedad"></select></label><label class="full-field" data-axis-label><span>Eje</span><select name="axis" aria-label="Eje de variante"></select></label></div><div data-slot-fields hidden><label class="full-field"><span>Contenido predeterminado</span><select name="default" aria-label="Contenido predeterminado"></select></label><span class="slot-choices-title">Componentes permitidos</span><div class="slot-choices" data-slot-choices></div><p class="field-note">Un componente por espacio. Conserva la posición y el tamaño de la capa vinculada.</p></div><label class="full-field"><span>Nombre visible</span><input name="label" aria-label="Nombre visible" required maxlength="80" value="${esc(existing?.label ?? layers.find(n => n.id === targetId)?.name ?? 'Propiedad')}"/></label><label class="full-field"><span>Clave para el IDE y la IA</span><input name="key" aria-label="Clave de propiedad" required pattern="[A-Za-z][A-Za-z0-9_-]{0,63}" maxlength="64" ${key ? 'readonly' : ''} value="${esc(key ?? '')}" placeholder="titulo"/></label><p class="property-error" role="alert"></p><div class="dialog-actions"><button type="button" data-action="close-preview">Cancelar</button><button class="primary" type="submit">Guardar propiedad</button></div></form></div>`;
  const form = root.querySelector<HTMLFormElement>('form')!;
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
  const refresh = (preferred?: string) => {
    const layer = layers.find(n => n.id === field('target').value)!;
    const def = p.components.find(c => c.id === layer.instanceOf), axes = def?.set ? variantAxes(p, def.set) : {};
    const types = [...(['text', 'button', 'input'].includes(layer.type) ? [['text', 'Texto']] : []), ...(layer.type === 'icon' ? [['icon', 'Icono']] : []), ...(Object.keys(axes).length ? [['variant', 'Variante']] : []), ...(layer.instanceOf && !ancestors(p, layer.id).some(up => up.instanceOf) ? [['slot', 'Contenido (slot)']] : []), ['visibility', 'Visibilidad']];
    const chosen = preferred ?? field('type').value;
    field('type').innerHTML = types.map(([value, label]) => `<option value="${value}" ${value === chosen ? 'selected' : ''}>${label}</option>`).join('');
    field('axis').innerHTML = Object.keys(axes).map(axis => `<option ${existing?.type === 'variant' && existing.axis === axis ? 'selected' : ''}>${esc(axis)}</option>`).join('');
    (form.querySelector('[data-axis-label]') as HTMLElement).hidden = field('type').value !== 'variant';
    (form.querySelector('[data-slot-fields]') as HTMLElement).hidden = field('type').value !== 'slot';
    const choices = p.components.filter(candidate => candidate.id !== c.id);
    const allowed = existing?.type === 'slot' ? existing.allowedComponents : [layer.instanceOf];
    field('default').innerHTML = choices.map(candidate => `<option value="${esc(candidate.id)}" ${candidate.id === layer.instanceOf ? 'selected' : ''}>${esc(candidate.name)}</option>`).join('');
    form.querySelector('[data-slot-choices]')!.innerHTML = choices.map(candidate => `<label class="check-field"><input type="checkbox" data-slot-choice value="${esc(candidate.id)}" aria-label="Permitir ${esc(candidate.name)}" ${allowed.includes(candidate.id) ? 'checked' : ''}/>${esc(candidate.name)}</label>`).join('');
  };
  refresh(existing?.type);
  form.onchange = e => {
    if ((e.target as HTMLElement).getAttribute('name') === 'target') refresh();
    else {
      (form.querySelector('[data-axis-label]') as HTMLElement).hidden = field('type').value !== 'variant';
      (form.querySelector('[data-slot-fields]') as HTMLElement).hidden = field('type').value !== 'slot';
      if ((e.target as HTMLElement).getAttribute('name') === 'default') for (const option of form.querySelectorAll<HTMLInputElement>('[data-slot-choice]')) if (option.value === field('default').value) option.checked = true;
    }
  };
  form.onsubmit = e => {
    e.preventDefault();
    try {
      const property = { type: field('type').value, targetId: field('target').value, label: field('label').value.trim(), ...(field('type').value === 'variant' ? { axis: field('axis').value } : field('type').value === 'slot' ? { allowedComponents: [...form.querySelectorAll<HTMLInputElement>('[data-slot-choice]:checked')].map(option => option.value) } : {}) } as ComponentProperty;
      const newKey = field('key').value;
      if (!existing && Object.hasOwn(get().components.find(c => c.id === componentId)?.properties ?? {}, newKey)) throw new Error('Esa clave ya existe; edita la propiedad existente');
      commit(p => {
        if (property.type !== 'slot') defineComponentProperty(p, componentId, newKey, property);
        else {
          const current = p.nodes.find(n => n.id === property.targetId)?.instanceOf;
          // Define, set the default and narrow the allowed list in one atomic transaction.
          const temporary = { ...property, allowedComponents: [...new Set([...property.allowedComponents, ...(current ? [current] : [])])] };
          defineComponentProperty(p, componentId, newKey, temporary);
          setComponentProperty(p, c.masterId, newKey, field('default').value);
          defineComponentProperty(p, componentId, newKey, property);
        }
      }); close();
    } catch (error) { form.querySelector('[role="alert"]')!.textContent = error instanceof Error ? error.message : String(error); }
  };
  field(key ? 'label' : 'key').focus();
}
