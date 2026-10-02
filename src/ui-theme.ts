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
}

export interface EditorAppearance {
  theme?: 'light' | 'dark';
  /** Omitted tokens keep their current value; null restores inheritance/defaults. */
  tokens?: { [Key in keyof EditorAppearanceTokens]?: EditorAppearanceTokens[Key] | null };
}

/** These defaults also serve as fallbacks in fragment-style.css. */
export const editorAppearanceDefaults: Readonly<Record<'light' | 'dark', Readonly<EditorAppearanceTokens>>> = Object.freeze({
  light: Object.freeze({
    background: '#f5f5f7', surface: '#ffffff', surfaceRaised: '#ececf0',
    text: '#242429', muted: '#686872', border: '#d9d9df',
    accent: '#007aff', accentText: '#ffffff', canvas: '#e9e9ef',
    grid: '#c6c6d0', selection: '#007aff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 12, radius: 6,
  }),
  dark: Object.freeze({
    background: '#1b1c21', surface: '#202126', surfaceRaised: '#292a31',
    text: '#ededf1', muted: '#9696a3', border: '#3a3b43',
    accent: '#b39bea', accentText: '#282035', canvas: '#18191e',
    grid: '#34353e', selection: '#ac8fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 12, radius: 6,
  }),
});

const properties: Record<keyof EditorAppearanceTokens, `--codaru-${string}`> = {
  background: '--codaru-background', surface: '--codaru-surface',
  surfaceRaised: '--codaru-surface-raised', text: '--codaru-text', muted: '--codaru-muted',
  border: '--codaru-border', accent: '--codaru-accent', accentText: '--codaru-accent-text',
  canvas: '--codaru-canvas', grid: '--codaru-grid', selection: '--codaru-selection',
  fontFamily: '--codaru-font-family', fontSize: '--codaru-font-size', radius: '--codaru-radius',
};

/**
 * Incrementally style a fragment host without changing its document.
 * Unset tokens inherit --codaru-* CSS variables from the IDE before falling back
 * to the selected theme. Calling with { theme: 'light' } preserves custom tokens.
 */
export function applyAppearance(element: HTMLElement, appearance: EditorAppearance): void {
  if (appearance.theme !== undefined && appearance.theme !== 'light' && appearance.theme !== 'dark') {
    throw new TypeError('El tema del editor debe ser light o dark.');
  }
  // Validate first so a malformed update cannot leave a partially applied theme.
  const changes: Array<[string, string | null]> = [];
  for (const key of Object.keys(properties) as Array<keyof EditorAppearanceTokens>) {
    const value = appearance.tokens?.[key];
    if (value === undefined) continue;
    if (value === null) { changes.push([properties[key], null]); continue; }
    if (typeof value === 'number') {
      if ((key !== 'fontSize' && key !== 'radius') || !Number.isFinite(value) || value < 0) {
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
  for (const [property, value] of changes) {
    if (value === null) element.style.removeProperty(property);
    else element.style.setProperty(property, value);
  }
}
