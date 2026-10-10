export type {ExperienceSpec,ExperienceReport,AccessibilitySpec,AnalyticsEventSpec} from './contracts';
import type { CodaruEditor } from './editor-core';
import type { ResourceRecord, ResourceServices } from './contracts';
export type { DesignStylePackage } from './contracts';
export type { ResourceCandidate, ResourceRecord, ResourceSummary, ResourceServices, ResourcePreview, ResourceReviewRequest, ResourceReviewVerdict } from './contracts';
import type { ComponentPropertyState, ComponentPropertyValue } from './component-properties';
export type { ComponentProperty, ComponentPropertyValue, ComponentPropertyState } from './component-properties';
import type { AssetOptions, AssetExport } from './asset-export';
import type { DesignNode, Project } from './model';
import type { AruSource, AruAsset, IllustrationRequest, ComponentImplementations, ImplementationReference, ImplementationRequest, AgentResponse, EditorOperation, CodaruInvoke } from './contracts';
export type { AruSource, AruAsset, IllustrationRequest, ComponentImplementations, ImplementationReference, ImplementationRequest, AgentRequest, AgentResponse, EditorOperation, CodaruInvoke } from './contracts';
import type { LocalizationConfig, LocalizationState, LocalizationIssue, TranslationRequest } from './localization';
import { applyAppearance, readAppearanceTokens, type EditorAppearance } from './ui-theme';
import { validateFontDefinitions } from './fonts';
export type { EditorAppearance, EditorAppearanceTokens } from './ui-theme';
export type { LocalizationConfig, LocalizationState, LocalizationIssue, TranslationRequest } from './localization';
// Pure helpers a host can use on a document; the headless SVG renderer lives in `codaru-mockup/svg`.
export { screens, roleOf, pagesOf, pageView, type FrameRole, type Page, type ScreenInfo } from './model';

