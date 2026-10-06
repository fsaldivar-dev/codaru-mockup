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
./codaru catalog --kind kits --kit ios --query botón
./codaru catalog --kind icons --kit web --query home
./codaru apply --file cambios.json --dry-run
./codaru apply --file cambios.json
./codaru select pantalla-inicio
./codaru export --format svg --frame pantalla-inicio --output vista.svg
./codaru export --format html --output prototipo.html
./codaru export --format json --output proyecto.codaru.json
```

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
```

### Variantes de componente

`variant.define {componentId, variant:{eje:valor}, setName?}` pone un componente en un conjunto con esos ejes (los demás miembros reciben «Base» en los ejes nuevos); `variant.create {componentId, variant}` duplica el maestro junto al original como otra definición del conjunto; `variant.switch {id, variant}` cambia una instancia a la variante que coincida y conserva sus sobrescrituras por nombre de capa. `context` lista `components` con `set`, `setName` y `variant`, y cada instancia o maestro muestra los suyos. En kits, el eje es `Estado` con Normal, Seleccionado y Deshabilitado, y la definición que falte se crea al cambiar.

### Sistema de diseño

`designSystem.set {summary?, brand?, principles?}` guarda la narrativa del sistema (qué es el producto y para quién, por qué la marca funciona para ese negocio, principios); `component.doc {componentId, usage?, do?, dont?}` documenta un componente o todo su conjunto (cuándo usarlo, buenas y malas prácticas, una por línea). Textos de hasta 4000 caracteres; `null` borra un campo. `context` devuelve `designSystem` y marca cada componente con `documented`. Todo se ve y se edita en la pestaña Sistema.

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
| `validation_error` / `invalid_request` | Consultar `schema`; corregir referencias, tipos o límites. |
| `TIMEOUT` | Leer contexto antes de repetir: el cambio anterior podría haberse aplicado. |

El socket predeterminado está en `~/.local/share/codaru-mockup/agent.sock`, dentro de un directorio privado 0700; el socket tiene permisos 0600. No escucha en la red. `CODARU_AGENT_SOCKET` permite elegir otra ruta para la aplicación y el CLI; `--socket` cambia únicamente el destino de esa invocación del CLI. Solo una aplicación usa cada directorio de socket.

## Compilar

```sh
npm run cli:build
npm run native:build
```

Rust y las herramientas web son dependencias de desarrollo. El CLI y la aplicación compilados funcionan sin ellas. La API equivalente para un host de la vista web es `window.codaru.agent(command, params)`; usa el mismo contrato y las mismas transacciones que el CLI.
