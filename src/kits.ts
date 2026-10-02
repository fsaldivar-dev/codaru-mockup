import { ancestors, containerKinds, instantiate, node, updateNode, type DesignNode, type Project } from './model';
import { defaultDesignTheme, type DesignTheme } from './themes';

/** Original editable drawings inspired by platform conventions; no native widgets or vendor assets. */
export type KitId = 'ios' | 'macos' | 'android' | 'linux' | 'web';
export type KitVariant = 'default' | 'selected' | 'disabled';
export interface KitItem { id: string; name: string; category: string; width: number; height: number }
export const kits: ReadonlyArray<{ id: KitId; name: string; description: string; version: string }> = [
  { id: 'ios', name: 'iOS', description: 'Controles amplios, superficies suaves y navegación móvil. Diseño original.', version: '1' },
  { id: 'macos', name: 'macOS', description: 'Ventanas, barras compactas y paneles para escritorio. Diseño original.', version: '1' },
  { id: 'android', name: 'Android', description: 'Formas redondeadas, campos delineados y navegación inferior. Diseño original.', version: '1' },
  { id: 'linux', name: 'Linux', description: 'Paneles sobrios y cabeceras inspiradas en GNOME / Adwaita. Diseño original.', version: '1' },
  { id: 'web', name: 'Web', description: 'Formularios, paneles y navegación para aplicaciones web. Diseño original.', version: '1' },
];
interface Profile { control: number; radius: number; panel: number; font: number; mobile: boolean; light: string[]; dark: string[] }
const profiles: Record<KitId, Profile> = {
  ios: { control: 48, radius: 12, panel: 20, font: 16, mobile: true,
    light: ['#2563eb', '#ffffff', '#f2f3f7', '#172033', '#6d7584', '#dfe3eb', '#e9f0ff'],
    dark: ['#79a7ff', '#232731', '#12151c', '#f3f6ff', '#a5afc2', '#3c4354', '#293a58'] },
  macos: { control: 32, radius: 7, panel: 12, font: 13, mobile: false,
    light: ['#4264d0', '#ffffff', '#f0f1f4', '#222633', '#747b8d', '#d6d9e2', '#e6ebfb'],
    dark: ['#92a6ff', '#2b2c34', '#1c1d24', '#f0f1f6', '#a2a7b7', '#464856', '#373e60'] },
  android: { control: 52, radius: 26, panel: 28, font: 15, mobile: true,
    light: ['#6b4bb5', '#fffbff', '#f6f1fa', '#292136', '#797082', '#d6cfe0', '#e9ddff'],
    dark: ['#d2b8ff', '#2a2234', '#19141f', '#f5eafa', '#bcb0c9', '#51445f', '#483465'] },
  linux: { control: 38, radius: 8, panel: 12, font: 14, mobile: false,
    light: ['#257b67', '#ffffff', '#f1f3f2', '#25302d', '#727d78', '#d5dcd8', '#e1f0e8'],
    dark: ['#7bcbb1', '#2b3431', '#1b211f', '#eef5f1', '#acb9b2', '#45534c', '#304d42'] },
  web: { control: 42, radius: 6, panel: 10, font: 14, mobile: false,
    light: ['#c25032', '#ffffff', '#f7f6f3', '#2d2b29', '#807a72', '#e3dfd8', '#fbeae3'],
    dark: ['#ffab8f', '#322d2a', '#211d1b', '#fff4ec', '#bdb0a5', '#51463f', '#563b30'] },
};
const colorKeys = ['primary', 'surface', 'background', 'text', 'muted', 'border', 'accent'];
function profile(kit: KitId) { const p = profiles[kit]; if (!Object.hasOwn(profiles, kit)) throw new Error('Kit desconocido'); return p; }
function kitTheme(kit: KitId): DesignTheme {
  const p = profile(kit), theme = defaultDesignTheme(`kit-${kit}-v1`, `${kits.find(k => k.id === kit)!.name} · Original`);
  for (const mode of ['light', 'dark'] as const) {
    const set = theme.modes[mode];
    set.colors = Object.fromEntries(colorKeys.map((key, i) => [key, p[mode][i]]));
    set.gradients.brand = { name: 'Acento suave', type: 'linear', angle: 135, stops: [{ color: '@primary', position: 0 }, { color: '@accent', position: 100 }] };
    set.materials.glass = { name: 'Panel translúcido', tint: '@surface', opacity: mode === 'dark' ? 88 : 92, blur: kit === 'macos' || kit === 'ios' ? 18 : 8, saturation: 110, stroke: '@border', shadow: 8 };
    set.typography = {
      body: { name: 'Texto', fontFamily: 'system', fontSize: p.font, fontWeight: 400, lineHeight: 1.35 },
      heading: { name: 'Título', fontFamily: 'system', fontSize: p.mobile ? 22 : 18, fontWeight: 650, lineHeight: 1.25 },
      caption: { name: 'Detalle', fontFamily: 'system', fontSize: p.font - 2, fontWeight: 400, lineHeight: 1.35 },
    };
    set.radii = { control: p.radius, panel: p.panel };
  }
  return theme;
}
/** Imports a kit's tokens once; edits made by the document owner always survive. */
export function ensureKitTheme(p: Project, kit: KitId): string {
  profile(kit); const id = `kit-${kit}-v1`;
  if (!p.designThemes[id]) p.designThemes[id] = kitTheme(kit);
  return id;
}

