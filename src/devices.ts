/** Screen sizes in layout units (pt on iOS, dp on Android), portrait unless the device opens wide. */
export interface DevicePreset {
  id: string; group: string; name: string; width: number; height: number;
  /** Hinge of a foldable in this posture. */
  fold?: { axis: 'vertical' | 'horizontal'; gap: number; panels?: 2 | 3 };
  /** True when the size is an estimate rather than a published figure. */
  approximate?: boolean;
  /** Device frame drawn around the screen; see deviceSkins. */
  skin?: string;
  /** Space the system keeps for itself: [top, bottom], or [top, right, bottom, left]. Typical values. */
  safe?: number[];
}
export interface SafeArea { top: number; right: number; bottom: number; left: number; }
export interface DeviceSkin {
  name: string;
  /** Corner radius of the screen and thickness of the bezel around it. */
  radius: number; bezel: number;
  cutout: 'none' | 'island' | 'punch';
  /** Which status bar and home indicator to draw. */
  system: 'ios' | 'android' | 'none';
  home: boolean;
}
export const deviceSkins: Record<string, DeviceSkin> = {
  iphone: { name: 'iPhone', radius: 50, bezel: 11, cutout: 'island', system: 'ios', home: true },
  'iphone-classic': { name: 'iPhone con botón', radius: 0, bezel: 14, cutout: 'none', system: 'ios', home: false },
  ipad: { name: 'iPad', radius: 22, bezel: 18, cutout: 'none', system: 'ios', home: true },
  android: { name: 'Teléfono Android', radius: 32, bezel: 9, cutout: 'punch', system: 'android', home: true },
  'android-tablet': { name: 'Tableta Android', radius: 20, bezel: 16, cutout: 'none', system: 'android', home: true },
  foldable: { name: 'Plegable', radius: 24, bezel: 8, cutout: 'punch', system: 'android', home: true },
  // iPhone Duo: hole-punch camera on the cover, camera under the panel inside, Touch ID on the side.
  'iphone-duo-cover': { name: 'iPhone Duo · cerrado', radius: 34, bezel: 8, cutout: 'punch', system: 'ios', home: true },
  'iphone-duo': { name: 'iPhone Duo · abierto', radius: 28, bezel: 7, cutout: 'none', system: 'ios', home: true },
};
export function presetSafeArea(preset: DevicePreset): SafeArea | undefined {
  const s = preset.safe; if (!s) return;
  return s.length === 2 ? { top: s[0], right: 0, bottom: s[1], left: 0 } : { top: s[0], right: s[1], bottom: s[2], left: s[3] };
}
export const devicePresets: DevicePreset[] = [
  { id: 'iphone-se', group: 'iOS · iPhone', name: 'iPhone SE', width: 375, height: 667, skin: 'iphone-classic', safe: [20, 0] },
  { id: 'iphone-16e', group: 'iOS · iPhone', name: 'iPhone 16e / 14', width: 390, height: 844, skin: 'iphone', safe: [47, 34] },
  { id: 'iphone-16', group: 'iOS · iPhone', name: 'iPhone 16 / 15', width: 393, height: 852, skin: 'iphone', safe: [59, 34] },
  { id: 'iphone-16-pro', group: 'iOS · iPhone', name: 'iPhone 17 / 16 Pro', width: 402, height: 874, skin: 'iphone', safe: [62, 34] },
  { id: 'iphone-air', group: 'iOS · iPhone', name: 'iPhone Air', width: 420, height: 912, skin: 'iphone', safe: [62, 34] },
  { id: 'iphone-16-plus', group: 'iOS · iPhone', name: 'iPhone 16 Plus', width: 430, height: 932, skin: 'iphone', safe: [59, 34] },
  { id: 'iphone-16-pro-max', group: 'iOS · iPhone', name: 'iPhone 17 / 16 Pro Max', width: 440, height: 956, skin: 'iphone', safe: [62, 34] },
  { id: 'ipad-mini', group: 'iOS · iPad', name: 'iPad mini', width: 744, height: 1133, skin: 'ipad', safe: [24, 20] },
  { id: 'ipad-11', group: 'iOS · iPad', name: 'iPad / iPad Air 11"', width: 820, height: 1180, skin: 'ipad', safe: [24, 20] },
  { id: 'ipad-pro-11', group: 'iOS · iPad', name: 'iPad Pro 11"', width: 834, height: 1210, skin: 'ipad', safe: [24, 20] },
  { id: 'ipad-air-13', group: 'iOS · iPad', name: 'iPad Air 13"', width: 1024, height: 1366, skin: 'ipad', safe: [24, 20] },
  { id: 'ipad-pro-13', group: 'iOS · iPad', name: 'iPad Pro 13"', width: 1032, height: 1376, skin: 'ipad', safe: [24, 20] },
  // Published panels are 1398 x 2034 px (cover) and 1878 x 2670 px (inside), both 1.41:1; points assume @3x.
  { id: 'iphone-fold-closed', group: 'iOS · iPhone Duo', name: 'iPhone Duo · cerrado', width: 466, height: 678, approximate: true, skin: 'iphone-duo-cover', safe: [44, 24] },
  { id: 'iphone-fold-open', group: 'iOS · iPhone Duo', name: 'iPhone Duo · abierto', width: 890, height: 626, fold: { axis: 'vertical', gap: 0 }, approximate: true, skin: 'iphone-duo', safe: [28, 20] },
  { id: 'android-compact', group: 'Android · teléfono', name: 'Compacto', width: 360, height: 800, skin: 'android', safe: [28, 24] },
  { id: 'android-phone', group: 'Android · teléfono', name: 'Teléfono de referencia', width: 411, height: 891, skin: 'android', safe: [28, 24] },
  { id: 'android-large', group: 'Android · teléfono', name: 'Teléfono grande', width: 448, height: 998, approximate: true, skin: 'android', safe: [32, 24] },
  { id: 'android-tablet', group: 'Android · tableta', name: 'Tableta de referencia', width: 1280, height: 800, skin: 'android-tablet', safe: [24, 24] },
  { id: 'android-tablet-portrait', group: 'Android · tableta', name: 'Tableta mediana', width: 600, height: 960, skin: 'android-tablet', safe: [24, 24] },
  { id: 'android-fold-closed', group: 'Android · Pasaporte (libro)', name: 'Pasaporte · cerrado', width: 360, height: 841, approximate: true, skin: 'foldable', safe: [28, 24] },
  { id: 'android-fold-closed-tall', group: 'Android · Pasaporte (libro)', name: 'Pasaporte alto · cerrado', width: 411, height: 960, approximate: true, skin: 'foldable', safe: [28, 24] },
  { id: 'android-fold-open', group: 'Android · Pasaporte (libro)', name: 'Pasaporte · abierto', width: 673, height: 841, fold: { axis: 'vertical', gap: 0 }, skin: 'foldable', safe: [28, 24] },
  { id: 'android-fold-tabletop', group: 'Android · Pasaporte (libro)', name: 'Pasaporte · sobremesa', width: 841, height: 673, fold: { axis: 'horizontal', gap: 0 }, skin: 'foldable', safe: [28, 24] },
  { id: 'android-dual', group: 'Android · Pasaporte (libro)', name: 'Dos pantallas con bisagra', width: 1114, height: 720, fold: { axis: 'vertical', gap: 34 }, approximate: true, skin: 'foldable', safe: [28, 24] },
  { id: 'android-flip-cover', group: 'Android · Flip (almeja)', name: 'Flip · pantalla exterior', width: 399, height: 361, approximate: true, skin: 'foldable', safe: [24, 16] },
  { id: 'android-flip-open', group: 'Android · Flip (almeja)', name: 'Flip · abierto', width: 411, height: 960, fold: { axis: 'horizontal', gap: 0 }, approximate: true, skin: 'foldable', safe: [28, 24] },
  { id: 'android-trifold-closed', group: 'Android · Tríptico (doble bisagra)', name: 'Tríptico · cerrado', width: 411, height: 975, approximate: true, skin: 'foldable', safe: [28, 24] },
  { id: 'android-trifold-half', group: 'Android · Tríptico (doble bisagra)', name: 'Tríptico · dos paneles', width: 860, height: 938, fold: { axis: 'vertical', gap: 0 }, approximate: true, skin: 'foldable', safe: [28, 24] },
  { id: 'android-trifold-open', group: 'Android · Tríptico (doble bisagra)', name: 'Tríptico · abierto', width: 1286, height: 943, fold: { axis: 'vertical', gap: 0, panels: 3 }, approximate: true, skin: 'foldable', safe: [28, 24] },
  { id: 'desktop', group: 'Escritorio y web', name: 'Escritorio 1440', width: 1440, height: 900 },
  { id: 'desktop-hd', group: 'Escritorio y web', name: 'Escritorio 1920', width: 1920, height: 1080 },
  { id: 'web-1280', group: 'Escritorio y web', name: 'Portátil 1280', width: 1280, height: 800 },
];
/** Android window size class of a width in dp; iOS and web widths read the same way. */
export function sizeClass(width: number) { return width < 600 ? 'compacto' : width < 840 ? 'medio' : 'expandido'; }
