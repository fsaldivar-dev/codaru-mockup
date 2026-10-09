import type { AruAsset, AruSource } from './contracts';
import { sanitizeSVG, vectorSize } from './motion';

/** Source is preserved as data; ARU compilation belongs to the optional CLI/host. */
export function validateAruSource(value: unknown): asserts value is AruSource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Fuente ARU inválida.');
  const source = value as AruSource;
  if (Object.keys(source).some(key => !['version', 'text', 'filename'].includes(key)) || source.version !== 1 ||
    typeof source.text !== 'string' || !source.text.trim() || source.text.length > 400_000 || source.text.includes('\0') ||
    typeof source.filename !== 'string' || !/^[^/\\\u0000-\u001f<>:"|?*]{1,120}\.aru$/i.test(source.filename)) {
    throw new Error('Fuente ARU inválida: versión 1, texto de hasta 400 kB y nombre .aru sin rutas.');
  }
}

export function prepareAruAsset(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Paquete ARU inválido.');
  const data = value as AruAsset;
  if (data.format !== 'codaru-aru/1') throw new Error('Se esperaba un paquete codaru-aru/1. Usa codaru-aru para preparar el archivo.');
  const aruSource: AruSource = { version: 1, text: data.source, filename: data.filename };
  validateAruSource(aruSource);
  const svg = sanitizeSVG(data.svg);
  return { svg, aruSource, ...vectorSize(svg) };
}
