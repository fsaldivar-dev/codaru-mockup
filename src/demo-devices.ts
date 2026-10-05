import { blank, node, type DesignNode, type Kind, type Project } from './model';
import { devicePresets, presetSafeArea } from './devices';
import { ensureKitTheme, type KitId } from './kits';
import { animationPresets, type NodeAnimation, type Transition } from './motion';

/**
 * The Forma example rebuilt per device: one layout routine that adapts to the width, the safe
 * area and the hinges, instead of one fixed drawing: iPhone, iPhone Duo, an Android phone and the
 * three Android foldable families (passport, flip and tri-fold) in each of their postures.
 */
export function demoDevices(): Project {
  const p = blank(); p.name = 'Forma · iOS, Android y plegables';
  const add = (type: Kind, patch: Partial<DesignNode>) => { const n = node(type, patch); p.nodes.push(n); return n; };
  const motion = (id: string, preset: keyof typeof animationPresets, delay = 0): NodeAnimation => ({ id, target: '', ...animationPresets[preset].make(), delay });

  function screen(id: string, name: string, deviceId: string, kit: KitId, x: number, y: number) {
    const d = devicePresets.find(item => item.id === deviceId)!;
    return add('frame', { id, name, x, y, width: d.width, height: d.height, fill: '@background', device: d.id, skin: d.skin, safeArea: presetSafeArea(d), fold: d.fold && { ...d.fold }, themeId: ensureKitTheme(p, kit), kitId: kit });
  }
  /** One column per panel of an open foldable (so nothing crosses a hinge), or a single centered column. */
  function columns(f: DesignNode, pad: number, max = 440) {
    if (f.fold?.axis === 'vertical') { const count = f.fold.panels ?? 2, panel = (f.width - f.fold.gap * (count - 1)) / count; return Array.from({ length: count }, (_, i) => ({ x: i * (panel + f.fold!.gap) + pad, w: panel - pad * 2 })); }
    const w = Math.min(f.width - pad * 2, max), x = (f.width - w) / 2;
    return [{ x, w }];
  }
  function login(f: DesignNode, android: boolean, home: string, transition: Transition) {
    const a = (type: Kind, patch: Partial<DesignNode>) => add(type, { parentId: f.id, ...patch });
    const safe = f.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 }, cols = columns(f, f.width < 600 ? 24 : 40), left = cols[0], right = cols[1] ?? cols[0], split = cols.length > 1;
    let y = safe.top + (split ? 64 : 28);
    a('rect', { name: 'Símbolo', x: left.x, y, width: 32, height: 32, radius: android ? 16 : 11, fillToken: 'brand' });
    a('text', { name: 'Marca', x: left.x + 44, y: y + 1, width: 120, height: 32, text: 'forma', fontSize: 24, fontWeight: 750 });
    y += split ? 96 : 70;
    a('text', { name: 'Etiqueta', x: left.x, y, width: left.w, height: 18, text: 'UN LUGAR PARA TUS IDEAS', fontSize: 10, fontWeight: 700, color: '@primary' });
    a('text', { name: 'Título', x: left.x, y: y + 30, width: left.w, height: 84, text: 'Tu próxima gran\nidea empieza aquí.', fontSize: Math.min(34, left.w / 9.6), lineHeight: 1.15, fontWeight: 720, animations: [motion('titulo', 'appear')] });
    a('text', { name: 'Descripción', x: left.x, y: y + 122, width: left.w, height: 44, text: 'Entra a tu espacio. Dale forma a lo que sigue.', color: '@muted', fontSize: 14 });
    y = split ? safe.top + 120 : y + 184;
    const radius = android ? 26 : 13;
    a('text', { name: 'Label · Correo', x: right.x, y, width: right.w, height: 20, text: 'Correo electrónico', fontSize: 12, fontWeight: 600 });
    a('input', { name: 'Correo', x: right.x, y: y + 26, width: right.w, height: 48, radius, text: 'hola@tuestudio.com', color: '@muted', fontSize: 13 });
    a('text', { name: 'Label · Contraseña', x: right.x, y: y + 90, width: right.w, height: 20, text: 'Contraseña', fontSize: 12, fontWeight: 600 });
    a('input', { name: 'Contraseña', x: right.x, y: y + 116, width: right.w, height: 48, radius, text: '••••••••', color: '@muted', fontSize: 13 });
    a('button', { name: 'Entrar', x: right.x, y: y + 188, width: right.w, height: 50, radius, text: 'Entrar a mi espacio  →', shadow: !android, targetId: home, transition, animations: [motion('entrar', 'appear', 150)] });
    if (cols[2]) {
      const promo = a('card', { name: 'Presentación', x: cols[2].x, y: safe.top + 64, width: cols[2].w, height: f.height - safe.top - safe.bottom - 160, radius: android ? 28 : 20, fillToken: 'brand', strokeWidth: 0, animations: [motion('presentacion', 'appear', 200)] });
      add('text', { parentId: promo.id, name: 'Presentación · título', x: 26, y: 30, width: cols[2].w - 52, height: 90, text: 'Diseña una vez.\nMíralo en cada postura.', fontSize: 24, lineHeight: 1.2, fontWeight: 720, color: '#ffffff' });
    }
    a('text', { name: 'Pie', x: 24, y: f.height - safe.bottom - 40, width: f.width - 48, height: 20, text: '¿Nuevo por aquí? Crea tu espacio', textAlign: 'center', color: '@muted', fontSize: 12 });
  }
  function home(f: DesignNode, android: boolean, back: string, transition: Transition) {
    const a = (type: Kind, patch: Partial<DesignNode>) => add(type, { parentId: f.id, ...patch });
    const safe = f.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 }, wide = f.width >= 600, pad = wide ? 28 : 20, radius = android ? 24 : 16;
    const rail = wide ? (android ? 88 : 0) : 0, cols = columns(f, pad, 720), left = cols[0], right = cols[1] ?? cols[0], split = cols.length > 1;
    const first = { x: split ? Math.max(left.x, rail + pad) : left.x, w: split ? left.w - Math.max(0, rail + pad - left.x) : left.w };
    let y = safe.top + 22;
    if (rail) {
      a('rect', { name: 'Barra lateral', x: 0, y: 0, width: rail, height: f.height, fill: '@surface', radius: 0 });
      ['Inicio', 'Ideas', 'Equipo'].forEach((label, i) => {
        if (!i) a('rect', { name: 'Indicador activo', x: 16, y: safe.top + 84, width: 56, height: 32, radius: 16, fill: '@accent' });
        a('text', { name: `Sección · ${label}`, x: 0, y: safe.top + 92 + i * 64, width: rail, height: 18, text: label, textAlign: 'center', fontSize: 11, fontWeight: i ? 500 : 700, color: i ? '@muted' : '@text' });
      });
    }
    a('text', { name: 'Saludo', x: first.x, y, width: first.w, height: 34, text: 'Hola, Alex', fontSize: 26, fontWeight: 720 });
    a('text', { name: 'Subtítulo', x: first.x, y: y + 38, width: first.w, height: 20, text: 'Un buen día para empezar algo nuevo.', color: '@muted', fontSize: 13 });
    y += 78;
    // Open foldables keep the list on one half and the featured card on the other.
    const hero = split ? { x: right.x, y: safe.top + 22, w: right.w, h: Math.min(260, f.height - safe.top - safe.bottom - 150) } : { x: first.x, y, w: first.w, h: 150 };
    const card = a('card', { name: 'Destacado', x: hero.x, y: hero.y, width: hero.w, height: hero.h, radius: radius + 4, fillToken: 'brand', strokeWidth: 0, animations: [motion('destacado', 'appear')] });
    add('text', { parentId: card.id, name: 'Destacado · etiqueta', x: 22, y: 22, width: hero.w - 44, height: 16, text: 'EN LO QUE ESTÁS AHORA', fontSize: 9, fontWeight: 700, color: '#ffffff' });
    add('text', { parentId: card.id, name: 'Destacado · título', x: 22, y: 50, width: hero.w - 44, height: 64, text: 'Algo increíble\nestá por tomar forma.', fontSize: 20, lineHeight: 1.2, fontWeight: 700, color: '#ffffff' });
    if (!split) y += hero.h + 26;
    a('text', { name: 'Tus proyectos', x: first.x, y, width: first.w, height: 22, text: 'Tus proyectos', fontSize: 15, fontWeight: 700 });
    y += 34;
    const perRow = first.w < 300 && split ? 1 : !split && first.w >= 520 ? 3 : 2, gap = 12, w = (first.w - gap * (perRow - 1)) / perRow;
    [['Brand exploration', '4 pantallas'], ['Studio web', '8 pantallas'], ['App móvil', '12 pantallas'], ['Sistema visual', '6 pantallas']].slice(0, split ? 4 : perRow).forEach(([title, detail], i) => {
      const item = a('card', { name: `Proyecto · ${title}`, x: first.x + (i % perRow) * (w + gap), y: y + Math.floor(i / perRow) * 118, width: w, height: 106, radius, animations: [motion(`proyecto-${i}`, 'appear', 120 + i * 90)] });
      add('rect', { parentId: item.id, name: 'Miniatura', x: 14, y: 14, width: 30, height: 30, radius: android ? 15 : 9, fill: '@accent' });
      add('text', { parentId: item.id, name: 'Nombre', x: 14, y: 54, width: w - 28, height: 18, text: title, fontSize: 12, fontWeight: 650 });
      add('text', { parentId: item.id, name: 'Detalle', x: 14, y: 74, width: w - 28, height: 16, text: detail, fontSize: 10, color: '@muted' });
    });
    if (cols[2]) {
      // The third panel of a tri-fold holds what a phone would hide behind another tab.
      a('text', { name: 'Actividad', x: cols[2].x, y: safe.top + 22, width: cols[2].w, height: 22, text: 'Actividad reciente', fontSize: 15, fontWeight: 700 });
      ['Marta comentó «Pantalla de inicio»', 'Subiste 4 ilustraciones', 'Equipo aprobó la paleta', 'Nueva versión del prototipo'].forEach((text, i) => {
        const row = a('card', { name: `Actividad · ${i + 1}`, x: cols[2].x, y: safe.top + 58 + i * 76, width: cols[2].w, height: 64, radius, animations: [motion(`actividad-${i}`, 'appear', 200 + i * 90)] });
        add('rect', { parentId: row.id, name: 'Avatar', x: 14, y: 16, width: 32, height: 32, radius: 16, fill: '@accent' });
        add('text', { parentId: row.id, name: 'Texto', x: 58, y: 22, width: cols[2].w - 72, height: 20, text, fontSize: 12 });
      });
    }
    const action = split ? { x: right.x, y: hero.y + hero.h + 20, w: right.w } : { x: first.x, y: f.height - safe.bottom - (wide ? 76 : 138), w: wide ? 220 : first.w };
    a('button', { name: 'Volver a bienvenida', x: action.x, y: action.y, width: action.w, height: 46, radius: android ? 23 : 13, text: '←  Volver a bienvenida', targetId: back, transition });
    if (!wide) {
      // Bottom navigation sits above the home indicator, inside the safe area.
      const bar = a('rect', { name: 'Navegación inferior', x: 0, y: f.height - safe.bottom - 64, width: f.width, height: 64 + safe.bottom, radius: 0, fill: '@surface', strokeWidth: 1, stroke: '@border' });
      const slot = f.width / 4;
      ['Inicio', 'Ideas', 'Equipo', 'Perfil'].forEach((label, i) => {
        if (!i && android) a('rect', { name: 'Indicador activo', x: slot / 2 - 30, y: bar.y + 9, width: 60, height: 28, radius: 14, fill: '@accent' });
        a('text', { name: `Pestaña · ${label}`, x: i * slot, y: bar.y + (android ? 14 : 24), width: slot, height: 18, text: label, textAlign: 'center', fontSize: 11, fontWeight: i ? 500 : 700, color: i ? '@muted' : '@primary' });
      });
    }
  }
  /** The small outer screen of a flip phone: a glanceable summary instead of the full layout. */
  function cover(f: DesignNode, open: string) {
    const a = (type: Kind, patch: Partial<DesignNode>) => add(type, { parentId: f.id, ...patch }), safe = f.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 }, w = f.width - 40;
    a('text', { name: 'Saludo', x: 20, y: safe.top + 14, width: w, height: 28, text: 'Hola, Alex', fontSize: 20, fontWeight: 720 });
    const card = a('card', { name: 'Resumen', x: 20, y: safe.top + 54, width: w, height: 150, radius: 24, fillToken: 'brand', strokeWidth: 0, animations: [motion('resumen', 'appear')] });
    add('text', { parentId: card.id, name: 'Resumen · etiqueta', x: 18, y: 18, width: w - 36, height: 16, text: '3 PROYECTOS ACTIVOS', fontSize: 9, fontWeight: 700, color: '#ffffff' });
    add('text', { parentId: card.id, name: 'Resumen · título', x: 18, y: 44, width: w - 36, height: 56, text: 'Algo increíble\nestá por tomar forma.', fontSize: 18, lineHeight: 1.2, fontWeight: 700, color: '#ffffff' });
    a('button', { name: 'Abrir', x: 20, y: f.height - safe.bottom - 66, width: w, height: 44, radius: 22, text: 'Abre el teléfono para continuar', fontSize: 13, targetId: open, transition: { type: 'unfold', duration: 700, easing: 'ease-in-out' } });
  }
  const link = (...screens: DesignNode[]) => screens.forEach((f, i) => { f.foldPair = screens[(i + 1) % screens.length].id; });
  const slide: [Transition, Transition] = [{ type: 'slide-left', duration: 350, easing: 'ease-out' }, { type: 'slide-right', duration: 350, easing: 'ease-out' }];
  const material: [Transition, Transition] = [{ type: 'scale', duration: 300, easing: 'ease-out' }, { type: 'fade', duration: 250, easing: 'ease-out' }];
  let y = 100;
  /** A row of the canvas: Bienvenida and Tu espacio for every posture of one device family. */
  function family(label: string, key: string, kit: KitId, [forward, backward]: [Transition, Transition], postures: [string, string][]) {
    const android = kit === 'android'; let x = 60, tallest = 0;
    const place = (id: string, name: string, device: string) => { const f = screen(`${key}-${id}`, `${label} · ${name}`, device, kit, x, y); x += f.width + 110; tallest = Math.max(tallest, f.height); return f; };
    const built = postures.map(([posture, device]) => {
      const tag = posture ? `${posture} · ` : '', slug = posture ? `${posture.toLowerCase().replace(/\s+/g, '-')}-` : '';
      const welcome = place(`${slug}bienvenida`, `${tag}Bienvenida`, device), space = place(`${slug}espacio`, `${tag}Tu espacio`, device);
      login(welcome, android, space.id, forward); home(space, android, welcome.id, backward);
      return { welcome, space };
    });
    if (built.length > 1) { link(...built.map(b => b.welcome)); link(...built.map(b => b.space)); }
    const row = { built, place, bottom: () => { y += tallest + 190; } };
    return row;
  }
  family('iPhone', 'ios', 'ios', slide, [['', 'iphone-16-pro']]).bottom();
  family('iPhone Duo', 'duo', 'ios', slide, [['Cerrado', 'iphone-fold-closed'], ['Abierto', 'iphone-fold-open']]).bottom();
  family('Android', 'android', 'android', material, [['', 'android-phone']]).bottom();
  family('Pasaporte', 'pasaporte', 'android', material, [['Cerrado', 'android-fold-closed'], ['Abierto', 'android-fold-open']]).bottom();
  const flip = family('Flip', 'flip', 'android', material, [['Abierto', 'android-flip-open']]);
  const outside = flip.place('exterior', 'Exterior · Resumen', 'android-flip-cover'); cover(outside, flip.built[0].space.id); link(outside, flip.built[0].space);
  flip.bottom();
  family('Tríptico', 'triptico', 'android', material, [['Cerrado', 'android-trifold-closed'], ['Dos paneles', 'android-trifold-half'], ['Abierto', 'android-trifold-open']]).bottom();
  return p;
}
