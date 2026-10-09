# Textos localizables para un IDE

Disponible en el código y paquete compilado localmente; pendiente de publicación en npm.

El documento conserva `text` (texto de origen) y `textKey` (clave opcional) en capas de texto, botones y campos. El IDE entrega los catálogos y controla sus archivos, su editor de traducciones y la persistencia. Codaru no necesita un servicio, un framework de i18n ni acceso directo al sistema de archivos para previsualizarlos.

## Integración modular

```ts
import { createEditor, createEditorView } from 'codaru-mockup/modular';
import type { LocalizationConfig } from 'codaru-mockup/core';

const catalog: LocalizationConfig = {
  locale: 'en',
  fallbackLocale: 'es',
  labels: { es: 'Español', en: 'English' },
  messages: {
    es: { 'welcome.start': 'Comenzar' },
    en: { 'welcome.start': 'Get started' },
  },
};
const editor = createEditor({
  document: project,
  localization: catalog,
  onChange: next => saveDesignInIDE(next),
  onTranslationRequest: ({ key, locale, nodeId, sourceText, previewText }) => {
    openTranslationInIDE({ key, locale, nodeId, sourceText, previewText });
  },
});
const view = createEditorView(editor, { appearance: { theme: 'light' } });
view.mount('canvas', canvasSlot);
view.mount('inspector', inspectorSlot);
view.mount('locale', languageSlot);
view.mount('dialogs', overlaySlot); // Lista de avisos y presentación.

editor.apply([{ op: 'update', id: 'start-button', patch: { textKey: 'welcome.start' } }]);
editor.setLocale('es'); // Vista previa; no modifica texto, revisión ni historial.
editor.setLocale(null); // Texto de origen.
editor.setLocalization(updatedCatalogFromIDE); // Refrescar después de editar/guardar en el IDE.
```

`locale` es un fragmento independiente con selector y contador de avisos. También forma parte de `viewbar` mientras no se monte por separado. Puede desmontarse y volverse a montar; utiliza los mismos tokens `--codaru-*` y aislamiento de estilos que las demás piezas.

El inspector permite vincular/desvincular una clave, muestra el texto traducido y conserva un campo separado **Texto de origen**. «Abrir clave en el IDE» solo aparece si el host proporciona `onTranslationRequest`. El callback es una intención: Codaru no escribe archivos de traducción. `requestTranslation(nodeId)` emite el mismo evento desde un control propio del IDE.

El host puede suscribirse a `EditorState.localization`, leer `getLocalizationState()`, consultar una copia de `getLocalization()` y obtener `getLocalizationIssues()`. `setLocalization(null)` retira el catálogo; las claves del documento se conservan. Los cambios de catálogo/idioma notifican a los suscriptores pero no llaman a `onChange` ni crean entradas de Deshacer. Se rechazan mientras haya un gesto, campo del editor en edición o diálogo activo, para no perder trabajo pendiente. `onChange` sigue reservado al documento.

En la integración por iframe, `mountCodaru` acepta las mismas opciones `localization` y `onTranslationRequest`; la API que resuelve `ready` expone los mismos métodos.

## Resolución, avisos y exportación

La resolución busca la clave en el idioma activo, después en `fallbackLocale` y finalmente utiliza `text`. Una traducción vacía (`""`) es intencional y no activa el respaldo. Los IDs de idioma son exactos: `en` no sustituye automáticamente a `en-US`. `locale: null` muestra el origen sin avisos de traducción.

Los avisos incluyen `kind: 'missing' | 'overflow'`, `node`, `key`, `locale` y `message`. Una clave ausente genera aviso aunque exista respaldo. Las capas ocultas, incluidos hijos de un contenedor oculto, se omiten. Los textos renderizados en el lienzo se miden con el DOM (`measurement: 'dom'`); sin un lienzo conectado o fuera de la página activa, el recorte se estima por métricas (`'metrics'`). Los avisos son orientativos y se limitan al cuadro de texto; no detectan oclusiones por otras capas ni sustituyen revisar el diseño en el dispositivo.

`getDocument()`, el JSON exportado, las versiones y el resultado de `destroy()` contienen el texto de origen y sus claves, sin catálogos. `getPreviewDocument()` devuelve una copia con los textos resueltos. Lienzo, presentación, HTML, SVG, PNG y assets de iOS/Android reflejan el idioma activo al comenzar la exportación; el host debe nombrar/organizar las variantes de idioma al guardarlas. Cambiar la vista previa no modifica la revisión del documento que usa la IA.

Esta primera versión admite cadenas simples. Los adaptadores para `.xcstrings`, `Localizable.strings`, `strings.xml` o el formato web del proyecto pertenecen al IDE. No incluye traducción automática, interpolación, plurales ICU, selección de recursos por idioma ni inversión automática de layout RTL.

Los catálogos se copian y validan al entregarlos: hasta 100 idiomas, 20 000 claves por idioma, claves de hasta 200 caracteres y valores de hasta 20 000; límite total de 5 millones de caracteres. Para proyectos grandes, entrega solo los idiomas y textos del módulo abierto. Estos datos no se incluyen completos en el contexto de la IA.

## CLI e IA

```sh
./codaru locale
./codaru catalog --kind texts --query welcome.
./codaru locale en
./codaru context --scope start-button --depth 1
./codaru export --format svg --frame welcome --output /tmp/welcome-en.svg
./codaru locale source
```

`catalog --kind texts` descubre hasta 100 claves por consulta, con `truncated` y `textTruncated`; acota con `--query` si hace falta. `context` añade `textKey`, el texto resuelto, su origen y los avisos de las capas incluidas. `locale` cambia solo la vista previa. Para editar vínculos, usa el flujo habitual de revisión, validación y aplicación:

```json
{
  "expectedRevision": "REVISION_DEL_CONTEXTO",
  "operations": [
    { "op": "update", "id": "start-button", "patch": { "textKey": "welcome.start" } }
  ]
}
```

`textKey: null` en una operación de agente desvincula la clave sin cambiar `text`. Un idioma desconocido o un editor ocupado produce un error; no se fuerza el cambio ni se cancela el trabajo de la persona.

## Ejemplo ejecutable

`examples/localization-host.html` monta los fragmentos en una interfaz de IDE, con catálogos es/en/de en memoria y un formulario del host para modificar traducciones. Deutsch provoca deliberadamente un título largo y una clave ausente. El ejemplo no carga ni modifica el borrador de la app principal; sus cambios duran hasta cerrar la ventana. Se puede abrir desde Vite durante desarrollo y se incluye en los archivos estáticos de la compilación Tauri.
