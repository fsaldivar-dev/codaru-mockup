#!/usr/bin/env node
import { cp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.length !== 1 || args[0] === '--help') {
  console.log('Uso: codaru-assets <carpeta-nueva>\nEjemplo: codaru-assets public/codaru\nCopia editor y licencias para servirlos desde el mismo origen. No reemplaza carpetas existentes.');
  process.exit(args[0] === '--help' ? 0 : 1);
}
const destination = resolve(args[0]);
const root = fileURLToPath(new URL('../', import.meta.url));
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
try {
  await mkdir(dirname(destination), { recursive: true });
  await mkdir(destination);
  for (const directory of ['editor', 'licenses']) {
    await cp(join(root, 'dist', directory), join(destination, directory), { recursive: true, errorOnExist: true, force: false });
  }
  for (const file of ['LICENSE', 'THIRD-PARTY-NOTICES.md']) {
    await cp(join(root, file), join(destination, file), { errorOnExist: true, force: false });
  }
  await writeFile(join(destination, '.codaru-assets.json'), JSON.stringify({ package: metadata.name, version: metadata.version }) + '\n', { flag: 'wx' });
  console.log(`Assets preparados en ${destination}\nEditor: ${join(destination, 'editor/index.html')}`);
} catch (error) {
  console.error(error.code === 'EEXIST' ? `El destino ya existe: ${destination}. Elige una carpeta nueva; no se reemplazaron archivos.` : error.message);
  process.exitCode = 1;
}
