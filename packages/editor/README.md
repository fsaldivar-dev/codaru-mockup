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
- `appearance` / `handle.setAppearance()`: tema claro/oscuro, densidad y tokens visuales del editor completo, con el mismo contrato de los fragmentos. Los tokens omitidos se leen del contenedor al cargar o actualizar la apariencia.
- `destroy()`: guarda el último borrador, detiene el polling nativo, elimina el iframe y devuelve el documento. Es idempotente. Una recarga inesperada se notifica; no reemplaza silenciosamente la instancia.

`ready` ofrece `getDocument`, `getSelection`, `getSelectionScope`, `select`, `apply`, `agent`, `importDocument`, `undo`, `redo` y `exportHTML`. Para automatización usa preferentemente `agent`: los lotes incluyen revisión, dry-run y contexto actualizado. El contrato completo está en `CLI.md` en el repositorio y en el comando `schema`.

## Integración por piezas, sin iframe

`codaru-mockup/modular` monta cada parte del editor en un contenedor propio de tu app, dentro de Shadow DOM y con una sola sesión compartida. `codaru-mockup/core` es el mismo motor sin interfaz. No necesitan copiar assets ni un iframe. Ambos exportan `screens(document)`, `roleOf`, `pagesOf` y `pageView`; `core` añade `renderScreenToSVG` / `renderScreenToDataURL` para dibujar una pantalla sin montar nada, y `codaru-mockup/svg` trae solo eso, sin DOM.

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

