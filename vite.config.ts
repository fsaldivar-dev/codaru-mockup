import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  base: './', clearScreen: false,
  build: { target: 'safari16', sourcemap: false, rolldownOptions: { input: {
    editor: resolve('index.html'), host: resolve('examples/tauri-host.html'), modular: resolve('examples/modular-host.html'), markdown: resolve('examples/markdown-preview.html'),
  } } },
  server: { watch: { ignored: ['**/src-tauri/**', '**/packages/**/target/**'] } },
});
