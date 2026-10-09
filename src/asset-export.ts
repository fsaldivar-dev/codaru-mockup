import { ancestors, node, parseDocument, topSelected, type DesignNode, type Project } from './model';
import { effectiveTheme } from './themes';
import { frameToSVG, svgDataURL, withTheme, type ScreenTheme } from './screen-svg';

export type AssetFormat = 'svg' | 'png' | 'assets';
export type AssetPlatform = 'ios' | 'android' | 'all';
export interface AssetOptions {
  /** Selected roots are exported together as one transparent composition. Descendants are included once. */
  ids: string[];
  format?: AssetFormat;
  platform?: AssetPlatform;
  name?: string;
  /** Logical width in points / dp, preserving aspect ratio. Defaults to the selected bounds. */
  width?: number;
  /** Transparent space around the bounds. By default includes visible children and shadow margins. */
  padding?: number;
  /** PNG only, 0.25–4. Platform packages use their standard density scales. */
  scale?: number;
  theme?: ScreenTheme;
}
export interface AssetFileInfo { path: string; bytes: number; width?: number; height?: number; scale?: number; }
export interface AssetExport {
  format: AssetFormat; filename: string; mime: string; encoding: 'utf8' | 'base64'; content: string;
  name: string; width: number; height: number; ids: string[]; files: AssetFileInfo[]; warnings: string[];
}
interface Bounds { x: number; y: number; width: number; height: number; }
interface File { path: string; data: Uint8Array; width?: number; height?: number; scale?: number; }
const encoder = new TextEncoder();
const MAX_BYTES = 40_000_000, MAX_PIXELS = 16_777_216, MAX_SIDE = 8192;
const IOS = [1, 2, 3], ANDROID = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]] as const;
function assetName(input: string): string {
  const name = input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  return !name ? 'asset' : /^[a-z]/.test(name) ? name : `asset_${name}`;
}
function visible(p: Project, n: DesignNode) { return !n.hidden && !ancestors(p, n.id).some(a => a.hidden); }
function border(p: Project, n: DesignNode) { return n.materialToken ? Math.max(1, n.strokeWidth) : Math.max(0, n.strokeWidth); }
function position(p: Project, n: DesignNode) {
  return ancestors(p, n.id).reduce((a, parent) => ({ x: a.x + parent.x + border(p, parent), y: a.y + parent.y + border(p, parent) }), { x: n.x, y: n.y });
}
function union(a: Bounds, b: Bounds): Bounds {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}
function footprint(p: Project, n: DesignNode, x: number, y: number): Bounds {
  let box = { x, y, width: n.width, height: n.height };
  const material = n.materialToken ? effectiveTheme(p, n).tokens.materials[n.materialToken] : undefined;
  const blur = material?.shadow ? material.shadow * 2 : n.shadow ? 22 : 0, dy = material?.shadow ? material.shadow / 2 : n.shadow ? 8 : 0;
  if (blur) {
    // SVG filter region is bounded at 50% of the node; include the useful blur without cropping it.
    const spread = blur * 1.5, sx = Math.min(n.width / 2, spread), sy = Math.min(n.height / 2, spread + Math.abs(dy));
    box = union(box, { x: x - sx, y: y - sy, width: n.width + sx * 2, height: n.height + sy * 2 });
  }
  if (n.type !== 'frame') for (const child of p.nodes.filter(k => k.parentId === n.id && !k.hidden)) {
    box = union(box, footprint(p, child, x + border(p, n) + child.x, y + border(p, n) + child.y));
  }
  return box;
}

