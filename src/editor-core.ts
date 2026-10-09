import { applyIdentityOperation, emptyIdentityLab, identityIssues, identityTargetRevision, validateIdentityEvidence, exportIdentityPackage } from './identity';
import {applyCommentOperation,captureCommentAnchor,emptyComments,getCommentContext,commentChanges} from './comments';
import type {LayoutComments,CommentAnchor,CommentContext,CommentEvent} from './contracts';
export type {LayoutComments,CommentAnchor,CommentContext,CommentEvent,CommentAuthor,CommentThread,CommentMessage,CommentDraft,CommentReviewRequest} from './contracts';
import type { IdentityLab, IdentityBrief, IdentityReference, IdentityDirection, IdentityDecision, IdentityOperation, IdentityState, IdentityServices, IdentityServiceRequest, IdentityRequestOptions, IdentityRequestResult, IdentityPackage } from './contracts';
export type { IdentityLab, IdentityBrief, IdentityReference, IdentityDirection, IdentityDecision, IdentityOperation, IdentityState, IdentityServices, IdentityServiceRequest, IdentityRequestOptions, IdentityRequestResult, IdentityPackage, IdentityCritique, IdentityEvidence, IdentityRefinement, IdentityFinding } from './contracts';
import { parseStylePackage, importStylePackage, applyStylePackage, styleSummaries } from './style-package';
import { ResourceLibrary } from './resource-library';
import type { ResourceCandidate, ResourceRecord, ResourceSummary, ResourceServices } from './contracts';
export type { DesignStylePackage } from './contracts';
export type { ResourceCandidate, ResourceRecord, ResourceSummary, ResourceServices, ResourcePreview, ResourceReviewRequest, ResourceReviewVerdict } from './contracts';
import { applyAruAsset } from './aru';
import { getComponentImplementations, setComponentImplementation } from './implementations';
import { defineComponentProperty, removeComponentProperty, getComponentProperties, setComponentProperty, type ComponentPropertyState, type ComponentPropertyValue } from './component-properties';
export type { ComponentProperty, ComponentPropertyValue, ComponentPropertyState } from './component-properties';
import {
  Store, blank, clone, containerKinds, createComponent, instantiate,
  isUnavailable, labels, node, remove, updateNode, validate,
  type DesignNode, type Kind, type Project,
} from './model';
import { commonScope } from './selection';
import { normalizeLocalization, localizationState, localizationIssues, localizeProject, resolveText, type LocalizationConfig, type LocalizationState, type LocalizationIssue, type TranslationRequest } from './localization';
export type { LocalizationConfig, LocalizationState, LocalizationIssue, TranslationRequest } from './localization';
// Pure helpers a host can use on a document, and the headless SVG renderer (also alone in `codaru-mockup/svg`).
export { screens, roleOf, pagesOf, pageView, type FrameRole, type Page, type ScreenInfo } from './model';
export { renderScreenToSVG, renderScreenToDataURL, svgDataURL, type ScreenTheme, type RenderScreenOptions } from './screen-svg';
import { exportHTML, exportSVG } from './render';
import type { AssetOptions, AssetExport } from './asset-export';
import type { AruSource, AruAsset, IllustrationRequest, ComponentImplementations, ImplementationReference, ImplementationRequest, AgentResponse, EditorOperation } from './contracts';
export type { AruSource, AruAsset, IllustrationRequest, ComponentImplementations, ImplementationReference, ImplementationRequest, AgentRequest, AgentResponse, EditorOperation } from './contracts';

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
  localization: LocalizationState;
  canOpenImplementation: boolean;
  identityCapabilities: IdentityState['capabilities'];
}
export interface CreateEditorOptions {
  /** Local hook; the IDE decides whether to wake its AI. No network calls occur here. */
  onCommentEvent?: (event:CommentEvent)=>void;
  identityServices?: IdentityServices;
  resourceServices?: ResourceServices;
  /** Explicit persistence: catalogue changes are independent of the design document. */
  onResourceLibraryChange?: (records: ResourceRecord[]) => void;
  document?: Project;
  /** Called only for committed document changes, never for selection or camera changes. */
  onChange?: (document: Project) => void;
  localization?: LocalizationConfig | null;
  /** An intent: the host resolves and opens its own implementation files or symbols. */
  onImplementationRequest?: (request: ImplementationRequest) => void | Promise<void>;
  onIllustrationRequest?: (request: IllustrationRequest) => void | Promise<void>;
  /** An intent: the host opens/edits its own translation files and supplies a refreshed catalog. */
  onTranslationRequest?: (request: TranslationRequest) => void | Promise<void>;
}
export interface CodaruEditor {
  getComments():LayoutComments;
  captureCommentAnchor(ids?:string[]):CommentAnchor;
  getCommentContext(id:string):CommentContext;
  /** No replay on subscribe. De-duplicate message IDs when persisting IDE jobs. */
  subscribeComments(listener:(event:CommentEvent)=>void):()=>void;
  getIdentityLab(): IdentityLab | null;
  getIdentityState(): IdentityState;
  updateIdentityBrief(patch: Partial<IdentityBrief>): Project;
  upsertIdentityReference(reference: IdentityReference): Project;
  upsertIdentityDirection(direction: IdentityDirection): Project;
  addIdentityDecision(decision: IdentityDecision): Project;
  applyIdentity(operation: IdentityOperation): Project;
  setIdentityServices(services: IdentityServices): void;
  requestIdentity(request: IdentityRequestOptions): Promise<IdentityRequestResult>;
  exportIdentity(): IdentityPackage;
  getStyles(): ReturnType<typeof styleSummaries>;
  getStyle(id:string): import('./contracts').DesignStylePackage | null;
  importStyle(input:unknown): Project;
  applyStyle(id:string, options?:{frameId?:string;mode?:'light'|'dark'}): Project;
  getResourceLibrary(): Promise<ResourceSummary[]>;
  getResource(id: string): Promise<ResourceRecord | null>;
  stageResource(resource: ResourceCandidate): Promise<string>;
  reviewResource(id: string): Promise<ResourceSummary>;
  requestResourceEdit(id: string): Promise<void>;
  setResourceServices(services: ResourceServices): void;
  insertResource(id: string, placement?: {parentId?:string|null;x?:number;y?:number;width?:number}): Promise<Project>;
  exportResource(id: string, options?: Omit<AssetOptions, 'ids'>): Promise<AssetExport>;
  getState(): EditorState;
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
  exportAsset(options?: Omit<AssetOptions, 'ids'> & { ids?: string[] }): Promise<AssetExport>;
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
  resources?(): void;
  flush(): void;
  isBusy(): boolean;
  /** Optional finer guard: camera changes preserve text fields, but cannot interrupt a gesture. */
  isInteracting?(): boolean;
  dispose(): void;
  command?(action: string): Promise<void>;
  localizationIssues?(): LocalizationIssue[];
}
/** @internal The host-facing API never exposes mutable document references. */
export interface EditorExtensionHooks {
  flush(): void; dispose(): void; isBusy?(): boolean;
  /** Cheap invalidation: optional panels read the live session without cloning a document per gesture. */
  notify?(): void;
}
export interface EditorSession {
  /** Optional panels share lifecycle without taking ownership of the canvas view. */
  bindExtension(hooks: EditorExtensionHooks): () => void;
  identityCapabilities(): IdentityState['capabilities'];
  store: Store;
  setResourceRenderer(renderer: ResourceServices['render']): void;
  setResourceLibraryHandler(callback: CreateEditorOptions['onResourceLibraryChange']): void;
  state: EditorSessionState;
  notify(documentChanged?: boolean): void;
  assertActive(): void;
  previewProject(): Project;
  localization(): LocalizationConfig | null;
  canOpenImplementation(): boolean;
  canOpenIllustration(): boolean;
  setIllustrationHandler(callback: CreateEditorOptions['onIllustrationRequest']): void;
  setImplementationHandler(callback: CreateEditorOptions['onImplementationRequest']): void;
  setTranslationHandler(callback: CreateEditorOptions['onTranslationRequest']): void;
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
  let localization = normalizeLocalization(options.localization ?? null), localizationRevision = 0;
  let implementationHandler = options.onImplementationRequest;
  let illustrationHandler = options.onIllustrationRequest;
  let translationHandler = options.onTranslationRequest;
  const localeState = () => localizationState(localization, localizationRevision, !!translationHandler);
  const previewProject = () => localizeProject(store.project, localization);
  const state: EditorSessionState = {
    selected: [], selectionScope: null, tool: 'cursor', mode: 'design',
    zoom: .7, pan: { x: 0, y: 0 }, grid: true,
  };
  const listeners = new Set<(state: EditorState) => void>();
  let view: EditorViewHooks | undefined;
  const extensions = new Set<EditorExtensionHooks>();
  let identityServices = {...options.identityServices}, identityGeneration = 0;
  const commentListeners=new Set<(event:CommentEvent)=>void>();
  let lastComments=store.project.comments,commentSequence=0,commentHistory=false;
  const identityRequests = new Set<AbortController>();
  const isBusy = () => !!view?.isBusy() || [...extensions].some(e=>e.isBusy?.());
  let destroyed = false, destroying = false, finalDocument: Project | undefined;
  let dispatching = false, queued = false, pendingDocumentChange = false;
  let resourceChangeHandler = options.onResourceLibraryChange;
  let resourceServices = {...options.resourceServices};
  let resourceRenderer: ResourceServices['render'];
  const resources = new ResourceLibrary({ document: () => store.project, services: resourceServices, active: () => !destroyed, changed: records => { try { resourceChangeHandler?.(records); } finally { view?.resources?.(); } } });
  function setResourceRenderer(renderer: ResourceServices['render']) { resourceRenderer = renderer; resources.setServices({...resourceServices,render:resourceServices.render ?? resourceRenderer}); }
  let lastDocument = store.serialize();
  let lastState = JSON.stringify(stateSnapshot());
  const onChange = options.onChange;

