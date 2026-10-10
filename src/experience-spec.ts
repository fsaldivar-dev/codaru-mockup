import type {ExperienceSpec} from './contracts';
export const accessibilityRoles = ['button','link','textbox','checkbox','switch','slider','tab','heading','img','region','status'] as const;
export const analyticsTriggers = ['press','view','change','submit','success','failure'] as const;
function check(value:unknown,message:string):asserts value {if(!value)throw new Error(message);}
function object(value:unknown,keys?:string[]):asserts value is Record<string,unknown> {
 check(value&&typeof value==='object'&&!Array.isArray(value),'Contrato de experiencia inválido.');
 if(keys)check(Object.keys(value as object).every(k=>keys.includes(k)),'Campo desconocido en contrato de experiencia.');
}
function text(value:unknown,max=500){check(typeof value==='string'&&value.trim()&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value),'Texto de experiencia vacío, demasiado largo o inválido.');}
function list(value:unknown,max:number){check(Array.isArray(value)&&value.length<=max&&new Set(value).size===value.length,'Lista de experiencia inválida o repetida.');value.forEach(v=>text(v));}
function key(value:unknown){check(typeof value==='string'&&/^[a-zA-Z][a-zA-Z0-9_.-]{0,127}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value),'Usa un identificador de 1–128 caracteres: letras, números, punto, guion o guion bajo.');}
export function validateExperienceSpec(value:unknown):asserts value is ExperienceSpec {
 object(value,['accessibility','analytics','testId','acceptance']);
 if(value.testId!==undefined)key(value.testId);
 if(value.acceptance!==undefined)list(value.acceptance,20);
 if(value.accessibility!==undefined){
  const a=value.accessibility;object(a,['role','name','nameKey','description','decorative','keyboard','focus','focusOrder','live','reducedMotion','states']);
  if(a.role!==undefined)check(accessibilityRoles.includes(a.role as any),'Rol accesible inválido.');
  for(const k of ['name','nameKey','description'])if(a[k]!==undefined)text(a[k]);
  for(const k of ['decorative','reducedMotion'])if(a[k]!==undefined)check(typeof a[k]==='boolean','Opción accesible inválida.');
  if(a.keyboard!==undefined)list(a.keyboard,12);
  if(a.focus!==undefined)check(a.focus==='visible'||a.focus==='not-focusable','Foco inválido.');
  if(a.focusOrder!==undefined)check(Number.isInteger(a.focusOrder)&&Number(a.focusOrder)>=0&&Number(a.focusOrder)<=3000,'Orden de foco inválido.');
  if(a.live!==undefined)check(['off','polite','assertive'].includes(String(a.live)),'Anuncio accesible inválido.');
  if(a.states!==undefined){list(a.states,6);check((a.states as string[]).every(s=>['disabled','checked','selected','expanded','invalid','busy'].includes(s)),'Estado accesible inválido.');}
 }
 if(value.analytics!==undefined){
  check(Array.isArray(value.analytics)&&value.analytics.length<=20,'Máximo 20 eventos por elemento.');
  const names=new Set<string>();
  for(const e of value.analytics){
   object(e,['name','trigger','purpose','consent','properties']);key(e.name);text(e.purpose);
   check(!names.has(e.name as string),'Evento repetido en el elemento.');names.add(e.name as string);
   check(analyticsTriggers.includes(e.trigger as any),'Disparador de analítica inválido.');
   if(e.consent!==undefined)check(e.consent==='required'||e.consent==='not-required','Consentimiento inválido.');
   if(e.properties!==undefined){object(e.properties);check(Object.keys(e.properties).length<=32,'Máximo 32 propiedades por evento.');for(const [k,v] of Object.entries(e.properties)){key(k);object(v,['type','source','sensitive']);check(['string','number','boolean'].includes(String(v.type)),'Tipo de propiedad inválido.');text(v.source);if(v.sensitive!==undefined)check(typeof v.sensitive==='boolean','Clasificación de propiedad inválida.');}}
  }
 }
 check(JSON.stringify(value).length<=64000,'Contrato de experiencia demasiado grande.');
}
