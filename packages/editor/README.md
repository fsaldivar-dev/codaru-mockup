# Codaru Mockup · editor embebible

[Repositorio](https://github.com/fsaldivar-dev/codaru-mockup) · [Contrato para IA](https://github.com/fsaldivar-dev/codaru-mockup/blob/main/CLI.md) · BSD-3-Clause

Editor visual con temas, componentes, iconos y API de IA. No crea una ventana ni inicia un servidor. Usa un iframe local del mismo origen dentro de la WebView que ya tiene tu aplicación, para aislar estilos, atajos y ciclo de vida. No es una frontera de seguridad para contenido remoto.

El paquete tiene cero dependencias JavaScript de ejecución. `npm run package:build`, desde la raíz del repositorio, genera `dist/codaru.js`, tipos TypeScript, el editor en `dist/editor/` y licencias. El CLI y el host nativo se distribuyen por separado.

## Montar en tu aplicación

```sh
npm install codaru-mockup
npx codaru-assets public/codaru
```

El segundo comando prepara los archivos del editor y sus licencias en una carpeta **nueva** del frontend; no reemplaza carpetas existentes. Al actualizar el paquete, usa una carpeta nueva o reemplaza deliberadamente la anterior. Es una herramienta de desarrollo: no se ejecuta ni requiere Node dentro de la aplicación distribuida.

También puedes copiar `dist/editor/`, `dist/licenses/`, `LICENSE` y `THIRD-PARTY-NOTICES.md` manualmente. Sirve esos archivos con el mismo origen de la app. En Tauri quedan incorporados al frontend; no se necesita un servidor HTTP en producción.

```ts
import { mountCodaru } from 'codaru-mockup';
import { invoke } from '@tauri-apps/api/core';

const mounted = mountCodaru(document.querySelector('#editor')!, {
  editorUrl: new URL('./codaru/editor/index.html', document.baseURI),
  storageKey: 'mi-app:mockup:proyecto-123',
  invoke,
  onChange(project) {
    // Opcional: sincronizar con el estado o almacenamiento de tu aplicación.
  },
});
const editor = await mounted.ready;
const response = await editor.agent('context', { depth: 1 });

// Al salir de esta vista, conservar el último documento y desmontar:
const project = await mounted.destroy();
```

El contenedor debe tener ancho y alto definidos, por ejemplo `height: calc(100vh - 48px)`. El editor conserva su diseño de escritorio; se recomienda un área de al menos 1060 × 650 px.

- `document`: documento inicial opcional; se valida antes de montarse y comienza con historial vacío.
- `storageKey`: clave explícita de borrador local. Sin ella, comienza vacío y la persistencia corresponde al host. El editor no utiliza el borrador de otra aplicación implícitamente.
- `invoke`: función del host Tauri para los comandos `plugin:codaru|…`. Sin ella, la API JavaScript sigue funcionando y abrir/guardar usan el navegador.
- `nativeAgent: false`: permite los diálogos nativos sin atender el CLI desde esa instancia. Con varios editores, el host debe habilitar el CLI únicamente en el que desea exponer.
- `onChange`: recibe una copia del documento cuando se confirman cambios, incluidos los de IA y Deshacer.
- `onError`: comunica errores de montaje o recarga inesperada.
- `destroy()`: guarda el último borrador, detiene el polling nativo, elimina el iframe y devuelve el documento. Es idempotente. Una recarga inesperada se notifica; no reemplaza silenciosamente la instancia.

`ready` ofrece `getDocument`, `getSelection`, `getSelectionScope`, `select`, `apply`, `agent`, `importDocument`, `undo`, `redo` y `exportHTML`. Para automatización usa preferentemente `agent`: los lotes incluyen revisión, dry-run y contexto actualizado. El contrato completo está en `CLI.md` en el repositorio y en el comando `schema`.

## Integración por piezas, sin iframe

`codaru-mockup/modular` monta cada parte del editor en un contenedor propio de tu app, dentro de Shadow DOM y con una sola sesión compartida. `codaru-mockup/core` es el mismo motor sin interfaz. No necesitan copiar assets ni un iframe.

```ts
import { createEditor, createEditorView } from 'codaru-mockup/modular';

const editor = createEditor({ document: project, onChange: save });
const view = createEditorView(editor, { appearance: { theme: 'light', tokens: { accent: '#007aff' } } });
view.mount('canvas', document.querySelector('#canvas')!);
view.mount('layers', document.querySelector('#navigator')!);
view.mount('inspector', document.querySelector('#properties')!);
view.mount('modes', document.querySelector('#tabs')!); // Solo las pestañas Diseño/Flujos.
view.mount('dialogs', document.querySelector('#overlays')!);
```

Piezas: `canvas`, `layers`, `inspector`, `library`, `toolbar`, `header`, `viewbar` (y sus controles `modes`, `designTheme`, `fit`), `breadcrumb`, `status`, `insert` y `dialogs`. Omite las que quieras sustituir por controles propios sobre `editor`. La [guía modular](https://github.com/fsaldivar-dev/codaru-mockup/blob/v0.3.0/docs/INTEGRATION.md) describe apariencia, tokens CSS, ciclo de vida y tamaños.

## Conectar Rust/Tauri

En el `Cargo.toml` de la app anfitriona:

```toml
[dependencies]
tauri-plugin-codaru = { git = "https://github.com/fsaldivar-dev/codaru-mockup", tag = "v0.3.0" }
```

Registra el plugin sobre tu builder existente:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_codaru::init())
    // Tus comandos, plugins y contexto habituales continúan aquí.
```

Añade a la capability local de la ventana anfitriona los permisos `codaru:allow-agent-poll`, `codaru:allow-agent-respond`, `codaru:allow-save-document` y `codaru:allow-open-document`. La invocación se hace desde el host y se inyecta al editor. No hacen falta permisos remotos. Consulta también el README de la crate Rust para desactivar el CLI o elegir un socket distinto.

El plugin reutiliza el proceso y la ventana de Tauri. Su código Rust se enlaza en el ejecutable de tu app; su incremento exacto depende de las dependencias que esa app ya incluya. El CLI externo es opcional si tu IA utiliza directamente la API del host. Para varias aplicaciones, utiliza un socket independiente por app y configura el CLI con `--socket`.

Para desarrollo local también puedes usar una dependencia Cargo `path` hacia `packages/tauri-plugin-codaru`. El plugin se distribuye desde este repositorio; no requiere una publicación en crates.io.

## Ejemplo y tamaños

`examples/tauri-host.html` es un host mínimo: monta el editor, consulta contexto y permite desmontarlo/remontarlo. La aplicación de ejemplo macOS arranca en esa página. Sigue conservando el borrador anterior de Codaru con una clave explícita.

`artifacts/embedded-size.json` registra tamaños medidos del runtime, distribución con tipos/licencias y gzip. No incluye una copia de Tauri, el CLI, el navegador del sistema ni memoria RAM. El tamaño de la app de ejemplo completa es una medición diferente.

## Licencias

El editor original usa BSD-3-Clause. Material conserva Apache-2.0 y Web/Lucide conserva ISC; los avisos completos están incluidos en `dist/licenses/`. Consulta `LICENSE` y `THIRD-PARTY-NOTICES.md`.
