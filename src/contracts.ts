/** Shared, type-only ports. The core and its adapters depend on these contracts. */
import type { ComponentProperty, DesignNode, Kind } from './model';

import type { ComponentPropertyValue } from './component-properties';

/** Editable authoring source. Rendering remains a sanitized SVG, never executable ARU. */
export interface AruSource { version: 1; text: string; filename: string; }
export interface AruAsset { format: 'codaru-aru/1'; source: string; svg: string; filename: string; }
/** The host owns the illustration editor and applies its eventual result explicitly. */
export interface IllustrationRequest { nodeId: string; source: AruSource; }

/** Declarative location. Only the IDE resolves symbols and opens workspace files. */
export interface ImplementationReference {
  symbol: string;
  /** Workspace-relative path with forward slashes, optional for symbols resolved by the IDE. */
  path?: string;
  /** Package/module hint, useful when the symbol belongs to a library. */
  module?: string;
}
export interface ComponentImplementations {
  nodeId: string;
  /** Closest component master or instance containing the requested node. */
  ownerId: string;
  componentId: string;
  componentName: string;
  implementations: Record<string, ImplementationReference>;
}
export interface ImplementationRequest {
  nodeId: string;
  ownerId: string;
  componentId: string;
  platform: string;
  reference: ImplementationReference;
}

/** Design-time contracts. The IDE instruments the product; Codaru collects no usage data. */
export type AccessibilityRole = 'button'|'link'|'textbox'|'checkbox'|'switch'|'slider'|'tab'|'heading'|'img'|'region'|'status';
export interface AccessibilitySpec {
  role?: AccessibilityRole;
  name?: string;
  /** Resolved by the IDE's localization catalogue, not embedded user text. */
  nameKey?: string;
  description?: string;
  decorative?: boolean;
  keyboard?: string[];
  focus?: 'visible'|'not-focusable';
  focusOrder?: number;
  live?: 'off'|'polite'|'assertive';
  reducedMotion?: boolean;
  states?: Array<'disabled'|'checked'|'selected'|'expanded'|'invalid'|'busy'>;
}
export interface AnalyticsEventSpec {
  name: string;
  trigger: 'press'|'view'|'change'|'submit'|'success'|'failure';
  purpose: string;
  consent?: 'required'|'not-required';
  /** Property definitions and sources only; never samples of real user data. */
  properties?: Record<string,{type:'string'|'number'|'boolean';source:string;sensitive?:boolean}>;
}
export interface ExperienceSpec {
  accessibility?: AccessibilitySpec;
  /** An explicit empty list means no analytics are intended for this element. */
  analytics?: AnalyticsEventSpec[];
  testId?: string;
  acceptance?: string[];
}
export interface ExperienceIssue {
  rule: string; nodeId: string; frameId: string|null;
  severity: 'error'|'warning'|'info'; message: string; fix: string;
  verification: 'design'|'implementation';
}
export interface ExperienceEntry {
  nodeId:string; frameId:string|null; name:string; visible:boolean;
  spec:ExperienceSpec;
  suggested:{role?:AccessibilityRole;name?:string;testId:string};
  implementation:ComponentImplementations|null;
  instrumentation:Array<{event:AnalyticsEventSpec;where:string;platforms:Record<'web'|'ios'|'android',string>}>;
  tests:{bindings:Record<'web'|'ios'|'android',string>;assertions:Array<{kind:string;expected:string;verification:'automated'|'manual'}>};
}
export interface ExperienceReport {
  format:'codaru-experience/1'; revision:string;
  entries:ExperienceEntry[]; issues:ExperienceIssue[];
  /** Items requiring a running product; this report never certifies WCAG compliance. */
  runtimeChecks:string[];
}

