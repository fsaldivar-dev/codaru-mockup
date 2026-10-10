# Diseñar con una IA mediante el CLI

El CLI controla el documento que está abierto en Codaru Mockup, incluido el editor montado dentro de tu propia aplicación Tauri. La IA y la persona usan el mismo lienzo, historial, temas y componentes. No incluye un modelo, no consume tokens por sí mismo y no necesita Node, un servidor HTTP ni MCP para funcionar. La primera integración nativa utiliza un socket Unix local; está verificada en macOS. Windows necesitará otro transporte para el CLI; el plugin no impide abrir el editor por esa limitación.

## Empezar

Abre Codaru Mockup. En este proyecto ejecuta:

```sh
./codaru --help
./codaru context
./codaru schema
```

`./codaru` es un lanzador del ejecutable `src-tauri/target/release/codaru`. La aplicación distribuida también incluye el ejecutable en `Codaru Mockup.app/Contents/MacOS/codaru`. Puede invocarse mediante su ruta absoluta. No se modifica automáticamente el PATH del sistema.

En una app anfitriona, registra `tauri-plugin-codaru` y monta el editor con la función `invoke` del host. El editor debe permanecer montado para responder al CLI. El paquete visual y su API JavaScript funcionan sin instalar el CLI; consulta `packages/editor/README.md`. Para varias aplicaciones simultáneas configura un socket privado distinto con el builder del plugin y pasa esa ruta al CLI mediante `--socket`.

El botón **IA / CLI** explica el recorrido desde la propia aplicación. Cierra ese diálogo antes de enviar cambios: el editor rechaza modificaciones externas mientras dibujas, editas un campo o tienes un diálogo abierto.

## El recorrido completo

1. **Leer.** `context` devuelve JSON con `ok`, `context.revision`, selección, nivel actual, pantallas, temas, conexiones y un resumen de los elementos. Las posiciones se expresan en píxeles relativos al padre. Sin selección, describe el nivel actual o el workspace.
2. **Descubrir.** `catalog` enumera los kits y sus cantidades sin enviar todos los datos. Acota con `--kind`, `--kit` y `--query`. `schema` explica cada operación y contiene un lote de ejemplo.
3. **Proponer.** Escribe un archivo JSON con `expectedRevision` y `operations`. Usa la revisión que acabas de leer, no una constante ni una revisión de otra sesión. Puedes dar IDs a los elementos nuevos y usarlos más adelante dentro del mismo lote.
4. **Validar.** `apply --dry-run` ejecuta las validaciones sobre una copia. No cambia el documento ni el historial. La revisión devuelta en esta respuesta corresponde al resultado hipotético; para aplicar, conserva la revisión original del archivo.
5. **Aplicar.** `apply` realiza el lote completo o no realiza nada. Devuelve los IDs añadidos, modificados y eliminados, la nueva revisión y contexto actualizado. Todo el lote ocupa una entrada de Deshacer.
6. **Revisar.** El resultado ya está en el lienzo. Exporta SVG para revisión visual de una pantalla, HTML para probar la navegación o JSON para conservar el documento editable. Consulta el contexto antes del siguiente lote.

```sh
./codaru context --scope workspace --depth 1
./codaru context --scope screen-login --depth 2
./codaru context --page pagos --depth 1
./codaru find --query correo --page pagos
./codaru catalog --kind kits --kit ios --query botón
./codaru catalog --kind icons --kit web --query home
./codaru apply --file cambios.json --dry-run
./codaru apply --file cambios.json
./codaru select pantalla-inicio
./codaru export --format svg --frame pantalla-inicio --output vista.svg
./codaru export --format html --page pagos --output pagos.html
./codaru export --format html --output prototipo.html
./codaru export --format json --output proyecto.codaru.json
./codaru export --format assets --ids ID_ILUSTRACION --platform all --output assets.zip
./codaru export --format png --ids ID_ILUSTRACION --width 240 --scale 2 --output ilustracion.png
```

Para entregar una ilustración o componente, `export --format svg|png|assets --ids ID` extrae solamente esa selección sobre fondo transparente. Sin IDs usa la selección actual. `assets` genera un ZIP con SVG fuente, catálogo iOS (1x/2x/3x) y recursos Android (mdpi a xxxhdpi); `--platform ios|android|all` acota su contenido. PNG y ZIP requieren `--output` y se escriben como binarios, sin base64 en stdout. [Contrato de assets, tamaños e integración](docs/ASSETS.md).

