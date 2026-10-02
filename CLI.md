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

Los tokens y los iconos se resuelven con el tema del elemento o de su pantalla. Los materiales conservan su simulación en HTML; SVG simplifica el vidrio a tinte y borde.

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