/** SVG extraction is pure and also works in Node or a worker; PNG needs a browser WebView. */
export function prepareAsset(document: unknown, options: AssetOptions) {
  const p = parseDocument(document);
  if (!Array.isArray(options.ids) || !options.ids.length || options.ids.length > 100 || options.ids.some(id => typeof id !== 'string')) throw new Error('Selecciona de 1 a 100 elementos para exportar.');
  const byId = new Map(p.nodes.map(n => [n.id, n]));
  for (const id of options.ids) { const n = byId.get(id); if (!n) throw new Error(`Elemento no encontrado: ${id}`); if (!visible(p, n)) throw new Error(`El elemento ${id} está oculto o pertenece a un contenedor oculto.`); }
  const ids = topSelected(p, [...new Set(options.ids)]), roots = p.nodes.filter(n => ids.includes(n.id));
  if (options.name !== undefined && typeof options.name !== 'string') throw new Error('name debe ser texto.');
  if (options.padding !== undefined && (!Number.isFinite(options.padding) || options.padding < 0 || options.padding > 1024)) throw new Error('padding debe estar entre 0 y 1024.');
  if (options.width !== undefined && (!Number.isFinite(options.width) || options.width < 1 || options.width > MAX_SIDE)) throw new Error(`width debe estar entre 1 y ${MAX_SIDE}.`);
  withTheme(p, options.theme, roots);
  const mode = typeof options.theme === 'string' ? options.theme : options.theme?.mode;
  if (mode) for (const root of roots) root.themeMode = mode;
  let bounds: Bounds | undefined;
  for (const n of roots) { const pos = position(p, n), b = footprint(p, n, pos.x, pos.y); bounds = bounds ? union(bounds, b) : b; }
  const padding = options.padding ?? 0, b = bounds!;
  bounds = { x: b.x - padding, y: b.y - padding, width: b.width + padding * 2, height: b.height + padding * 2 };
  const name = assetName(options.name ?? (roots.length === 1 ? roots[0].name : 'seleccion'));
  let id = 'codaru_asset_root'; while (byId.has(id)) id += '_';
  const wrapper = node('group', { id, name, width: bounds.width, height: bounds.height, fill: 'transparent', strokeWidth: 0, radius: 0, padding: 0 });
  // Keep the source ancestry available while resolving inherited profile, mode and opacity.
  const moved = new Map(roots.map(n => {
    const at = position(p, n), theme = effectiveTheme(p, n);
    const opacity = ancestors(p, n.id).reduce((v, parent) => v * parent.opacity / 100, n.opacity);
    return [n.id, { ...n, parentId: id, x: at.x - bounds!.x, y: at.y - bounds!.y, themeId: theme.id, themeMode: theme.mode, opacity }];
  }));
  const working = { ...p, nodes: [...p.nodes.map(n => moved.get(n.id) ?? n), wrapper] };
  const width = options.width ?? bounds.width, height = width * bounds.height / bounds.width;
  let svg = frameToSVG(working, wrapper);
  svg = svg.replace(/^(<svg[^>]*?)width="[^"]*" height="[^"]*"/, `$1width="${width}" height="${height}"`);
  const included = p.nodes.filter(n => roots.some(root => n.id === root.id || ancestors(p, n.id).some(a => a.id === root.id)) && visible(p, n));
  const warnings: string[] = [];
  if (included.some(n => n.materialToken)) warnings.push('El cristal conserva tinte, borde y sombra; no incluye desenfoque del contenido que quedaba detrás.');
  if (included.some(n => n.animations?.length)) warnings.push('Asset estático: las animaciones no se incluyen.');
  if (included.some(n => n.text)) warnings.push('El SVG conserva texto editable y usa fuentes del sistema; puede variar entre plataformas. El PNG fija el resultado.');
  const aruSources = included.filter(n => n.aruSource).map(n => ({id:n.id,source:n.aruSource!}));
  return { svg, name, width, height, bounds, ids: roots.map(n => n.id), warnings, aruSources };
}
export function renderAssetToSVG(document: unknown, options: AssetOptions): string { return prepareAsset(document, options).svg; }
function encoded(bytes: Uint8Array): string {
  let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
/** Public for hosts saving exported binary data without using native dialogs. */
export function assetBytes(asset: Pick<AssetExport, 'encoding' | 'content'>): Uint8Array {
  return asset.encoding === 'utf8' ? encoder.encode(asset.content) : Uint8Array.from(atob(asset.content), c => c.charCodeAt(0));
}
function dimensions(width: number, height: number, scale: number) {
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  if (w > MAX_SIDE || h > MAX_SIDE || w * h > MAX_PIXELS) throw new Error('El asset supera 8192 px por lado o 16 megapíxeles en una escala. Reduce width o selecciona una pieza más pequeña.');
  return { width: w, height: h };
}
async function loadImage(svg: string): Promise<HTMLImageElement> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') throw new Error('PNG y paquetes móviles necesitan el navegador o la WebView de Codaru. SVG funciona sin DOM.');
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { image.src = ''; reject(new Error('La imagen tardó demasiado en prepararse.')); }, 15000);
    image.onload = () => { clearTimeout(timer); resolve(); }; image.onerror = () => { clearTimeout(timer); reject(new Error('No se pudo rasterizar el SVG del asset.')); };
    image.src = svgDataURL(svg);
  });
  return image;
}
async function png(image: HTMLImageElement, width: number, height: number): Promise<Uint8Array> {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  try {
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('No está disponible el render PNG.');
    ctx.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo crear el PNG.')), 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  } finally { canvas.width = canvas.height = 1; }
}

/** Export one selected composition. ZIP contains ready-to-import native PNG assets and the SVG source. */
export async function exportAsset(document: unknown, options: AssetOptions): Promise<AssetExport> {
  const format = options.format ?? 'assets', platform = options.platform ?? 'all';
  if (!['svg', 'png', 'assets'].includes(format)) throw new Error('format debe ser svg, png o assets.');
  if (!['ios', 'android', 'all'].includes(platform)) throw new Error('platform debe ser ios, android o all.');
  const scale = options.scale ?? 1;
  if (!Number.isFinite(scale) || scale < .25 || scale > 4) throw new Error('scale debe estar entre 0.25 y 4.');
  const asset = prepareAsset(document, options), { svg, name, width, height, ids, warnings } = asset;
  const base = { format, name, width, height, ids, warnings };
  if (format === 'svg') return { ...base, filename: `${name}.svg`, mime: 'image/svg+xml', encoding: 'utf8', content: svg, files: [{ path: `${name}.svg`, bytes: encoder.encode(svg).length }] };
  const scales = format === 'png' ? [scale] : [...new Set([...(platform !== 'android' ? IOS : []), ...(platform !== 'ios' ? ANDROID.map(([,s]) => s) : [])])];
  const sizes = new Map(scales.map(s => [s, dimensions(width, height, s)]));
  const images = new Map<number, Uint8Array>();
  let total = 0;
  for (const s of scales) {
    const size = sizes.get(s)!;
    // Give WebKit an SVG viewport at the actual density, so it never enlarges a cached 1x bitmap.
    const sizedSVG = svg.replace(/^(<svg[^>]*?)width="[^"]*" height="[^"]*"/, `$1width="${size.width}" height="${size.height}"`);
    const image = await loadImage(sizedSVG), data = await png(image, size.width, size.height);
    image.src = '';
    total += data.length; if (total > MAX_BYTES) throw new Error('La exportación supera 40 MB; reduce width.'); images.set(s, data);
  }
  if (format === 'png') { const data = images.get(scale)!, size = sizes.get(scale)!; return { ...base, filename: `${name}.png`, mime: 'image/png', encoding: 'base64', content: encoded(data), files: [{ path: `${name}.png`, bytes: data.length, ...size, scale }] }; }
  const files: File[] = [{ path: `source/${name}.svg`, data: encoder.encode(svg) }];
  for(const entry of asset.aruSources) files.push({path:`source/aru/${entry.id}-${assetName(entry.source.filename.replace(/\.aru$/i,""))}.aru`,data:encoder.encode(entry.source.text)});
  const json = (path: string, data: unknown) => files.push({ path, data: encoder.encode(JSON.stringify(data, null, 2) + '\n') });
  const addPNG = (path: string, s: number) => files.push({ path, data: images.get(s)!, ...sizes.get(s)!, scale: s });
  if (platform !== 'android') {
    const root = `ios/Assets.xcassets`, set = `${root}/${name}.imageset`;
    const info = { version: 1, author: 'codaru' };
    json(`${root}/Contents.json`, { info });
    json(`${set}/Contents.json`, { images: IOS.map(s => ({ idiom: 'universal', filename: `${name}${s === 1 ? '' : `@${s}x`}.png`, scale: `${s}x` })), info });
    for (const s of IOS) addPNG(`${set}/${name}${s === 1 ? '' : `@${s}x`}.png`, s);
  }
  if (platform !== 'ios') for (const [bucket, s] of ANDROID) addPNG(`android/res/drawable-${bucket}/${name}.png`, s);
  json('manifest.json', { format: 'codaru-assets', version: 1, name, ids, width, height, platform, warnings, files: files.map(({ path, data, ...meta }) => ({ path, bytes: data.length, ...meta })) });
  files.push({ path: 'README.txt', data: encoder.encode(`Codaru assets: ${name}\n\nTamaño lógico: ${width} × ${height} pt/dp. PNG transparente; escala 1x = 1 px por unidad.\n\niOS: arrastra ${name}.imageset a tu Assets.xcassets. SwiftUI: Image("${name}").\nAndroid: copia las carpetas drawable-* dentro de app/src/main/res. Referencia: @drawable/${name}.\nsource/${name}.svg conserva los vectores; Android usa los PNG del paquete, no el SVG directamente.\n\n${warnings.join('\n')}\n`) });
  const archive = zip(files);
  return { ...base, filename: `${name}-${platform}.zip`, mime: 'application/zip', encoding: 'base64', content: encoded(archive), files: files.map(({path,data,...meta})=>({path,bytes:data.length,...meta})) };
}

// Minimal ZIP "store" writer. PNG is already compressed; no dependency or server is required.
function crc32(bytes: Uint8Array) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
function zip(files: File[]): Uint8Array {
  const chunks: Uint8Array[] = [], directory: Uint8Array[] = []; let offset = 0;
  for (const file of files) {
    const path = encoder.encode(file.path), data = file.data, crc = crc32(data), header = new Uint8Array(30 + path.length), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, path.length, true); header.set(path, 30);
    const central = new Uint8Array(46 + path.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, path.length, true); c.setUint32(42, offset, true); central.set(path, 46);
    chunks.push(header, data); directory.push(central); offset += header.length + data.length;
  }
  const directorySize = directory.reduce((n, b) => n + b.length, 0), end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, directorySize, true); e.setUint32(16, offset, true);
  if (offset + directorySize + end.length > MAX_BYTES) throw new Error('El paquete supera 40 MB; reduce width.');
  const result = new Uint8Array(offset + directorySize + end.length); let at = 0;
  for (const chunk of [...chunks, ...directory, end]) { result.set(chunk, at); at += chunk.length; }
  return result;
}
