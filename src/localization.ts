import type { DesignNode, Project } from './model';
import { effectiveTheme, resolveNodeStyle } from './themes';
import { fonts, metricMeasure, wrapText, type TextMeasure } from './screen-svg';

/** Host-owned catalog. Only textKey and the source text are saved in a design document. */
export interface LocalizationConfig {
  locale: string | null;
  fallbackLocale?: string;
  messages: Record<string, Record<string, string>>;
  labels?: Record<string, string>;
}
export interface LocalizationState {
  locale: string | null;
  fallbackLocale?: string;
  locales: Array<{ id: string; label: string }>;
  revision: number;
  canRequestTranslation: boolean;
}
export interface TranslationRequest {
  nodeId: string; key: string; locale: string | null; sourceText: string; previewText: string;
}
export interface LocalizationIssue {
  kind: 'missing' | 'overflow'; node: string; key: string; locale: string;
  message: string; measurement?: 'metrics' | 'dom';
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const localeId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v) && !['__proto__','constructor','prototype'].includes(v);
export function normalizeLocalization(input: LocalizationConfig | null): LocalizationConfig | null {
  if (input === null) return null;
  if (!record(input) || !record(input.messages) || Object.keys(input.messages).length > 100) throw new Error('localization.messages debe contener hasta 100 idiomas.');
  const messages: Record<string, Record<string, string>> = Object.create(null);
  let total = 0;
  for (const [locale, values] of Object.entries(input.messages)) {
    if (!localeId(locale) || !record(values) || Object.keys(values).length > 20000) throw new Error('Idioma o catálogo inválido (máximo 20 000 claves por idioma).');
    const entries: Record<string, string> = Object.create(null);
    for (const [key, value] of Object.entries(values)) {
      if (!key.trim() || key.length > 200 || /[\u0000-\u001f\u007f]/.test(key) || typeof value !== 'string' || value.length > 20000) throw new Error('Las traducciones necesitan claves de 1–200 caracteres y textos de hasta 20 000 caracteres.');
      total += key.length + value.length;
      if (total > 5_000_000) throw new Error('El catálogo supera 5 millones de caracteres; envía los idiomas del módulo abierto.');
      entries[key] = value;
    }
    messages[locale] = entries;
  }
  if (input.locale !== null && (!localeId(input.locale) || !Object.hasOwn(messages, input.locale))) throw new Error('El idioma de vista previa no está en el catálogo.');
  if (input.fallbackLocale !== undefined && (!localeId(input.fallbackLocale) || !Object.hasOwn(messages, input.fallbackLocale))) throw new Error('El idioma de respaldo no está en el catálogo.');
  const labels: Record<string, string> = Object.create(null);
  if (input.labels !== undefined) {
    if (!record(input.labels)) throw new Error('labels debe ser un mapa de nombres de idioma.');
    for (const [locale, label] of Object.entries(input.labels)) {
      if (!Object.hasOwn(messages, locale) || typeof label !== 'string' || !label.trim() || label.length > 80) throw new Error('Nombre de idioma inválido.');
      labels[locale] = label;
    }
  }
  return { locale: input.locale, ...(input.fallbackLocale ? { fallbackLocale: input.fallbackLocale } : {}), messages, labels };
}
export function localizationState(config: LocalizationConfig | null, revision = 0, canRequestTranslation = false): LocalizationState {
  return { locale: config?.locale ?? null, ...(config?.fallbackLocale ? { fallbackLocale: config.fallbackLocale } : {}), locales: Object.keys(config?.messages ?? {}).map(id => ({ id, label: config?.labels?.[id] ?? id })), revision, canRequestTranslation };
}
export function resolveText(n: Pick<DesignNode, 'text' | 'textKey'>, config: LocalizationConfig | null) {
  const key = n.textKey, locale = config?.locale;
  if (!key || !locale) return { text: n.text, source: 'source' as const, missing: false };
  const entries = config.messages[locale];
  if (entries && Object.hasOwn(entries, key)) return { text: entries[key], source: 'translation' as const, missing: false };
  const fallback = config.fallbackLocale ? config.messages[config.fallbackLocale] : undefined;
  if (fallback && Object.hasOwn(fallback, key)) return { text: fallback[key], source: 'fallback' as const, missing: true };
  return { text: n.text, source: 'source' as const, missing: true };
}
/** Read-only projection for rendering/export; it never writes translations into the source document. */
export function localizeProject(p: Project, config: LocalizationConfig | null): Project {
  if (!config?.locale) return p;
  return { ...p, nodes: p.nodes.map(n => n.textKey ? { ...n, text: resolveText(n, config).text } : n) };
}
/** Without a mounted canvas overflow uses font metrics. A view can replace it with DOM measurements. */
export function localizationIssues(p: Project, config: LocalizationConfig | null, measure: TextMeasure = metricMeasure): LocalizationIssue[] {
  if (!config?.locale) return [];
  const byId = new Map(p.nodes.map(n => [n.id, n])), out: LocalizationIssue[] = [];
  for (const raw of p.nodes) {
    if (!raw.textKey) continue;
    let parent: DesignNode | undefined = raw, hidden = false;
    while (parent) { if (parent.hidden) { hidden = true; break; } parent = parent.parentId ? byId.get(parent.parentId) : undefined; }
    if (hidden) continue;
    const value = resolveText(raw, config), base = { node: raw.id, key: raw.textKey, locale: config.locale };
    if (value.missing) out.push({ ...base, kind: 'missing', message: `Falta «${raw.textKey}» en ${config.locale}; se muestra ${value.source === 'fallback' ? 'el idioma de respaldo' : 'el texto de origen'}.` });
    const n = { ...raw, ...resolveNodeStyle(p, raw) }, border = n.materialToken && effectiveTheme(p, n).tokens.materials[n.materialToken] ? Math.max(1, n.strokeWidth) : n.strokeWidth;
    const width = Math.max(1, n.width - border * 2 - (n.type === 'button' || n.type === 'input' ? 28 : 0));
    const height = Math.max(0, n.height - border * 2), font = { family: fonts[n.fontFamily] ?? fonts.system, size: n.fontSize, weight: n.fontWeight };
    if (value.text && wrapText(value.text, width, font, measure).length * n.fontSize * n.lineHeight > height + .5) out.push({ ...base, kind: 'overflow', measurement: 'metrics', message: 'El texto puede exceder el alto disponible; amplía la capa o ajusta su tipografía.' });
  }
  return out;
}
