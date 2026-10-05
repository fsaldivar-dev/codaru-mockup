import { color, labels, uid, updateNode, type DesignNode, type Project } from './model';
import { animationPresets, easingLabels, easings, startMotion, vectorLayers, type MotionKeyframe, type NodeAnimation } from './motion';
import { element, escape as esc } from './render';
import { effectiveTheme } from './themes';
import { closeColorPicker, pickColorFor } from './color-picker';

interface AnimatorOptions { root: HTMLElement; get: () => Project; nodeId: string; commit: (fn: (p: Project) => void) => void; undo: () => void; close: () => void; }
const numeric: [keyof MotionKeyframe, string, number, number, number][] = [['x', 'X', -10000, 10000, 1], ['y', 'Y', -10000, 10000, 1], ['scale', 'Escala', 0, 20, .01], ['rotate', 'Giro°', -3600, 3600, 1], ['opacity', 'Opac.', 0, 100, 1], ['draw', 'Trazo%', 0, 100, 1], ['shine', 'Brillo%', 0, 100, 1]];
const colors: ['fill' | 'stroke', string][] = [['fill', 'Relleno'], ['stroke', 'Borde']];
const layerNames: Record<string, string> = { g: 'Grupo', path: 'Trazado', rect: 'Rectángulo', circle: 'Círculo', ellipse: 'Elipse', line: 'Línea', polyline: 'Polilínea', polygon: 'Polígono', text: 'Texto', use: 'Símbolo' };