export function getKitItems(kit: KitId): KitItem[] {
  const p = profile(kit), h = p.control, wide = p.mobile ? 328 : 300;
  return [
    ['button', 'Botón', 'Controles', p.mobile ? 160 : 132, h],
    ['field', 'Campo de texto', 'Controles', wide, h + 26],
    ['search', 'Búsqueda', 'Controles', wide, h],
    ['toggle', 'Interruptor', 'Controles', 232, Math.max(h, 44)],
    ['checkbox', 'Casilla', 'Controles', 232, 36],
    ['radio', 'Opción única', 'Controles', 232, 36],
    ['slider', 'Deslizador', 'Controles', wide, 56],
    ['progress', 'Progreso', 'Controles', wide, 48],
    ['badge', 'Etiqueta', 'Contenido', 100, 28],
    ['avatar', 'Avatar', 'Contenido', 56, 56],
    ['list-row', 'Fila de lista', 'Contenido', wide, p.mobile ? 76 : 64],
    ['card', 'Tarjeta', 'Contenido', wide, p.mobile ? 244 : 220],
    ['segments', kit === 'web' ? 'Pestañas' : 'Selector segmentado', 'Navegación', wide, h],
    ['navbar', p.mobile ? 'Navegación móvil' : 'Cabecera', 'Navegación', p.mobile ? 360 : 520, kit === 'ios' ? 104 : kit === 'android' ? 80 : 56],
    ['toolbar', 'Barra de herramientas', 'Navegación', p.mobile ? 360 : 420, p.mobile ? 56 : 44],
    ['dialog', 'Diálogo', 'Paneles', p.mobile ? 320 : 360, kit === 'ios' ? 228 : 220],
    ['toast', 'Aviso', 'Paneles', p.mobile ? 328 : 360, 72],
    ['sidebar', p.mobile ? 'Menú lateral móvil' : 'Barra lateral', 'Navegación', p.mobile ? 268 : 232, 304],
    ['window', p.mobile ? 'Pantalla inicial' : kit === 'web' ? 'Panel web' : 'Ventana', 'Paneles', p.mobile ? 360 : kit === 'web' ? 560 : 520, p.mobile ? 480 : 340],
    ['menu', 'Menú de acciones', 'Paneles', p.mobile ? 252 : 224, 188],
  ].map(([id, name, category, width, height]) => ({ id: String(id), name: String(name), category: String(category), width: Number(width), height: Number(height) }));
}

