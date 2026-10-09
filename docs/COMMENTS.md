# Comentarios del layout

Módulo local y opcional. Los hilos viven en Project.comments (codaru-comments/1);
documentos v1/v2 sin comentarios siguen funcionando. No instala IA, credenciales
ni servidor Node. La IA y el guardado pertenecen al IDE.

## Recorrido

Seleccionar uno o varios elementos de una misma pantalla, abrir Comentarios y
publicar. Cada hilo conserva IDs, nombres originales, tema/modo, caja original y
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
Montar mountPanel(contenedor) y, opcionalmente, mountPins(view.getCanvasViewport()).
Los dos fragmentos aceptan setAppearance y destroy. El estilo utiliza el nonce del host automáticamente; styleNonce permite especificarlo. La capa de marcadores es transparente para conservar el render del lienzo. La vista ofrece flush, destroy
y open(threadId). Opciones: appearance, ownerDocument, styleNonce, author, onOpen,
onReveal, onError y onAIRequest. El host puede crear su propio panel usando sólo core.
El ejemplo encuadra la pantalla del ancla al revelar un hilo y conserva la selección de sus capas. El editor completo incluye un botón Comentarios; el IDE modular decide dónde montarlo.

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
El puente del ejemplo identity-host permite devolver una respuesta JSON real
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