/** Keyframe animator for one element. Every committed field is one undo entry. */
export function openAnimator(options: AnimatorOptions) {
  const { root, get, nodeId, commit } = options;
  let selected = '', error = '', playing = true;
  const current = () => get().nodes.find(n => n.id === nodeId);
  const list = () => current()?.animations ?? [];
  const active = () => list().find(a => a.id === selected) ?? list()[0];
  function update(change: (animations: NodeAnimation[]) => void) {
    const next = structuredClone(list()); change(next);
    try { commit(p => updateNode(p, nodeId, { animations: next.length ? next : undefined })); error = ''; }
    catch (e) { error = e instanceof Error ? e.message : 'No se pudo guardar'; }
    draw();
  }
  const paint = (value: string, n: DesignNode) => { try { return color(get(), value, n); } catch { return '#ffffff'; } };
  const input = (label: string, field: string, value: string | number, extra = '') => `<label class="full-field"><span>${label}</span><input aria-label="${label}" data-an-field="${field}" value="${esc(value)}" ${typeof value === 'number' ? 'type="number"' : 'maxlength="80"'} ${extra}/></label>`;
  const select = (label: string, field: string, value: string, choices: [string, string][]) => `<label class="full-field"><span>${label}</span><select aria-label="${label}" data-an-field="${field}">${choices.map(([id, name]) => `<option value="${esc(id)}" ${id === value ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>`;
  function fields(n: DesignNode, a: NodeAnimation) {
    const layers: [string, string][] = [['', n.type === 'vector' ? 'Toda la ilustración' : 'Todo el elemento'], ...(n.svg ? vectorLayers(n.svg).map((l): [string, string] => [l.id, `${'· '.repeat(l.depth)}${layerNames[l.tag] ?? l.tag} · ${l.id}`]) : [])];
    return `${input('Nombre de la animación', 'name', a.name)}${select('Capa', 'target', a.target, layers)}
      <div class="field-grid">${select('Inicio', 'trigger', a.trigger, [['load', 'Al entrar en pantalla'], ['click', 'Al hacer clic']])}${select('Curva', 'easing', a.easing, easings.map(e => [e, easingLabels[e]]))}
      ${input('Duración ms', 'duration', a.duration, 'min="1" max="20000" step="50"')}${input('Retraso ms', 'delay', a.delay, 'min="0" max="20000" step="50"')}
      ${input('Repeticiones', 'iterations', a.iterations, 'min="0" max="100" step="1" title="0 repite sin fin"')}<label class="check-field"><input type="checkbox" data-an-field="alternate" ${a.alternate ? 'checked' : ''}/> Ida y vuelta</label></div>
      <p class="field-note">Repeticiones 0 = sin fin. Deja una celda vacía para no animar esa propiedad.</p>
      <div class="keyframes" role="table" aria-label="Fotogramas clave"><div class="keyframe-row keyframe-head" role="row"><span>%</span>${numeric.map(([, label]) => `<span>${label}</span>`).join('')}<span></span></div>
      ${a.keyframes.map((k, i) => `<div class="keyframe" role="row"><div class="keyframe-row"><input type="number" aria-label="Fotograma ${i + 1}: posición %" data-an-key="${i}:at" value="${k.at}" min="0" max="100"/>${numeric.map(([key, label, min, max, step]) => `<input type="number" aria-label="Fotograma ${i + 1}: ${label}" data-an-key="${i}:${key}" value="${k[key] ?? ''}" min="${min}" max="${max}" step="${step}"/>`).join('')}<button data-an="remove-key" data-index="${i}" aria-label="Quitar fotograma ${i + 1}" ${a.keyframes.length <= 2 ? 'disabled' : ''}>×</button></div>
        <div class="keyframe-colors">${colors.map(([key, label]) => { const value = k[key]; return `<label><span>${label}</span><button type="button" class="color-chip${value ? '' : ' unset'}" data-pick="Fotograma ${i + 1}: ${label.toLowerCase()}" aria-label="Fotograma ${i + 1}: ${label.toLowerCase()}, selector" title="Elegir color" style="--chip:${esc(value ? paint(value, n) : 'transparent')}"></button><input aria-label="Fotograma ${i + 1}: ${label.toLowerCase()}" data-an-key="${i}:${key}" value="${esc(value ?? '')}" placeholder="sin cambio" maxlength="40"/></label>`; }).join('')}</div></div>`).join('')}</div>
      <p class="field-note">Colores: HEX o un token del tema, como @muted. Para un esqueleto de carga alterna dos tonos de relleno o usa Brillo%.</p>
      <div class="button-row"><button data-an="add-key" ${a.keyframes.length >= 32 ? 'disabled' : ''}>+ Fotograma</button><button data-an="delete">Eliminar animación</button></div>`;
  }
  function stage(n: DesignNode) {
    const box = root.querySelector<HTMLElement>('.animator-stage')!;
    const el = element(get(), n, true); Object.assign(el.style, { position: 'relative', left: '0', top: '0', flex: 'none' });
    const ratio = Math.min(1, 300 / n.width, 300 / n.height);
    const holder = document.createElement('div'); Object.assign(holder.style, { width: `${n.width * ratio}px`, height: `${n.height * ratio}px` });
    el.style.transformOrigin = '0 0'; el.style.transform = `scale(${ratio})`; holder.append(el); box.replaceChildren(holder);
    if (playing) startMotion(el);
  }
  function draw() {
    const n = current(); if (!n) { options.close(); return; }
    const a = active(); selected = a?.id ?? '';
    root.innerHTML = `<div class="modal-backdrop"><section class="theme-dialog animator-dialog" role="dialog" aria-modal="true" aria-label="Animador">
      <header><div><span class="eyebrow">ANIMADOR · ${esc(labels[n.type].toUpperCase())}</span><h2>${esc(n.name)}</h2></div><button data-an="close" aria-label="Cerrar animador">Cerrar ×</button></header>
      <div class="animator-body"><aside class="animator-list"><div class="stops-heading">Animaciones <span>${list().length}</span></div>
        ${list().map(item => `<button data-an-select="${esc(item.id)}" class="${item.id === selected ? 'active' : ''}"><strong>${esc(item.name || 'Sin nombre')}</strong><small>${item.target ? esc(item.target) : 'Elemento'} · ${item.duration} ms${item.iterations === 0 ? ' · ∞' : ''}</small></button>`).join('') || '<p class="field-note">Aún no hay animaciones. Elige una base y ajústala.</p>'}
        <label class="full-field"><span>Añadir animación</span><select aria-label="Añadir animación" data-an="add"><option value="">Elegir base…</option>${Object.entries(animationPresets).map(([id, preset]) => `<option value="${id}">${preset.name}</option>`).join('')}</select></label></aside>
      <div class="animator-preview"><div class="animator-stage" aria-label="Vista previa de la animación"></div><div class="button-row"><button data-an="play">▶ Reproducir</button><button data-an="stop">■ Detener</button></div></div>
      <div class="animator-fields">${a ? fields(n, a) : '<p class="field-note">Selecciona o añade una animación para editar sus fotogramas clave.</p>'}${error ? `<p class="theme-error" role="alert">${esc(error)}</p>` : ''}</div></div>
      <footer><span>Las animaciones se reproducen en Presentar y en el HTML exportado. El lienzo permanece estático.</span><button data-an="undo">↶ Deshacer cambio</button><button data-an="close" class="primary">Listo</button></footer></section></div>`;
    stage(n);
  }
  root.onclick = e => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]'), n = current();
    if (chip && n) { pickColorFor(chip, { resolve: value => paint(value, n), tokens: Object.fromEntries(Object.keys(effectiveTheme(get(), n).tokens.colors).map(id => [id, paint('@' + id, n)])) }); return; }
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-an],[data-an-select]'); if (!el || el instanceof HTMLSelectElement) return;
    if (el.dataset.anSelect) { selected = el.dataset.anSelect; draw(); return; }
    const a = active();
    switch (el.dataset.an) {
      case 'close': closeColorPicker(); options.close(); break;
      case 'undo': options.undo(); error = ''; draw(); break;
      case 'play': playing = true; draw(); break;
      case 'stop': playing = false; draw(); break;
      case 'delete': if (a) update(next => { next.splice(next.findIndex(x => x.id === a.id), 1); }); break;
      case 'add-key': if (a) update(next => { const keys = next.find(x => x.id === a.id)!.keyframes, last = keys.at(-1)!, previous = keys.at(-2)!; keys.splice(keys.length - 1, 0, { ...previous, at: Math.round((previous.at + last.at) / 2 * 100) / 100 }); }); break;
      case 'remove-key': if (a) update(next => { next.find(x => x.id === a.id)!.keyframes.splice(Number(el.dataset.index), 1); }); break;
    }
  };
  root.onchange = e => {
    const el = e.target as HTMLInputElement | HTMLSelectElement, a = active();
    if (el.dataset.an === 'add') {
      const preset = animationPresets[el.value]; if (!preset) return;
      const id = uid(); update(next => { next.push({ id, target: a?.target ?? '', ...preset.make() }); }); if (!error) { selected = id; playing = true; draw(); }
      return;
    }
    if (!a) return;
    if (el.dataset.anField) {
      const field = el.dataset.anField as keyof NodeAnimation;
      const value = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el instanceof HTMLInputElement && el.type === 'number' ? Number(el.value) : el.value;
      update(next => { Object.assign(next.find(x => x.id === a.id)!, { [field]: value }); });
    } else if (el.dataset.anKey) {
      const [index, key] = el.dataset.anKey.split(':') as [string, keyof MotionKeyframe];
      update(next => {
        const frame = next.find(x => x.id === a.id)!.keyframes[Number(index)] as unknown as Record<string, unknown>;
        if (el.value.trim() === '' && key !== 'at') delete frame[key]; else frame[key] = key === 'fill' || key === 'stroke' ? el.value.trim() : Number(el.value);
      });
    }
  };
  root.onkeydown = e => { if (e.key === 'Escape') { e.stopPropagation(); options.close(); } };
  draw(); root.querySelector<HTMLElement>('[data-an="add"]')?.focus();
}
