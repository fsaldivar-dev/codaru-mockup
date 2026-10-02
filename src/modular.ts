import { type CodaruEditor, getEditorSession } from './editor-core';
import { createEditorRuntime } from './editor-runtime';
import type { CodaruInvoke } from './embed';
import { applyAppearance, type EditorAppearance } from './ui-theme';
import { viewbarParts, type EditorPart } from './view-dom';
import baseStyles from './style.css?inline';
import fragmentStyles from './fragment-style.css?inline';

export { createEditor } from './editor-core';
export type { CodaruEditor, EditorState, EditorTool, EditorMode } from './editor-core';
export type { EditorPart } from './view-dom';
export { applyAppearance, editorAppearanceDefaults } from './ui-theme';
export type { EditorAppearance, EditorAppearanceTokens } from './ui-theme';
export type { Project, DesignNode, Kind, Component } from './model';

export interface EditorViewOptions {
  /** Editor chrome only. Project theme tokens are independent. */
  appearance?: EditorAppearance;
  /** The document that owns all fragment containers. Defaults to window.document. */
  ownerDocument?: Document;
  invoke?: CodaruInvoke;
  nativeAgent?: boolean;
}
export interface FragmentHandle {
  element: HTMLElement;
  setAppearance(appearance: EditorAppearance): void;
  /** Remove this fragment. Session, history and other fragments remain alive. */
  destroy(): void;
}
export interface EditorView {
  /**
   * One active mounting per part; unmount and mount again to relocate.
   * modes, designTheme and fit belong to viewbar until mounted separately, and return to it when destroyed.
   */
  mount(part: EditorPart, container: HTMLElement, options?: { appearance?: EditorAppearance }): FragmentHandle;
  setAppearance(appearance: EditorAppearance): void;
  fit(selectionOnly?: boolean): void;
  /** Flush focused edits and unmount all fragments; retain the editor session. */
  destroy(): void;
}

/** Reuse any subset of the UI with one shared document, selection and history. */
export function createEditorView(editor: CodaruEditor, options: EditorViewOptions = {}): EditorView {
  const session = getEditorSession(editor);
  if (session.hasView()) throw new Error('Esta sesión ya tiene una vista montada.');
  const owner = options.ownerDocument ?? document;
  const app = owner.createElement('div');
  const mounted = new Map<EditorPart, FragmentHandle>();
  let disposed = false, appearance = options.appearance ?? {};
  const runtime = createEditorRuntime({ app, editor, modular: true, invoke: options.invoke, nativeAgent: options.nativeAgent, onDispose: () => { disposed = true; for (const handle of mounted.values()) handle.destroy(); mounted.clear(); } });
  function assertActive() { if (disposed) throw new Error('La vista fue desmontada.'); getEditorSession(editor).assertActive(); }
  function destroy() {
    if (disposed) return;
    // The runtime flushes in-progress fields before listeners or nodes are removed.
    runtime.dispose(); disposed = true;
    for (const handle of mounted.values()) handle.destroy();
    mounted.clear();
  }
  return {
    mount(part, container, config = {}) {
      assertActive();
      if (!Object.hasOwn(runtime.parts, part)) throw new Error(`Parte desconocida: ${part}`);
      if (mounted.has(part)) throw new Error(`La parte ${part} ya está montada.`);
      if (container.ownerDocument !== owner) throw new Error('Todas las partes deben pertenecer al mismo documento.');
      const element = owner.createElement('div'); element.dataset.codaruPart = part;
      element.style.cssText = viewbarParts.includes(part)
        ? 'display:inline-flex;align-items:stretch;min-width:0;vertical-align:middle;'
        : 'display:block;width:100%;height:100%;min-width:0;min-height:0;';
      const shadow = element.attachShadow({ mode: 'open' });
      const style = owner.createElement('style'); style.textContent = baseStyles + '\n' + fragmentStyles;
      const content = runtime.parts[part]; content.setAttribute('part', part);
      shadow.append(style, content);
      applyAppearance(element, appearance); if (config.appearance) applyAppearance(element, config.appearance);
      container.append(element);
      let removed = false;
      const handle: FragmentHandle = {
        element,
        setAppearance(next) { assertActive(); if (removed) throw new Error('La parte fue desmontada.'); applyAppearance(element, next); },
        destroy() {
          if (removed) return;
          const active = shadow.activeElement as HTMLElement | null; active?.blur();
          if (part === 'dialogs' && !disposed) runtime.dismissDialogs();
          removed = true; content.remove(); runtime.restorePart(part); element.remove(); mounted.delete(part);
        },
      };
      mounted.set(part, handle); runtime.refresh();
      return handle;
    },
    setAppearance(next) {
      assertActive(); appearance = { ...appearance, ...next, tokens: { ...appearance.tokens, ...next.tokens } };
      for (const handle of mounted.values()) handle.setAppearance(next);
    },
    fit(selectionOnly = false) { assertActive(); runtime.fit(selectionOnly); },
    destroy,
  };
}