function makeTemplate(kit: KitId, item: KitItem, variant: KitVariant, componentId: string): DesignNode[] {
  const p = profile(kit), { width: w, height: h } = item, selected = variant === 'selected';
  const root = node('group', { id: `${componentId}-root`, name: `${kits.find(k => k.id === kit)!.name} · ${item.name}`, width: w, height: h, kitId: kit, themeId: `kit-${kit}-v1`, opacity: variant === 'disabled' ? 45 : 100 });
  const ns = [root]; let serial = 0;
  const add = (type: DesignNode['type'], name: string, x: number, y: number, width: number, height: number, patch: Partial<DesignNode> = {}, parent = root.id) => {
    const n = node(type, { id: `${componentId}-${++serial}`, parentId: parent, name, x, y, width, height, fill: 'transparent', color: '@text', fontSize: p.font, lineHeight: 1.35, ...patch });
    ns.push(n); return n.id;
  };
  const box = (name: string, x: number, y: number, width: number, height: number, patch: Partial<DesignNode> = {}, parent = root.id) => add('rect', name, x, y, width, height, { fill: '@surface', radius: p.radius, radiusToken: 'control', ...patch }, parent);
  const text = (name: string, value: string, x: number, y: number, width: number, patch: Partial<DesignNode> = {}, parent = root.id) => add('text', name, x, y, width, Number(patch.height || 24), { text: value, typographyToken: 'body', ...patch }, parent);
  const group = (name: string, x: number, y: number, width: number, height: number, parent = root.id) => add('group', name, x, y, width, height, {}, parent);
  const caption = (value: string, x: number, y: number, width: number, parent = root.id) => text('Detalle', value, x, y, width, { color: '@muted', typographyToken: undefined, fontSize: p.font - 2, height: 20 }, parent);
  const heading = (value: string, x: number, y: number, width: number, parent = root.id) => text('Título', value, x, y, width, { typographyToken: 'heading', fontSize: p.mobile ? 22 : 18, fontWeight: 650, height: 30 }, parent);
  const dot = (name: string, x: number, y: number, size: number, fill: string, parent = root.id) => add('ellipse', name, x, y, size, size, { fill }, parent);
  const line = (x: number, y: number, width: number, parent = root.id) => box('Separador', x, y, width, 1, { fill: '@border', radiusToken: undefined, radius: 0 }, parent);
  const button = (label: string, x: number, y: number, width: number, height: number, primary = true, parent = root.id) => {
    const g = group(`Acción · ${label}`, x, y, width, height, parent);
    box('Fondo de botón', 0, 0, width, height, { fill: primary ? '@primary' : '@accent', strokeWidth: selected ? 2 : 0, stroke: '@primary' }, g);
    text('Etiqueta de botón', label, 8, (height - 22) / 2, width - 16, { color: primary ? '@background' : '@primary', textAlign: 'center', fontWeight: 600, height: 24 }, g);
    return g;
  };
  const icon = (name: string, x: number, y: number, size = 20, parent = root.id, fill = '@primary') => {
    const g = group(`Icono · ${name}`, x, y, size, size, parent);
    if (name === 'buscar') {
      add('ellipse', 'Lente', 1, 1, size - 7, size - 7, { fill: 'transparent', stroke: fill, strokeWidth: 2 }, g);
      box('Mango', size - 7, size - 7, 6, 6, { fill, radius: 2, radiusToken: undefined }, g);
    } else if (name === 'menú') {
      [3, 9, 15].forEach(yy => box('Línea', 1, yy * size / 20, size - 2, 2, { fill, radius: 1, radiusToken: undefined }, g));
    } else if (name === 'cuadrícula') {
      [[1, 1], [size / 2 + 1, 1], [1, size / 2 + 1], [size / 2 + 1, size / 2 + 1]].forEach(([xx, yy]) => box('Celda', xx, yy, size / 2 - 3, size / 2 - 3, { fill, radius: 2, radiusToken: undefined }, g));
    } else {
      dot('Centro', 3, 3, size - 6, fill, g);
      dot('Detalle', 7, 7, Math.max(2, size - 14), '@surface', g);
    }
    return g;
  };
  const panel = (height = h) => box('Superficie', 0, 0, w, height, { radius: p.panel, radiusToken: 'panel', strokeWidth: 1, shadow: !p.mobile });
  const miniRows = (x: number, y: number, width: number, parent = root.id) => ['Tu espacio', 'Compartidos', 'Guardados'].forEach((label, i) => {
    const g = group(`Fila · ${label}`, x, y + i * 44, width, 38, parent);
    if (i === 0) box('Selección', 0, 0, width, 38, { fill: '@accent' }, g);
    icon(i === 0 ? 'cuadrícula' : 'colección', 10, 9, 18, g, i === 0 ? '@primary' : '@muted');
    text('Nombre', label, 38, 9, width - 48, { color: i === 0 ? '@primary' : '@text', height: 22 }, g);
  });
  const header = (width: number, title: string, parent = root.id) => {
    if (kit === 'macos') {
      box('Barra de título', 0, 0, width, 44, { fill: '@background', radius: p.panel, radiusToken: 'panel' }, parent);
      ['#e67872', '#ddb666', '#7aa88b'].forEach((fill, i) => dot('Control de ventana', 14 + i * 18, 16, 10, fill, parent));
      text('Título de ventana', title, 92, 13, width - 184, { textAlign: 'center', height: 22 }, parent);
    } else if (kit === 'linux') {
      box('Barra de cabecera', 0, 0, width, 48, { fill: '@background', radius: p.panel, radiusToken: 'panel' }, parent);
      icon('menú', 16, 15, 18, parent, '@text');
      text('Título de ventana', title, 56, 14, width - 112, { textAlign: 'center', fontWeight: 650 }, parent);
      dot('Cerrar', width - 34, 13, 22, '@border', parent); text('Símbolo cerrar', '×', width - 34, 12, 22, { textAlign: 'center', typographyToken: undefined, fontSize: 17 }, parent);
    } else if (kit === 'web') {
      box('Cabecera de aplicación', 0, 0, width, 52, { fill: '@surface', radius: 0, radiusToken: undefined }, parent);
      icon('cuadrícula', 16, 17, 18, parent); text('Marca', title, 44, 15, 148, { fontWeight: 650 }, parent);
      text('Enlaces', 'Inicio   Equipo', width - 210, 16, 142, { color: '@muted' }, parent); dot('Perfil', width - 44, 12, 28, '@accent', parent);
    } else {
      box('Cabecera móvil', 0, 0, width, kit === 'ios' ? 96 : 64, { fill: '@surface', radius: 0, radiusToken: undefined }, parent);
      if (kit === 'ios') { caption('9:41', 18, 9, 60, parent); text('Estado', '•••', width - 54, 7, 38, { textAlign: 'right', color: '@muted' }, parent); heading(title, 18, 47, width - 70, parent); }
      else { icon('menú', 18, 24, 20, parent, '@text'); heading(title, 56, 20, width - 96, parent); }
      icon('colección', width - 38, kit === 'ios' ? 52 : 24, 20, parent);
    }
  };

  switch (item.id) {
    case 'button': button(selected ? 'Seleccionado' : 'Continuar', 0, 0, w, h); break;
    case 'field': {
      const android = kit === 'android';
      text('Etiqueta', 'Correo electrónico', android ? 16 : 0, 0, w - 24, { color: selected ? '@primary' : '@text', typographyToken: undefined, fontSize: p.font - 2 });
      box('Campo', 0, 26, w, h - 26, { fill: kit === 'ios' ? '@background' : '@surface', radius: android ? 5 : p.radius, radiusToken: android ? undefined : 'control', strokeWidth: selected ? 2 : kit === 'ios' ? 0 : 1, stroke: selected ? '@primary' : '@border' });
      text('Texto de entrada', selected ? 'hola@ejemplo.com' : 'nombre@ejemplo.com', 14, 26 + (p.control - 22) / 2, w - 28, { color: selected ? '@text' : '@muted' }); break;
    }
    case 'search':
      box('Fondo de búsqueda', 0, 0, w, h, { fill: '@background', strokeWidth: selected ? 2 : kit === 'web' ? 1 : 0, stroke: selected ? '@primary' : '@border' }); icon('buscar', 14, (h - 20) / 2, 20, root.id, '@muted'); text('Consulta', 'Buscar en tu espacio', 44, (h - 22) / 2, w - 58, { color: '@muted' }); break;
    case 'toggle': {
      text('Etiqueta', 'Notificaciones', 0, (h - 22) / 2, 164);
      const th = kit === 'android' ? 32 : kit === 'ios' ? 30 : 24, tw = kit === 'android' ? 54 : kit === 'ios' ? 50 : 42;
      box('Pista', w - tw, (h - th) / 2, tw, th, { fill: selected ? '@primary' : '@border', radius: th / 2, radiusToken: undefined });
      dot('Control', w - tw + (selected ? tw - th + 3 : 3), (h - th) / 2 + 3, th - 6, '@surface'); break;
    }
    case 'checkbox': case 'radio': {
      const circular = item.id === 'radio', size = kit === 'macos' ? 18 : 22;
      add(circular ? 'ellipse' : 'rect', 'Control', 0, (h - size) / 2, size, size, { fill: selected && !circular ? '@primary' : '@surface', stroke: selected ? '@primary' : '@muted', strokeWidth: 2, radius: kit === 'android' ? 2 : 4 });
      if (selected) { if (circular) dot('Seleccionado', 6, (h - size) / 2 + 6, size - 12, '@primary'); else text('Marca', '✓', 1, (h - 23) / 2, size - 2, { typographyToken: undefined, fontSize: 16, color: '@background', textAlign: 'center' }); }
      text('Etiqueta', circular ? 'Opción preferida' : 'Guardar preferencia', size + 12, (h - 22) / 2, w - size - 12); break;
    }
    case 'slider': {
      text('Etiqueta', 'Volumen', 0, 0, w - 60); caption(selected ? '80 %' : '40 %', w - 50, 0, 50);
      const amount = selected ? 0.8 : 0.4, thick = kit === 'android' ? 12 : 5;
      box('Pista', 0, 38, w, thick, { fill: '@border', radius: 6, radiusToken: undefined }); box('Valor', 0, 38, w * amount, thick, { fill: '@primary', radius: 6, radiusToken: undefined });
      dot('Control', w * amount - 10, 31 + (thick - 5) / 2, 20, kit === 'ios' || kit === 'macos' ? '@surface' : '@primary'); break;
    }
    case 'progress': text('Etiqueta', 'Preparando tu espacio', 0, 0, w - 48); caption(selected ? '100 %' : '60 %', w - 48, 0, 48); box('Pista', 0, 33, w, kit === 'android' ? 8 : 5, { fill: '@border' }); box('Avance', 0, 33, w * (selected ? 1 : 0.6), kit === 'android' ? 8 : 5, { fill: '@primary' }); break;
    case 'badge': box('Fondo', 0, 0, w, h, { fill: selected ? '@primary' : '@accent', radius: p.mobile ? 14 : p.radius, radiusToken: undefined }); text('Etiqueta', selected ? 'Activo' : 'Nuevo', 8, 5, w - 16, { textAlign: 'center', color: selected ? '@background' : '@primary', typographyToken: undefined, fontSize: p.font - 2 }); break;
    case 'avatar': dot('Fondo', 0, 0, w, '@accent'); text('Iniciales', 'AM', 0, 15, w, { color: '@primary', textAlign: 'center', typographyToken: 'heading', fontSize: 20, height: 28 }); if (selected) { dot('Estado', w - 16, h - 16, 16, '@surface'); dot('Disponible', w - 13, h - 13, 10, '@primary'); } break;
    case 'list-row':
      box('Superficie', 0, 0, w, h, { fill: selected ? '@accent' : '@surface', radius: kit === 'ios' ? 0 : p.radius, radiusToken: kit === 'ios' ? undefined : 'control' });
      box('Fondo de icono', 14, (h - 38) / 2, 38, 38, { fill: '@accent' }); icon('cuadrícula', 23, (h - 20) / 2); text('Título', 'Mi colección', 66, h / 2 - 23, w - 100, { fontWeight: 600 }); caption('12 elementos · Hoy', 66, h / 2 + 2, w - 100); text('Accesorio', '›', w - 27, h / 2 - 18, 20, { typographyToken: undefined, fontSize: 26, color: '@muted', height: 32 }); if (kit === 'ios') line(66, h - 1, w - 66); break;
    case 'card':
      panel(); box('Ilustración editable', 12, 12, w - 24, 86, { fill: '@accent', fillToken: 'brand', radiusToken: 'control' });
      dot('Forma grande', w - 120, 27, 58, '@surface'); box('Forma pequeña', 30, 40, 76, 32, { fill: '@surface', opacity: 65 });
      heading('Ideas en movimiento', 18, 114, w - 36); caption('Un espacio para tu próximo proyecto.', 18, 148, w - 36);
      button(selected ? 'Guardado' : 'Abrir colección', 18, h - p.control - 16, w - 36, p.control, kit !== 'ios'); break;
    case 'segments': {
      const tabs = kit === 'web' || kit === 'android';
      if (!tabs) box('Pista', 0, 0, w, h, { fill: '@background' });
      ['Todo', 'Reciente', 'Favoritos'].forEach((label, i) => {
        const active = i === (selected ? 1 : 0), part = w / 3;
        if (active) { if (tabs) box('Indicador activo', i * part + 10, h - 3, part - 20, 3, { fill: '@primary', radius: 2, radiusToken: undefined }); else box('Segmento activo', i * part + 3, 3, part - 6, h - 6, { fill: '@surface', shadow: kit === 'ios' }); }
        text(`Pestaña · ${label}`, label, i * part + 3, (h - 22) / 2, part - 6, { textAlign: 'center', color: active ? '@primary' : '@muted', fontWeight: active ? 600 : 400 });
      }); break;
    }
    case 'navbar':
      if (kit === 'android') {
        box('Barra inferior', 0, 0, w, h, { fill: '@surface', radius: 0, radiusToken: undefined });
        ['Inicio', 'Explorar', 'Perfil'].forEach((label, i) => { const active = i === (selected ? 1 : 0); if (active) box('Píldora activa', i * 120 + 30, 10, 60, 30, { fill: '@accent' }); icon(i === 0 ? 'cuadrícula' : 'colección', i * 120 + 51, 16, 18, root.id, active ? '@primary' : '@muted'); text(`Destino · ${label}`, label, i * 120 + 8, 47, 104, { textAlign: 'center', color: active ? '@primary' : '@muted', typographyToken: undefined, fontSize: p.font - 2 }); });
      } else { header(w, kit === 'ios' ? 'Mi espacio' : 'Estudio'); if (kit === 'ios') line(0, h - 1, w); } break;
    case 'toolbar':
      box('Superficie de herramientas', 0, 0, w, h, { fill: '@surface', materialToken: kit === 'macos' || kit === 'ios' ? 'glass' : undefined, strokeWidth: 1 });
      ['cuadrícula', 'buscar', 'menú'].forEach((symbol, i) => icon(symbol, 18 + i * 44, (h - 20) / 2));
      box('Separador vertical', 154, 10, 1, h - 20, { fill: '@border', radius: 0, radiusToken: undefined }); text('Acción', kit === 'ios' ? 'Compartir' : 'Ordenar', w - 116, (h - 22) / 2, 98, { color: '@primary', textAlign: 'right' }); break;
    case 'dialog':
      panel(); heading('¿Guardar los cambios?', 22, 24, w - 44); text('Mensaje', 'Tu proyecto estará disponible\ncuando vuelvas a este espacio.', 22, 70, w - 44, { color: '@muted', height: 56 });
      if (kit === 'ios') { line(0, 132, w); text('Confirmar', 'Guardar', 20, 146, w - 40, { textAlign: 'center', color: '@primary', fontWeight: 600 }); line(0, 181, w); text('Cancelar', 'Cancelar', 20, 194, w - 40, { color: '@primary', textAlign: 'center' }); }
      else { const bh = Math.min(p.control, 40); button('Cancelar', 22, h - bh - 22, (w - 56) / 2, bh, false); button('Guardar', 34 + (w - 56) / 2, h - bh - 22, (w - 56) / 2, bh); } break;
    case 'toast':
      panel(); box('Acento', 0, 0, kit === 'web' ? 5 : 1, h, { fill: kit === 'web' ? '@primary' : 'transparent', radiusToken: undefined, radius: 0 }); icon('colección', 18, 24, 24); text('Título', 'Cambios guardados', 56, 15, w - 104, { fontWeight: 600 }); caption('Todo está actualizado.', 56, 40, w - 82); text('Cerrar', '×', w - 34, 22, 24, { color: '@muted', textAlign: 'center', typographyToken: undefined, fontSize: 22, height: 28 }); break;
    case 'sidebar':
      box('Superficie lateral', 0, 0, w, h, { fill: '@background', radius: p.mobile ? p.panel : 0, radiusToken: p.mobile ? 'panel' : undefined });
      heading('Tu espacio', 18, 20, w - 36); caption('PERSONAL', 18, 67, w - 36); miniRows(8, 96, w - 16); line(18, 244, w - 36); icon('colección', 20, 267, 18, root.id, '@muted'); text('Ajustes', 'Preferencias', 50, 264, w - 66); break;
    case 'window': {
      panel(); header(w, 'Mi espacio');
      if (p.mobile) {
        const yy = kit === 'ios' ? 114 : 82;
        box('Buscar', 18, yy, w - 36, 42, { fill: '@background' }); icon('buscar', 32, yy + 11, 20, root.id, '@muted'); caption('Buscar colecciones', 64, yy + 12, w - 96);
        heading('Para ti', 18, yy + 65, w - 36);
        box('Tarjeta destacada', 18, yy + 104, w - 36, 120, { fill: '@accent', radius: p.panel, radiusToken: 'panel' }); icon('cuadrícula', 34, yy + 122, 28); heading('Nuevas ideas', 34, yy + 164, w - 70); caption('Todo comienza con un boceto.', 34, yy + 198, w - 68);
        text('Sección', 'Tus colecciones', 18, yy + 248, w - 36, { fontWeight: 600 }); caption('Recientes · 3 proyectos', 18, yy + 276, w - 36);
        box('Navegación inferior', 0, h - 62, w, 62, { fill: '@surface', radius: 0, radiusToken: undefined, strokeWidth: 1 });
        ['Inicio', 'Explorar', 'Perfil'].forEach((label, i) => text(`Destino · ${label}`, label, i * 120 + 8, h - 43, 104, { textAlign: 'center', color: i === 0 ? '@primary' : '@muted', typographyToken: undefined, fontSize: p.font - 2 }));
      } else {
        const top = kit === 'macos' ? 44 : kit === 'linux' ? 48 : 52;
        box('Panel lateral', 0, top, 156, h - top, { fill: '@background', radius: 0, radiusToken: undefined }); caption('COLECCIONES', 14, top + 18, 128); miniRows(6, top + 48, 144);
        heading('Vista general', 178, top + 24, w - 200); caption('Tus proyectos, en un solo lugar.', 178, top + 59, w - 200);
        box('Tarjeta de proyecto', 178, top + 100, w - 200, 124, { fill: '@accent', radius: p.panel, radiusToken: 'panel' }); icon('cuadrícula', 194, top + 115, 26); text('Proyecto', 'Mi próximo proyecto', 194, top + 155, w - 232, { fontWeight: 600 }); caption('Editado hace un momento', 194, top + 184, w - 232);
        button('Crear proyecto', 178, h - 58, w - 200, 36);
      } break;
    }
    case 'menu':
      panel(); ['Crear colección', 'Cambiar nombre', 'Duplicar', 'Compartir'].forEach((label, i) => {
        const g = group(`Opción · ${label}`, 6, 6 + i * 43, w - 12, 40);
        if (selected && i === 0) box('Selección', 0, 0, w - 12, 40, { fill: '@accent' }, g);
        icon(i === 0 ? 'cuadrícula' : 'colección', 10, 11, 18, g, i === 0 && selected ? '@primary' : '@muted'); text('Etiqueta', label, 40, 10, w - 68, { color: i === 0 && selected ? '@primary' : '@text' }, g);
      }); break;
  }
  return ns;
}

