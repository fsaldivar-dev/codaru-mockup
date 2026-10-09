# Integrar piezas de Codaru en un IDE

La dirección del proyecto y sus límites actuales están en [Arquitectura](ARCHITECTURE.md). Los contratos `EditorOperation`, `AgentRequest` y `AgentResponse` se exportan desde `codaru-mockup/core`, `codaru-mockup/modular` y el paquete raíz; los imports existentes siguen funcionando.

Esta guía describe la API modular disponible desde `codaru-mockup` 0.2.0 (medidas de la 0.5.0) en los puntos de entrada `codaru-mockup/core` y `codaru-mockup/modular`. Desde el repositorio, compila el paquete con `npm run package:build`.

Codaru separa el documento de su interfaz. El IDE decide dónde monta el lienzo, qué paneles utiliza y cómo los viste. Todas las piezas de una sesión comparten selección, historial, componentes, temas del diseño y operaciones de IA. No hay iframe en la integración modular ni un servidor Node necesario para ejecutar la app.

La integración de [textos localizables](LOCALIZATION.md) agrega un fragmento `locale`, `textKey` en capas y catálogos proporcionados por el host, sin persistencia implícita. Ejemplo: `examples/localization-host.html`.

## Una sesión, varias piezas

```ts
import { createEditor } from 'codaru-mockup/core';
import { createEditorView } from 'codaru-mockup/modular';

const editor = createEditor({
  document: project, // Documento v1/v2; omitir para crear uno vacío.
  onChange: next => saveProjectInYourIDE(next),
});
const view = createEditorView(editor, {
  appearance: { theme: 'light', tokens: { accent: '#007aff' } },
  // invoke: invokeDeTauri,
  nativeAgent: false,
});

const canvas = view.mount('canvas', document.querySelector('#canvas')!);
const layers = view.mount('layers', document.querySelector('#navigator')!);
const inspector = view.mount('inspector', document.querySelector('#properties')!);
view.mount('toolbar', document.querySelector('#drawing-tools')!);
view.mount('dialogs', document.querySelector('#overlays')!);
view.fit();
```

Los contenedores del lienzo y los paneles necesitan un ancho y una altura definidos por tu layout. Usa `min-width: 0; min-height: 0` en las celdas flex/grid que los contienen. El editor no impone un layout al IDE ni escucha sus atajos globales: la interacción pertenece a los fragmentos montados.

| Pieza | Contenido |
| --- | --- |
| `canvas` | Lienzo, pantallas, selección, arrastre y zoom |
| `layers` | Árbol de capas y selección |
| `inspector` | Propiedades de la selección |
| `library` | Componentes propios, kits e iconos |
| `toolbar` | Herramientas de dibujo y deshacer/rehacer |
| `header` | Cabecera completa original con acciones de archivo |
| `viewbar` | Diseño/flujos, tema del documento y ajustar (lo que no se haya montado por separado) |
| `modes` | Solo las pestañas Diseño/Flujos de `viewbar` |
| `designTheme` | Solo el nombre del tema del documento y su alternador claro/oscuro |
| `fit` | Solo el botón Ajustar |
| `breadcrumb` | Ámbito actual y navegación entre contenedores |
| `status` | Estado de la selección y controles de zoom |
| `insert` | Acciones rápidas para insertar elementos |
| `dialogs` | Temas, presentación, confirmaciones, avisos e inputs de archivo |

Cada pieza se puede montar una sola vez por vista. Para trasladarla, destruye su montaje y vuelve a montarla en otro contenedor. Puedes omitir cualquier panel y sustituirlo por UI nativa. Una sesión admite una vista interactiva a la vez; varias piezas de esa vista siguen siendo una sola sesión.

`modes`, `designTheme` y `fit` son los controles de `viewbar`. Monta `viewbar` para tener la barra entera, o monta cualquiera de los tres en otro punto del IDE: ese control sale de la barra y `viewbar`, si también está montada, conserva el resto. Al destruir su montaje vuelve a la barra. Se muestran en línea y adoptan la altura de su contenedor, de modo que caben dentro de una barra de título o de acciones propia.