export interface EmbeddedOptions {
  fonts?: import('./contracts').FontDefinition[];
  onCorrectionRequest?:(request:import('./contracts').CorrectionRequest)=>Promise<void>;
  resourceServices?: ResourceServices;
  onResourceLibraryChange?: (records: ResourceRecord[]) => void;
  document?: Project;
  invoke?: CodaruInvoke;
  nativeAgent?: boolean;
  onChange?: (document: Project) => void;
  localization?: LocalizationConfig | null;
  onImplementationRequest?: (request: ImplementationRequest) => void | Promise<void>;
  onIllustrationRequest?: (request: IllustrationRequest) => void | Promise<void>;
  onTranslationRequest?: (request: TranslationRequest) => void | Promise<void>;
}
export interface EditorAPI extends Pick<CodaruEditor,'getFonts'|'setFonts'|'registerFonts'|'loadFonts'|'getFontIssues'|'exportHTMLAsync'|'exportSVGAsync'|'getExperienceReport'|'setExperience'|'getCorrectionRequest'|'getComments'|'captureCommentAnchor'|'getCommentContext'|'subscribeComments'|'getStyles'|'getStyle'|'importStyle'|'applyStyle'|'getResourceLibrary'|'getResource'|'stageResource'|'reviewResource'|'requestResourceEdit'|'setResourceServices'|'insertResource'|'exportResource'> {
  getDocument(): Project;
  getPreviewDocument(): Project;
  getLocalization(): LocalizationConfig | null;
  getLocalizationState(): LocalizationState;
  getLocalizationIssues(): LocalizationIssue[];
  setLocalization(config: LocalizationConfig | null): void;
  setLocale(locale: string | null): void;
  requestTranslation(nodeId: string): Promise<void>;
  getImplementations(nodeId: string): ComponentImplementations | null;
  setImplementation(componentId: string, platform: string, reference: ImplementationReference | null): Project;
  requestImplementation(nodeId: string, platform: string): Promise<void>;
  requestIllustration(nodeId: string): Promise<void>;
  getComponentProperties(nodeId: string): ComponentPropertyState[];
  setComponentProperty(nodeId: string, key: string, value: ComponentPropertyValue | null): Project;
  getSelection(): DesignNode[];
  getSelectionScope(): string | null;
  select(ids: string[]): void;
  apply(operations: EditorOperation[]): Project;
  agent(command: string, params?: Record<string, unknown>): Promise<AgentResponse>;
  importDocument(input: unknown): void;
  undo(): void | Promise<void>;
  redo(): void | Promise<void>;
  exportHTML(): string;
  exportAsset(options?: Omit<AssetOptions, 'ids'> & { ids?: string[] }): Promise<AssetExport>;
}
interface EmbeddedEditorAPI extends EditorAPI {
  initializeEmbedded(options: EmbeddedOptions): void | Promise<void>;
  disposeEmbedded(): Project | Promise<Project>;
}
export interface MountCodaruOptions extends EmbeddedOptions {
  /** Shared chrome appearance; omitted tokens inherit --codaru-* from the host. */
  appearance?: EditorAppearance;
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
  /** Partial update, also allowed while loading. Does not change document themes. */
  setAppearance(appearance: EditorAppearance): void;
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
  // Resource paths belong to the host, even when the editor page lives elsewhere.
  const hostFonts = (definitions: import('./contracts').FontDefinition[]) => validateFontDefinitions(definitions).map(font => ({
    ...font, variants: font.variants.map(variant => ({ ...variant, source: 'url' in variant.source
      ? { url: new URL(variant.source.url, hostDocument.baseURI).href } : variant.source })),
  }));
  const initialFonts=options.fonts===undefined?undefined:hostFonts(options.fonts);
  const initialDocument = options.document === undefined ? undefined : structuredClone(options.document);
  const initialLocalization = options.localization === undefined ? undefined : structuredClone(options.localization);
  let appearance = structuredClone(options.appearance ?? {});
  const validationElement = hostDocument.createElement('div');
  applyAppearance(validationElement, appearance);
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
  function refreshAppearance() {
    const root = iframe.contentDocument?.documentElement;
    if (!root) return;
    const tokens = readAppearanceTokens(container);
    for (const [key, value] of Object.entries(appearance.tokens ?? {})) {
      if (value !== null && value !== undefined) Object.assign(tokens, { [key]: value });
    }
    applyAppearance(root, { ...appearance, tokens });
  }
  function setAppearance(next: EditorAppearance) {
    if (destroyed) throw new Error('El editor ya fue desmontado.');
    applyAppearance(validationElement, next);
    appearance = { ...appearance, ...next, tokens: { ...appearance.tokens, ...next.tokens } };
    if (loaded) refreshAppearance();
  }
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
      refreshAppearance();
      initialization = Promise.resolve(candidate.initializeEmbedded({
        ...(initialDocument === undefined ? {} : { document: initialDocument }),
        ...(options.invoke === undefined ? {} : { invoke: options.invoke }),
        ...(options.nativeAgent === undefined ? {} : { nativeAgent: options.nativeAgent }),
        ...(initialFonts===undefined?{}:{fonts:initialFonts}),
        ...(initialLocalization === undefined ? {} : { localization: initialLocalization }),
        resourceServices: options.resourceServices,
        onResourceLibraryChange: records => { if (!destroyed) options.onResourceLibraryChange?.(structuredClone(records)); },
        onTranslationRequest: options.onTranslationRequest,
        onImplementationRequest: options.onImplementationRequest,
        onIllustrationRequest: options.onIllustrationRequest,
        onCorrectionRequest:options.onCorrectionRequest,
        onChange: document => { if (!destroyed) options.onChange?.(structuredClone(document)); },
      }));
      await initialization;
      if (destroyed) return;
      const publicAPI = new Proxy(candidate, { get(target, key) {
        const value = Reflect.get(target, key);
        if (typeof value !== 'function') return value;
        if (key === 'setFonts' || key === 'registerFonts') return (definitions: import('./contracts').FontDefinition[]) => value.call(target, hostFonts(definitions));
        return value.bind(target);
      } });
      iframe.dataset.codaruStatus = 'ready'; settled = true; resolveReady(publicAPI);
    } catch (error) { fail(asError(error)); }
  }
  function onLoadError() { fail(new Error('No se pudo cargar el editor embebido de Codaru.')); }
  iframe.addEventListener('load', onLoad); iframe.addEventListener('error', onLoadError);
  iframe.src = url.href;
  container.append(iframe);
  return { element: iframe, ready, setAppearance, destroy };
}
