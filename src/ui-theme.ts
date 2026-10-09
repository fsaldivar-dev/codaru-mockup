/** Editor chrome only. Document themes and design-node styles are independent. */
export interface EditorAppearanceTokens {
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentText: string;
  canvas: string;
  grid: string;
  selection: string;
  fontFamily: string;
  /** CSS length, or a pixel value. */
  fontSize: string | number;
  /** CSS length, or a pixel value. */
  radius: string | number;
  /** Optional additions: existing complete token objects remain compatible. */
  controlHeight?: string | number;
  rowHeight?: string | number;
  panelPadding?: string | number;
  gap?: string | number;
  danger?: string;
  warning?: string;
  success?: string;
  info?: string;
}

export interface EditorAppearance {
  theme?: 'light' | 'dark';
  /** Affects chrome spacing only; explicit size tokens take precedence. */
  density?: 'compact' | 'comfortable';
  /** Omitted tokens keep their current value; null restores inheritance/defaults. */
  tokens?: { [Key in keyof EditorAppearanceTokens]?: EditorAppearanceTokens[Key] | null };
}

/** These defaults also serve as fallbacks in chrome-style.css. */
export const editorAppearanceDefaults: Readonly<Record<'light' | 'dark', Readonly<EditorAppearanceTokens>>> = Object.freeze({
  light: Object.freeze({
    background: '#f5f5f7', surface: '#ffffff', surfaceRaised: '#ececf0',
    text: '#242429', muted: '#686872', border: '#d9d9df',
    accent: '#007aff', accentText: '#ffffff', canvas: '#e9e9ef',
    grid: '#c6c6d0', selection: '#007aff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 12, radius: 6,
    controlHeight: 32, rowHeight: 30, panelPadding: 12, gap: 8,
    danger: '#bf3348', warning: '#996400', success: '#248052', info: '#007aff',
  }),
  dark: Object.freeze({
    background: '#1b1c21', surface: '#202126', surfaceRaised: '#292a31',
    text: '#ededf1', muted: '#9696a3', border: '#3a3b43',
    accent: '#b39bea', accentText: '#282035', canvas: '#18191e',
    grid: '#34353e', selection: '#ac8fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 12, radius: 6,
    controlHeight: 32, rowHeight: 30, panelPadding: 12, gap: 8,
    danger: '#f39ba8', warning: '#e7bf6c', success: '#83cba3', info: '#8db7ff',
  }),
});

const properties: Record<keyof EditorAppearanceTokens, `--codaru-${string}`> = {
  background: '--codaru-background', surface: '--codaru-surface',
  surfaceRaised: '--codaru-surface-raised', text: '--codaru-text', muted: '--codaru-muted',
  border: '--codaru-border', accent: '--codaru-accent', accentText: '--codaru-accent-text',
  canvas: '--codaru-canvas', grid: '--codaru-grid', selection: '--codaru-selection',
  fontFamily: '--codaru-font-family', fontSize: '--codaru-font-size', radius: '--codaru-radius',
  controlHeight: '--codaru-control-height', rowHeight: '--codaru-row-height',
  panelPadding: '--codaru-panel-padding', gap: '--codaru-gap',
  danger: '--codaru-danger', warning: '--codaru-warning', success: '--codaru-success', info: '--codaru-info',
};

/** Read the public variables at an iframe boundary, where CSS inheritance stops. */
export function readAppearanceTokens(element: HTMLElement): NonNullable<EditorAppearance['tokens']> {
  const style = element.ownerDocument.defaultView!.getComputedStyle(element);
  return Object.fromEntries(Object.entries(properties).map(([key, property]) => [key, style.getPropertyValue(property).trim() || null]));
}

/**
 * Incrementally style a fragment host without changing its document.
 * Unset tokens inherit --codaru-* CSS variables from the IDE before falling back
 * to the selected theme. Calling with { theme: 'light' } preserves custom tokens.
 */
export function applyAppearance(element: HTMLElement, appearance: EditorAppearance): void {
  if (appearance.theme !== undefined && appearance.theme !== 'light' && appearance.theme !== 'dark') {
    throw new TypeError('El tema del editor debe ser light o dark.');
  }
  if (appearance.density !== undefined && appearance.density !== 'compact' && appearance.density !== 'comfortable') {
    throw new TypeError('La densidad del editor debe ser compact o comfortable.');
  }
  // Validate first so a malformed update cannot leave a partially applied theme.
  const changes: Array<[string, string | null]> = [];
  for (const key of Object.keys(properties) as Array<keyof EditorAppearanceTokens>) {
    const value = appearance.tokens?.[key];
    if (value === undefined) continue;
    if (value === null) { changes.push([properties[key], null]); continue; }
    if (typeof value === 'number') {
      if (!['fontSize', 'radius', 'controlHeight', 'rowHeight', 'panelPadding', 'gap'].includes(key) || !Number.isFinite(value) || value < 0) {
        throw new TypeError(`El token ${key} debe ser una longitud CSS válida.`);
      }
      changes.push([properties[key], `${value}px`]);
    } else if (typeof value === 'string') {
      changes.push([properties[key], value]);
    } else {
      throw new TypeError(`El token ${key} debe ser una cadena CSS.`);
    }
  }
  if (appearance.theme !== undefined) element.dataset.codaruTheme = appearance.theme;
  if (appearance.density !== undefined) element.dataset.codaruDensity = appearance.density;
  for (const [property, value] of changes) {
    if (value === null) element.style.removeProperty(property);
    else element.style.setProperty(property, value);
  }
}