`apply --file -` acepta JSON por stdin. Todos los comandos, excepto la ayuda, responden JSON. Un error devuelve `ok:false` y un código de salida distinto de cero. `select` sin IDs limpia la selección. `undo` y `redo` operan sobre el historial compartido: revisa el contexto antes de usarlos si la persona ha continuado editando.

## Ejemplo de lote

Sustituye `REVISION_DEL_CONTEXTO` por el valor leído en `context.revision`:

```json
{
  "expectedRevision": "REVISION_DEL_CONTEXTO",
  "operations": [
    {"op":"add","node":{"id":"pantalla-inicio","type":"frame","name":"Inicio","x":1400,"y":100,"width":390,"height":844}},
    {"op":"icon","pack":"web","name":"home","parentId":"pantalla-inicio","x":24,"y":24,"size":28,"color":"@primary"},
    {"op":"add","node":{"id":"titulo-inicio","type":"text","parentId":"pantalla-inicio","name":"Título","text":"Tu espacio","x":24,"y":80,"width":342,"height":44,"typographyToken":"heading"}},
    {"op":"kit","kit":"ios","item":"button","parentId":"pantalla-inicio","x":24,"y":150,"variant":"default"}
  ]
}
```

Para conectar una interacción con otra pantalla usa `{"op":"flow","from":"ID_ORIGEN","to":"ID_PANTALLA"}`. El contexto devuelve estas conexiones explícitamente como acciones de clic. `to:null` quita la conexión. Usa `update` para editar propiedades y `null` para quitar vínculos opcionales como `fillToken`.

Un degradado propio de varios colores se define con `gradient` (`linear` o `radial`), `gradientAngle` y `gradientStops`: `[{"color":"#2a7b9b","position":0},{"color":"#57c785","position":50},{"color":"#eddd53","position":100}]`, de 2 a 16 paradas en orden creciente. Sin `gradientStops` se usan `fill` y `gradientEnd` como extremos.

El auto layout de un contenedor usa `layout` (`vertical` u `horizontal`), `padding` o `paddingSides`, `gap`, `justify` (`start`, `center`, `end`, `between`), `align` (`stretch`, `start`, `center`, `end`), `wrap`, `hugWidth` y `hugHeight`. En cada hijo, `sizing` (`fixed` o `fill`) y `minWidth`, `maxWidth`, `minHeight`, `maxHeight`. El editor recalcula posiciones y tamaños al aplicar el lote; no hace falta enviar `x` e `y` de los hijos.

Los tokens y los iconos se resuelven con el tema del elemento o de su pantalla. Los materiales conservan su simulación en HTML; SVG simplifica el vidrio a tinte y borde.

## Revisar el diseño

```sh
./codaru lint
./codaru lint --frame pantalla-inicio
./codaru lint --page pagos
./codaru find --query "Continuar" --type button
./codaru versions --compare v-1
```

### Páginas y versiones

`page {action: 'create'|'rename'|'remove'|'move'|'activate', id, name?, index?, moveTo?}`. Los nodos raíz llevan `page` (en `add` o con `update {id, patch:{page}}`); sin `page` pertenecen a la primera. Un documento sin páginas abre con una llamada «Página 1». `remove` de una página con contenido exige `moveTo` con la página que recibe sus marcos; sin él falla y lo dice. `context`, `lint`, `export` y `find` aceptan `--page ID`; `context` lista `pages` con `frames` y `nodes` por página, `activePageId` y la `page` y el `role` de cada marco. Solo la página activa se dibuja; los flujos pueden cruzar páginas. Los alias `page.add/rename/remove/activate/move` y el campo `pageId` de 0.5 siguen aceptándose.

### Rol de los marcos

Cada marco raíz tiene `role`: `screen` (pantalla del producto), `annotation` (rótulos, leyendas) o `library` (hoja de componentes). Sin `role`, es `screen` si tiene `device` y `annotation` si no; los marcos que crea `add` sin dispositivo ni rol quedan como `screen`. `lint` solo comprueba zonas táctiles, área segura y pliegue en pantallas, y avisa (`role`) cuando un marco sin rol ni dispositivo contiene controles. `screens(p)` del paquete devuelve las pantallas en orden de lectura, página por página.

### Buscar