`dialogs` es opcional si el IDE implementa sus propios flujos. Móntalo al utilizar acciones incorporadas como temas, presentación, abrir/guardar y nuevo documento para que sus diálogos, confirmaciones, avisos y selectores estén disponibles. Un contenedor de overlays puede no ocupar espacio:

```css
#overlays { position: fixed; inset: 0 auto auto 0; width: 0; height: 0; z-index: 1000; }
```

Los diálogos usan el viewport. No coloques su contenedor dentro de un ancestro con `transform` o recorte si necesitas que cubran toda la ventana.

## Tus controles sobre el mismo motor

```ts
const unsubscribe = editor.subscribe(state => {
  // Se llama inmediatamente y después de cambios del documento o de la UI.
  const selected = state.document.nodes.filter(n => state.selection.includes(n.id));
  updateNativeInspector(selected);
  undoButton.disabled = !state.canUndo;
  redoButton.disabled = !state.canRedo;
});

editor.select(['id-de-capa']);
editor.apply([{ op: 'update', id: 'id-de-capa', patch: { width: 320 } }]);
editor.undo();
editor.redo();
view.fit();
await editor.command('themes'); // Requiere la vista y su pieza dialogs.
```

`getDocument()`, `getState()` y `getSelection()` devuelven copias. Editarlas no modifica el editor. Para modificarlo utiliza `apply()` o una transacción validada `commit(document => { ... })`; ambas participan en deshacer. Las escrituras se rechazan mientras hay una interacción activa o un diálogo del editor abierto: deja terminar la interacción antes de reenviar un cambio.

`onChange` se limita a modificaciones del documento; no se dispara por cambiar la selección o el zoom. `subscribe` también incluye ámbito, herramienta, modo, cámara e historial. Conserva y ejecuta su función de cancelación al desmontar tus controles.

## Apariencia del IDE y temas del diseño

Son sistemas independientes. `setAppearance()` viste los controles del editor. Los tokens del documento definen el diseño que estás creando y se mantienen al cambiar la apariencia del IDE.

```ts
view.setAppearance({
  theme: 'dark',
  density: 'compact',
  tokens: { accent: '#0a84ff', fontFamily: 'system-ui', fontSize: 13, radius: 5 },
});
// También puedes personalizar una sola pieza.
layers.setAppearance({ tokens: { surface: '#20242b' } });
layers.setAppearance({ tokens: { surface: null } }); // Restaura herencia/default.
```

Las actualizaciones son parciales: un token omitido conserva su valor anterior. `null` elimina la personalización de ese token. Los tamaños (`fontSize`, `radius`, `controlHeight`, `rowHeight`, `panelPadding`, `gap`) aceptan números en píxeles o longitudes CSS; los colores y la familia tipográfica son cadenas CSS. `density: 'compact' | 'comfortable'` cambia el espaciado base; un token explícito de tamaño tiene prioridad. Los controles conservan espacio para la fuente configurada.

| Token de la API | Variable CSS heredable |
| --- | --- |
| `background` | `--codaru-background` |
| `surface` | `--codaru-surface` |
| `surfaceRaised` | `--codaru-surface-raised` |
| `text`, `muted`, `border` | `--codaru-text`, `--codaru-muted`, `--codaru-border` |
| `accent`, `accentText` | `--codaru-accent`, `--codaru-accent-text` |
| `canvas`, `grid`, `selection` | `--codaru-canvas`, `--codaru-grid`, `--codaru-selection` |
| `fontFamily`, `fontSize`, `radius` | `--codaru-font-family`, `--codaru-font-size`, `--codaru-radius` |
| `controlHeight`, `rowHeight` | `--codaru-control-height`, `--codaru-row-height` |
| `panelPadding`, `gap` | `--codaru-panel-padding`, `--codaru-gap` |
| `danger`, `warning`, `success`, `info` | `--codaru-danger`, `--codaru-warning`, `--codaru-success`, `--codaru-info` |

