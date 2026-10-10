import type { FontDefinition, FontIssue, FontLoader, FontStyle, FontSummary, FontVariant } from './contracts';
import type { Project, DesignNode } from './model';
import { resolveNodeStyle } from './themes';
export type { FontDefinition, FontIssue, FontLoader, FontStyle, FontSummary, FontVariant } from './contracts';
export const builtinFonts:Record<string,string>={system:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',serif:'Georgia, "Times New Roman", serif',mono:'ui-monospace, SFMono-Regular, Menlo, monospace'};
import {validFontId,validFontStyle} from './font-validation';
export {validFontId,validFontStyle} from './font-validation';
const copy=<T>(v:T):T=>structuredClone(v);
const key=(v:Pick<FontVariant,'weight'|'style'>)=>`${v.weight}:${v.style??'normal'}`;
let sequence=0;
const environments=new WeakMap<Project,FontRegistry>();
export function attachFonts(p:Project,registry:FontRegistry){environments.set(p,registry);return p;}
export function fontsFor(p:Project){return environments.get(p);}
export function transferFonts(from:Project,to:Project){const r=fontsFor(from);if(r)attachFonts(to,r);return to;}
export function fontFamilyCSS(p:Project,id:string){if(Object.hasOwn(builtinFonts,id))return builtinFonts[id];const r=fontsFor(p);if(!r)throw new Error(`Fuente ausente: ${id}. Registra el catálogo del IDE.`);return r.family(id);}
export function fontIssue(p:Project,node:DesignNode):FontIssue|undefined{
 const n={...node,...resolveNodeStyle(p,node)};if(!n.text||n.hidden)return;const r=fontsFor(p);
 if(r)return r.issue(n);if(Object.hasOwn(builtinFonts,n.fontFamily))return;
 return {nodeId:n.id,family:n.fontFamily,weight:n.fontWeight,style:n.fontStyle??'normal',kind:'missing',message:`Fuente ausente: ${n.fontFamily}. El IDE debe registrarla.`};
}
export function requireFonts(p:Project,nodes=p.nodes){const issue=nodes.map(n=>fontIssue(p,n)).find(Boolean);if(issue)throw new Error(issue.message);}
export function validateFontDefinitions(input:FontDefinition[]):FontDefinition[]{
 if(!Array.isArray(input)||input.length>100)throw new Error('El catálogo admite hasta 100 fuentes.');const seen=new Set<string>();
 for(const d of input){if(!d||!validFontId(d.id)||Object.hasOwn(builtinFonts,d.id)||seen.has(d.id)||typeof d.name!=='string'||!d.name.trim()||d.name.length>200||!Array.isArray(d.variants)||!d.variants.length||d.variants.length>64)throw new Error('Definición de fuente inválida o ID duplicado/reservado.');seen.add(d.id);const variants=new Set<string>();
 if(d.license!==undefined&&(typeof d.license!=='string'||d.license.length>8000))throw new Error('Licencia de fuente inválida.');
 for(const v of d.variants){if(!v||!Number.isInteger(v.weight)||v.weight<100||v.weight>900||!validFontStyle(v.style)||variants.has(key(v))||!v.source||typeof v.source!=='object'||!['reference','embed'].includes(v.export??'reference'))throw new Error('Variante de fuente inválida o duplicada.');variants.add(key(v));
 const src=v.source;if(('url' in src)===('local' in src))throw new Error('Elige una única fuente: url o local.');if('url' in src){if(typeof src.url!=='string'||src.url.length>4096||!src.url.trim()||/[\x00-\x1f]/.test(src.url)||/^(?:javascript|file):/i.test(src.url)||(/^\w+:/i.test(src.url)&&! /^(?:https?|blob|data|asset|tauri):/i.test(src.url)))throw new Error('URL de fuente inválida.');if(src.url.startsWith('data:')&&!/^data:(?:font\/[a-z0-9.-]+|application\/(?:font-[a-z0-9.-]+|octet-stream|x-font-[a-z0-9.-]+));base64,/i.test(src.url))throw new Error('El data URL debe contener una fuente.');}
 else if('local' in src){if(typeof src.local!=='string'||!src.local.trim()||src.local.length>200||/[\x00-\x1f]/.test(src.local)||v.export==='embed')throw new Error('Una fuente local no entrega bytes: usa referencia o una URL para incluirla.');}else throw new Error('La fuente necesita url o local.');
 }}return copy(input);
}
export class FontRegistry {
 private definitions:FontDefinition[]=[];private statuses=new Map<string,FontSummary['variants'][number]>();private jobs=new Map<string,Promise<void>>();private loader?:FontLoader;private generation=0;revision=0;
 readonly namespace=`CodaruFont${++sequence}`;
 constructor(input:FontDefinition[]=[],private changed:()=>void=()=>{}){this.set(input);}
 setChangeListener(changed:()=>void){this.changed=changed;}
 set(input:FontDefinition[]){const next=validateFontDefinitions(input);this.generation++;this.loader?.dispose();this.statuses.clear();this.jobs.clear();this.definitions=next;for(const d of next)for(const v of d.variants)this.statuses.set(`${d.id}/${key(v)}`,{weight:v.weight,style:v.style??'normal',status:'registered',source:'url' in v.source?'url':'local',export:v.export??'reference'});this.revision++;this.changed();}
 register(input:FontDefinition[]){const incoming=validateFontDefinitions(input);const next=validateFontDefinitions([...this.definitions.filter(d=>!incoming.some(n=>n.id===d.id)),...incoming]);if(incoming.some(n=>this.definitions.some(d=>d.id===n.id))){this.set(next);return;}this.definitions=next;for(const d of incoming)for(const v of d.variants)this.statuses.set(`${d.id}/${key(v)}`,{weight:v.weight,style:v.style??'normal',status:'registered',source:'url' in v.source?'url':'local',export:v.export??'reference'});this.revision++;this.changed();}
 bind(loader:FontLoader){this.loader?.dispose();this.generation++;this.jobs.clear();for(const status of this.statuses.values()){status.status='registered';delete status.error;}this.loader=loader;this.revision++;this.changed();return ()=>{if(this.loader===loader){this.generation++;loader.dispose();this.loader=undefined;this.jobs.clear();for(const s of this.statuses.values())s.status='registered';this.revision++;this.changed();}};}
 family(id:string){if(Object.hasOwn(builtinFonts,id))return builtinFonts[id];if(!this.definitions.some(d=>d.id===id))throw new Error(`Fuente ausente: ${id}. El IDE debe registrarla.`);return `"${this.namespace}-${id}"`;}
 list():FontSummary[]{return [...Object.keys(builtinFonts).map(id=>({id,name:{system:'Sistema',serif:'Serif',mono:'Monoespaciada'}[id]!,builtin:true,variants:[100,200,300,400,500,600,700,800,900].flatMap(weight=>(['normal','italic','oblique'] as const).map(style=>({weight,style,status:'loaded' as const,source:'builtin' as const,export:'reference' as const})))})),...this.definitions.map(d=>({id:d.id,name:d.name,builtin:false,variants:d.variants.map(v=>copy(this.statuses.get(`${d.id}/${key(v)}`)!))}))];}
 issue(n:Pick<DesignNode,'id'|'fontFamily'|'fontWeight'|'fontStyle'>):FontIssue|undefined{if(Object.hasOwn(builtinFonts,n.fontFamily))return;const d=this.definitions.find(d=>d.id===n.fontFamily),v=this.statuses.get(`${n.fontFamily}/${key({weight:n.fontWeight,style:n.fontStyle})}`);const base={nodeId:n.id,family:n.fontFamily,weight:n.fontWeight,style:n.fontStyle??'normal'};if(!d)return {...base,kind:'missing',message:`Fuente ausente: ${n.fontFamily}. El IDE debe registrarla.`};if(!v)return {...base,kind:'variant-missing',message:`Variante ausente: ${n.fontFamily} ${n.fontWeight} ${base.style}. Consulta el catálogo.`};if(v.status!=='loaded')return {...base,kind:v.status==='error'?'error':'pending',message:`Fuente ${v.status==='error'?'no disponible':'pendiente'}: ${n.fontFamily} ${n.fontWeight} ${base.style}${v.error?` · ${v.error}`:''}`};}
 async load(ids?:string[]){const chosen=ids??this.definitions.map(d=>d.id);if(!Array.isArray(chosen)||chosen.some(id=>!Object.hasOwn(builtinFonts,id)&&!this.definitions.some(d=>d.id===id)))throw new Error(`ID de fuente ausente del catálogo: ${chosen.find(id=>!Object.hasOwn(builtinFonts,id)&&!this.definitions.some(d=>d.id===id))}`);if(chosen.every(id=>Object.hasOwn(builtinFonts,id)))return this.list();if(!this.loader)throw new Error('El IDE debe conectar un FontLoader o montar una vista para cargar fuentes.');const generation=this.generation,loader=this.loader;
 await Promise.all(this.definitions.filter(d=>chosen.includes(d.id)).flatMap(d=>d.variants.map(v=>{const k=`${d.id}/${key(v)}`,s=this.statuses.get(k)!;if(s.status==='loaded')return Promise.resolve();if(this.jobs.has(k))return this.jobs.get(k)!;s.status='loading';delete s.error;this.revision++;this.changed();const job=loader.load(this.family(d.id),copy(v)).then(()=>{if(generation!==this.generation)return;s.status='loaded';this.revision++;this.changed();},error=>{if(generation!==this.generation)return;s.status='error';s.error=String(error instanceof Error?error.message:error).slice(0,240);this.revision++;this.changed();}).finally(()=>{if(generation===this.generation)this.jobs.delete(k);});this.jobs.set(k,job);return job;})));if(generation!==this.generation)throw new Error('El catálogo de fuentes cambió durante la carga.');return this.list();}
 baseline(font:{family:string;size:number;weight:number;style?:FontStyle},lineHeight:number){if(!this.loader?.baseline)throw new Error('El consumidor debe medir la línea base de fuentes personalizadas.');return this.loader.baseline(font,lineHeight);}
 hasMeasure(){return !!this.loader?.measure;}
 measure(text:string,font:{family:string;size:number;weight:number;style?:FontStyle}){if(!this.loader?.measure)throw new Error('La fuente personalizada necesita medición real del consumidor.');return this.loader.measure(text,font);}
 referenceCSS(ids?:string[]){return this.definitions.filter(d=>!ids||ids.includes(d.id)).flatMap(d=>d.variants.map(v=>`@font-face{font-family:${this.family(d.id)};font-weight:${v.weight};font-style:${v.style??'normal'};src:${'url' in v.source?`url(${JSON.stringify(v.source.url)})`:`local(${JSON.stringify(v.source.local)})`};font-display:block;}`)).join('');}
 async css(mode:'reference'|'embed',ids:string[],uses?:{fontFamily:string;fontWeight:number;fontStyle?:FontStyle}[]){if(mode==='reference')return this.referenceCSS(ids);const ds=this.definitions.filter(d=>ids.includes(d.id)).map(d=>({...d,variants:d.variants.filter(v=>!uses||uses.some(n=>n.fontFamily===d.id&&n.fontWeight===v.weight&&(n.fontStyle??'normal')===(v.style??'normal')))}));if(!ds.length)return '';if(ds.some(d=>d.variants.some(v=>v.export!=='embed'||!('url' in v.source))))throw new Error('La inclusión de archivos de fuentes requiere permiso export:embed y bytes por URL para todas las variantes utilizadas.');if(!this.loader?.css)throw new Error('El consumidor no ofrece inclusión de archivos de fuentes.');const css=await this.loader.css(ds.map(d=>({...copy(d),id:this.family(d.id)})),mode);return ds.map(d=>`/* ${d.id}: ${(d.license??'Licencia bajo responsabilidad del consumidor').replaceAll('*/','* /').replaceAll('<','\\3c ')} */`).join('\n')+'\n'+css;}
 dispose(){this.generation++;this.loader?.dispose();this.loader=undefined;this.jobs.clear();}
}

/** Reject only newly selected unavailable variants; reopening missing-font documents stays possible. */
export function validateFontChanges(before:Project,after:Project,registry:FontRegistry,allowImported=false){
 const prior=new Map(before.nodes.map(n=>[n.id,{...n,...resolveNodeStyle(before,n)}]));
 for(const raw of after.nodes){const n={...raw,...resolveNodeStyle(after,raw)},old=prior.get(n.id);if(old&&n.fontFamily===old.fontFamily&&n.fontWeight===old.fontWeight&&(n.fontStyle??'normal')===(old.fontStyle??'normal'))continue;if(allowImported&&!old&&/^(dom-|fg-)/.test(n.id)&&n.fontFamily.startsWith('font-'))continue;const issue=registry.issue(n);if(issue)throw new Error(issue.message);}
 for(const [id,t] of Object.entries(after.designThemes))for(const mode of ['light','dark'] as const)for(const [key,v] of Object.entries(t.modes[mode].typography)){const old=before.designThemes[id]?.modes[mode].typography[key];if(old&&JSON.stringify(old)===JSON.stringify(v))continue;if(allowImported&&!old&&v.fontFamily.startsWith('font-'))continue;const issue=registry.issue({id:`token:${id}:${mode}:${key}`,fontFamily:v.fontFamily,fontWeight:v.fontWeight,fontStyle:v.fontStyle});if(issue)throw new Error(issue.message);}
}

/** Imported names stay identifiable until the host supplies the actual resource. */
export function importedFontFamily(p:Project,raw:string,note:(message:string)=>void):string{
 const name=raw.split(',')[0].replace(/^["']|["']$/g,'').trim();const found=fontsFor(p)?.list().find(f=>f.id===name||f.name.toLowerCase()===name.toLowerCase());if(found)return found.id;
 if(['system','system-ui','-apple-system','BlinkMacSystemFont','Arial','Helvetica','sans-serif'].some(n=>n.toLowerCase()===name.toLowerCase()))return 'system';
 if(['serif','Georgia','Times','Times New Roman'].some(n=>n.toLowerCase()===name.toLowerCase()))return 'serif';
 if(['mono','monospace','ui-monospace','Courier','Courier New','Menlo','SFMono-Regular','Consolas'].some(n=>n.toLowerCase()===name.toLowerCase()))return 'mono';
 let hash=2166136261;for(const c of name)hash=Math.imul(hash^c.charCodeAt(0),16777619);const id=`font-${name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,70)}-${(hash>>>0).toString(16)}`;
 note(`Fuente pendiente: ${name||'sin nombre'} → ${id}. El IDE debe registrar sus archivos y variantes; no se sustituyó.`);return id;
}