`find --query TEXTO [--frame ID] [--page ID] [--type TIPO] [--limit N]` busca por nombre o texto (sin distinguir mayúsculas) y devuelve `[{id, name, type, frame, page, text?}]`, hasta 200 resultados. Úsalo antes de `update` o `remove` en lugar de recorrer el contexto entero.

`version.save {name, note?}` guarda una copia comprimida del diseño dentro del documento (máximo 30); `version.restore {id}` la restaura en el mismo lote (reversible con `undo`); `version.remove {id}`. El comando `versions` lista las versiones y, con `compare: ID`, qué pantallas se añadieron, quitaron o cambiaron desde esa versión.

### Variantes de componente

`variant.define {componentId, variant:{eje:valor}, setName?}` pone un componente en un conjunto con esos ejes (los demás miembros reciben «Base» en los ejes nuevos); `variant.create {componentId, variant}` duplica el maestro junto al original como otra definición del conjunto; `variant.switch {id, variant}` cambia una instancia a la variante que coincida y conserva sus sobrescrituras por nombre de capa. `context` lista `components` con `set`, `setName` y `variant`, y cada instancia o maestro muestra los suyos. En kits, el eje es `Estado` con Normal, Seleccionado y Deshabilitado, y la definición que falte se crea al cambiar.

`component.remove {componentId}` elimina una definición sin instancias junto con su maestro; si era el último maestro de un contenedor «· variantes», el contenedor se va con él. También sirve para las definiciones cuyo maestro ya se borró del lienzo, que `remove` no alcanza porque solo borra elementos. Con instancias se rechaza: sepáralas con `detach` o elimínalas antes.

### Sistema de diseño

`designSystem.set {summary?, brand?, principles?, color?, typography?, spacing?, motion?, voice?}` guarda la narrativa y los fundamentos del sistema; `component.doc {componentId, description?, why?, when?, how?, do?, dont?}` documenta un componente o todo su conjunto (qué es, por qué, cuándo, cómo, y buenas y malas prácticas una por línea; una línea puede terminar en `[ejemplo: ID]` para mostrar esa capa al lado). Textos de hasta 4000 caracteres; `null` borra un campo. `context` devuelve `designSystem`, marca cada componente con `documented` y, si cambió después de documentarse, `docStale`; `designSystemStale` y `docsToReview` resumen lo que hay que revisar. Un patch vacío (`{}`) marca la ficha o los fundamentos como revisados sin cambiar el texto. `lint` lo lista como `docs`. Todo se ve y se edita en la pestaña Sistema.

### Importar una página web

`{ "op": "dom", "data": <instantánea> }` dentro de `apply`. La instantánea la produce `packages/claude-plugin/skills/codaru-clone/scripts/snapshot.js` ejecutado en la página (formato `codaru-dom-snapshot`, versión 1). Crea una pantalla del tamaño del viewport a la derecha de las existentes, un tema `Importado · dominio` con los colores y las tipografías más usados, y capas vinculadas a esos tokens; SVG saneados como ilustraciones, imágenes del mismo dominio como imágenes, el resto como cajas. Límite: 3000 capas por instantánea.

Devuelve `summary` (errores, avisos y notas, y cuántos por regla) e `issues`, cada uno con `node`, `frame`, `rule`, `severity`, `message`, `fix` y, si el problema solo aparece en un modo, `mode`. El contraste se calcula contra el fondo real del texto en claro y en oscuro. Corrige con `apply` y repite hasta no tener errores. Reglas: `contrast`, `target`, `text-size`, `text-fit`, `overflow`, `safe-area`, `hinge`, `overlap`, `off-theme`, `alignment`, `scale`, `palette` (el color principal del tema no funciona como acento ni como ancla) `accent-fill` (chip pequeño con acento cálido de fondo y texto oscuro) y `gradient` (rampa de neutro oscuro a acento cálido que se embarra).

## Ilustraciones, animaciones y transiciones

Las animaciones son datos declarativos: no se ejecuta ningún script del SVG ni del lote. Se reproducen en «Presentar» y en el HTML exportado; el lienzo y la exportación SVG son estáticos.

