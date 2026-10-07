import { build } from 'vite';
import { cp, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';

const output = resolve('packages/editor/dist');
await build({ configFile: false, base: './', build: {
  target: 'safari16', sourcemap: false, minify: true, outDir: output, emptyOutDir: true,
  lib: { entry: { codaru: resolve('src/embed.ts'), core: resolve('src/editor-core.ts'), modular: resolve('src/modular.ts'), preview: resolve('src/preview.ts'), svg: resolve('src/screen-svg.ts') }, formats: ['es'], fileName: (_format, name) => `${name}.js` },
} });
await build({ configFile: false, base: './', build: {
  target: 'safari16', sourcemap: false, outDir: join(output, 'editor'), emptyOutDir: true,
  rolldownOptions: { input: resolve('index.html') },
} });
execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', 'tsconfig.embed.json'], { stdio: 'inherit' });
await cp(resolve('vendor/licenses'), join(output, 'licenses'), { recursive: true });

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(join(dir, e.name)) : join(dir, e.name)))).flat();
}
const all = await files(output);
const runtime = all.filter(p => /\.(js|css|html)$/.test(p));
const bytes = async paths => (await Promise.all(paths.map(async p => (await stat(p)).size))).reduce((a,b) => a+b, 0);
const report = {
  runtimeBytes: await bytes(runtime),
  runtimeGzipBytes: (await Promise.all(runtime.map(async p => gzipSync(await readFile(p), { level: 9 }).length))).reduce((a,b) => a+b, 0),
  distributionBytes: await bytes(all),
  notes: 'Runtime: JS + CSS + HTML. Distribución: runtime, tipos y licencias; sin host Tauri ni CLI. Gzip por archivo, no RAM.',
};
await mkdir(resolve('artifacts'), { recursive: true });
await writeFile(resolve('artifacts/embedded-size.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
