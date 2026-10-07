import {
  Store, blank, clone, containerKinds, createComponent, instantiate,
  isUnavailable, labels, node, remove, updateNode, validate,
  type DesignNode, type Kind, type Project,
} from './model';
import { commonScope } from './selection';
// Pure helpers a host can use on a document without mounting anything.
export { screens, roleOf, pagesOf, pageView, type FrameRole, type Page } from './model';
import { exportHTML, exportSVG } from './render';
import type { AgentResponse, EditorOperation } from './embed';

export type EditorTool = Kind | 'cursor' | 'hand';
export type EditorMode = 'design' | 'flow' | 'system';
export interface EditorState {
  document: Project;
  selection: string[];
  scope: string | null;
  tool: EditorTool;
  mode: EditorMode;
  viewport: { zoom: number; pan: { x: number; y: number } };
  canUndo: boolean;
  canRedo: boolean;
}
export interface CreateEditorOptions {
  document?: Project;
  /** Called only for committed document changes, never for selection or camera changes. */
  onChange?: (document: Project) => void;
}
export interface CodaruEditor {
  getState(): EditorState;
  getDocument(): Project;
  getSelection(): DesignNode[];
  getSelectionScope(): string | null;
  select(ids: string[], scope?: string | null): void;
  enterScope(id: string | null): void;
  exitScope(): void;
  apply(operations: EditorOperation[]): Project;
  /** A single validated, undoable transaction. Retained draft references cannot mutate the editor. */
  commit(edit: (document: Project) => void): Project;
  importDocument(input: unknown): void;
  undo(): void;
  redo(): void;
  agent(command: string, params?: Record<string, unknown>): Promise<AgentResponse>;
  setTool(tool: EditorTool): void;
  setMode(mode: EditorMode): void;
  setViewport(viewport: { zoom?: number; pan?: { x: number; y: number } }): void;
  /** HTML and SVG export need a browser DOM for rendering and text measurement. */
  exportHTML(): string;
  exportSVG(frameId: string): string;
  /** Receives an immediate snapshot, then updates. Returns an unsubscribe function. */
  subscribe(listener: (state: EditorState) => void): () => void;
  /** Runs an action provided by the mounted editor view, such as fit or export-json. */
  command(action: string): Promise<void>;
  /** Flushes and disposes a mounted view, retaining the final document. Idempotent. */
  destroy(): Project;
}

/** @internal Shared by the DOM runtime and the standalone session. */
export interface EditorSessionState {
  selected: string[];
  selectionScope: string | null;
  tool: EditorTool;
  mode: EditorMode;
  zoom: number;
  pan: { x: number; y: number };
  grid: boolean;
}
/** @internal Only one interactive view may own transient gestures for a session. */
export interface EditorViewHooks {
  render(): void;
  camera(): void;
  flush(): void;
  isBusy(): boolean;
  /** Optional finer guard: camera changes preserve text fields, but cannot interrupt a gesture. */
  isInteracting?(): boolean;
  dispose(): void;
  command?(action: string): Promise<void>;
}
/** @internal The host-facing API never exposes mutable document references. */
export interface EditorSession {
  store: Store;
  state: EditorSessionState;
  notify(documentChanged?: boolean): void;
  assertActive(): void;
  hasView(): boolean;
  bindView(hooks: EditorViewHooks): () => void;
}
const sessions = new WeakMap<CodaruEditor, EditorSession>();

/** @internal */
export function getEditorSession(editor: CodaruEditor): EditorSession {
  const session = sessions.get(editor);
  if (!session) throw new Error('La sesión no pertenece a Codaru.');
  session.assertActive();
  return session;
}

