# Comentarios del layout

Módulo local y opcional. Los hilos viven en Project.comments (codaru-comments/1);
documentos v1/v2 sin comentarios siguen funcionando. No instala IA, credenciales
ni servidor Node. La IA y el guardado pertenecen al IDE.

## Recorrido

Seleccionar un elemento y pulsar su burbuja **Dar retroalimentación** abre la
barra junto a él. También se puede activar **Anotar** y señalar una capa
directamente en el lienzo, incluso dentro
de un frame o componente. Se abre una barra compacta junto al elemento para criticarlo o
pedir otra propuesta. El botón de opciones despliega «se pierde», «se encima»,
«otra propuesta». Esas ayudas
rellenan texto editable; no generan un diagnóstico ni documentan el componente.
**Comentar** publica el hilo y el hook del IDE. Los marcadores permiten volver a
la conversación y pedir una propuesta. Escape cierra conservando el borrador.
También se puede seleccionar varias capas de una misma pantalla y comentar juntas. Cada hilo conserva IDs, nombres originales, tema/modo, caja original y
revisión SHA-256 del layout. Los marcadores siguen las capas actuales y la cámara.
Los hilos avisan si el diseño cambió o si se eliminó/movió una capa; no se reasignan.
Actualizar ancla es explícito para un borrador obsoleto. Responder, resolver y
reabrir comparten las transacciones y Deshacer del documento.

Los borradores se guardan en el documento al salir del campo, cambiar panel o
desmontar. Publicar es explícito; guardar un borrador no dispara el hook. Texto
sin enviar bloquea escrituras externas hasta su flush. Un error de flush conserva
el borrador y mantiene el editor recuperable.

## Integración independiente

Importar createCommentsView desde codaru-mockup/comments, con una sesión createEditor.
Montar `mountPins(view.getCanvasViewport())` para marcadores, selección directa y
barra de anotación. `mountPanel(contenedor)` es opcional y conserva el listado de
hilos. Ambos fragmentos pueden usarse solos.
Los dos fragmentos aceptan setAppearance y destroy.
El IDE también puede personalizar el aspecto mediante `::part(feedback-bar)`,
`feedback-input`, `feedback-send`, `feedback-launcher`, `feedback-marker`,
`feedback-outline`, `feedback-inspect`, `feedback-options`, `feedback-thread` y
`feedback-message` en el elemento del fragmento. Si se monta dentro del lienzo
modular, las partes se exponen en el host del canvas: por ejemplo,
`[data-codaru-part="canvas"]::part(feedback-bar)`.
El estilo utiliza el nonce del host automáticamente; styleNonce permite especificarlo. La capa de marcadores es transparente para conservar el render del lienzo. La vista ofrece flush, destroy
y open(threadId). `setAnnotationMode(true)` activa el señalamiento directo;
`setAnnotationMode(false)` sale del modo. `annotate(ids?)` abre la barra junto a
la selección indicada o actual. El host decide dónde coloca el botón Anotar.
Los clics sobre marcadores abren la conversación local sin solicitar al host
que cambie de panel; `open(threadId)` sigue notificando `onOpen`. Opciones: appearance, ownerDocument, styleNonce, author, onOpen,
onReveal, onError y onAIRequest. El host puede crear su propio panel usando sólo core.
El ejemplo encuadra la pantalla del ancla al revelar un hilo y conserva la selección de sus capas. El editor completo incluye Anotar y Comentarios; el IDE modular decide dónde montarlo.

## Hook para la IA

editor.subscribeComments(event => { ... }) devuelve unsubscribe.
También se admite onCommentEvent en createEditor. No reproduce eventos históricos
al suscribirse. comment.created, comment.replied, comment.resolved y comment.reopened
se emiten después del commit real, jamás en dry-run o cámara. Deshacer, Rehacer e
importDocument emiten comments.restored, sin simular una nueva solicitud humana.
La secuencia es local a la sesión; el IDE debe deduplicar trabajos por ID de mensaje
y escuchar sólo mensajes de autor humano para evitar un bucle de respuestas IA.
Los listeners reciben copias; sus fallos no revierten ni bloquean el commit.

