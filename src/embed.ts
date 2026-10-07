import type { DesignNode, Kind, Project } from './model';
// Pure helpers a host can use on a document; the headless SVG renderer lives in `codaru-mockup/svg`.
export { screens, roleOf, pagesOf, pageView, type FrameRole, type Page, type ScreenInfo } from './model';

export type CodaruInvoke = <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;
export interface EmbeddedOptions {
  document?: Project;
  invoke?: CodaruInvoke;
  nativeAgent?: boolean;
  onChange?: (document: Project) => void;
}
export type EditorOperation =
  | { op: 'add'; node: Partial<DesignNode> & { type: Kind } }
  | { op: 'update'; id: string; patch: Partial<DesignNode> }
  | { op: 'remove'; ids: string[] }
  | { op: 'component'; id: string }
  | { op: 'instance'; componentId: string; parentId: string | null; x: number; y: number };
export interface AgentResponse {
  ok: boolean;
  context?: { revision: string; [key: string]: unknown };
  error?: { code: string; message: string };
  [key: string]: unknown;
}
export interface EditorAPI {
  getDocument(): Project;
  getSelection(): DesignNode[];
  getSelectionScope(): string | null;
  select(ids: string[]): void;
  apply(operations: EditorOperation[]): Project;
  agent(command: string, params?: Record<string, unknown>): Promise<AgentResponse>;
  importDocument(input: unknown): void;
  undo(): void | Promise<void>;
  redo(): void | Promise<void>;
  exportHTML(): string;
}
interface EmbeddedEditorAPI extends EditorAPI {
  initializeEmbedded(options: EmbeddedOptions): void | Promise<void>;
  disposeEmbedded(): Project | Promise<Project>;
}
export interface MountCodaruOptions extends EmbeddedOptions {
  /** Same-origin editor page. Defaults to the editor distributed beside this module. */
  editorUrl?: string | URL;
  /** null (the default) never reads or writes the standalone editor's draft. */
  storageKey?: string | null;
  /** Also reported as a bubbling `codaru:error` CustomEvent on the iframe. */
  onError?: (error: Error) => void;
}
export interface CodaruHandle {
  element: HTMLIFrameElement;
  ready: Promise<EditorAPI>;
  /** Flushes committed data, returns its snapshot, and removes the iframe. Idempotent. */
  destroy(): Promise<Project | undefined>;
}
export type MountedEditor = CodaruHandle;

/** Mount the full editor without applying editor styles or keyboard listeners to the host. */
export function mountCodaru(container: HTMLElement, options: MountCodaruOptions = {}): CodaruHandle {
  const hostDocument = container.ownerDocument, hostWindow = hostDocument.defaultView;
  if (!hostWindow) throw new Error('El contenedor debe pertenecer a una ventana.');
  const url = options.editorUrl === undefined ? new URL(/* @vite-ignore */ './editor/index.html', import.meta.url) : new URL(options.editorUrl, hostDocument.baseURI);
  const hostURL = new URL(hostWindow.location.href);
  if (url.origin !== hostURL.origin || (url.origin === 'null' && (url.protocol !== hostURL.protocol || url.host !== hostURL.host))) throw new Error('Codaru requiere una URL del mismo origen que la aplicación anfitriona.');
  if (options.storageKey !== undefined && options.storageKey !== null && (typeof options.storageKey !== 'string' || !options.storageKey.length)) throw new Error('storageKey debe ser una clave no vacía o null.');
  url.searchParams.set('codaruEmbed', '1');
  if (options.storageKey == null) url.searchParams.delete('storageKey'); else url.searchParams.set('storageKey', options.storageKey);
  const initialDocument = options.document === undefined ? undefined : structuredClone(options.document);
  const iframe = hostDocument.createElement('iframe');
  iframe.title = 'Editor de mockups Codaru'; iframe.loading = 'eager';
  iframe.style.cssText = 'display:block;width:100%;height:100%;border:0;';
  iframe.dataset.codaruStatus = 'loading';
  let api: EmbeddedEditorAPI | undefined, initialization: Promise<void> | undefined;
  let destroyed = false, loaded = false, settled = false, disposal: Promise<Project | undefined> | undefined;
  let resolveReady!: (api: EditorAPI) => void, rejectReady!: (reason: Error) => void;
  const ready = new Promise<EditorAPI>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // An early destroy is an expected lifecycle action even if a host hasn't awaited ready yet.
  void ready.catch(() => {});
  const asError = (error: unknown) => error instanceof Error ? error : new Error(String(error));
  function report(error: Error) {
    iframe.dispatchEvent(new CustomEvent('codaru:error', { detail: error, bubbles: true }));
    options.onError?.(error);
  }
  function destroy(): Promise<Project | undefined> {
    if (disposal) return disposal;
    destroyed = true;
    iframe.removeEventListener('load', onLoad); iframe.removeEventListener('error', onLoadError);
    if (!settled) { settled = true; rejectReady(new DOMException('El editor se desmontó antes de estar listo.', 'AbortError')); }
    disposal = (async () => {
      try {
        // Initialization may be asynchronous; do not let it restart resources after disposal.
        if (initialization) await initialization.catch(() => {});
        return api ? structuredClone(await api.disposeEmbedded()) : undefined;
      } finally { iframe.dataset.codaruStatus = 'disposed'; iframe.remove(); }
    })();
    return disposal;
  }
  function fail(error: Error) {
    if (destroyed) return;
    iframe.dataset.codaruStatus = 'error';
    if (!settled) { settled = true; rejectReady(error); }
    // Retain the original API for its final snapshot; a navigation never initializes a new editor.
    try { report(error); } finally { void destroy().catch(() => {}); }
  }
  async function onLoad() {
    if (destroyed) return;
    if (loaded) { fail(new Error('El iframe de Codaru se recargó. El montaje se cerró para conservar el documento anterior; monta otra instancia con su snapshot.')); return; }
    loaded = true;
    try {
      const candidate = (iframe.contentWindow as (Window & { codaru?: EmbeddedEditorAPI }) | null)?.codaru;
      if (!candidate || typeof candidate.initializeEmbedded !== 'function' || typeof candidate.disposeEmbedded !== 'function' || typeof candidate.getDocument !== 'function') throw new Error('La página no expone una API embebible de Codaru compatible.');
      api = candidate;
      initialization = Promise.resolve(candidate.initializeEmbedded({
        ...(initialDocument === undefined ? {} : { document: initialDocument }),
        ...(options.invoke === undefined ? {} : { invoke: options.invoke }),
        ...(options.nativeAgent === undefined ? {} : { nativeAgent: options.nativeAgent }),
        onChange: document => { if (!destroyed) options.onChange?.(structuredClone(document)); },
      }));
      await initialization;
      if (destroyed) return;
      iframe.dataset.codaruStatus = 'ready'; settled = true; resolveReady(candidate);
    } catch (error) { fail(asError(error)); }
  }
  function onLoadError() { fail(new Error('No se pudo cargar el editor embebido de Codaru.')); }
  iframe.addEventListener('load', onLoad); iframe.addEventListener('error', onLoadError);
  iframe.src = url.href;
  container.append(iframe);
  return { element: iframe, ready, destroy };
}
