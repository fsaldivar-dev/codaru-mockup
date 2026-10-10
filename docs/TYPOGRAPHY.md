# Tipografía extensible · 0.10.0

## Auditoría y alcance

Sajaru parte de 0.8.0; al comenzar esta implementación el repositorio estaba en 0.9.0. Ambos restringían familias en validación, temas, esquema e inspector a `system`, `serif` y `mono`. El render y los importadores podían sustituir familias desconocidas. No había catálogo, carga explícita, estilo cursivo ni archivos de fuentes en las exportaciones. El SVG puro usaba aproximaciones y las medidas del navegador no esperaban recursos.

0.10.0 agrega un catálogo por sesión y un puerto de carga/medición. No impone composiciones, plantillas, familias por sector, estilos de marca ni posiciones. Conserva el texto y el árbol editable, documentos v1/v2, tokens y sobrescrituras de componentes. Los genéricos existentes permanecen válidos. Los pesos genéricos siguen dependiendo de las fuentes disponibles en cada plataforma; no equivalen a un catálogo de archivos idénticos entre dispositivos.

## Recursos del consumidor

```ts
import { createEditor, createEditorView } from 'codaru-mockup/modular';
import type { FontDefinition } from 'codaru-mockup/core';

const fonts: FontDefinition[] = [{
  id: 'marca-editorial', name: 'Editorial de la marca',
  license: 'Licencia y procedencia verificadas por el consumidor',
  variants: [
    { weight: 400, style: 'normal', source: { url: '/fonts/editorial-regular.woff2' }, export: 'embed' },
    { weight: 700, style: 'normal', source: { url: '/fonts/editorial-bold.woff2' }, export: 'embed' },
    { weight: 400, style: 'italic', source: { url: '/fonts/editorial-italic.woff2' }, export: 'embed' },
  ],
}, {
  id: 'mi-fuente-instalada', name: 'Fuente instalada',
  variants: [{ weight: 400, source: { local: 'Nombre PostScript o completo instalado' } }],
}];
const editor = createEditor({ document: savedProject, fonts, onChange: saveProject });
const view = createEditorView(editor, { appearance: { theme: 'light' } });
view.mount('canvas', canvas); view.mount('inspector', inspector);
await editor.loadFonts(); // Consultar estados: una carga fallida se informa como error.
const catalog = editor.getFonts();
const issues = editor.getFontIssues();
```

`id` usa letras/números/guion/guion bajo, hasta 128 caracteres; `system`, `serif`, `mono` están reservados. Máximo 100 familias y 64 variantes por familia. Pesos enteros 100–900; estilos `normal`, `italic`, `oblique`. Cada pareja peso/estilo debe existir explícitamente. Una fuente variable puede proporcionar el mismo URL a varias parejas; no se expone un editor de ejes arbitrarios.

`source.url` puede apuntar a un archivo empaquetado por el host, HTTP(S), URL de asset de Tauri, blob o data URL. Debe ser accesible desde la WebView. Una ruta de archivo del sistema (`file:`) no es un URL de asset válido: el IDE la debe resolver por su propio puerto. El catálogo y sus URLs no se guardan dentro del documento ni se envían como rutas al agente; el host conserva archivos, licencias y persistencia. Al reabrir registra los mismos IDs. No hay descarga de proveedores ni instalación global de fuentes.

Cada vista registra sus `FontFace` con un nombre CSS privado y los elimina al desmontarse; no altera las fuentes CSS del IDE. Por sesión hay un cargador activo. Para vistas simultáneas con recursos diferentes utiliza sesiones diferentes. La carga cambia estados, no revisiones ni historial del documento. Sustituir el catálogo invalida cargas anteriores; agregar IDs nuevos mantiene las fuentes ya cargadas.

`setFonts(definitions)` reemplaza el catálogo; `registerFonts(definitions)` agrega/reemplaza IDs; `loadFonts(ids?)` carga/reintenta; `getFonts()` devuelve catálogo/variantes/estado `registered|loading|loaded|error` y errores; `getFontIssues()` reporta nodos con familia ausente, variante ausente, pendiente o fallida. Montar una vista inicia la carga; las APIs asíncronas de exportación esperan las familias utilizadas. El timeout del cargador del navegador es 15 segundos.

Un documento con una fuente ausente puede abrirse, conservarse y editarse. Su texto no se sustituye ni se convierte: el lienzo presenta un diagnóstico explícito en su caja y el inspector conserva el ID faltante. Seleccionar una nueva variante no disponible mediante operaciones o cambios de tokens falla de forma atómica. Los controles listan variantes declaradas; al cambiar de familia, el inspector informa si debe elegir otra pareja disponible. Editar valores tipográficos desvincula el token y conserva sus otros valores efectivos.

## IA, tokens y componentes

```sh
./codaru catalog --kind fonts
./codaru fonts --load --id marca-editorial
./codaru context --scope texto-id --depth 1
./codaru schema
```

El esquema/contexto incluye el catálogo, estados e incidencias y la tipografía efectiva de la selección. La IA elige un ID registrado y una pareja `loaded`; el IDE aporta los recursos. Los genéricos no se tratan como archivos portables. El registro de nuevas URLs pertenece al host, no a una operación de dibujo del agente.

```json
{"expectedRevision":"REVISION_ACTUAL","operations":[{"op":"update","id":"texto-id","patch":{"fontFamily":"marca-editorial","fontWeight":400,"fontStyle":"italic"}}]}
```