  function assertActive() { if (destroyed) throw new Error('El editor ya fue desmontado.'); }
  function assertWritable() {
    assertActive();
    if (isBusy()) throw new Error('El editor está ocupado. Termina la interacción antes de modificar el documento.');
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
      localization: localeState(), canOpenImplementation: !!implementationHandler,
      identityCapabilities:{research:!!identityServices.research,explore:!!identityServices.explore,review:!!identityServices.render&&!!identityServices.review,refine:!!identityServices.refine},
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
      if(changed){const events=commentHistory?[{type:'comments.restored' as const}]:commentChanges(lastComments,store.project.comments);lastComments=store.project.comments;for(const e of events){const event={...e,sequence:++commentSequence};if(options.onCommentEvent)safely(()=>options.onCommentEvent!(clone(event)));for(const listener of [...commentListeners])if(commentListeners.has(listener))safely(()=>listener(clone(event)));}}
      if (stateChanged) for (const hooks of [...extensions]) if (extensions.has(hooks)) safely(()=>hooks.notify?.());
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
    getComments(){assertActive();return clone(store.project.comments??emptyComments());},
    captureCommentAnchor(ids=state.selected){assertActive();return captureCommentAnchor(store.project,ids);},
    getCommentContext(id){assertActive();return getCommentContext(store.project,id);},
    subscribeComments(listener){assertActive();commentListeners.add(listener);return ()=>commentListeners.delete(listener);},
    getIdentityLab() { assertActive(); return clone(store.project.identityLab ?? null); },
    getIdentityState() { assertActive(); return {lab:editor.getIdentityLab(),issues:identityIssues(store.project),capabilities:{research:!!identityServices.research,explore:!!identityServices.explore,review:!!identityServices.render&&!!identityServices.review,refine:!!identityServices.refine}}; },
    updateIdentityBrief(patch) { return editor.applyIdentity({op:'identity.brief.set',patch}); },
    upsertIdentityReference(reference) { return editor.applyIdentity({op:'identity.reference.put',reference}); },
    upsertIdentityDirection(direction) { return editor.applyIdentity({op:'identity.direction.put',direction}); },
    addIdentityDecision(decision) { return editor.applyIdentity({op:'identity.decision.add',decision}); },
    applyIdentity(operation) { return commit(p=>applyIdentityOperation(p,operation)); },
    setIdentityServices(services) { assertActive(); identityGeneration++; identityRequests.forEach(r=>r.abort()); identityServices={...services}; notify(true); },
    exportIdentity() { assertActive(); return exportIdentityPackage(store.project); },
    async requestIdentity(input) {
      assertWritable();
      const request=clone(input);
      if(!['research','explore','review','refine'].includes(request.action))throw new Error('Acción Identity Lab desconocida.');
      if(request.instruction!==undefined&&(typeof request.instruction!=='string'||request.instruction.length>4000))throw new Error('Instrucción inválida.');
      if(request.nodeIds!==undefined&&(!Array.isArray(request.nodeIds)||request.nodeIds.length>100||request.nodeIds.some(id=>typeof id!=='string')))throw new Error('Selección de refinamiento inválida.');
      const document=clone(store.project),before=store.project,generation=identityGeneration,services={...identityServices},controller=new AbortController();
      const lab=document.identityLab??emptyIdentityLab(),direction=lab.directions.find(d=>d.id===request.directionId);
      if(['review','refine'].includes(request.action)&&(!direction||!direction.frameIds.length))throw new Error('Selecciona una dirección con pantallas existentes.');
      if(direction&&identityIssues(document).some(i=>i.id===direction.id))throw new Error('Resuelve las referencias ausentes antes de pedir una revisión.');
      if(request.action==='refine'&&(!request.nodeIds?.length||!request.instruction?.trim()))throw new Error('Selecciona capas e indica qué refinar.');
      const service=services[request.action];if(!service||request.action==='review'&&!services.render)throw new Error('El IDE no conectó este servicio de Identity Lab.');
      const guard=()=>{assertWritable();if(controller.signal.aborted||generation!==identityGeneration||store.project!==before)throw new Error('La respuesta quedó obsoleta: el documento o el servicio cambió. Vuelve a solicitarla.');};
      const uid=()=>`identity-${crypto.randomUUID()}`;
      identityRequests.add(controller);
      try {
        const {revision}=await import('./agent');const documentRevision=await revision(document);guard();
        const targetRevision=direction?identityTargetRevision(document,direction):undefined;
        const context:IdentityServiceRequest={...request,document:clone(document),revision:documentRevision,lab:clone(lab),...(direction?{direction:clone(direction),targetRevision}:{}),signal:controller.signal};
        const ops:IdentityOperation[]=[];
        if(request.action==='research'){const result=await services.research!(context);guard();if(!Array.isArray(result.references)||result.references.length>100)throw new Error('Respuesta de investigación inválida.');for(const ref of result.references){if(lab.references.some(r=>r.id===ref.id))throw new Error('La investigación no puede reemplazar referencias existentes.');ops.push({op:'identity.reference.put',reference:{...ref,status:'proposed'}});}}
        if(request.action==='explore'){const result=await services.explore!(context);guard();if(!Array.isArray(result.directions)||result.directions.length>30)throw new Error('Respuesta de exploración inválida.');for(const dir of result.directions){if(lab.directions.some(d=>d.id===dir.id))throw new Error('La exploración no puede reemplazar direcciones existentes.');ops.push({op:'identity.direction.put',direction:{...dir,status:'exploring'}});}}
        if(request.action==='review'){
          const bound={...context,direction:clone(direction!),targetRevision:targetRevision!};
          const evidence=clone(await services.render!(bound));guard();validateIdentityEvidence(document,direction!,targetRevision!,evidence);
          const result=await services.review!({...request,signal:controller.signal,revision:documentRevision,document:clone(document),lab:clone(lab),direction:clone(direction!),targetRevision:targetRevision!,evidence:clone(evidence)});guard();
          ops.push({op:'identity.critique.add',critique:{...result,id:uid(),directionId:direction!.id,targetRevision:targetRevision!,evidence}});
        }
        if(request.action==='refine'){const refinement={id:uid(),directionId:direction!.id,nodeIds:request.nodeIds!,instruction:request.instruction!,targetRevision:targetRevision!,status:'requested' as const};const test=clone(document);applyIdentityOperation(test,{op:'identity.refinement.put',refinement});const result=await services.refine!({...context,direction:clone(direction!),targetRevision:targetRevision!});guard();ops.push({op:'identity.refinement.put',refinement:{...refinement,status:'proposed',proposal:result.proposal}});}
        guard();if(ops.length)commit(p=>{for(const op of ops)applyIdentityOperation(p,op);});
        return {action:request.action,ids:ops.map(op=>'reference' in op?op.reference.id:'direction' in op?op.direction.id:'critique' in op?op.critique.id:'refinement' in op?op.refinement.id:''),revision:await revision(store.project)};
      } finally {identityRequests.delete(controller);}
    },
    getStyles() { assertActive(); return styleSummaries(store.project); },
    getStyle(id) { assertActive(); return clone(store.project.stylePackages?.[id] ?? null); },
    importStyle(input) { const style=parseStylePackage(input); return commit(p=>{importStylePackage(p,style);}); },
    applyStyle(id, options={}) { return commit(p=>applyStylePackage(p,id,options.frameId,options.mode)); },
    getResourceLibrary: () => resources.list(),
    getResource: id => resources.get(id),
    stageResource: input => resources.stage(input),
    reviewResource: id => resources.review(id),
    requestResourceEdit: id => resources.requestEdit(id),
    setResourceServices(services) { assertActive(); resourceServices = {...services}; resources.setServices({...resourceServices,render:resourceServices.render ?? resourceRenderer}); view?.resources?.(); },
    async insertResource(id, placement = {}) {
      assertWritable(); const resource = await resources.requireApproved(id); assertWritable();
      const width = placement.width ?? resource.width;
      let createdId = '';
      const result = commit(p => { const created = node('vector', {name:resource.name,svg:resource.svg,aruSource:resource.source,animations:resource.animations,parentId:placement.parentId ?? state.selectionScope,x:placement.x ?? 24,y:placement.y ?? 24,width,height:Math.max(1,width * resource.height / resource.width)}); p.nodes.push(created); createdId=created.id; });
      select([createdId]); return result;
    },
    async exportResource(id, assetOptions = {}) {
      assertActive(); const resource = await resources.requireApproved(id); assertActive();
      const p = blank(), drawing = node('vector',{id:'library-asset',name:resource.name,svg:resource.svg,aruSource:resource.source,animations:resource.animations,x:0,y:0,width:resource.width,height:resource.height}); p.nodes.push(drawing);
      const {exportAsset} = await import('./asset-export'); return exportAsset(p,{...assetOptions,ids:[drawing.id],name:assetOptions.name ?? resource.name});
    },
    getState() { assertActive(); return snapshot(); },
    getDocument() { assertActive(); return clone(store.project); },
    getPreviewDocument() { assertActive(); return clone(previewProject()); },
    getLocalization() { assertActive(); return localization ? clone(localization) : null; },
    getLocalizationState() { assertActive(); return localeState(); },
    getLocalizationIssues() { assertActive(); return clone(view?.localizationIssues?.() ?? localizationIssues(store.project, localization)); },
    setLocalization(config) {
      assertWritable(); const next = normalizeLocalization(config);
      localization = next; localizationRevision++; render();
    },
    setLocale(locale) {
      assertWritable();
      if (locale !== null && (!localization || !Object.hasOwn(localization.messages, locale))) throw new Error('El idioma no está en el catálogo del IDE.');
      if (!localization || localization.locale === locale) return;
      localization = { ...localization, locale }; localizationRevision++; render();
    },
    async requestTranslation(nodeId) {
      assertActive(); const n = find(nodeId);
      if (!n?.textKey) throw new Error('Vincula una clave de localización a esta capa.');
      if (!translationHandler) throw new Error('El IDE no configuró un editor de traducciones.');
      await translationHandler({ nodeId, key: n.textKey, locale: localization?.locale ?? null, sourceText: n.text, previewText: resolveText(n, localization).text });
    },
    getImplementations(nodeId) { assertActive(); return getComponentImplementations(store.project, nodeId); },
    setImplementation(componentId, platform, reference) { return commit(p => setComponentImplementation(p, componentId, platform, reference)); },
    async requestImplementation(nodeId, platform) {
      assertActive();
      const context = getComponentImplementations(store.project, nodeId);
      const reference = context && Object.hasOwn(context.implementations, platform) ? context.implementations[platform] : undefined;
      if (!reference || !context) throw new Error('Este componente no tiene implementación para esa plataforma.');
      if (!implementationHandler) throw new Error('El IDE no configuró la navegación a implementaciones.');
      await implementationHandler({ nodeId, ownerId: context.ownerId, componentId: context.componentId, platform, reference });
    },
    async requestIllustration(nodeId) {
      assertActive(); const n = find(nodeId);
      if (!n?.aruSource) throw new Error('Esta capa no tiene fuente ARU.');
      if (!illustrationHandler) throw new Error('El IDE no configuró un editor de ilustraciones.');
      await illustrationHandler({ nodeId, source: clone(n.aruSource) });
    },
    getComponentProperties(nodeId) { assertActive(); return clone(getComponentProperties(store.project, nodeId)); },
    setComponentProperty(nodeId, key, value) { return commit(p => setComponentProperty(p, nodeId, key, value)); },
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
            case 'comment.create':case 'comment.reply':case 'comment.status':case 'comment.draft.put':case 'comment.draft.remove':applyCommentOperation(project,op);break;
            case 'identity.brief.set': case 'identity.reference.put': case 'identity.reference.remove': case 'identity.direction.put': case 'identity.direction.remove': case 'identity.decision.add': case 'identity.refinement.put': case 'identity.critique.add': applyIdentityOperation(project,op); break;
            case 'style.import': importStylePackage(project,op.data); break;
            case 'style.apply': applyStylePackage(project,op.id,op.frameId,op.mode); break;
            case 'aru': applyAruAsset(project, op); break;
            case 'component.implementation.set': setComponentImplementation(project, op.componentId, op.platform, op.reference); break;
            case 'component.property.define': defineComponentProperty(project, op.componentId, op.key, op.property); break;
            case 'component.property.remove': removeComponentProperty(project, op.componentId, op.key); break;
            case 'component.property.set': setComponentProperty(project, op.id, op.key, op.value); break;
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
      store.commit(project => {for(const key of Object.keys(project))delete (project as unknown as Record<string,unknown>)[key];Object.assign(project,next);});
      state.selected = []; state.selectionScope = null;
      commentHistory=true;try{render(true);}finally{commentHistory=false;}
    },
    undo() { assertWritable(); store.undo();commentHistory=true;try{render(true);}finally{commentHistory=false;} },
    redo() { assertWritable(); store.redo();commentHistory=true;try{render(true);}finally{commentHistory=false;} },
    async agent(command, params = {}) {
      assertActive();
      const { handleAgentRequest } = await import('./agent');
      assertActive();
      return handleAgentRequest({
        resourceLibrary:editor.getResourceLibrary,resource:editor.getResource,exportResource:editor.exportResource,
        project: () => { assertActive(); return store.project; },
        selection: () => [...state.selected], scope: () => state.selectionScope,
        busy: () => destroyed || isBusy(), commit: edit => { assertWritable(); store.commit(edit); render(true); },
        commitPrepared: prepared => { assertWritable(); store.commitPrepared(prepared); render(true); },
        select, undo: editor.undo, redo: editor.redo,
        localization: () => localization, localizationState: localeState, previewProject, setLocale: editor.setLocale, localizationIssues: editor.getLocalizationIssues,
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
    async exportAsset(options = {}) {
      assertWritable(); const snapshot = clone(previewProject()), ids = options.ids ?? [...state.selected];
      const { exportAsset } = await import('./asset-export');
      return exportAsset(snapshot, { ...options, ids });
    },
    exportHTML() { assertActive(); requireDOM(); return exportHTML(previewProject()); },
    exportSVG(frameId) {
      assertActive(); requireDOM();
      const preview = previewProject(), frame = preview.nodes.find(n => n.id === frameId);
      if (frame?.type !== 'frame') throw new Error('La exportación SVG requiere una pantalla.');
      return exportSVG(preview, frame);
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
      identityRequests.forEach(r=>r.abort());
      try {for(const extension of [...extensions])extension.flush();}
      catch(error){destroying=false;throw error;}
      try {
        for(const extension of [...extensions]){try {extension.dispose();} finally {extensions.delete(extension);}}
        try { view?.flush(); } finally { view?.dispose(); }
      } finally {
        finalDocument = clone(store.project);
        destroyed = true; destroying = false; view = undefined; listeners.clear();commentListeners.clear();
      }
      return clone(finalDocument);
    },
  };
  sessions.set(editor, {
    identityCapabilities() { assertActive(); return {research:!!identityServices.research,explore:!!identityServices.explore,review:!!identityServices.render&&!!identityServices.review,refine:!!identityServices.refine}; },
    bindExtension(hooks) { assertActive(); extensions.add(hooks); return ()=>{extensions.delete(hooks);}; },
    store, setResourceRenderer, setResourceLibraryHandler(callback) { assertActive(); resourceChangeHandler=callback; }, state, notify, assertActive, previewProject, localization: () => localization,
    canOpenImplementation: () => !!implementationHandler,
    canOpenIllustration: () => !!illustrationHandler,
    setIllustrationHandler(callback) { assertWritable(); illustrationHandler = callback; render(); },
    setImplementationHandler(callback) { assertWritable(); implementationHandler = callback; render(); },
    setTranslationHandler(callback) { assertWritable(); translationHandler = callback; localizationRevision++; render(); },
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