/** One transaction at the editor boundary, regardless of which UI initiated it. */
export type EditorOperation = IdentityOperation | CommentOperation
  | {op:'experience.set';id:string;spec:ExperienceSpec|null}
  | { op:'style.import'; data:DesignStylePackage }
  | { op:'style.apply'; id:string; frameId?:string; mode?:'light'|'dark' }
  | { op: 'aru'; data: AruAsset; id?: string; parentId?: string | null; x?: number; y?: number; width?: number; name?: string }
  | { op: 'component.implementation.set'; componentId: string; platform: string; reference: ImplementationReference | null }
  | { op: 'component.property.define'; componentId: string; key: string; property: ComponentProperty }
  | { op: 'component.property.remove'; componentId: string; key: string }
  | { op: 'component.property.set'; id: string; key: string; value: ComponentPropertyValue | null }
  | { op: 'add'; node: Partial<DesignNode> & { type: Kind } }
  | { op: 'update'; id: string; patch: Partial<DesignNode> }
  | { op: 'remove'; ids: string[] }
  | { op: 'component'; id: string }
  | { op: 'instance'; componentId: string; parentId: string | null; x: number; y: number };

export interface AgentRequest { command: string; params?: Record<string, unknown>; }
export interface AgentResponse {
  ok: boolean;
  context?: { revision: string; [key: string]: unknown };
  error?: { code: string; message: string };
  [key: string]: unknown;
}

/** Optional transport supplied by the IDE; no native SDK is imported by the editor. */
export type CodaruInvoke = <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;

/** Stable design anchors; commentary is document data, never executable instructions. */
export interface CommentAuthor { name:string; kind:'human'|'ai'; }
export interface CommentAnchor {
  nodeIds:string[]; frameId:string; revision:string;
  labels:string[]; theme:{id:string;mode:'light'|'dark'};
  /** Original world-space bounding box, retained when layers disappear. */
  bounds:{x:number;y:number;width:number;height:number};
}
export interface CommentMessage { id:string; text:string; author:CommentAuthor; at:string; }
export interface CommentThread { id:string; anchor:CommentAnchor; messages:CommentMessage[]; status:'open'|'resolved'; }
export interface CommentDraft { id:string; threadId?:string; anchor:CommentAnchor; text:string; author:CommentAuthor; }
export interface CorrectionQueueItem { threadId:string; messageId:string; }
export interface LayoutComments { format:'codaru-comments/1'; threads:CommentThread[]; drafts:CommentDraft[]; queue?:CorrectionQueueItem[]; }
/** One ordered snapshot; the host acknowledges delivery, never implicit application. */
export interface CorrectionRequest { id:string; items:{item:CorrectionQueueItem;context:CommentContext}[]; document:import('./model').Project; }
export type CommentOperation =
  | {op:'comment.create';id:string;anchor:CommentAnchor;message:CommentMessage}
  | {op:'comment.reply';id:string;message:CommentMessage}
  | {op:'comment.status';id:string;status:CommentThread['status']}
  | {op:'comment.draft.put';draft:CommentDraft}
  | {op:'comment.draft.remove';id:string}
  | {op:'comment.queue.add';id:string;messageId:string}
  | {op:'comment.queue.remove';id:string;messageId:string}
  | {op:'comment.queue.move';id:string;index:number};
export interface CommentContext {
  thread:CommentThread; currentRevision:string|null; stale:boolean; missingIds:string[];
  nodes:DesignNode[]; truncated:boolean; bounds:CommentAnchor['bounds'];
}
export interface CommentEvent {
  sequence:number;
  type:'comment.created'|'comment.replied'|'comment.resolved'|'comment.reopened'|'comments.restored';
  threadId?:string; message?:CommentMessage; targetRevision?:string;
  /** Collected for explicit batch delivery; do not start an individual AI job. */
  queued?:boolean;
}
/** The IDE supplies its own renderer/evaluator; proposals never mutate geometry. */
export interface CommentReviewRequest { context:CommentContext; document:import('./model').Project; }