Valida y aplica el mismo lote con `apply --file ... --dry-run` y `apply --file ...`. Ante conflicto vuelve a leer la selección. `typographyToken` resuelve familia/peso/estilo/tamaño/interlineado; todos viajan en el JSON. Las instancias heredan el maestro y admiten sobrescrituras locales, incluyendo `fontStyle`. No se aplanan ni se rasterizan automáticamente. Las skills de diseño, clonación y revisión descubren el catálogo antes de elegir fuentes. Importadores DOM/Figma conservan nombres no registrados como IDs identificables con aviso; los tokens no colapsan familias o cursivas distintas.

## Medición, previsualización y exportaciones

El adaptador DOM usa la fuente cargada para medir anchuras y línea base. Desactiva síntesis y tamaño óptico automático para mantener la misma selección entre DOM, canvas y SVG. No se mide una fuente personalizada pendiente ni se aproxima con una fuente de sistema. El núcleo sin DOM mantiene genéricos y JSON; para medir/exportar una fuente personalizada necesita un `FontLoader` que aporte medidas reales y línea base.

```ts
import { createBrowserFontLoader } from 'codaru-mockup/fonts';
const editor = createEditor({ document: savedProject, fonts,
  fontLoader: createBrowserFontLoader(document) }); // Uso sin montar una vista.
await editor.loadFonts();
const svg = await editor.exportSVGAsync('screen-id');
const html = await editor.exportHTMLAsync();
const png = await editor.exportAsset({ ids: ['text-id'], format: 'png', padding: 0 });
```

Para `renderMockup`/`enhanceMarkdown`, usa el `FontRegistry` de tu propio cargador, cárgalo antes y pásalo como `options.fonts`; también puedes asociarlo al objeto mediante `attachFonts`. Para el render SVG puro, el documento asociado debe conservar ese registro cargado con medidas reales. Los registros se asocian por identidad y no se serializan. Una miniatura en un proceso separado necesita su propio registro/adaptador.

| Formato | Tratamiento de fuentes |
| --- | --- |
| JSON | Texto, IDs, variantes, tokens y referencias editables; sin archivos. Reabrir requiere catálogo del host. |
| HTML/SVG asíncronos | Por defecto incluyen únicamente variantes usadas como data URLs mediante `@font-face`; texto vivo en DOM/`<text>`. Esperan la carga, rechazan faltantes. |
| HTML/SVG síncronos existentes | Requieren fuente ya cargada y conservan referencias externas; no garantizan portabilidad. |
| HTML/SVG `fonts:'reference'` | Decisión explícita del host: URLs o `local()` deben seguir disponibles donde se abra el archivo. |
| Asset SVG `fontExport:'reference'` | Referencias explícitas; medidas reales del registro. |
| PNG / ZIP iOS y Android | Rasterización solicitada explícitamente. Fuentes personalizadas necesitan inclusión de bytes; no aceptan modo reference. El ZIP conserva SVG fuente con texto. |

La inclusión requiere `export:'embed'` y `source.url` en cada variante usada; sin permiso se rechaza, no se sustituye. `local()` no entrega bytes: para exportación portable ofrece también los archivos por URL. El permiso técnico no concede una licencia. El host debe conservar e incluir los textos de licencia que correspondan; se agrega el aviso `license` al CSS, no un archivo legal completo ni la licencia original automáticamente. Las fuentes de demostración OFL y sus archivos viven en `examples/font-assets`, fuera del paquete npm.

Límite de bytes incluidos: 8 MB por exportación; solicitudes del navegador necesitan CORS y permisos CSP del host (`font-src` para carga, `connect-src` para inclusión; `data:` para abrir exports embebidos). `mountCodaru` resuelve las URLs relativas del registro inicial, `setFonts` y `registerFonts` contra el documento anfitrión. En el núcleo y vistas modulares se resuelven contra el documento del cargador; para referencias externas usa URLs absolutas válidas en el destino. Blobs y URLs locales caducan según el host.

Limitaciones: no PDF nativo ni exportación automática a trazados; no selector de ejes variables, funciones OpenType o diccionario de guionado; no certificación de cobertura de glifos. El consumidor debe elegir fuentes que cubran los idiomas utilizados y verificar escrituras complejas. SVG con fuentes incluidas depende del soporte `@font-face` del visor; algunas herramientas externas ignoran estas reglas. Usa HTML o PNG para esos destinos. Los genéricos dependen de plataforma. Mantener el mismo archivo, variantes, dimensiones y reglas de línea reduce diferencias; no se promete identidad de antialiasing entre motores/dispositivos.

## Validación

`tests/fonts.test.ts` cubre compatibilidad, catálogo/aislamiento, cargas obsoletas, errores, tokens, componentes, transacciones y persistencia. `tests/ui/fonts.spec.ts` verifica fuentes reales, pesos/cursivas, texto largo, ausencia/404, variantes, desmontaje, exportación editable y fidelidad de glifos rasterizados frente al canvas cargado. `examples/fonts-host.html` permite repetir la revisión visual. La evidencia de este release se registra en `docs/TYPOGRAPHY-PROGRESS.json`.

El mecanismo de carga sigue el contrato [CSS Font Loading](https://www.w3.org/TR/css-font-loading/). Las restricciones de exportación descritas arriba son decisiones del editor/host, no obligaciones de esa especificación.