/** Inserts one reusable instance. Templates are materialized only when requested. */
export function insertKitItem(p: Project, kit: KitId, itemId: string, parentId: string | null, x: number, y: number, variant: KitVariant = 'default'): string {
  const item = getKitItems(kit).find(i => i.id === itemId);
  if (!item) throw new Error('Elemento de kit desconocido');
  if (!['default', 'selected', 'disabled'].includes(variant)) throw new Error('Variante de kit desconocida');
  if (![x, y].every(n => Number.isFinite(n) && Math.abs(n) <= 100000)) throw new Error('Posición inválida');
  const parent = parentId === null ? undefined : p.nodes.find(n => n.id === parentId);
  if (parentId !== null && (!parent || !containerKinds.includes(parent.type))) throw new Error('Contenedor inválido');
  const scope = parent ? [parent, ...ancestors(p, parent.id)] : [];
  if (scope.some(n => n.instanceOf || n.componentId)) throw new Error('Los componentes anidados quedan fuera de esta versión');
  const themeId = ensureKitTheme(p, kit), componentId = `kit-${kit}-${itemId}-${variant}-v1`;
  if (!p.components.some(c => c.id === componentId)) {
    const template = makeTemplate(kit, item, variant, componentId);
    p.components.push({ id: componentId, name: template[0].name, masterId: `${componentId}-master`, template });
  }
  const id = instantiate(p, componentId, parentId, x, y);
  updateNode(p, id, { themeId: scope.some(n => n.themeId) ? undefined : themeId });
  return id;
}
