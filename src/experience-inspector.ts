import {setExperience} from './experience';
import type {Project} from './model';
import type {CodaruEditor} from './editor-core';
import {createExperienceView,type ExperiencePart} from './experience-view';
import {readAppearanceTokens} from './ui-theme';
/** Full-editor adapter. The same panels can also be mounted without this sheet. */
export function openExperienceEditor(root:HTMLElement,editor:CodaruEditor,appearanceSource:HTMLElement,commit:(edit:(p:Project)=>void)=>void,close:()=>void):()=>void {
 const doc=root.ownerDocument;
 root.innerHTML='<div class="modal-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-label="Contrato del producto" style="width:min(820px,90vw);max-height:85vh;overflow:auto;padding:20px"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><h2 style="margin:0">Contrato del producto</h2><button class="icon-button" data-action="close-preview" aria-label="Cerrar">×</button></div><p class="field-note">Accesibilidad, instrumentación y pruebas para el IDE.</p><nav aria-label="Contratos" style="display:flex;gap:8px;margin:16px 0"><button data-experience-tab="accessibility" aria-pressed="true">Accesibilidad</button><button data-experience-tab="analytics" aria-pressed="false">Analítica</button><button data-experience-tab="tests" aria-pressed="false">Pruebas</button></nav><div data-experience-slot="accessibility"></div><div data-experience-slot="analytics" hidden></div><div data-experience-slot="tests" hidden></div></section></div>';
 const view=createExperienceView(editor,{ownerDocument:doc,appearance:{tokens:readAppearanceTokens(appearanceSource)},commit:updates=>commit(p=>{for(const u of updates)setExperience(p,u.id,u.spec);})});
 for(const part of ['accessibility','analytics','tests'] as ExperiencePart[])view.mount(part,root.querySelector(`[data-experience-slot="${part}"]`)!);
 const onClick=(event:Event)=>{if((event.target as Element).closest('[data-action=close-preview]')){event.stopPropagation();close();return;}const button=(event.target as Element).closest<HTMLElement>('[data-experience-tab]');if(!button)return;try{view.flush();root.querySelectorAll<HTMLElement>('[data-experience-slot]').forEach(slot=>slot.hidden=slot.dataset.experienceSlot!==button.dataset.experienceTab);root.querySelectorAll('[data-experience-tab]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===button)));}catch(error){console.error(error);}};
 root.addEventListener('click',onClick);
 root.querySelector<HTMLButtonElement>('[data-experience-tab]')!.focus();
 return ()=>{view.destroy();root.removeEventListener('click',onClick);};
}
