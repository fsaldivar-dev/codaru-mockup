import type { Project } from './model';
import { clone } from './model';
import { validateAruSource } from './aru-asset';
import { isSanitizedSVG, sanitizeSVG, validateAnimations, vectorLayers } from './motion';
import type { ResourceCandidate, ResourceRecord, ResourceReviewRequest, ResourceReviewVerdict, ResourceServices, ResourceSummary, ResourceStatus, ResourcePreview } from './contracts';

const digest = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(b => b.toString(16).padStart(2, '0')).join('');
const candidateRevision = (r: ResourceCandidate) => digest([r.name, r.tags ?? [], r.svg, r.source, r.width, r.height, r.kind, r.purpose, r.animations ?? [], r.reference ?? null]);
const contentId = async (r: ResourceCandidate) => `drawing_${await digest([r.svg, r.source?.text ?? null, r.animations ?? []])}`;
type Entry = ResourceRecord & { nodeIds: string[]; origin: 'document' | 'library' };
const text = (value: unknown, max: number) => typeof value === 'string' && !!value.trim() && value.length <= max && !/[\u0000-\u001f]/.test(value);

function candidate(input: ResourceCandidate): ResourceCandidate {
  if (!input || !text(input.name, 160) || !text(input.purpose, 2000) || !['icon', 'illustration', 'app-icon'].includes(input.kind) ||
    !Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width < 1 || input.height < 1 || input.width > 100000 || input.height > 100000 ||
    (input.id !== undefined && !/^[A-Za-z0-9_-]{1,128}$/.test(input.id)) ||
    (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.length > 32 || input.tags.some(t => !text(t, 64)))) ||
    typeof input.svg !== 'string' || input.svg.length > 400_000 || !isSanitizedSVG(input.svg)) throw new Error('Recurso inválido: declara su uso, dimensiones y un SVG saneado.');
  if (vectorLayers(input.svg).length > 4096) throw new Error('El recurso supera 4096 capas; simplifica el dibujo antes de revisarlo.');
  if (input.source) validateAruSource(input.source);
  if (input.animations) validateAnimations(input.animations, vectorLayers(input.svg).map(l => l.id));
  if (input.reference !== undefined && (typeof input.reference !== 'string' || input.reference.length > 2_000_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.reference))) throw new Error('La referencia debe ser una imagen local.');
  // Do not import verdicts, status or arbitrary properties from external files as authority.
  return clone({ ...(input.id ? {id:input.id} : {}), name:input.name, purpose:input.purpose, kind:input.kind, tags:[...new Set(input.tags ?? [])], svg:input.svg,
    width:input.width, height:input.height, ...(input.source ? {source:input.source} : {}), ...(input.animations ? {animations:input.animations} : {}), ...(input.reference ? {reference:input.reference} : {}) });
}
function validatePreviews(previews: ResourcePreview[], revision: string, resource: ResourceCandidate) {
  if (!Array.isArray(previews) || previews.length > 12 || !previews.some(p => p.role === 'actual') || !previews.some(p => p.role === 'small')) throw new Error('Se necesitan renders PNG reales, a tamaño de uso y reducido.');
  let bytes = 0;
  for (const p of previews) {
    if (p.revision !== revision || !['actual','small','animation'].includes(p.role) || !Number.isInteger(p.width) || !Number.isInteger(p.height) || p.width < 1 || p.height < 1 || p.width > 2048 || p.height > 2048 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(p.dataURL)) throw new Error('Render de revisión inválido o desactualizado.');
    const longest=Math.max(resource.width,resource.height), rendered=Math.max(p.width,p.height);
    if (p.role==='actual' && rendered < Math.round(Math.min(1024,longest))) throw new Error('El render real es demasiado pequeño para revisar el recurso.');
    if (p.role==='small' && rendered !== Math.round(Math.min(resource.kind==='illustration'?64:24,longest))) throw new Error('El render reducido debe corresponder al tamaño de lectura del recurso.');
    if (Math.abs(p.height-Math.max(1,Math.round(p.width*resource.height/resource.width)))>1) throw new Error('El render altera la proporción del recurso.');
    const encoded = p.dataURL.slice(22); bytes += encoded.length;
    if (bytes > 8_000_000) throw new Error('Los renders de revisión superan 8 MB.');
    const image = Uint8Array.from(atob(encoded), c => c.charCodeAt(0)), header=image.subarray(0,24);
    // Reject a bare header masquerading as a raster; decoding/visual assessment belongs to the host.
    if (image.length<67 || String.fromCharCode(...image.slice(-8,-4))!=='IEND') throw new Error('El PNG de revisión está incompleto.');
    if (header.length < 24 || [137,80,78,71,13,10,26,10].some((v,i) => header[i] !== v) || String.fromCharCode(...header.slice(12,16)) !== 'IHDR') throw new Error('La revisión requiere una imagen PNG, no un SVG o texto renombrado.');
    const view = new DataView(header.buffer);
    if (view.getUint32(16) !== p.width || view.getUint32(20) !== p.height) throw new Error('Las dimensiones del PNG no corresponden al render.');
  }
  if (resource.animations?.length && new Set(previews.filter(p => p.role === 'animation' && Number.isFinite(p.timeMs) && p.timeMs! >= 0).map(p => p.timeMs)).size < 3) throw new Error('La ilustración animada requiere al menos tres instantes renderizados.');
}
function verdict(input: ResourceReviewVerdict, resource: ResourceCandidate) {
  if (!input || !['approved','changes_requested','rejected'].includes(input.status) || !Array.isArray(input.reasons) || input.reasons.length > 32 || input.reasons.some(r => !text(r, 2000)) || !text(input.evaluator?.provider, 120) || !text(input.evaluator?.model, 160)) throw new Error('La IA debe devolver un dictamen identificado y sus motivos.');
  for (const key of ['appearance','readability','clipping','style'] as const) if (!['pass','fail'].includes(input.checks?.[key])) throw new Error('Dictamen visual incompleto.');
  for (const key of ['fidelity','animation'] as const) if (!['pass','fail','not_applicable'].includes(input.checks?.[key])) throw new Error('Dictamen visual incompleto.');
  if (input.status === 'approved' && (Object.values(input.checks).includes('fail') || (resource.reference && input.checks.fidelity !== 'pass') || (resource.animations?.length && input.checks.animation !== 'pass'))) throw new Error('No se puede aprobar con comprobaciones fallidas o sin revisar la referencia/animación.');
  if (input.status !== 'approved' && !input.reasons.length) throw new Error('Indica qué debe corregirse o por qué se rechaza.');
  return clone(input);
}

