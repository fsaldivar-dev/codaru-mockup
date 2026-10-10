import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  base: './', clearScreen: false,
  build: { target: 'safari16', sourcemap: false, rolldownOptions: { input: {
    editor: resolve('index.html'), experience: resolve('examples/experience-host.html'), identity: resolve('examples/identity-host.html'), hiloReference: resolve('examples/hilo-reference/index.html'), performance: resolve('examples/performance-host.html'), musaruStyles: resolve('examples/musaru-styles/index.html'), aruMusic: resolve('examples/aru-music/index.html'), implementations: resolve('examples/implementations-host.html'), slots: resolve('examples/slots-host.html'), properties: resolve('examples/properties-host.html'), nested: resolve('examples/nested-host.html'), localization: resolve('examples/localization-host.html'), host: resolve('examples/tauri-host.html'), modular: resolve('examples/modular-host.html'), markdown: resolve('examples/markdown-preview.html'),
  } } },
  server: { watch: { ignored: ['**/src-tauri/**', '**/packages/**/target/**'] } },
});