```json
{"expectedRevision":"REVISION","operations":[
  {"op":"vector","id":"sol","svg":"<svg viewBox=\"0 0 120 120\"><g id=\"rayos\"><path d=\"M60 8V24\" stroke=\"#f5a524\" stroke-width=\"6\"/></g><circle cx=\"60\" cy=\"60\" r=\"26\" fill=\"#f5a524\"/></svg>","parentId":"pantalla-inicio","x":24,"y":24,"width":120},
  {"op":"animate","id":"sol","animations":[
    {"id":"giro","name":"Girar","target":"rayos","trigger":"load","duration":4000,"delay":0,"easing":"linear","iterations":0,"alternate":false,
     "keyframes":[{"at":0,"rotate":0},{"at":100,"rotate":360}]}]},
  {"op":"flow","from":"boton-entrar","to":"pantalla-detalle","transition":{"type":"slide-left","duration":300,"easing":"ease-out"}}
]}
```

- **`vector`** importa un SVG. El editor lo reconstruye desde una lista permitida: descarta scripts, estilos, eventos, imágenes, filtros y referencias externas, y asigna un id (`capa-N`) a cada forma que no lo tenga. Límite: 400 kB y 3000 elementos.
- **`context`** devuelve en `layers` los ids animables de cada ilustración (`id:etiqueta`), primero los que traía el SVG y después los generados, hasta 250; `layerCount` indica el total si hay más. Nombra en el SVG los grupos que quieras animar. Úsalos como `target`; `""` anima el elemento entero. Cualquier elemento, no solo las ilustraciones, admite animaciones con `target` vacío.
- **`animate`** reemplaza la lista completa de animaciones del elemento; `[]` o `null` las quita. Cada fotograma clave indica `at` (0 a 100) y solo las propiedades que cambian: `x`, `y`, `scale`, `rotate`, `opacity`, `fill`, `stroke`, `draw` (porcentaje visible del trazo) y `shine` (brillo de carga que cruza el elemento). Los colores admiten HEX y tokens como `@muted`; un esqueleto de carga es `fill` alternando entre dos tonos, o `shine` de 0 a 100.
- **`flow`** acepta `transition` con `fade`, `slide-left`, `slide-right`, `slide-up`, `slide-down` o `scale`; `null` la quita. «Atrás» reproduce la transición invertida.
- `iterations: 0` repite sin fin. `trigger` es `load` (al entrar en la pantalla) o `click`. `./codaru schema` lista rangos y curvas.

## Importar un archivo de Figma

El plugin de `packages/figma-plugin` escribe un `.figma.codaru.json`. Su contenido se aplica con `{"op":"figma","data":{…}}`: añade pantallas, componentes y tokens en un solo paso de deshacer. El archivo se trata como entrada no confiable: se valida, los SVG se sanean y no se descarga nada.

## Dispositivos y plegables

`./codaru schema` lista en `devices` los tamaños disponibles (`id anchoxalto`). Una pantalla los adopta con `update`:

```json
{"op":"update","id":"pantalla-abierta","patch":{"device":"android-fold-open","width":673,"height":841,"fold":{"axis":"vertical","gap":0}}}
```

Las pantallas admiten además `safeArea` (`{top,right,bottom,left}`), `skin` (marco: `iphone`, `ipad`, `android`, `android-tablet`, `foldable`, `iphone-duo-cover`, `iphone-duo`, `iphone-classic`) y `foldPair` (id de la misma pantalla en otra postura; las pantallas enlazadas forman un grupo entre el que se alterna al presentar, de dos o, en un tríptico, de tres).

`fold` solo se admite en pantallas: `axis` es `vertical` (libro) u `horizontal` (tapa), `gap` el ancho de la bisagra, de 0 a 200, y `panels` es 2 (por defecto) o 3 para un tríptico con dos bisagras. `null` lo quita. Para animar la apertura, conecta la pantalla cerrada con la abierta usando `flow` y `transition.type: "unfold"`; `fold` hace el recorrido contrario.

## Mantener el contexto pequeño

- `context` devuelve como máximo 100 elementos, con profundidad predeterminada 1 y máxima 4. `truncated:true` indica que debes consultar un contenedor concreto.
- Acota `--scope selection`, `--scope workspace` o `--scope ID`. Los textos largos se resumen e incluyen `textTruncated:true`.
- No envíes todo el proyecto para modificar un botón: lee su contexto y aplica únicamente los campos que cambian.
- Los catálogos devuelven metadatos e identificadores, sin enviar rutas SVG ni plantillas completas. `export --format json` permite obtener el documento completo cuando sea necesario.

## Errores recuperables

