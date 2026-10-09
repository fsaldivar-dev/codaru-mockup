import type { Project, DesignNode } from './model';
import { isUnavailable } from './model';
import { getComponentImplementations, setComponentImplementation } from './implementations';
import { escape as esc } from './render';

export function implementationPanel(p: Project, n: DesignNode, canOpen: boolean) {
  const context = getComponentImplementations(p, n.id);
  if (!context) return '';
  const owner = p.nodes.find(n => n.id === context.ownerId)!;
  const c = p.components.find(c => c.id === context.componentId)!;
  const author = !!owner.componentId && !isUnavailable(p, owner);
  const references = Object.entries(context.implementations);
  return `<section class="inspector-section implementation-panel"><div class="section-heading"><span>IMPLEMENTACIÓN</span></div><p class="field-note">${esc(context.componentName)} · ${owner.instanceOf ? 'Compartida con el maestro' : 'Referencias por plataforma'}</p>${references.map(([platform, ref]) => `<div class="public-property"><div class="property-heading"><strong>${esc(platform)}</strong>${author ? `<button data-implementation-edit="${esc(platform)}" data-implementation-component="${esc(c.id)}" aria-label="Editar implementación ${esc(platform)}">Editar</button><button data-implementation-remove="${esc(platform)}" data-implementation-component="${esc(c.id)}" aria-label="Desvincular implementación ${esc(platform)}">×</button>` : ''}</div><code class="implementation-symbol">${esc(ref.symbol)}</code>${ref.path || ref.module ? `<p class="field-note implementation-location">${esc(ref.path ?? ref.module)}</p>` : ''}<button class="wide-button" data-implementation-open="${esc(platform)}" data-implementation-node="${esc(n.id)}" aria-label="Abrir implementación ${esc(platform)}" ${canOpen ? '' : 'disabled'}>Abrir implementación ↗</button></div>`).join('')}${!references.length ? '<p class="field-note">Vincula este componente con un símbolo de tu aplicación.</p>' : !canOpen ? '<p class="field-note">La navegación estará disponible cuando el IDE la conecte.</p>' : ''}${author ? `<button class="wide-button" data-implementation-create="${esc(c.id)}">+ Vincular implementación</button>` : owner.instanceOf && p.nodes.some(n => n.id === c.masterId) ? `<button class="wide-button" data-select-master="${esc(c.masterId)}">Editar vínculos en el maestro</button>` : ''}</section>`;
}

export function openImplementationEditor(root: HTMLElement, get: () => Project, componentId: string, platform: string | undefined, commit: (edit: (p: Project) => void) => void, close: () => void) {
  const c = get().components.find(c => c.id === componentId); if (!c) return;
  const ref = platform ? c.implementations?.[platform] : undefined;
  root.innerHTML = `<div class="modal-backdrop"><form class="dialog property-dialog" role="dialog" aria-modal="true" aria-label="Vincular implementación"><button type="button" class="dialog-close icon-button" data-action="close-preview" aria-label="Cerrar">×</button><span class="eyebrow">${esc(c.name)}</span><h2>${ref ? 'Editar vínculo' : 'Vincular implementación'}</h2><p>Las instancias compartirán esta referencia. Tu IDE se encarga de abrirla.</p><label class="full-field"><span>Plataforma</span><input name="platform" aria-label="Plataforma" list="implementation-platforms" value="${esc(platform ?? 'ios')}" pattern="[a-z][a-z0-9-]{0,31}" maxlength="32" required ${platform ? 'readonly' : ''}/></label><datalist id="implementation-platforms">${['ios','android','web','macos','linux','windows'].map(p => `<option value="${p}"></option>`).join('')}</datalist><label class="full-field"><span>Símbolo o componente</span><input name="symbol" aria-label="Símbolo" value="${esc(ref?.symbol ?? '')}" maxlength="200" placeholder="CardView" required/></label><label class="full-field"><span>Archivo relativo al proyecto (opcional)</span><input name="path" aria-label="Archivo relativo" value="${esc(ref?.path ?? '')}" maxlength="512" placeholder="Sources/Views/CardView.swift"/></label><label class="full-field"><span>Paquete o módulo (opcional)</span><input name="module" aria-label="Módulo" value="${esc(ref?.module ?? '')}" maxlength="200" placeholder="DesignSystem"/></label><p class="property-error" role="alert"></p><div class="dialog-actions"><button type="button" data-action="close-preview">Cancelar</button><button class="primary" type="submit">Guardar vínculo</button></div></form></div>`;
  const form = root.querySelector<HTMLFormElement>('form')!;
  const value = (key: string) => (form.elements.namedItem(key) as HTMLInputElement).value.trim();
  form.onsubmit = event => {
    event.preventDefault();
    try {
      const key = value('platform');
      if (!platform && Object.hasOwn(get().components.find(c => c.id === componentId)?.implementations ?? {}, key)) throw new Error('Esa plataforma ya tiene un vínculo; edítalo desde el inspector');
      commit(p => setComponentImplementation(p, componentId, key, { symbol: value('symbol'), ...(value('path') ? { path: value('path') } : {}), ...(value('module') ? { module: value('module') } : {}) }));
      close();
    } catch (error) { form.querySelector('[role="alert"]')!.textContent = error instanceof Error ? error.message : String(error); }
  };
  (form.elements.namedItem('symbol') as HTMLInputElement).focus();
}