/** A reusable drawing is independent of component definitions and document node IDs. */
export interface ResourceCandidate {
  id?: string;
  name: string;
  kind: 'icon' | 'illustration' | 'app-icon';
  purpose: string;
  tags?: string[];
  svg: string;
  source?: AruSource;
  width: number;
  height: number;
  animations?: import('./motion').NodeAnimation[];
  /** Optional reference supplied by the author; no URL is fetched by the library. */
  reference?: string;
}
export type ResourceStatus = 'pending' | 'reviewing' | 'approved' | 'changes_requested' | 'rejected';
export interface ResourcePreview {
  /** Binds the actual raster to the exact candidate being reviewed. */
  revision: string;
  dataURL: string;
  width: number;
  height: number;
  role: 'actual' | 'small' | 'animation';
  timeMs?: number;
}
export interface ResourceSummary {
  id: string;
  revision: string;
  name: string;
  kind: ResourceCandidate['kind'];
  purpose: string;
  tags: string[];
  width: number;
  height: number;
  nodeIds: string[];
  origin: 'document' | 'library';
  status: ResourceStatus;
  reasons: string[];
  editable: boolean;
  canEdit: boolean;
}
export interface ResourceReviewVerdict {
  status: 'approved' | 'changes_requested' | 'rejected';
  reasons: string[];
  /** Identifies the real evaluator supplied by the IDE. The editor bundles no model. */
  evaluator: { provider: string; model: string };
  checks: {
    appearance: 'pass' | 'fail';
    readability: 'pass' | 'fail';
    clipping: 'pass' | 'fail';
    style: 'pass' | 'fail';
    fidelity: 'pass' | 'fail' | 'not_applicable';
    animation: 'pass' | 'fail' | 'not_applicable';
  };
}
export interface ResourceReviewRequest {
  resource: ResourceCandidate & { id: string };
  revision: string;
  previews: ResourcePreview[];
  technical: { sanitized: true; sourceMatches: boolean | null; layers: number };
}
export interface ResourceRecord {
  resource: ResourceCandidate & { id: string };
  revision: string;
  status: Exclude<ResourceStatus, 'reviewing'>;
  review?: ResourceReviewVerdict;
  reasons: string[];
}
/** Explicit host ports: authoring, actual rendering, AI assessment and persistence stay local to the IDE. */
export interface ResourceServices {
  edit?: (request: {resourceId:string;revision:string;source:AruSource}) => void | Promise<void>;
  compile?: (source: AruSource) => Promise<string>;
  render?: (resource: ResourceCandidate & { id: string }, revision: string) => Promise<ResourcePreview[]>;
  evaluate?: (request: ResourceReviewRequest) => Promise<ResourceReviewVerdict>;
}

/** Portable visual language. Composition guidance is prose, never an executable layout template. */
export interface DesignStylePackage {
  format: 'codaru-style/1';
  id: string;
  name: string;
  version: string;
  description: string;
  theme: import('./themes').DesignTheme;
  guidance: {
    composition: string[];
    typography: string[];
    controls: string[];
    mobile: string[];
    motion: string[];
    avoid: string[];
  };
  /** Optional authoring hints for ARU. The helper does not install or recognize this package as a named style. */
  aru?: { palette: string[]; instructions: string[] };
}

