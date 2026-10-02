import { clone, tokens as baseColors, uid, type Project, type Theme } from './model';
import { effectiveTheme, resolveColor, type TokenSet } from './themes';
import { escape as esc } from './render';

type Category = keyof TokenSet;
const categories: [Category, string][] = [['colors','Colores'],['gradients','Degradados'],['materials','Materiales'],['typography','Tipografía'],['radii','Radios']];
interface ThemeEditorOptions { root: HTMLElement; get: () => Project; commit: (fn: (p: Project) => void) => void; undo: () => void; close: () => void; }

/** A local token editor: one committed change is one undo entry. */
export function openThemeEditor(options: ThemeEditorOptions) {
  const { root, get, commit } = options;
  let profile = get().activeThemeId, mode: Theme = get().theme, category: Category = 'colors', key = 'primary', error = '';
  const context = () => ({ ...get(), activeThemeId: profile, theme: mode });
  const set = () => effectiveTheme(context()).tokens;
  const color = (value: string) => resolveColor(context(), value);
  const entryName = (value: unknown, id: string) => typeof value === 'object' && value ? (value as { name: string }).name : id;
  const input = (label: string, field: string, value: string | number, min?: number, max?: number, step = 1) => `<label class="full-field"><span>${label}</span><input aria-label="${label}" data-te-field="${field}" value="${esc(value)}" ${typeof value === 'number' ? `type="number" min="${min}" max="${max}" step="${step}"` : 'maxlength="200"'}/></label>`;
  const select = (label: string, field: string, value: string, choices: [string,string][]) => `<label class="full-field"><span>${label}</span><select aria-label="${label}" data-te-field="${field}">${choices.map(([id,name])=>`<option value="${id}" ${id===value?'selected':''}>${name}</option>`).join('')}</select></label>`;
  function update(fn: (p: Project) => void) {
    try { commit(fn); error = ''; } catch (e) { error = e instanceof Error ? e.message : 'No se pudo guardar'; }
    draw();
  }
  function preview() {
    const s = set(); const gradient = category === 'gradients' ? s.gradients[key] : s.gradients.brand;
    const paint = gradient ? `${gradient.type==='radial'?'radial-gradient(circle':`linear-gradient(${gradient.angle}deg`},${gradient.stops.map(stop=>`${color(stop.color)} ${stop.position}%`).join(',')})` : color('@primary');
    const material = category === 'materials' ? s.materials[key] : undefined;
    const type = category === 'typography' ? s.typography[key] : s.typography.body;
    const radius = category === 'radii' ? s.radii[key] : s.radii.panel ?? 20;
    const glass = material ? `background:color-mix(in srgb,${color(material.tint)} ${material.opacity}%,transparent);backdrop-filter:blur(${material.blur}px) saturate(${material.saturation}%);-webkit-backdrop-filter:blur(${material.blur}px) saturate(${material.saturation}%);border:1px solid ${color(material.stroke)};box-shadow:0 8px ${material.shadow}px #0003;` : `background:${color('@surface')};border:1px solid ${color('@border')};`;
    return `<div class="theme-sample" style="background:${esc(paint)}"><span class="sample-orb"></span><div class="theme-sample-card" style="${esc(glass)}border-radius:${radius}px;color:${color('@text')};font-family:${type?.fontFamily==='serif'?'Georgia,serif':type?.fontFamily==='mono'?'monospace':'system-ui'};font-size:${Math.min(type?.fontSize??16,36)}px;font-weight:${type?.fontWeight??400};line-height:${type?.lineHeight??1.4}"><small>VISTA PREVIA · ${mode==='light'?'CLARO':'OSCURO'}</small><span>Tu próxima idea</span><p style="color:${color('@muted')}">Un sistema visual que crece contigo.</p><span class="sample-button" style="background:${color('@primary')};border-radius:${s.radii.control??10}px">Continuar →</span></div></div>`;
  }
  function fields(): string {
    const s = set();
    if (category === 'colors') return `${input('Valor del color','value',s.colors[key])}<p class="field-note">HEX, transparent o referencia @primary. Las referencias se actualizan juntas.</p>`;
    if (category === 'radii') return input('Radio del token','value',s.radii[key],0,10000);
    if (category === 'gradients') {
      const g=s.gradients[key];
      return `${input('Nombre del token','name',g.name)}<div class="field-grid">${select('Tipo de degradado','type',g.type,[['linear','Lineal'],['radial','Radial']])}${input('Ángulo del token','angle',g.angle,-360,360)}</div><div class="stops-heading">Paradas <span>Color / posición %</span></div>${g.stops.map((stop,i)=>`<div class="gradient-stop"><span class="stop-chip" style="background:${color(stop.color)}"></span>${input(`Color parada ${i+1}`,`stop-color-${i}`,stop.color)}${input(`Posición parada ${i+1}`,`stop-position-${i}`,stop.position,0,100,.1)}<button data-te-remove-stop="${i}" aria-label="Quitar parada ${i+1}" ${g.stops.length<=2?'disabled':''}>×</button></div>`).join('')}<button class="wide-button" data-te="add-stop" ${g.stops.length>=16?'disabled':''}>+ Añadir parada</button>`;
    }
    if (category === 'materials') {
      const m=s.materials[key];
      return `${input('Nombre del token','name',m.name)}${input('Tinte','tint',m.tint)}<div class="field-grid">${input('Transparencia: tinte %','opacity',m.opacity,0,100)}${input('Desenfoque px','blur',m.blur,0,40)}${input('Saturación %','saturation',m.saturation,0,200)}${input('Sombra px','shadow',m.shadow,0,40)}</div>${input('Borde del material','stroke',m.stroke)}<p class="field-note">Simulación de vidrio. El desenfoque necesita contenido detrás; el SVG conserva tinte y borde.</p>`;
    }
    const t=s.typography[key];
    return `${input('Nombre del token','name',t.name)}${select('Familia del token','fontFamily',t.fontFamily,[['system','Sistema'],['serif','Serif'],['mono','Monoespaciada']])}<div class="field-grid">${input('Tamaño del token','fontSize',t.fontSize,1,512)}${input('Peso del token','fontWeight',t.fontWeight,100,900)}${input('Interlineado del token','lineHeight',t.lineHeight,.5,5,.1)}</div>`;
  }
  function draw() {
    if (!get().designThemes[profile]) profile=get().activeThemeId;
    const entries=Object.entries(set()[category]); if(!entries.some(([id])=>id===key))key=entries[0]?.[0]??'';
    root.innerHTML=`<div class="modal-backdrop"><section class="theme-dialog" role="dialog" aria-modal="true" aria-label="Editor de temas"><header><div><span class="eyebrow">SISTEMA DE DISEÑO</span><h2>Temas y tokens</h2></div><button data-te="close" aria-label="Cerrar temas">Cerrar ×</button></header><div class="theme-controls"><label class="full-field"><span>Perfil</span><select aria-label="Perfil de tema" data-te-profile>${Object.values(get().designThemes).map(t=>`<option value="${t.id}" ${t.id===profile?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label><label class="full-field"><span>Nombre del perfil</span><input data-te-name aria-label="Nombre del perfil" value="${esc(get().designThemes[profile].name)}" maxlength="200"/></label><button data-te="duplicate">+ Duplicar tema</button><button data-te="activate" ${get().activeThemeId===profile?'disabled':''}>Usar en documento</button><select data-te-mode aria-label="Modo a editar"><option value="light" ${mode==='light'?'selected':''}>Claro</option><option value="dark" ${mode==='dark'?'selected':''}>Oscuro</option></select></div><nav class="theme-categories" aria-label="Tipos de token">${categories.map(([id,name])=>`<button data-te-category="${id}" aria-pressed="${category===id}">${name}</button>`).join('')}</nav><div class="theme-body"><aside class="token-list">${entries.map(([id,value])=>`<button data-te-key="${id}" aria-pressed="${key===id}">${category==='colors'?`<i style="background:${color(String(value))}"></i>`:''}<span>${esc(entryName(value,id))}<small>${esc(id)}</small></span></button>`).join('')}<input aria-label="Identificador del nuevo token" id="new-token-id" placeholder="mi-token" maxlength="128"/><button data-te="add-token" class="add-token">+ Crear token</button></aside><section class="token-fields"><code>${esc(category)}.${esc(key)}</code>${key?fields():'Crea el primer token.'}<p class="theme-error" role="alert">${esc(error)}</p></section><aside class="theme-preview">${preview()}<p>Editas el modo <strong>${mode==='light'?'claro':'oscuro'}</strong>. Cada pantalla puede heredar el tema o elegir uno propio.</p><p>Los cambios se guardan en el documento. Vincula los elementos desde «Tokens» en Propiedades.</p></aside></div><footer><span>Tokens compartidos · guardado local</span><button data-te="undo">↶ Deshacer cambio</button><button class="primary" data-te="close">Listo</button></footer></section></div>`;
  }
  root.onclick=e=>{
    const el=(e.target as HTMLElement).closest<HTMLElement>('button');if(!el)return;
    if(el.dataset.teCategory){category=el.dataset.teCategory as Category;key='';error='';draw();return;}
    if(el.dataset.teKey){key=el.dataset.teKey;error='';draw();return;}
    if(el.dataset.teRemoveStop!==undefined){const index=Number(el.dataset.teRemoveStop);update(p=>p.designThemes[profile].modes[mode].gradients[key].stops.splice(index,1));return;}
    switch(el.dataset.te){
      case 'close':options.close();break;
      case 'undo':options.undo();error='';draw();break;
      case 'duplicate':{const id=uid();update(p=>{const theme=clone(p.designThemes[profile]);if(profile==='project')for(const m of ['light','dark'] as const)Object.assign(theme.modes[m].colors,p.themes[m]);theme.id=id;theme.name+=' · copia';p.designThemes[id]=theme;});if(get().designThemes[id])profile=id;draw();break;}
      case 'activate':update(p=>{p.activeThemeId=profile;});break;
      case 'add-token':{
        const id=(root.querySelector<HTMLInputElement>('#new-token-id')?.value??'').trim();
        if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)||['constructor','prototype','__proto__'].includes(id)){error='Escribe un identificador: letras, números, guiones o guion bajo.';draw();return;}
        if(['light','dark'].some(m=>Object.hasOwn(get().designThemes[profile].modes[m as Theme][category],id))||['colors','gradients'].includes(category)&&Object.hasOwn(set()[category==='colors'?'gradients':'colors'],id)){error='Ese identificador ya existe.';draw();return;}

        update(p=>{for(const m of ['light','dark'] as const){const s=p.designThemes[profile].modes[m];if(category==='colors')s.colors[id]='#7955e8';else if(category==='radii')s.radii[id]=16;else if(category==='gradients')s.gradients[id]={name:'Nuevo degradado',type:'linear',angle:135,stops:[{color:'@primary',position:0},{color:'@accent',position:100}]};else if(category==='materials')s.materials[id]={name:'Nuevo material',tint:'@surface',opacity:65,blur:16,saturation:150,stroke:'@border',shadow:16};else s.typography[id]={name:'Nuevo estilo',fontFamily:'system',fontSize:16,fontWeight:400,lineHeight:1.4};}});key=id;draw();break;
      }
      case 'add-stop':update(p=>{const stops=p.designThemes[profile].modes[mode].gradients[key].stops;let index=0;for(let i=1;i<stops.length-1;i++)if(stops[i+1].position-stops[i].position>stops[index+1].position-stops[index].position)index=i;stops.splice(index+1,0,{color:'@accent',position:(stops[index].position+stops[index+1].position)/2});});break;
    }
  };
  root.onchange=e=>{
    const el=e.target as HTMLInputElement|HTMLSelectElement;
    if(el.hasAttribute('data-te-profile')){profile=el.value;error='';draw();return;}
    if(el.hasAttribute('data-te-mode')){mode=el.value as Theme;error='';draw();return;}
    if(el.hasAttribute('data-te-name')){update(p=>{p.designThemes[profile].name=el.value;});return;}
    const field=el.dataset.teField;if(!field)return;
    if(!el.checkValidity()){error='Introduce un valor dentro del rango indicado.';draw();return;}
    const value=el instanceof HTMLInputElement&&el.type==='number'?Number(el.value):el.value;
    update(p=>{
      const s=p.designThemes[profile].modes[mode];
      if(category==='colors'){s.colors[key]=String(value);if(profile==='project'&&(baseColors as readonly string[]).includes(key))p.themes[mode][key]=String(value);}
      else if(category==='radii')s.radii[key]=Number(value);
      else if(category==='gradients'&&field.startsWith('stop-')){const [,prop,index]=field.split('-');const stop=s.gradients[key].stops[Number(index)];if(prop==='color')stop.color=String(value);else stop.position=Number(value);s.gradients[key].stops.sort((a,b)=>a.position-b.position);}
      else Object.assign(s[category][key],{[field]:value});
    });
  };
  root.onkeydown=e=>{if(e.key==='Tab'){const elements=[...root.querySelectorAll<HTMLElement>('button:not(:disabled),input,select')];if(e.shiftKey&&(root.getRootNode() as Document | ShadowRoot).activeElement===elements[0]){e.preventDefault();elements.at(-1)?.focus();}else if(!e.shiftKey&&(root.getRootNode() as Document | ShadowRoot).activeElement===elements.at(-1)){e.preventDefault();elements[0]?.focus();}}};
  draw();root.querySelector<HTMLSelectElement>('[data-te-profile]')?.focus();
}
