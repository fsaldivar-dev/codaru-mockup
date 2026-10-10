import type {Project,DesignNode} from './model';
import {ancestors,clone,rootIds,updateNode} from './model';
import {getComponentImplementations} from './implementations';
import {lintProject} from './lint';
import {identityHash} from './identity';
import {validateExperienceSpec} from './experience-spec';
import type {AccessibilityRole,ExperienceSpec,ExperienceReport,ExperienceEntry,ExperienceIssue,AnalyticsEventSpec} from './contracts';
export type {AccessibilityRole,AccessibilitySpec,AnalyticsEventSpec,ExperienceSpec,ExperienceReport,ExperienceEntry,ExperienceIssue} from './contracts';
export {validateExperienceSpec,accessibilityRoles,analyticsTriggers} from './experience-spec';
export function setExperience(p:Project,id:string,spec:ExperienceSpec|null){
 if(!p.nodes.some(n=>n.id===id))throw new Error('Elemento de experiencia no encontrado.');
 if(spec!==null)validateExperienceSpec(spec);
 updateNode(p,id,{experience:spec===null?undefined:clone(spec)});
}
const interactiveRoles = new Set(['button','link','textbox','checkbox','switch','slider','tab']);
export function suggestedExperience(n:DesignNode):ExperienceEntry['suggested'] {
 const role:AccessibilityRole|undefined=n.type==='button'?'button':n.type==='input'?'textbox':n.targetId?'link':n.type==='image'||n.type==='vector'||n.type==='icon'?'img':undefined;
 return {role,...(n.text.trim()&&n.type!=='input'?{name:n.text.slice(0,500)}:{}),testId:n.id.length<=121?'codaru-'+n.id:'codaru-'+n.id.slice(0,100)+identityHash(n.id).slice(0,16)};
}
function placement(e:AnalyticsEventSpec){return {press:'En el manejador de activación, una vez por acción; incluye teclado y tecnología de asistencia.',view:'Al entrar realmente en pantalla; define visibilidad, duración y deduplicación por visita.',change:'Tras confirmar un cambio significativo; define debounce y evita capturar texto escrito.',submit:'Al validar y aceptar el envío del formulario; no confundas intento con éxito.',success:'Después de confirmar el resultado exitoso de la operación; no en el clic inicial.',failure:'En la rama de error de la operación; usa un código permitido y evita mensajes con datos personales.'}[e.trigger];}
export function experienceReport(p:Project,options:{ids?:string[];frameId?:string}={}):ExperienceReport {
 const tops=rootIds(p),nodes=p.nodes,byId=new Map(nodes.map(n=>[n.id,n]));
 if(options.ids&&(!Array.isArray(options.ids)||options.ids.some(id=>!byId.has(id))))throw new Error('Elemento de experiencia no encontrado.');
 if(options.frameId&&!nodes.some(n=>n.id===options.frameId&&n.type==='frame'))throw new Error('Pantalla de experiencia no encontrada.');
 const selected=nodes.filter(n=>(!options.ids||options.ids.includes(n.id))&&(!options.frameId||n.id===options.frameId||ancestors(p,n.id).some(a=>a.id===options.frameId)));
 const issues:ExperienceIssue[]=[],entries:ExperienceEntry[]=[];
 const ids=new Map<string,string[]>(),orders=new Map<string,string[]>();
 for(const n of nodes){{const key=n.experience?.testId??suggestedExperience(n).testId;const list=ids.get(key)??[];list.push(n.id);ids.set(key,list);}const a=n.experience?.accessibility;if(a?.focusOrder!==undefined){const k=`${tops.get(n.id)}:${a.focusOrder}`,list=orders.get(k)??[];list.push(n.id);orders.set(k,list);}}
 const eventSchemas=new Map<string,Set<string>>();
 for(const n of nodes)for(const e of n.experience?.analytics??[]){const set=eventSchemas.get(e.name)??new Set<string>();set.add(JSON.stringify(Object.entries(e.properties??{}).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,v.type])));eventSchemas.set(e.name,set);}
 for(const n of selected){
  const spec=clone(n.experience??{}),a=spec.accessibility??{},suggested=suggestedExperience(n),role=a.role??suggested.role;
  const top=byId.get(tops.get(n.id)??''),frameId=top?.type==='frame'?top.id:null;
  const visible=!n.hidden&&!ancestors(p,n.id).some(v=>v.hidden);
  const interactive=!!role&&interactiveRoles.has(role);
  const add=(rule:string,severity:ExperienceIssue['severity'],message:string,fix:string,verification:ExperienceIssue['verification']='design')=>issues.push({rule,nodeId:n.id,frameId,severity,message,fix,verification});
  if((ids.get(spec.testId??suggested.testId)?.length??0)>1)add('test-id-duplicate','error','Identificador de prueba repetido.','Asigna un testId único a cada instancia o utiliza el ID estable de la capa.');
  if(a.focusOrder!==undefined&&(orders.get(`${tops.get(n.id)}:${a.focusOrder}`)?.length??0)>1)add('focus-order-duplicate','warning','Dos elementos comparten el orden de foco.','Define un recorrido sin ambigüedad dentro de la pantalla.');
  if(visible){
   if(interactive&&!a.role)add('accessible-role','warning','Falta declarar el rol accesible.','Confirma el rol sugerido antes de implementarlo.');
   if((interactive||role==='img'||role==='region')&&!a.decorative&&!a.name&&!a.nameKey)add('accessible-name','warning','Falta un nombre accesible explícito.','Añade nombre o clave de traducción; el placeholder de un campo no es su etiqueta.','implementation');
   if(interactive&&a.decorative)add('decorative-control','error','Un control no puede ocultarse como decoración.','Conserva el control en el árbol accesible.');
   if(interactive&&(!a.keyboard?.length||a.focus!=='visible'))add('keyboard-focus','warning','Teclado o indicador de foco pendientes.','Define las teclas y verifica el foco visible en el producto.','implementation');
   if(n.animations?.length&&a.reducedMotion!==true)add('reduced-motion','warning','No se definió la alternativa de movimiento reducido.','Añade una alternativa sin movimiento esencial.','implementation');
   if(interactive&&spec.analytics===undefined)add('analytics-placement','info','Sin decisión de analítica para esta interacción.','Define eventos con propósito o declara una lista vacía si no requiere instrumentación.');
  }
  for(const e of spec.analytics??[]){
   if(e.consent===undefined)add('analytics-consent','warning',`Decisión de consentimiento pendiente para ${e.name}.`,'Define required o not-required con el equipo del producto.','implementation');
   if(Object.values(e.properties??{}).some(v=>v.sensitive===true))add('analytics-sensitive','warning',`Propiedades sensibles declaradas en ${e.name}.`,'Revisa minimización y permiso antes de implementar su captura.','implementation');
   if((eventSchemas.get(e.name)?.size??0)>1)add('analytics-schema','error',`El evento ${e.name} tiene esquemas incompatibles.`,'Unifica nombres y tipos o utiliza otro nombre de evento.');
   if(e.trigger==='success'||e.trigger==='failure')add('analytics-result','info',`${e.name} debe depender del resultado real.`,'Instrumenta la resolución de la operación; no la activación del botón.','implementation');
  }
  const testId=spec.testId??suggested.testId;
  const assertions:ExperienceEntry['tests']['assertions']=[{kind:'locator',expected:`Identificador único: ${testId}`,verification:'automated'}];
  if(role&&!a.decorative)assertions.push({kind:'role',expected:role,verification:'automated'});
  if(a.name||a.nameKey)assertions.push({kind:a.nameKey?'localized-name':'accessible-name',expected:a.nameKey??a.name!,verification:'automated'});
  if(a.decorative)assertions.push({kind:'decorative',expected:'Ausente del árbol accesible',verification:'automated'});
  for(const key of a.keyboard??[])assertions.push({kind:'keyboard',expected:`${key}: activa o manipula el control sin ratón; comprueba resultado y foco`,verification:'manual'});
  if(a.focus==='visible')assertions.push({kind:'focus',expected:'Foco visible, recorrido lógico y sin trampas',verification:'manual'});
  for(const state of a.states??[])assertions.push({kind:'state',expected:`${state}: refleja el estado real y sus cambios`,verification:'automated'});
  if(a.live&&a.live!=='off')assertions.push({kind:'live',expected:`Anunciar cambios con prioridad ${a.live}`,verification:'manual'});
  if(a.reducedMotion)assertions.push({kind:'reduced-motion',expected:'Respeta la preferencia de movimiento reducido',verification:'automated'});
  for(const e of spec.analytics??[])assertions.push({kind:'analytics',expected:`${e.name}: ${e.trigger}; emitir una vez, respetar consentimiento y esquema`,verification:'automated'});
  for(const expected of spec.acceptance??[])assertions.push({kind:'acceptance',expected,verification:'manual'});
  entries.push({nodeId:n.id,frameId,name:n.name,visible,spec,suggested,implementation:getComponentImplementations(p,n.id),instrumentation:(spec.analytics??[]).map(event=>({event,where:placement(event),platforms:{web:'Manejador semántico del componente y resultado de la operación; adaptador de analítica del host.',ios:'Acción del control y resultado de la operación; adaptador de analítica de la aplicación.',android:'Acción semántica del control y resultado de la operación; adaptador de analítica de la aplicación.'}})),tests:{bindings:{web:`data-testid=${testId}`,ios:`accessibilityIdentifier=${testId}`,android:`testTag=${testId} (Compose) o resource-id equivalente`},assertions}});
 }
 const emitted=new Set(entries.map(e=>e.nodeId));
 const frames=new Set(entries.map(e=>e.frameId).filter(Boolean));
 const lintFrame=options.frameId??(options.ids&&frames.size===1?[...frames][0]!:undefined);
 for(const issue of lintProject(p,{frame:lintFrame}).filter(i=>emitted.has(i.node)&&['contrast','target','text-fit','overflow','safe-area','hinge','overlap'].includes(i.rule)))issues.push({rule:issue.rule,nodeId:issue.node,frameId:issue.frame,severity:issue.severity,message:issue.message,fix:issue.fix,verification:'design'});
 return {format:'codaru-experience/1',revision:identityHash(JSON.stringify(p)),entries,issues,runtimeChecks:['Verificar nombre, rol, estados y anuncios con lectores de pantalla reales.','Probar navegación por teclado, foco visible y ausencia de trampas en el producto.','Probar zoom, reflujo, traducciones, contraste renderizado y tamaño/espaciado de objetivos; la geometría del mockup es una aproximación.','Conectar identificadores al código antes de ejecutar pruebas; los selectores sugeridos aún no existen en la aplicación.','Validar los eventos con un adaptador de pruebas y comprobar consentimiento, deduplicación y ausencia de datos personales.']};
}
