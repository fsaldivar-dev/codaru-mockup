# Desarrollo y verificación

Requisitos de desarrollo: Node.js 22.12 o posterior y npm. Para el ejemplo nativo se necesitan Rust estable y los requisitos de Tauri 2 de la plataforma. Las aplicaciones compiladas no necesitan Node.

```sh
npm ci
npm run package:build
npm test
npx playwright install chromium
npm run test:ui
npm run build
```

Construye el paquete antes de probar la distribución: la suite de interfaz verifica también los archivos generados, sin recurrir a `src/`. Los cambios visuales deben comprobarse en el ejemplo nativo, conservando cualquier documento abierto por el usuario.

```sh
TAURI_CONFIG='{"bundle":{"resources":[]}}' cargo test --locked --manifest-path src-tauri/Cargo.toml -p tauri-plugin-codaru --lib
TAURI_CONFIG='{"bundle":{"resources":[]}}' cargo test --locked --manifest-path src-tauri/Cargo.toml --bin codaru
npm run native:build
```

Los cambios del editor se implementan en `src/`; `packages/editor/dist/` se regenera y no se versiona. El plugin Rust vive en `packages/tauri-plugin-codaru`. Los artefactos, capturas y borradores personales no se suben al repositorio.

Para preparar una versión, actualiza versiones y changelog, ejecuta las comprobaciones y `npm run package:pack`. Revisa `npm pack --dry-run ./packages/editor` antes de publicar. La publicación npm se realiza de forma explícita; CI verifica y construye artefactos, pero no contiene credenciales de publicación.