/** Creates an isolated, DOM-free document session. Persistence belongs to the host. */
export function createEditor(options: CreateEditorOptions = {}): CodaruEditor {
  const store = new Store(options.document ?? blank());
  const state: EditorSessionState = {
    selected: [], selectionScope: null, tool: 'cursor', mode: 'design',
    zoom: .7, pan: { x: 0, y: 0 }, grid: true,
  };
  const listeners = new Set<(state: EditorState) => void>();
  let view: EditorViewHooks | undefined;
  let destroyed = false, destroying = false, finalDocument: Project | undefined;
  let dispatching = false, queued = false, pendingDocumentChange = false;
  let lastDocument = store.serialize();
  let lastState = JSON.stringify(stateSnapshot());
  const onChange = options.onChange;

  function assertActive() { if (destroyed) throw new Error('El editor ya fue desmontado.'); }
  function assertWritable() {
    assertActive();
    if (view?.isBusy()) throw new Error('El editor está ocupado. Termina la interacción antes de modificar el documento.');
  }
  function find(id: string) { return store.project.nodes.find(n => n.id === id); }
  function canEnter(id: string) {
    const n = find(id);
    return !!n && containerKinds.includes(n.type) && !isUnavailable(store.project, n);
  }
  function normalizeSelection() {
    state.selected = [...new Set(state.selected)].filter(id => !!find(id));
    if (state.selected.length) state.selectionScope = commonScope(store.project, state.selected);
    while (state.selectionScope && !canEnter(state.selectionScope)) state.selectionScope = find(state.selectionScope)?.parentId ?? null;
    state.selected = state.selected.filter(id => find(id)?.parentId === state.selectionScope);
  }
  // Everything but the document: cheap to compare on every camera or selection change.
  function stateSnapshot(): Omit<EditorState, 'document'> {
    return {
      selection: [...state.selected], scope: state.selectionScope,
      tool: state.tool, mode: state.mode, viewport: { zoom: state.zoom, pan: { ...state.pan } },
      canUndo: !!store.undoStack.length, canRedo: !!store.redoStack.length,
    };
  }
  function snapshot(): EditorState { return { document: clone(store.project), ...stateSnapshot() }; }
  // Host callback errors must not roll back a transaction or block other subscribers.
  function safely(callback: () => void) {
    try { callback(); } catch (error) { console.error('Codaru: error en una suscripción del anfitrión.', error); }
  }
  function scheduleNotification() {
    if (queued || destroyed) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!destroyed) notify();
    });
  }
  function notify(documentChanged = false) {
    if (destroyed) return;
    pendingDocumentChange ||= documentChanged;
    if (dispatching) { scheduleNotification(); return; }
    // The document is only serialized when a commit says it may have changed, and only cloned for whoever listens.
    const partial = stateSnapshot(), signature = JSON.stringify(partial);
    const documentSignature = pendingDocumentChange ? store.serialize() : lastDocument;
    const changed = pendingDocumentChange && documentSignature !== lastDocument;
    pendingDocumentChange = false;
    if (changed) lastDocument = documentSignature;
    const stateChanged = signature !== lastState || changed;
    lastState = signature;
    if (!changed && !stateChanged) return;
    dispatching = true;
    try {
      if (changed && onChange) safely(() => onChange(clone(store.project)));
      if (stateChanged) for (const listener of [...listeners]) {
        if (destroyed) break;
        if (listeners.has(listener)) safely(() => listener({ document: clone(store.project), ...clone(partial) }));
      }
    } finally { dispatching = false; }
  }
  function render(documentChanged = false, cameraOnly = false) {
    normalizeSelection();
    try {
      if (cameraOnly) view?.camera(); else view?.render();
    } finally { notify(documentChanged); }
  }
  function commit(edit: (document: Project) => void): Project {
    assertWritable();
    store.commit(edit);
    render(true);
    return clone(store.project);
  }
  function select(ids: string[], scope?: string | null) {
    assertActive();
    if (scope !== undefined && scope !== null && !canEnter(scope)) throw new Error('Ámbito de selección inválido.');
    let next = [...new Set(ids)].filter(id => !!find(id));
    const nextScope = scope === undefined ? next.length ? commonScope(store.project, next) : state.selectionScope : scope;
    next = next.map(id => {
      let n = find(id)!;
      while (n.parentId !== nextScope && n.id !== nextScope && n.parentId) n = find(n.parentId)!;
      return n.parentId === nextScope ? n.id : '';
    }).filter(Boolean);
    next = [...new Set(next)];
    if (nextScope === state.selectionScope && JSON.stringify(next) === JSON.stringify(state.selected)) return;
    assertWritable();
    state.selectionScope = nextScope; state.selected = next;
    render();
  }
  function requireDOM() {
    if (typeof document === 'undefined') throw new Error('La exportación HTML/SVG necesita un DOM de navegador. Usa exportación JSON en una sesión sin interfaz.');
  }
  const editor: CodaruEditor = {
    getState() { assertActive(); return snapshot(); },
    getDocument() { assertActive(); return clone(store.project); },
    getSelection() { assertActive(); return state.selected.flatMap(id => { const n = find(id); return n ? [clone(n)] : []; }); },
    getSelectionScope() { assertActive(); return state.selectionScope; },
    select,
    enterScope(id) {
      assertWritable();
      if (id !== null && !canEnter(id)) throw new Error('Selecciona un contenedor visible y desbloqueado para entrar.');
      state.tool = 'cursor'; state.selected = []; state.selectionScope = id;
      render();
    },
    exitScope() {
      assertWritable();
      const scope = state.selectionScope ? find(state.selectionScope) : undefined;
      state.tool = 'cursor'; state.selected = scope ? [scope.id] : []; state.selectionScope = scope?.parentId ?? null;
      render();
    },
    apply(operations) {
      return commit(project => {
        for (const op of operations) {
          switch (op.op) {
            case 'add': project.nodes.push(node(op.node.type, op.node)); break;
            case 'update':
              if (['id', 'type', 'componentId', 'instanceOf', 'componentKey', 'overrides'].some(key => key in op.patch)) throw new Error('Estos campos requieren una operación explícita.');
              updateNode(project, op.id, op.patch); break;
            case 'remove': remove(project, op.ids); break;
            case 'component': createComponent(project, op.id); break;
            case 'instance': instantiate(project, op.componentId, op.parentId, op.x, op.y); break;
            default: throw new Error('Operación de editor desconocida.');
          }
        }
      });
    },
    commit,
    importDocument(input) {
      assertWritable();
      const next = validate(input);
      store.commit(project => Object.assign(project, next));
      state.selected = []; state.selectionScope = null;
      render(true);
    },
    undo() { assertWritable(); store.undo(); render(true); },
    redo() { assertWritable(); store.redo(); render(true); },
    async agent(command, params = {}) {
      assertActive();
      const { handleAgentRequest } = await import('./agent');
      assertActive();
      return handleAgentRequest({
        project: () => { assertActive(); return store.project; },
        selection: () => [...state.selected], scope: () => state.selectionScope,
        busy: () => destroyed || !!view?.isBusy(), commit: edit => { commit(edit); },
        select, undo: editor.undo, redo: editor.redo,
      }, { command, params }) as Promise<AgentResponse>;
    },
    setTool(tool) {
      assertActive();
      if (tool !== 'cursor' && tool !== 'hand' && !Object.hasOwn(labels, tool)) throw new Error('Herramienta desconocida.');
      if (state.tool === tool) return;
      assertWritable();
      state.tool = tool; render();
    },
    setMode(mode) {
      assertActive();
      if (mode !== 'design' && mode !== 'flow' && mode !== 'system') throw new Error('Modo de editor inválido.');
      if (state.mode === mode) return;
      assertWritable();
      state.mode = mode; render();
    },
    setViewport(viewport) {
      assertActive();
      const zoom = viewport.zoom ?? state.zoom, pan = viewport.pan ?? state.pan;
      if (!Number.isFinite(zoom) || zoom <= 0 || !Number.isFinite(pan.x) || !Number.isFinite(pan.y)) throw new Error('El zoom y las coordenadas deben ser números finitos; el zoom debe ser positivo.');
      const boundedZoom = Math.max(.1, Math.min(8, zoom));
      if (boundedZoom === state.zoom && pan.x === state.pan.x && pan.y === state.pan.y) return;
      if (view && (view.isInteracting?.() ?? view.isBusy())) throw new Error('El editor está ocupado. Termina el gesto antes de cambiar la vista.');
      state.zoom = boundedZoom; state.pan = { ...pan }; render(false, true);
    },
    exportHTML() { assertActive(); requireDOM(); return exportHTML(store.project); },
    exportSVG(frameId) {
      assertActive(); requireDOM();
      const frame = find(frameId);
      if (frame?.type !== 'frame') throw new Error('La exportación SVG requiere una pantalla.');
      return exportSVG(store.project, frame);
    },
    subscribe(listener) {
      assertActive(); listeners.add(listener);
      const wasDispatching = dispatching;
      dispatching = true;
      try { safely(() => listener(snapshot())); } finally { dispatching = wasDispatching; }
      return () => { listeners.delete(listener); };
    },
    async command(action) {
      assertActive();
      if (!view?.command) throw new Error('Esta acción necesita una vista montada del editor.');
      if (action !== 'close-preview') assertWritable();
      await view.command(action);
    },
    destroy() {
      if (destroyed || destroying) return clone(finalDocument ?? store.project);
      destroying = true;
      try {
        try { view?.flush(); } finally { view?.dispose(); }
      } finally {
        finalDocument = clone(store.project);
        destroyed = true; destroying = false; view = undefined; listeners.clear();
      }
      return clone(finalDocument);
    },
  };
  sessions.set(editor, {
    store, state, notify, assertActive,
    hasView() { assertActive(); return !!view; },
    bindView(hooks) {
      assertActive();
      if (view) throw new Error('Esta sesión ya tiene un lienzo montado. Desmóntalo antes de montar otro.');
      view = hooks;
      return () => { if (view === hooks) view = undefined; };
    },
  });
  return editor;
}
