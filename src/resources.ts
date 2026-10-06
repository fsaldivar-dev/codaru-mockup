/**
 * Free resource bank: icons and small illustrations from Iconify (open-source icon sets), photos
 * under Creative Commons from Openverse, and placeholder photos from Lorem Picsum. Everything is
 * fetched on demand from the browser, only when the person searches; the editor works without it.
 * Credits travel with the inserted layer (name) so attribution is never lost.
 */
export type ResourceSource = 'iconify' | 'openverse' | 'picsum';
export interface ResourceHit {
  id: string; source: ResourceSource; kind: 'vector' | 'image'; title: string; thumb: string;
  license: string; licenseUrl?: string; creator?: string; page?: string; set?: string;
  width?: number; height?: number; svgUrl?: string; imageUrl?: string;
}
export const resourceSources: Array<{ id: ResourceSource; name: string; hint: string; terms: string }> = [
  { id: 'iconify', name: 'Iconos e ilustraciones · Iconify', hint: 'Más de 200 000 iconos y emojis de colecciones de código abierto (MIT, Apache, CC0, CC BY…). Se insertan como ilustración editable.', terms: 'https://iconify.design/docs/icons/license.html' },
  { id: 'openverse', name: 'Fotos · Openverse (Creative Commons)', hint: 'Fotografías con licencia CC0, CC BY o CC BY-SA aptas para uso comercial y modificación. El crédito queda en el nombre de la capa.', terms: 'https://openverse.org/about' },
  { id: 'picsum', name: 'Fotos de relleno · Lorem Picsum', hint: 'Fotos de Unsplash para maquetar; cambia la semilla para obtener otras. Licencia Unsplash (uso libre, sin reventa tal cual).', terms: 'https://unsplash.com/license' },
];
const text = (value: unknown, max = 200) => typeof value === 'string' ? value.slice(0, max) : '';
const ICON_ID = /^[a-z0-9-]+:[a-z0-9-]+$/;
/** Licenses we show by default: free to use and modify in a product. Share-alike stays (fine for mockups), non-commercial and copyleft code licenses are hidden. */
export function permissiveLicense(license: string) { return !/non-?commercial|\bNC\b|GPL|LGPL|AGPL|no derivatives|\bND\b/i.test(license); }

export function iconifySearchURL(query: string, limit = 48) { return `https://api.iconify.design/search?query=${encodeURIComponent(query.trim())}&limit=${Math.max(1, Math.min(96, limit))}`; }
export function iconifySVGURL(id: string, color?: string, size = 64) { if (!ICON_ID.test(id)) throw new Error('Icono inválido'); const [prefix, name] = id.split(':'); return `https://api.iconify.design/${prefix}/${name}.svg?width=${size}&height=${size}${color ? `&color=${encodeURIComponent(color)}` : ''}`; }
/** Thumbnails are drawn on the editor's dark panel, so they use a light ink; the inserted SVG keeps currentColor and takes the layer's @text. */
export const THUMB_INK = '#d2d2db';
export function parseIconify(json: unknown, color: string = THUMB_INK): ResourceHit[] {
  const data = json && typeof json === 'object' ? json as { icons?: unknown; collections?: Record<string, { name?: string; license?: { title?: string; spdx?: string; url?: string }; author?: { name?: string } }> } : {};
  const sets = data.collections ?? {};
  return (Array.isArray(data.icons) ? data.icons : []).filter((id): id is string => typeof id === 'string' && ICON_ID.test(id)).map(id => {
    const [prefix, name] = id.split(':'), set = sets[prefix] ?? {}, license = text(set.license?.spdx) || text(set.license?.title) || 'Licencia abierta';
    return { id: `iconify:${id}`, source: 'iconify' as const, kind: 'vector' as const, title: name.replace(/-/g, ' '), set: text(set.name) || prefix, license, licenseUrl: text(set.license?.url) || undefined, creator: text(set.author?.name) || undefined, thumb: iconifySVGURL(id, color, 48), svgUrl: iconifySVGURL(id, undefined, 256) };
  }).filter(hit => permissiveLicense(hit.license));
}

export function openverseSearchURL(query: string, page = 1, pageSize = 20) { return `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query.trim())}&page=${page}&page_size=${Math.min(20, pageSize)}&license_type=commercial,modification`; }
export function parseOpenverse(json: unknown): ResourceHit[] {
  const data = json && typeof json === 'object' ? json as { results?: unknown } : {};
  return (Array.isArray(data.results) ? data.results : []).filter((r): r is Record<string, unknown> => !!r && typeof r === 'object').map(r => {
    const license = `CC ${text(r.license).toUpperCase().replace(/^CC0$/, '0')}${r.license_version ? ' ' + text(r.license_version) : ''}`.replace('CC 0', 'CC0').replace('CC PDM', 'Dominio público');
    const id = text(r.id, 80);
    return { id: `openverse:${id}`, source: 'openverse' as const, kind: 'image' as const, title: text(r.title, 120) || 'Foto', creator: text(r.creator, 120) || undefined, license, licenseUrl: text(r.license_url) || undefined, page: text(r.foreign_landing_url, 500) || undefined, width: typeof r.width === 'number' ? r.width : undefined, height: typeof r.height === 'number' ? r.height : undefined,
      thumb: text(r.thumbnail, 500) || `https://api.openverse.org/v1/images/${id}/thumb/`, imageUrl: `https://api.openverse.org/v1/images/${id}/thumb/` };
  }).filter(hit => /^[0-9a-f-]{36}$/.test(hit.id.slice(10)) && permissiveLicense(hit.license));
}

export function picsumHits(seed: string, count = 12, width = 480, height = 320): ResourceHit[] {
  const base = seed.trim().replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'codaru';
  return Array.from({ length: Math.max(1, Math.min(48, count)) }, (_, i) => { const s = `${base}-${i + 1}`; return { id: `picsum:${s}`, source: 'picsum' as const, kind: 'image' as const, title: `Foto de relleno ${i + 1}`, license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', thumb: `https://picsum.photos/seed/${s}/${Math.round(width / 2)}/${Math.round(height / 2)}`, imageUrl: `https://picsum.photos/seed/${s}/${width}/${height}`, width, height }; });
}

/** The layer name a resource gets: what it is, who made it and under which license, so credits survive exports and hand-offs. */
export function creditName(hit: ResourceHit) { return [hit.title, hit.creator ?? (hit.source === 'iconify' ? hit.set : hit.source === 'picsum' ? 'Unsplash vía Picsum' : 'Openverse'), hit.license].filter(Boolean).join(' · ').slice(0, 120); }

export async function fetchSVGText(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal }); if (!response.ok) throw new Error(`No se pudo descargar el icono (${response.status})`);
  const svg = await response.text(); if (!/<svg[\s>]/i.test(svg)) throw new Error('La respuesta no es un SVG'); return svg;
}
/** Download an image and re-encode it at a sensible size for a mockup (browser only). */
export async function fetchImageDataURL(url: string, options: { maxSize?: number; signal?: AbortSignal } = {}) {
  const response = await fetch(url, { signal: options.signal }); if (!response.ok) throw new Error(`No se pudo descargar la imagen (${response.status})`);
  const blob = await response.blob(); if (!blob.type.startsWith('image/')) throw new Error('La respuesta no es una imagen');
  const bitmap = await createImageBitmap(blob), max = options.maxSize ?? 1200, scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
  const alpha = blob.type === 'image/png' || blob.type === 'image/gif' || blob.type === 'image/webp';
  const data = alpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', .8);
  return { data, width: canvas.width, height: canvas.height };
}
