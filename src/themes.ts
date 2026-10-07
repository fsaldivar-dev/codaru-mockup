import type { DesignNode, Project, Theme } from './model';

export interface GradientToken { name: string; type: 'linear' | 'radial'; angle: number; stops: Array<{ color: string; position: number }>; }
export interface MaterialToken { name: string; tint: string; opacity: number; blur: number; saturation: number; stroke: string; shadow: number; }
export interface TypographyToken { name: string; fontFamily: 'system' | 'serif' | 'mono'; fontSize: number; fontWeight: number; lineHeight: number; }
export interface TokenSet { colors: Record<string, string>; gradients: Record<string, GradientToken>; materials: Record<string, MaterialToken>; typography: Record<string, TypographyToken>; radii: Record<string, number>; }
export interface DesignTheme { id: string; name: string; modes: { light: TokenSet; dark: TokenSet }; }

export function defaultDesignTheme(id = 'project', name = 'Mi tema'): DesignTheme {
  const colors = {
    light: { primary: '#7955e8', surface: '#ffffff', background: '#f6f5fa', text: '#20202c', muted: '#8a899a', border: '#e9e7ef', accent: '#eee8fd' },
    dark: { primary: '#a28af6', surface: '#252431', background: '#1b1a25', text: '#f4f2fc', muted: '#aaa6bc', border: '#3c394d', accent: '#36304f' },
  };
  function mode(mode: Theme): TokenSet {
    return { colors: { ...colors[mode] },
      gradients: { brand: { name: 'Marca', type: 'linear', angle: 135, stops: [{ color: '@primary', position: 0 }, { color: mode === 'light' ? '#b8a1fa' : '#6650bb', position: 100 }] } },
      materials: { glass: { name: 'Cristal', tint: '@surface', opacity: mode === 'light' ? 64 : 68, blur: 16, saturation: 150, stroke: '@border', shadow: 16 } },
      typography: { body: { name: 'Cuerpo', fontFamily: 'system', fontSize: 16, fontWeight: 400, lineHeight: 1.4 }, heading: { name: 'Título', fontFamily: 'system', fontSize: 28, fontWeight: 700, lineHeight: 1.2 } },
      radii: { control: 10, panel: 20 },
    };
  }
  return { id, name, modes: { light: mode('light'), dark: mode('dark') } };
}

export function effectiveTheme(p: Project, n?: DesignNode, byId?: Map<string, DesignNode>): { id: string; mode: Theme; tokens: TokenSet } {
  let id: string | undefined, kitFallback: string | undefined, mode: Theme | undefined;
  const seen = new Set<string>();
  while (n && !seen.has(n.id)) {
    seen.add(n.id);
    if (n.kitId && n.instanceOf) kitFallback ??= n.themeId;
    else id ??= n.themeId;
    if (!mode && n.themeMode && n.themeMode !== 'inherit') mode = n.themeMode;
    n = n.parentId ? (byId ? byId.get(n.parentId) : p.nodes.find(parent => parent.id === n!.parentId)) : undefined;
  }
  id ??= kitFallback ?? p.activeThemeId;
  mode ??= p.theme;
  const theme = p.designThemes[id];
  if (!theme) throw new Error(`Tema no encontrado: ${id}`);
  const selected = theme.modes[mode];
  // Existing palette controls continue to own the built-in project's base colors.
  const tokens = id === 'project' ? { ...selected, colors: { ...selected.colors, ...p.themes[mode] } } : selected;
  return { id, mode, tokens };
}

export function resolveColor(p: Project, value: string, n?: DesignNode, byId?: Map<string, DesignNode>): string {
  const colors = effectiveTheme(p, n, byId).tokens.colors;
  const seen = new Set<string>();
  while (value.startsWith('@')) {
    const key = value.slice(1);
    if (seen.has(key)) throw new Error(`Alias de color cíclico: ${key}`);
    seen.add(key);
    if (!Object.hasOwn(colors, key)) throw new Error(`Color no encontrado: ${key}`);
    value = colors[key];
  }
  return value;
}

export function resolveNodeStyle(p: Project, n: DesignNode): Partial<DesignNode> {
  const tokens = effectiveTheme(p, n).tokens;
  const result: Partial<DesignNode> = {};
  if (n.fillToken && Object.hasOwn(tokens.colors, n.fillToken)) { result.fill = resolveColor(p, '@' + n.fillToken, n); result.gradient = 'none'; }
  if (n.typographyToken) {
    const { fontFamily, fontSize, fontWeight, lineHeight } = tokens.typography[n.typographyToken];
    Object.assign(result, { fontFamily, fontSize, fontWeight, lineHeight });
  }
  if (n.radiusToken) result.radius = tokens.radii[n.radiusToken];
  return result;
}