/** Identity Lab stores creative intent separately from editable geometry. No bundled AI/model. */
export interface IdentityBrief {
  intent: string;
  audience: string;
  context: string;
  qualities: string[];
  avoid: string[];
  constraints: string[];
}
export interface IdentityReference {
  id: string;
  title: string;
  source: string;
  author?: string;
  community?: string;
  license?: string;
  kind: 'cultural' | 'visual' | 'material' | 'other';
  observations: string;
  interpretation?: string;
  status: 'proposed' | 'accepted';
}
export interface IdentityDirection {
  id: string;
  name: string;
  intent: string;
  frameIds: string[];
  styleIds: string[];
  referenceIds?: string[];
  status: 'exploring' | 'selected' | 'archived';
  proposal?: string;
}
export interface IdentityDecision {
  id: string;
  directionId?: string;
  criterion: string;
  observation: string;
  next: string;
  outcome: 'keep' | 'revise' | 'discard';
  author: string;
  at: string;
}
export interface IdentityEvidence {
  /** Fingerprint of the direction and its actual rendered design, not the document with review history. */
  revision: string;
  frameId: string;
  dataURL: string;
  width: number;
  height: number;
}
export interface IdentityFinding {
  criterion: string;
  assessment: 'pass' | 'needs_work';
  reason: string;
  nodeIds: string[];
}
export interface IdentityCritique {
  id: string;
  directionId: string;
  targetRevision: string;
  summary: string;
  findings: IdentityFinding[];
  evaluator: { provider: string; model: string };
  evidence: IdentityEvidence[];
}
export interface IdentityRefinement {
  id: string;
  directionId: string;
  nodeIds: string[];
  instruction: string;
  targetRevision: string;
  proposal?: string;
  status: 'requested' | 'proposed' | 'resolved';
}
export interface IdentityLab {
  format: 'codaru-identity/1';
  brief: IdentityBrief;
  references: IdentityReference[];
  directions: IdentityDirection[];
  critiques: IdentityCritique[];
  decisions: IdentityDecision[];
  refinements: IdentityRefinement[];
}
export type IdentityOperation =
  | {op:'identity.brief.set';patch:Partial<IdentityBrief>}
  | {op:'identity.reference.put';reference:IdentityReference}
  | {op:'identity.reference.remove';id:string}
  | {op:'identity.direction.put';direction:IdentityDirection}
  | {op:'identity.direction.remove';id:string}
  | {op:'identity.decision.add';decision:IdentityDecision}
  | {op:'identity.refinement.put';refinement:IdentityRefinement}
  | {op:'identity.critique.add';critique:IdentityCritique};
export interface IdentityIssue {
  kind: 'missing_frame' | 'missing_style' | 'missing_reference' | 'missing_direction' | 'missing_node' | 'stale_review' | 'stale_refinement';
  id: string;
  targetId: string;
  message: string;
}
export interface IdentityState {
  lab: IdentityLab | null;
  issues: IdentityIssue[];
  capabilities: {research:boolean;explore:boolean;review:boolean;refine:boolean};
}
export interface IdentityRequestOptions {
  action: 'research' | 'explore' | 'review' | 'refine';
  directionId?: string;
  nodeIds?: string[];
  instruction?: string;
}
export interface IdentityServiceRequest extends IdentityRequestOptions {
  document: import('./model').Project;
  revision: string;
  lab: IdentityLab;
  direction?: IdentityDirection;
  targetRevision?: string;
  signal: AbortSignal;
}
export interface IdentityServices {
  research?: (request:IdentityServiceRequest)=>Promise<{references:IdentityReference[]}>;
  explore?: (request:IdentityServiceRequest)=>Promise<{directions:IdentityDirection[]}>;
  /** Must render the supplied immutable snapshot. The library never invents screenshots. */
  render?: (request:IdentityServiceRequest & {direction:IdentityDirection;targetRevision:string})=>Promise<IdentityEvidence[]>;
  review?: (request:IdentityServiceRequest & {direction:IdentityDirection;targetRevision:string;evidence:IdentityEvidence[]})=>Promise<Pick<IdentityCritique,'summary'|'findings'|'evaluator'>>;
  refine?: (request:IdentityServiceRequest & {direction:IdentityDirection;targetRevision:string})=>Promise<{proposal:string}>;
}
export interface IdentityRequestResult { action:IdentityRequestOptions['action']; ids:string[]; revision:string; }
/** Portable documents retain real review rasters and original references, never live callbacks. */
export interface IdentityPackage {
  format:'codaru-identity-package/1';
  lab:IdentityLab;
  document:import('./model').Project;
  issues:IdentityIssue[];
}