| Código | Qué hacer |
|---|---|
| `APP_NOT_RUNNING` | Abrir Codaru Mockup y volver a consultar contexto. |
| `editor_busy` | Terminar el gesto o edición y cerrar el diálogo. |
| `revision_conflict` | Volver a leer contexto; revisar el lote antes de actualizar su revisión. |
| `validation_error` / `invalid_request` | El mensaje indica la operación (`op 3 (update)`), el campo y el valor esperado: «patch.fill debe ser HEX, "transparent" o "@alias"; llegó "rojo"». Con `--dry-run`, `errors` lista todas las operaciones que fallan. Consultar `schema` si hace falta. |
| `TIMEOUT` | Leer contexto antes de repetir: el cambio anterior podría haberse aplicado. |

El socket predeterminado está en `~/.local/share/codaru-mockup/agent.sock`, dentro de un directorio privado 0700; el socket tiene permisos 0600. No escucha en la red. `CODARU_AGENT_SOCKET` permite elegir otra ruta para la aplicación y el CLI; `--socket` cambia únicamente el destino de esa invocación del CLI. Solo una aplicación usa cada directorio de socket.

## Compilar

```sh
npm run cli:build
npm run native:build
```

Rust y las herramientas web son dependencias de desarrollo. El CLI y la aplicación compilados funcionan sin ellas. La API equivalente para un host de la vista web es `window.codaru.agent(command, params)`; usa el mismo contrato y las mismas transacciones que el CLI.

## Textos localizables del IDE

`codaru locale` muestra el idioma de vista previa y los idiomas que el host entregó. `codaru locale en` cambia la vista previa; `codaru locale source` regresa al texto de origen. No cambian la revisión ni el historial y respetan `editor_busy`.

Descubre claves con `codaru catalog --kind texts --query welcome.`. La respuesta incluye como máximo 100 claves y respeta `truncated` y `textTruncated`. El contexto de una capa incluye `textKey`, `translation` y avisos de traducciones faltantes o recortes. Vincula una clave con `update {id,patch:{textKey:"welcome.start"}}` mediante un lote validado con su revisión; `textKey:null` desvincula. El IDE controla los archivos del catálogo.

SVG, HTML, PNG y assets exportan el idioma de vista previa. JSON conserva el origen y las claves, sin incluir traducciones. Consulta `docs/LOCALIZATION.md`.

### Composición de componentes

`component` convierte un grupo con instancias en un nuevo maestro. `instance` permite insertar componentes en otro maestro: símbolo → botón → tarjeta. Los cambios se propagan por dependencias conservando IDs y personalizaciones locales. `variant.switch` funciona también sobre una instancia interior. Los ciclos se rechazan antes de confirmar el lote.

Cada maestro vive fuera de otros componentes. Para cambiar la estructura de una instancia, usa el `masterId` de su definición; sus textos, estilos y variantes sí se pueden personalizar directamente con las operaciones existentes. Los proyectos siguen en formato v2 y el lector conserva compatibilidad con v1.

## Propiedades públicas de componentes

`context --scope ID --depth 0` devuelve `properties` del maestro o instancia: clave, tipo, valor, disponibilidad y opciones. Usa `component.property.set` con `{id,key,value}` para editar por clave; `null` restablece la propiedad. Texto conserva `textKey`. `component.property.define` recibe `{componentId,key,property:{type,targetId,label,axis?}}`; `component.property.remove` elimina el control y conserva los valores. Usa IDs de capa del maestro al definir, IDs de instancias al personalizar. Consulta `schema` y `docs/COMPONENT-PROPERTIES.md`. Los textos mayores de 240 caracteres se identifican con `textTruncated`.

### Slots: contenido intercambiable

Una propiedad `type: "slot"` devuelve `value` y `defaultComponentId` (IDs de definición), `options` (IDs permitidos) y `components` (`{id,name}`). Descúbrelos con `context --scope ID --depth 0`. `component.property.set` usa `{id: ID_INSTANCIA, key: CLAVE_SLOT, value: ID_COMPONENTE_PERMITIDO}`; `null` restaura el predeterminado. Para definirlo usa `component.property.define` con `{componentId, key, property:{type:"slot",label,targetId,allowedComponents:[...]}}`: targetId es una instancia propia del maestro. La lista debe incluir su contenido actual. Se rechazan ciclos y opciones incompatibles con reemplazos activos. No inventes IDs: lee el contexto.


### Vincular una implementación