const safeId = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(s) && !['__proto__', 'constructor', 'prototype'].includes(s);
const safeName = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0 && s.length <= 200 && !/[\u0000-\u001f\u007f]/.test(s);
export const safeColor = (s: unknown): s is string => typeof s === 'string' && (/^(?:#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8}|transparent)$/i.test(s) || (s.startsWith('@') && safeId(s.slice(1))));
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const range = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
function dictionary(v: unknown, label: string): asserts v is Record<string, unknown> {
  if (!record(v) || Object.keys(v).length > 128 || Object.keys(v).some(key => !safeId(key))) throw new Error(`${label}: nombres de tokens inválidos`);
}
function aliases(colors: Record<string, string>) {
  for (const [key, color] of Object.entries(colors)) {
    if (!safeColor(color)) throw new Error(`Color inválido: ${key}`);
    const seen = new Set([key]); let value = color;
    while (value.startsWith('@')) {
      const ref = value.slice(1);
      if (seen.has(ref)) throw new Error(`Alias de color cíclico: ${ref}`);
      seen.add(ref);
      if (!Object.hasOwn(colors, ref)) throw new Error(`Referencia de color inválida: ${ref}`);
      value = colors[ref];
      if (!safeColor(value)) throw new Error(`Color inválido: ${ref}`);
    }
  }
}

export function validateDesignThemes(p: Project) {
  if (!record(p.designThemes) || !Object.keys(p.designThemes).length || Object.keys(p.designThemes).length > 32 || !Object.hasOwn(p.designThemes, 'project') || !safeId(p.activeThemeId) || !Object.hasOwn(p.designThemes, p.activeThemeId)) throw new Error('Tema activo inválido');
  for (const [id, theme] of Object.entries(p.designThemes)) {
    if (!safeId(id) || !record(theme) || theme.id !== id || !safeName(theme.name) || !record(theme.modes)) throw new Error('Perfil de tema inválido');
    for (const mode of ['light', 'dark'] as const) {
      const set = theme.modes[mode];
      if (!record(set)) throw new Error('Modo de tema inválido');
      for (const key of ['colors', 'gradients', 'materials', 'typography', 'radii'] as const) dictionary(set[key], key);
      const colors = id === 'project' ? { ...set.colors, ...p.themes[mode] } : set.colors;
      aliases(set.colors); aliases(colors);
      for (const key of ['primary', 'surface', 'background', 'text', 'muted', 'border', 'accent']) if (!Object.hasOwn(colors, key)) throw new Error(`Color base ausente: ${key}`);
      const colorRef = (value: unknown) => {
        if (!safeColor(value) || (value.startsWith('@') && !Object.hasOwn(colors, value.slice(1)))) throw new Error('Referencia de color inválida');
      };
      for (const gradient of Object.values(set.gradients)) {
        if (!record(gradient) || !safeName(gradient.name) || !['linear', 'radial'].includes(gradient.type) || !range(gradient.angle, -360, 360) || !Array.isArray(gradient.stops) || gradient.stops.length < 2 || gradient.stops.length > 16) throw new Error('Degradado inválido');
        let previous = -1;
        for (const stop of gradient.stops) {
          if (!record(stop) || !range(stop.position, 0, 100) || stop.position < previous) throw new Error('Parada de degradado inválida');
          colorRef(stop.color); previous = stop.position;
        }
      }
      for (const material of Object.values(set.materials)) {
        if (!record(material) || !safeName(material.name) || !range(material.opacity, 0, 100) || !range(material.blur, 0, 40) || !range(material.saturation, 0, 200) || !range(material.shadow, 0, 40)) throw new Error('Material inválido');
        colorRef(material.tint); colorRef(material.stroke);
      }
      for (const typography of Object.values(set.typography)) if (!record(typography) || !safeName(typography.name) || !['system', 'serif', 'mono'].includes(typography.fontFamily) || !range(typography.fontSize, 1, 512) || !range(typography.fontWeight, 100, 900) || !range(typography.lineHeight, 0.5, 5)) throw new Error('Tipografía inválida');
      for (const radius of Object.values(set.radii)) if (!range(radius, 0, 10000)) throw new Error('Radio de token inválido');
      if (Object.keys(set.colors).some(key => Object.hasOwn(set.gradients, key))) throw new Error('Nombre de relleno ambiguo');
    }
  }
}

export function validateNodeThemeRefs(p: Project, n: DesignNode, byId?: Map<string, DesignNode>) {
  for (const key of ['fillToken', 'materialToken', 'typographyToken', 'radiusToken', 'themeId', 'kitId'] as const) if (n[key] !== undefined && !safeId(n[key])) throw new Error('Referencia de token o tema inválida');
  if (n.themeId && !Object.hasOwn(p.designThemes, n.themeId)) throw new Error('Referencia de tema inválida');
  if (n.themeMode !== undefined && !['inherit', 'light', 'dark'].includes(n.themeMode)) throw new Error('Modo de elemento inválido');
  const set = effectiveTheme(p, n, byId).tokens;
  if (n.fillToken && !Object.hasOwn(set.colors, n.fillToken) && !Object.hasOwn(set.gradients, n.fillToken)) throw new Error('Referencia de relleno inválida');
  for (const [field, category] of [['materialToken', 'materials'], ['typographyToken', 'typography'], ['radiusToken', 'radii']] as const) if (n[field] && !Object.hasOwn(set[category], n[field]!)) throw new Error(`Referencia de ${category} inválida`);
  for (const key of ['fill', 'color', 'stroke', 'gradientEnd'] as const) resolveColor(p, n[key], n, byId);
  for (const stop of n.gradientStops ?? []) resolveColor(p, stop.color, n, byId);
}