Los tokens nuevos son opcionales: los objetos `EditorAppearanceTokens` existentes siguen siendo válidos. Se conservan los nombres de fragmentos, selectores y parts de sus raíces. El inspector expone además `inspector-section`, `section-heading` y `section-toggle`. Sus secciones se pueden plegar; ese estado pertenece a la vista y no modifica el documento ni su historial.

El editor completo utiliza la misma base visual. `mountCodaru(container, { appearance })` y `handle.setAppearance()` aceptan el mismo contrato que la vista modular:

```ts
const handle = mountCodaru(container, {
  document,
  appearance: { theme: 'light', density: 'compact' },
});
handle.setAppearance({ tokens: { accent: '#008060', panelPadding: 14 } });
await handle.ready;
```

En un iframe, las variables CSS no se heredan automáticamente. El montaje copia las variables `--codaru-*` del contenedor al cargar y al llamar a `handle.setAppearance()`; llamar con `{}` vuelve a leerlas. Los tokens explícitos mantienen prioridad y `null` restaura el valor del contenedor. Un cambio de apariencia no modifica el proyecto ni confirma o interrumpe una edición enfocada.

Los fragmentos viven en Shadow DOM: sus estilos no contaminan el IDE. Los tokens CSS pueden heredarse de un contenedor, por lo que también funcionan los temas del host sin llamar a JavaScript. Cada raíz expone un CSS part con el nombre de la pieza:

```css
.my-ide {
  --codaru-accent: #007aff;
  --codaru-font-family: -apple-system, sans-serif;
  --codaru-radius: 5px;
}
[data-codaru-part="toolbar"]::part(toolbar) {
  background: transparent;
  border: 0;
  padding: 2px;
}
```

Un token pasado por la API se establece en el host del fragmento y tiene prioridad sobre un token heredado. `::part()` personaliza la raíz expuesta; no abre arbitrariamente los elementos internos del Shadow DOM. Para reemplazar el funcionamiento de un inspector o toolbar, utiliza tus propios controles y el motor.

## Desmontar sin perder el trabajo

```ts
inspector.destroy(); // Sincrónico: desmonta solo este panel.
const otherInspector = view.mount('inspector', anotherContainer);
// Documento, selección e historial siguen en editor.

view.destroy(); // Sincrónico: confirma campos activos y desmonta todas las piezas.
const snapshot = editor.getDocument(); // La sesión sigue disponible.
const replacement = createEditorView(editor, { appearance: { theme: 'light' } });
replacement.mount('canvas', anotherCanvas);

unsubscribe();
const finalDocument = editor.destroy(); // Sincrónico, idempotente; desmonta su vista.
saveProjectInYourIDE(finalDocument);
```

Destruir la sesión conserva su instantánea final como valor de retorno y termina sus suscripciones. No se debe seguir editando esa sesión. La persistencia es explícita y pertenece al host: la API modular no lee ni escribe el borrador de la aplicación de ejemplo ni crea una clave de `localStorage`.

Para dos documentos abiertos crea dos `createEditor()` y dos `createEditorView()`. Sus selecciones e historiales están aislados. Para compartir un documento entre varias zonas del IDE, crea **una** sesión y monta sus distintas piezas. Dos sesiones inicializadas con el mismo JSON son copias independientes, no una edición colaborativa.

## Núcleo sin interfaz, IA y operaciones nativas