`component.implementation.set` recibe `{componentId,platform,reference:{symbol,path?,module?}}`; `reference:null` desvincula. Se guarda en la definición y sus instancias lo comparten. Hay hasta 16 plataformas por definición, con claves en minúsculas de hasta 32 caracteres; `symbol` hasta 200, `path` relativo al workspace hasta 512 y `module` hasta 200. No se aceptan rutas absolutas, URLs ni segmentos `..`.

`context --scope ID --depth 0` incluye `nodes[].implementation`, resuelto desde el componente más cercano (también en variantes y slots), sin incluir código fuente ni vínculos de otras definiciones. Consulta `schema` y usa revisión/dry-run como en cualquier transacción. La apertura es una intención de la UI/API al IDE, no un comando que lea o ejecute archivos. Véase `docs/IMPLEMENTATION-LINKS.md`.

## ARU: autoría de iconos e ilustraciones

ARU 0.7.0 es un helper opcional, separado del editor. `codaru-aru fuente.aru --out recurso.aru.codaru.json` prepara SVG y fuente editable. Usa el contenido del paquete en `{op:'aru',data:PAQUETE,id?,parentId?,x?,y?,width?}`. Un ID de vector existente actualiza el recurso manteniendo geometría y animaciones compatibles. Valida y aplica con la revisión actual como cualquier lote. `context` devuelve metadatos de autoría y capas animables, sin el fuente completo; `export --format aru --ids ID --output fuente.aru` lo recupera. `animate` controla el movimiento de forma declarativa. [Integración, límites y prueba Musaru](docs/ARU.md).

### Biblioteca y estilos externos

- `catalog --kind resources [--query TEXTO]` descubre candidatos/aprobados con ID, revisión, uso, etiquetas y capas del documento; máximo 100 resultados por respuesta, respeta `truncated`.
- `export --resource ID --format svg|png|assets|aru --output RUTA` exporta la biblioteca. SVG/PNG/ZIP requieren aprobación por la IA conectada al IDE; ARU permite corregir candidatos. No mezcles `--resource` con nodos, frame o página. No existe una aprobación CLI autoemitida.
- `catalog --kind styles [--kit ID]` descubre estilos portátiles y sus guías móviles/ARU. `style.import {data:paquete}` y `style.apply {id,frameId?,mode?}` usan el mismo lote con revisión y dry-run. Aplican tokens, conservando geometría; la IA diseña la composición conforme a las guías.

Contratos: `docs/RESOURCE-LIBRARY.md` y `docs/STYLE-PACKAGES.md`.

## Comentarios

comments lista hilos y devuelve el ancla de la selección; comments --id ID devuelve contexto, revisión, nodos (hasta 200), truncated y capas ausentes. Las operaciones comment.* se descubren con schema y usan el lote de apply habitual. Los hooks se suscriben dentro del IDE con subscribeComments; el CLI no ejecuta un modelo ni aplica propuestas automáticamente.

## Contratos de analítica, accesibilidad y pruebas

`experience [--ids ID,ID] [--frame ID]` devuelve el reporte `codaru-experience/1`:
revisión fuente, ficha por capa, instrumentación de eventos, enlaces de implementación,
IDs de pruebas web/iOS/Android y verificaciones de diseño/implementación.
`experience.set {id,spec}` reemplaza la ficha en un lote con revisión esperada;
`spec:null` la elimina. `context` resume la ficha y avisa `experience.truncated`.
El IDE conecta analítica y pruebas al código; Codaru no envía eventos.
Véase [EXPERIENCE.md](docs/EXPERIENCE.md).

## Catálogo tipográfico del IDE · 0.10.0

`catalog --kind fonts [--query NOMBRE]` y `schema` exponen fuentes/variantes/estado. `fonts --load [--id ID]` carga o reintenta recursos registrados por el host. `context` devuelve tipografía efectiva e incidencias. Selecciona `fontFamily` por ID y una pareja `fontWeight`/`fontStyle` cargada; una variante inexistente falla y mantiene la revisión. No se permiten URLs de fuentes dentro de operaciones del agente: registro y persistencia pertenecen al IDE.

`export --format html|svg|png|assets` espera las fuentes utilizadas e incluye archivos autorizados. Una fuente faltante o sin permiso/bytes bloquea la exportación; JSON conserva las referencias. [Contrato tipográfico](docs/TYPOGRAPHY.md). Los estilos/clones existentes son ejemplos opcionales, no restricciones de composición.