getCommentContext(id) entrega el hilo, revisión actual, ancla, capas ausentes,
caja actual y hasta 200 nodos del frame con truncated. getDocument entrega el
snapshot completo si el IDE necesita renderizar. El texto del comentario es dato
del usuario, no código ni un permiso automático para editar o publicar.

onAIRequest recibe contexto y snapshot. El IDE renderiza, evalúa y propone.
La propuesta puede añadirse como respuesta de autor kind:ai. Nunca altera geometría.
Aplicar un ajuste requiere contexto fresco y un lote normal expectedRevision +
operations; editor_busy y revision_conflict protegen cambios humanos.
El puente del ejemplo identity-host entrega un render PNG de la pantalla
vinculado a la revisión del ancla actual y permite devolver una respuesta JSON real
{text,authorName}, con revisión esperada; no contiene una evaluación simulada.

## CLI

codaru comments lista hilos/borradores y el ancla de la selección actual.
codaru comments --id ID devuelve contexto del hilo y revisión del documento.
schema documenta comment.create, comment.reply, comment.status,
comment.draft.put y comment.draft.remove. Apply sigue dry-run + mismo lote.
El CLI no es un daemon de IA: un agente externo puede consultar cambios o el IDE
suscribirse al hook local. JSON y la entrega de Identity conservan hilos y borradores.

Límites: 200 hilos, 100 mensajes por hilo, 4000 caracteres por mensaje, 20 borradores
y 2 MB de datos de comentarios por documento. No existe eliminación irreversible
de hilos ni ejecución automática de propuestas.

## Cola de correcciones

La barra permite **Agregar a la cola** al escribir una crítica. El comentario queda
anclado y se conserva al guardar/desmontar; no solicita una evaluación individual.
También se puede agregar un hilo existente: se encola su última crítica humana.
**Cola** en el lienzo muestra el conjunto, permite ordenar, revelar los elementos,
retirar entradas y exportar JSON. Retirar una entrada conserva su conversación.
Resolver un hilo lo retira de la cola; Deshacer restaura ambos estados.

**Enviar correcciones** requiere `onCorrectionRequest` en `createCommentsView`
(o en `createEditorView` / `mountCodaru` para los controles incluidos).
El callback recibe un único `CorrectionRequest`: ID determinista de snapshot,
entradas ordenadas `{item:{threadId,messageId},context}` y documento compartido.
Cada contexto conserva la crítica humana exacta y los mensajes hasta ella,
la revisión actual, la original, el estado obsoleto y las capas relacionadas.
El IDE renderiza las pantallas del snapshot, evalúa y entrega sus propuestas.
Las anclas ausentes bloquean el envío; un layout modificado se señala explícitamente.

El callback debe resolver sólo después de que el IDE acepte el lote; debe rechazar
si falla o se cancela. La cola se conserva ante fallos y desmontaje durante el envío.
Al recibir el acuse se retiran únicamente los pares enviados que siguen en cola;
las críticas nuevas se conservan. El envío no resuelve hilos ni cambia geometría.
El ID permite deduplicar reintentos del mismo snapshot en el IDE.
`subscribeComments` sigue informando los commits: los mensajes publicados en cola
incluyen `queued:true`; el IDE debe omitir trabajos individuales para esos eventos.
Las operaciones de ordenar/retirar no disparan solicitudes de IA.

`mountQueue(contenedor)` ofrece la cola como fragmento independiente, con apariencia,
nonce, aislamiento y desmontaje. `openQueue()` abre el listado flotante y
`sendQueue()` solicita el envío; `editor.getCorrectionRequest()` permite una UI
propia sin montar vistas. Partes CSS adicionales: `feedback-enqueue`,
`correction-queue`, `correction-item` y `correction-send`.
`Project.comments.queue` es opcional; se siguen leyendo documentos v1/v2 anteriores.
CLI: `comments` incluye la cola; `comment.queue.add/remove/move` se realizan con
`apply` y revisión esperada. `remove` usa el ID exacto del mensaje para conservar
una corrección posterior del mismo hilo.