`codaru-mockup/core` crea sesiones sin montar DOM ni instalar estilos. Permite consultar y modificar documentos, validar transacciones, manejar historial y utilizar `editor.agent(command, params)` para contexto, catálogo, esquema y lotes de operaciones. El contexto mantiene el contrato de revisiones documentado en [CLI.md](../CLI.md). Ambos puntos de entrada exportan además helpers puros sobre un documento: `screens(document)` (pantallas en orden de lectura con id estable, nombre, rol y página), `roleOf(p, n)`, `pagesOf(p)`, `pageView(p, pageId)`, y `core` el render sin DOM `renderScreenToSVG` / `renderScreenToDataURL`, también disponible solo en `codaru-mockup/svg` (ver [MARKDOWN.md](MARKDOWN.md#imágenes-sin-montar-nada)).

La exportación JSON es `JSON.stringify(editor.getDocument())`. Las exportaciones `exportHTML()` y `exportSVG(frameId)` necesitan un DOM de navegador; SVG también mide texto con canvas. `exportAsset({ ids?, format: 'svg'|'png'|'assets', platform: 'ios'|'android'|'all', width?, name? })` extrae selecciones; sin IDs usa la selección de la sesión. SVG funciona sin DOM; PNG/ZIP necesitan canvas. [Contrato completo de assets](ASSETS.md). `command()` ejecuta acciones de la vista y requiere una vista conectada. Un núcleo sin interfaz no implementa por sí solo diálogos ni archivos del sistema.

Para Tauri, pasa el `invoke` del host a `createEditorView` y registra `tauri-plugin-codaru` como se explica en [su README](../packages/tauri-plugin-codaru/README.md). El puente CLI nativo es opcional; usa `nativeAgent: false` en vistas secundarias y ejemplos que no deban adueñarse del documento activo del CLI. La API JavaScript del editor y su contexto de IA siguen disponibles sin ese puente.

La API existente `mountCodaru()` de `codaru-mockup` sigue disponible para integrar el editor completo mediante un iframe del mismo origen. Mantiene su ciclo de carga asíncrono y su persistencia explícita; no es necesario migrar una integración que quiera conservar toda esa interfaz.

## Tamaños por punto de entrada

Medidos sobre `packages/editor/dist` tras `npm run package:build`, sumando cada entrada con los fragmentos que importa. Gzip por archivo; el bundler del host puede minificar más.

| Entrada | Carga inicial | Gzip | Bajo demanda |
| --- | --- | --- | --- |
| `codaru-mockup/core` | 144,0 kB | 48,3 kB | agente de IA (con importación de páginas), revisión de diseño, kits, iconos e importación de Figma: 90,5 kB (32,7 kB gzip) |
| `codaru-mockup/modular` | 408,1 kB | 124,4 kB | agente, Figma, kits, iconos, animador y ejemplo multiplataforma: 93,7 kB (33,5 kB gzip) |
| `codaru-mockup/preview` | 145,0 kB | 49,0 kB | — |
| `codaru-mockup/svg` | 119,7 kB | 39,2 kB | — |

`modular` ya contiene a `core` y sus estilos; no carga el editor completo del iframe (`dist/editor`). Estas cifras son solo el paquete embebible: no incluyen el plugin Rust enlazado al host, el CLI opcional (0,42 MB) ni la app de ejemplo para macOS (5,06 MiB), que se miden por separado.

## Ejemplo ejecutable

Con `npm run dev`, abre `http://127.0.0.1:1432/examples/modular-host.html`. El ejemplo también está incluido en el build para Tauri. [modular-host.ts](../examples/modular-host.ts) monta cada pieza en un layout de IDE, reparte los controles de `viewbar` entre su barra de pestañas y su barra de acciones, añade un inspector de ancho propio, permite desmontar/remontar el inspector y alterna la apariencia sin cambiar los tokens del diseño.

El ejemplo inicia Forma en memoria, no usa el borrador existente y mantiene el agente CLI nativo desactivado. Su enlace «Editor completo» permite regresar a la integración original. Exporta los cambios que quieras conservar antes de abandonar el ejemplo.

## Estilos bajo la CSP de Tauri

Los fragmentos copian el nonce del primer `<style nonce>` del documento anfitrión. Tauri asigna ese nonce a los estilos de tu HTML al compilar. Si tu host gestiona otra política, entrega el nonce autorizado con `createEditorView(editor, { styleNonce })`. No es necesario desactivar la CSP. Si tu HTML solo usa hojas externas, puedes incluir un `<style></style>` para que Tauri lo autorice y el editor reutilice su nonce. Consulta [CSP de Tauri](https://v2.tauri.app/security/csp/).

### Componentes anidados

Un maestro puede contener instancias de otros componentes: símbolo → botón → tarjeta. Las APIs existentes `component`, `instance`, `update` y `variant.switch` sirven también para esta composición. Las actualizaciones conservan IDs y personalizaciones por uso; se rechazan referencias circulares antes de confirmar la transacción. `examples/nested-host.html` muestra la biblioteca, el lienzo y el inspector montados por separado, con un botón del host que cambia el maestro.

Para cambiar la estructura de una instancia, el host debe dirigir al maestro; textos, estilos y variantes se editan directamente en su uso. Desvincular la instancia exterior deja sus componentes interiores independientes. La biblioteca montada por separado se actualiza aunque el host mantenga visible también el árbol de capas.

## Propiedades públicas de componentes

`getComponentProperties(id)` descubre controles de texto, icono, visibilidad y variante; `setComponentProperty(id, clave, valor)` permite construir controles propios del IDE. `null` restablece solo esa propiedad. También están disponibles las operaciones `component.property.define`, `.remove` y `.set` en `apply` y en el agente. Los textos conservan sus claves de localización.

Consulta `docs/COMPONENT-PROPERTIES.md` en el repositorio y `examples/properties-host.html` para un host sin persistencia implícita.

Los controles también admiten `type: "slot"` con `allowedComponents`: un componente intercambiable por espacio, predeterminado heredado y elecciones por instancia. Se descubren con `getComponentProperties` y se editan con `setComponentProperty(id, clave, componentId)`; `null` restablece. Consulta `docs/COMPONENT-SLOTS.md` y el ejemplo `examples/slots-host.html` en el repositorio.


## Navegar del diseño al código

Configura `onImplementationRequest` en `createEditor` o `mountCodaru` para que tu IDE reciba `{nodeId, ownerId, componentId, platform, reference}` y resuelva el símbolo o archivo. El inspector muestra «Abrir implementación»; sin el callback, explica que la navegación aún no está conectada. No hay acceso implícito al sistema de archivos.

`getImplementations(nodeId)` consulta el componente más cercano; `setImplementation(componentId, platform, reference)` guarda un vínculo compartido y `null` lo elimina. `requestImplementation(nodeId, platform)` solicita la navegación sin cambiar el diseño. Los tres métodos están disponibles en el núcleo modular y el iframe. Consulta [el contrato completo](IMPLEMENTATION-LINKS.md) y `examples/implementations-host.html`.

## Ilustraciones ARU

`onIllustrationRequest({nodeId,source})` y `editor.requestIllustration(nodeId)` conectan un ilustrador del IDE con la capa ARU seleccionada. La fuente se entrega como copia, sin escribir archivos ni modificar el documento; el host prepara y aplica el resultado explícitamente mediante una operación `aru`, con revisión si usa el agente. Este callback opcional funciona en ambas formas de montaje. [Preparación, importación y animación](ARU.md).

## Biblioteca con revisión visual y estilos externos

Los nuevos puertos `resourceServices` y `onResourceLibraryChange` son opcionales y funcionan en el núcleo, fragmentos e iframe. La biblioteca descubre dibujos del proyecto como candidatos; el IDE proporciona compilación ARU, evaluación real por IA, edición y persistencia. Sin evaluador quedan pendientes, con reutilización/exportación desde biblioteca deshabilitadas. [Contrato de recursos](RESOURCE-LIBRARY.md).

`importStyle`, `getStyles`, `getStyle` y `applyStyle` admiten paquetes `codaru-style/1`, con tokens y guías distintas para móvil. No cambian el layout del host ni generan composiciones repetidas. [Contrato portátil](STYLE-PACKAGES.md). La API y CSS de personalización existentes se mantienen.