/** Session-local catalogue. Imported records are candidates; only the host's evaluator can approve. */
export class ResourceLibrary {
  private catalog = new Map<string, Entry>();
  private working = new Map<string, ResourceStatus>();
  private documentFor?: Project;
  private documentIndex?: Promise<Map<string, Entry>>;
  private generation = 0;
  constructor(private options: { document: () => Project; services?: ResourceServices; changed?: (records: ResourceRecord[]) => void; active?: () => boolean }) {}
  private assertActive() { if (this.options.active?.() === false) throw new Error('La biblioteca ya fue desmontada.'); }
  setServices(services: ResourceServices) { this.assertActive(); this.options.services = {...services}; this.generation++; }
  private async entry(input: ResourceCandidate, origin: Entry['origin'], nodeIds: string[] = []): Promise<Entry> {
    const resource = candidate(input), id = resource.id ?? await contentId(resource);
    return {resource:{...resource,id},revision:await candidateRevision(resource),status:'pending',reasons:[],nodeIds,origin};
  }
  private index() {
    this.assertActive(); const p = this.options.document();
    if (p !== this.documentFor || !this.documentIndex) {
      this.documentFor = p;
      const drawings = p.nodes.filter(n => n.type === 'vector' && n.svg).map(n => ({ id:n.id, resource:{name:n.name.trim() || 'Dibujo sin nombre',purpose:n.name.trim() || 'Dibujo sin nombre',kind:(n.width <= 64 && n.height <= 64 ? 'icon' : 'illustration') as ResourceCandidate['kind'],svg:n.svg!,source:n.aruSource,width:n.width,height:n.height,animations:n.animations} }));
      this.documentIndex = (async () => {
        const result = new Map<string, Entry>();
        for (let i = 0; i < drawings.length; i++) {
          this.assertActive();
          const n = drawings[i], entry = await this.entry(n.resource, 'document', [n.id]);
          const previous = result.get(entry.resource.id); if (previous) previous.nodeIds.push(n.id); else result.set(entry.resource.id, entry);
          // Do not queue hundreds of crypto completions without giving the editor an input turn.
          if (i % 24 === 23) await new Promise(resolve => setTimeout(resolve, 0));
        }
        return result;
      })();
    }
    return this.documentIndex;
  }
  private summary(entry: Entry): ResourceSummary {
    const r = entry.resource;
    return {id:r.id,revision:entry.revision,name:r.name,kind:r.kind,purpose:r.purpose,tags:[...(r.tags ?? [])],width:r.width,height:r.height,nodeIds:[...entry.nodeIds],origin:entry.origin,status:this.working.get(r.id) ?? entry.status,reasons:[...entry.reasons],editable:!!r.source,canEdit:!!r.source && !!this.options.services?.edit};
  }
  private async lookup(id: string) { const docs = await this.index(); this.assertActive(); return this.catalog.get(id) ?? docs.get(id); }
  async list(): Promise<ResourceSummary[]> {
    const docs = await this.index(); this.assertActive();
    const all = new Map(docs); for (const [id, entry] of this.catalog) all.set(id, {...entry,nodeIds:docs.get(id)?.nodeIds ?? []});
    return [...all.values()].map(e => this.summary(e));
  }
  async get(id: string): Promise<(ResourceRecord & {nodeIds:string[];origin:Entry['origin']}) | null> { const entry = await this.lookup(id); return entry ? clone(entry) : null; }
  private changed() {
    this.assertActive();
    try { this.options.changed?.([...this.catalog.values()].map(({nodeIds:_,origin:__,...record}) => clone(record))); }
    catch (error) { console.error('Codaru: no se pudo notificar el catálogo al IDE.', error); }
  }
  async stage(input: ResourceCandidate) {
    this.assertActive(); const entry = await this.entry(input, 'library'); this.assertActive();
    if (this.catalog.size >= 1000 && !this.catalog.has(entry.resource.id)) throw new Error('La biblioteca admite hasta 1000 dibujos.');
    // Even external saved files containing status:approved cannot bypass a fresh host review.
    this.catalog.set(entry.resource.id, entry); this.changed(); return entry.resource.id;
  }
  async review(id: string): Promise<ResourceSummary> {
    this.assertActive(); if (this.working.has(id)) throw new Error('Este recurso ya está en revisión.');
    const entry = await this.lookup(id); if (!entry) throw new Error('Recurso no encontrado.');
    if (this.catalog.size >= 1000 && !this.catalog.has(id)) throw new Error('La biblioteca admite hasta 1000 dibujos.');
    const services = {...this.options.services}, generation = this.generation, resource = clone(entry.resource), revision = entry.revision;
    if (this.working.has(id)) throw new Error('Este recurso ya está en revisión.');
    if (this.working.size >= 2) throw new Error('Espera a que termine una de las revisiones actuales.');
    this.working.set(id, 'reviewing');
    try {
      if (!services.render || !services.evaluate || (resource.source && !services.compile)) throw new Error('Pendiente: el IDE debe proporcionar renderizado, evaluación por IA y compilación ARU cuando haya fuente.');
      let sourceMatches: boolean | null = null;
      if (resource.source) { sourceMatches = sanitizeSVG(await services.compile!(clone(resource.source))) === resource.svg; if (!sourceMatches) throw new Error('El SVG no corresponde a la compilación del fuente ARU actual.'); }
      const assertCurrent = async () => { this.assertActive(); const current=await this.lookup(id); if (generation!==this.generation || current?.revision!==revision) throw new Error('El recurso o los servicios cambiaron durante la revisión.'); };
      await assertCurrent();
      const previews = await services.render(clone(resource), revision); validatePreviews(previews, revision, resource);
      await assertCurrent();
      const request: ResourceReviewRequest = {resource:clone(resource),revision,previews:clone(previews),technical:{sanitized:true,sourceMatches,layers:vectorLayers(resource.svg).length}};
      const review = verdict(await services.evaluate(request), resource);
      this.assertActive(); const current = await this.lookup(id);
      if (generation !== this.generation || current?.revision !== revision) throw new Error('El recurso o los servicios cambiaron durante la revisión. Vuelve a evaluar la versión actual.');
      if (this.catalog.size >= 1000 && !this.catalog.has(id)) throw new Error('La biblioteca admite hasta 1000 dibujos.');
      const result: Entry = {...entry,resource,status:review.status,review,reasons:review.reasons,origin:'library'};
      this.catalog.set(id,result); this.changed(); return {...this.summary(result),status:review.status};
    } catch (error) {
      this.assertActive(); const current = await this.lookup(id);
      // Preserve any replacement staged while the old version was being evaluated.
      if (current?.revision === revision && generation === this.generation && (this.catalog.size < 1000 || this.catalog.has(id))) {
        const result: Entry = {...entry,status:'pending',review:undefined,reasons:[error instanceof Error ? error.message : String(error)]};
        this.catalog.set(id,result); this.changed(); return {...this.summary(result),status:'pending'};
      }
      throw error;
    } finally { this.working.delete(id); }
  }
  async requestEdit(id: string) { const entry=await this.lookup(id); this.assertActive(); if (!entry?.resource.source || !this.options.services?.edit) throw new Error('El IDE debe proporcionar un editor ARU para este recurso.'); await this.options.services.edit({resourceId:id,revision:entry.revision,source:clone(entry.resource.source)}); }
  async requireApproved(id: string) { const entry = await this.lookup(id); if (!entry || entry.status !== 'approved' || this.working.has(id)) throw new Error('El recurso necesita aprobación por IA antes de reutilizarse desde la biblioteca.'); return clone(entry.resource); }
}