Piezas: `canvas`, `layers`, `inspector`, `library`, `pages`, `system`, `toolbar`, `header`, `viewbar` (y sus controles `modes`, `designTheme`, `fit`), `breadcrumb`, `status`, `insert` y `dialogs`. Omite las que quieras sustituir por controles propios sobre `editor`. La [guía modular](https://github.com/fsaldivar-dev/codaru-mockup/blob/v0.3.0/docs/INTEGRATION.md) describe apariencia, tokens CSS, ciclo de vida y tamaños.

El editor completo y los fragmentos comparten estilos de controles, tipografía, superficies y avisos. Se mantienen los tokens `--codaru-*` y los CSS parts de las raíces; los tamaños adicionales (`controlHeight`, `rowHeight`, `panelPadding`, `gap`) y colores de estado son opcionales. `density: 'compact' | 'comfortable'` permite adaptar el espaciado al IDE. El inspector conserva su plegado en la vista y expone también `inspector-section`, `section-heading` y `section-toggle` para ajustes con `::part()`.

## Exportar ilustraciones para iOS y Android

`editor.exportAsset({ format: 'assets', platform: 'all' })` entrega la selección como un ZIP con SVG fuente, un `.imageset` iOS a 1x/2x/3x y PNG Android de mdpi a xxxhdpi. También admite `ids`, `name`, `width` lógico, `padding`, `theme`, formatos `svg`/`png` y `scale` para PNG. No cambia documento ni historial. Funciona tanto con el editor completo como con el motor modular y botones propios del IDE.

`codaru-mockup/assets` exporta `exportAsset(document, options)`, `renderAssetToSVG(document, { ids })` y `assetBytes(result)` para obtener un `Uint8Array`. SVG no necesita DOM; PNG/ZIP usan el canvas de tu navegador/WebView. El resultado incluye `filename`, `mime`, `encoding`, `content`, `files` y `warnings`. El plugin Tauri actualizado acepta `encoding: 'base64'` en `save_document` para PNG/ZIP; el CLI guarda los binarios con `export --format assets --ids ID --output assets.zip`.

Los assets son estáticos y transparentes. El SVG conserva vectores y créditos; los materiales de cristal se simplifican a tinte, borde y sombra, sin desenfoque del fondo. [Guía de tamaños y uso nativo](https://github.com/fsaldivar-dev/codaru-mockup/blob/main/docs/ASSETS.md).

## Conectar Rust/Tauri

En el `Cargo.toml` de la app anfitriona:

```toml
[dependencies]
tauri-plugin-codaru = { git = "https://github.com/fsaldivar-dev/codaru-mockup", tag = "v0.5.0" }
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

## Localización conectada al IDE

Esta compilación incluye claves `textKey` en textos, botones y campos. El IDE entrega `localization: { locale, fallbackLocale?, messages, labels? }` a `createEditor` o `mountCodaru`, con `messages` organizado por idioma y clave. `onTranslationRequest` permite abrir la clave en el editor del host.

```ts
const editor = createEditor({
  document: project,
  localization: { locale: 'en', messages: { en: { 'welcome.start': 'Get started' } } },
  onTranslationRequest: request => openTranslationInIDE(request),
});
editor.apply([{ op: 'update', id: 'start-button', patch: { textKey: 'welcome.start' } }]);
view.mount('locale', languageSlot); // view = createEditorView(editor, ...).
editor.setLocale(null); // Texto de origen.
```

`setLocalization(catalog)` refresca las traducciones; `getLocalizationIssues()` devuelve claves ausentes y posibles recortes. Estos cambios solo afectan la vista previa y las exportaciones visuales, sin entradas de Deshacer ni `onChange`. El JSON mantiene `text` + `textKey`; el IDE conserva sus propios archivos de traducción. Los idiomas se resuelven por ID exacto, con respaldo opcional; los valores vacíos son intencionales. Primera versión de cadenas simples, sin plurales, interpolación ni inversión automática RTL. [Guía y ejemplo completos](https://github.com/fsaldivar-dev/codaru-mockup/blob/main/docs/LOCALIZATION.md).

## Propiedades públicas de componentes

`getComponentProperties(id)` descubre controles de texto, icono, visibilidad y variante; `setComponentProperty(id, clave, valor)` permite construir controles propios del IDE. `null` restablece solo esa propiedad. También están disponibles las operaciones `component.property.define`, `.remove` y `.set` en `apply` y en el agente. Los textos conservan sus claves de localización.

Consulta `docs/COMPONENT-PROPERTIES.md` en el repositorio y `examples/properties-host.html` para un host sin persistencia implícita.

Los controles también admiten `type: "slot"` con `allowedComponents`: un componente intercambiable por espacio, predeterminado heredado y elecciones por instancia. Se descubren con `getComponentProperties` y se editan con `setComponentProperty(id, clave, componentId)`; `null` restablece. Consulta `docs/COMPONENT-SLOTS.md` y el ejemplo `examples/slots-host.html` en el repositorio.


### Vínculos con la implementación

Los componentes pueden guardar referencias por plataforma (`symbol`, `path` relativo y/o `module`). `getImplementations`, `setImplementation` y `requestImplementation` permiten controlarlas desde el IDE. El inspector ofrece **Abrir implementación** mediante el callback `onImplementationRequest`; el host conserva la resolución de símbolos, navegación y persistencia. Las instancias comparten los vínculos de su definición, incluidos componentes anidados y slots.

El CLI descubre los vínculos en el contexto acotado y los edita con `component.implementation.set`. No se añade un servidor ni lectura automática de código. Contrato: `docs/IMPLEMENTATION-LINKS.md`; ejemplo del repositorio: `examples/implementations-host.html`.

## Recursos ARU opcionales

Con `@fsaldivar.dev/aru@0.7.0` instalado, `npx codaru-aru dibujo.aru --out dibujo.aru.codaru.json` prepara iconos e ilustraciones. Impórtalos desde Recursos o mediante `editor.apply([{op:'aru',data:paquete}])`. El fuente se conserva en `aruSource`; `onIllustrationRequest` y `requestIllustration(id)` delegan la edición al IDE, tanto en iframe como en fragmentos. La entrada `codaru-mockup/aru` exporta la preparación del paquete y sus tipos. No incorpora ARU ni Sharp al runtime. [Contrato completo](https://github.com/fsaldivar-dev/codaru-mockup/blob/main/docs/ARU.md).

### Recursos revisados y estilos portátiles

`resourceServices` conecta compilación ARU, renders y revisión visual por la IA del IDE. `stageResource`, `reviewResource`, `getResourceLibrary`, `getResource`, `insertResource`, `exportResource` y `requestResourceEdit` están disponibles en ambas integraciones. `onResourceLibraryChange` entrega el catálogo para persistencia explícita; los registros importados vuelven como candidatos. No se incluye un modelo ni aprobación automática.

`codaru-mockup/styles` exporta `parseStylePackage` y `DesignStylePackage`. `editor.importStyle`, `getStyles`, `getStyle` y `applyStyle` admiten tokens y guías de composición/móvil externos en `codaru-style/1`; no imponen layouts ni instalan presets en ARU. En el repositorio: `docs/RESOURCE-LIBRARY.md`, `docs/STYLE-PACKAGES.md` y el ejemplo de risografía editorial.

### Identity Lab opcional

`codaru-mockup/identity` añade paneles independientes sobre la sesión de `/core` o
`/modular`. No incluye un modelo, servicios de red ni la interfaz de ARU.

```ts
import { createIdentityLabView, renderIdentityEvidence } from 'codaru-mockup/identity';

editor.setIdentityServices({
  render: renderIdentityEvidence, // raster de snapshot en navegador/WebView
  review: async request => ide.reviewDesign(request), // debe ver request.evidence
  research: async request => ide.researchIdentity(request),
  explore: async request => ide.exploreIdentity(request),
  refine: async request => ide.proposeRefinement(request),
});
const identity = createIdentityLabView(editor, {
  appearance: { theme: 'dark', tokens: { accent: '#283472' } },
  onOpenFrame: id => ide.openFrame(id),
  onExport: delivery => ide.saveIdentity(delivery),
});
const brief = identity.mount('brief', briefSlot);
identity.mount('reviews', reviewSlot);
// También: references, directions, decisions, handoff.
brief.destroy(); // confirma edición pendiente del brief
identity.destroy(); // no destruye editor ni su historial
```

El host registra direcciones con pantallas y estilos existentes. Las respuestas de
investigación son propuestas; las referencias se aceptan explícitamente. Una crítica
conserva los PNG y la revisión exacta de las pantallas revisadas; los cambios posteriores
la marcan obsoleta. Refinar conserva una propuesta textual y la selección, sin ejecutar
cambios de geometría. El IDE aplica un lote validado por separado.

`renderIdentityEvidence` usa el exportador SVG/PNG en la WebView; el host puede reemplazarlo
por su renderer para conservar fuentes o efectos específicos. Verificar la forma de un
PNG no prueba la procedencia o la calidad de una evaluación externa.

Los paneles usan Shadow DOM, `EditorAppearance` y variables `--codaru-*`; no cambian el
tema de las pantallas. `identity.flush()` confirma borradores del brief. Los formularios
nuevos se guardan mediante sus botones, no al escribir. Antes de desmontarlos, el host
debe dejar que la persona los guarde; desmontar una ficha nueva no la publica.

Contrato y límites: `docs/IDENTITY-LAB.md` en el repositorio. Ejemplo de integración:
`examples/identity-host.html`, con un puente explícito de solicitud/respuesta JSON al
agente del IDE y sin evaluación simulada.

## Comentarios del layout

Importa createCommentsView de codaru-mockup/comments. Monta panel y marcadores por separado; view.getCanvasViewport() proporciona el origen correcto para los pins. La sesión ofrece getComments, captureCommentAnchor, getCommentContext y subscribeComments. El IDE aporta IA y persistencia; los borradores no notifican a la IA y las propuestas no cambian geometría. Véase docs/COMMENTS.md en el repositorio.
