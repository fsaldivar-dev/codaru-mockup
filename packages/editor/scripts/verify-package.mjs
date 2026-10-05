import { access, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (metadata.private || metadata.license !== 'BSD-3-Clause') throw new Error('Revisa visibilidad y licencia antes de empaquetar.');
for (const file of ['dist/codaru.js','dist/core.js','dist/modular.js','dist/preview.js','dist/types/preview.d.ts','dist/types/editor-core.d.ts','dist/types/modular.d.ts','dist/editor/index.html','dist/types/embed.d.ts','dist/licenses/material-Apache-2.0.txt','dist/licenses/lucide-ISC.txt','LICENSE','README.md','scripts/copy-assets.mjs']) {
  try { await access(join(root, file)); } catch { throw new Error(`Falta ${file}. Ejecuta npm run package:build desde la raíz del repositorio.`); }
}
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await inspect(join(directory, entry.name));
    else if (entry.name.endsWith('.map')) throw new Error('La distribución no debe incluir mapas de fuentes.');
  }
}
await inspect(join(root, 'dist'));
console.log(`${metadata.name}@${metadata.version}: archivos y licencias listos.`);
