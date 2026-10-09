# Identity Lab

Laboratorio local y opcional de identidad para un editor embebido. Conserva intención,
procedencia y decisiones entre propuestas. No instala un modelo, una API key, un servidor
Node ni la interfaz de ARU. El IDE aporta investigación, exploración, render y evaluación.

## Documento y recorrido

`Project.identityLab` es opcional (`codaru-identity/1`). Proyectos v1/v2 existentes conservan
sus nodos, temas y páginas; no se agrega un laboratorio hasta escribirlo.

- **Brief vivo**: intención, audiencia, contexto, cualidades, restricciones y cosas que evitar.
- **Referencias**: fuente, autoría, comunidad, licencia cuando se conoce, observaciones e
  interpretación claramente separadas. Investigación de IA se almacena como propuesta;
  la persona acepta explícitamente una referencia. La librería no descarga URLs.
- **Direcciones**: intención propia, pantallas raíz, estilos y referencias existentes,
  estado explorando/seleccionada/archivada y propuesta textual. No son plantillas cosméticas.
- **Críticas**: proveedor/modelo real, hallazgos por criterio y selección, y PNG renderizados
  de cada pantalla vinculados a la revisión de la dirección.
- **Decisiones**: observación, criterio, siguiente paso, autor, fecha y conservar/revisar/descartar.
  Son entradas históricas: para rectificar se agrega una nueva, no se reemplaza una anterior.
- **Refinamientos**: selección dentro de una dirección, instrucción y propuesta pendiente de
  aplicación explícita. Marcar resuelto no altera geometría ni implica aprobación visual.
- **Entrega**: `exportIdentity()` produce `codaru-identity-package/1`, con laboratorio,
  documento completo (recursos, fuentes ARU y estilos incluidos en el documento) y problemas.
  Para abrir una entrega validada, el host usa `editor.importDocument(package.document)`.
  La biblioteca externa del IDE conserva su propia persistencia.

Eliminar una pantalla, referencia o dirección no borra el historial. `getIdentityState().issues`
informa destinos ausentes y revisiones obsoletas. Deshacer recupera las relaciones originales.
Cada operación participa en las transacciones y el historial existentes del editor.

## API sin interfaz

Los tipos compartidos están en `src/contracts.ts`; la implementación independiente del DOM,
en `src/identity.ts` y `src/editor-core.ts`.

```ts
const editor = createEditor({document, identityServices});
editor.updateIdentityBrief({
  intent: 'Una identidad deseable y contemporánea con procedencia cultural precisa',
  qualities: ['elegancia', 'singularidad'],
  avoid: ['motivos culturales de stock', 'variantes de color del mismo layout'],
});
editor.upsertIdentityDirection({
  id:'direccion-a', name:'Lenguaje propio', intent:'Continuidad y precisión',
  frameIds:['desktop','mobile'], styleIds:[], referenceIds:[], status:'exploring',
});
await editor.requestIdentity({action:'review', directionId:'direccion-a'});
await editor.requestIdentity({
  action:'refine', directionId:'direccion-a', nodeIds:['navegacion'],
  instruction:'Mejorar jerarquía y posición, conservando la rotulación aprobada',
});
const {lab, issues, capabilities} = editor.getIdentityState();
const delivery = editor.exportIdentity();
```

También existen `getIdentityLab`, `upsertIdentityReference`, `addIdentityDecision`,
`applyIdentity` y `setIdentityServices`. Todos los datos que entrega la API son copias.
`setIdentityServices` reemplaza los puertos, aborta solicitudes pendientes y actualiza
las capacidades publicadas. Cada editor mantiene servicios, documentos y solicitudes aislados.

## Puertos del IDE

`IdentityServices` recibe una copia del documento y laboratorio, revisión completa,
dirección cuando corresponde, `targetRevision` y `AbortSignal`.

| Puerto | Resultado | Tratamiento |
| --- | --- | --- |
| `research(request)` | `{references}` | Nuevos registros `proposed`; no reemplaza referencias existentes. |
| `explore(request)` | `{directions}` | Nuevas propuestas `exploring`; no reemplaza direcciones existentes ni genera nodos. |
| `render(request)` | `IdentityEvidence[]` | PNG reales de **todas** las pantallas de la dirección, ligados a `targetRevision`. |
| `review({...request,evidence})` | `{summary,findings,evaluator}` | Conserva la crítica y sus renders, sin cambiar el diseño. |
| `refine(request)` | `{proposal}` | Almacena propuesta textual ligada a selección y revisión; no aplica cambios. |

Una dirección puede abarcar hasta 12 pantallas. PNG individual hasta 2 MB de URL codificada;
evidencia total hasta 12 MB por laboratorio. El PNG debe tener encabezado, dimensiones,
bloques de datos y final presentes; la revisión y cada `frameId` deben coincidir. El IDE es responsable de
renderizar exactamente el snapshot recibido y de enviar esos píxeles al evaluador real.
Validar la estructura de PNG no prueba la calidad visual ni autentica afirmaciones de terceros.
No se simula una crítica ni una aprobación cuando falta el evaluador.

`targetRevision` es SHA-256 sobre dirección, nodos descendientes de sus pantallas, temas,
estilos asociados, brief y referencias asociadas. Excluye el historial de críticas para que
una crítica no se vuelva obsoleta al guardarla. Alterar brief, referencia o diseño vinculado
invalida la revisión. Cámara, selección y decisiones de otras direcciones no la invalidan.

Mientras una solicitud espera, cualquier commit, desmontaje, cambio de servicio o borrador
ocupado impide aceptar silenciosamente el resultado tardío. El host recibe un error y puede
solicitar otra revisión. El diseño humano permanece intacto. Las señales de cancelación son
cooperativas: aunque el proveedor las ignore, el núcleo rechaza su respuesta obsoleta.

Aplicar cambios propuestos al diseño es una acción explícita posterior: leer contexto reciente,
preparar `agent('apply',{expectedRevision,operations,dryRun:true})` y aplicar el mismo lote
con la revisión apropiada. Las propuestas textuales nunca se ejecutan como JavaScript.

## CLI

Los campos `context.identity` incluyen brief resumido, conteos, direcciones con `targetRevision`
y problemas (hasta 100). Exportar JSON conserva el laboratorio completo. `schema.operations`
documenta `identity.brief.set`, `identity.reference.put/remove`, `identity.direction.put/remove`,
`identity.decision.add`, `identity.critique.add` e `identity.refinement.put`.

Usar el lote normal `{expectedRevision,operations}`: mismo control de ocupado, conflictos,
dry-run, confirmación atómica y Deshacer que cualquier edición de diseño. Para una crítica
externa, entregar PNG reales, revisión de destino y proveedor/modelo; el CLI no lleva IA propia.

## Paneles y ciclo de vida

El adaptador opcional de interfaz puede montar fragmentos de brief, referencias, direcciones,
revisiones, decisiones y entrega sobre una misma sesión. No toma control del lienzo ni
requiere una segunda vista interactiva. Usa `EditorSession.bindExtension({flush,dispose,isBusy})`:
los borradores ocupados bloquean escrituras externas, desmontar guarda el texto pendiente y
una falla de flush mantiene la sesión recuperable. El adaptador vacía su estado busy antes de
confirmar su propio borrador para no bloquear su transacción.

No incluye comentarios anclados a objetos ni suscripciones/hooks de comentarios: ese flujo
requiere definir anclas, estados, permisos y eventos aparte.

## Comprobaciones

`tests/identity.test.ts` comprueba migración opcional v1/v2, aislamiento, Deshacer, validación
atómica, SHA-256, propuestas sin mutación visual, renders/revisiones exactos, respuestas tardías,
refinamiento localizado, referencias ausentes, historial, CLI y flush recuperable. La prueba de
arquitectura confirma que el núcleo no importa adaptadores, estilos ni SDK/runtime externos.

## Adaptador de interfaz publicado en el paquete local

Importar `createIdentityLabView` de `codaru-mockup/identity` y montar cada parte:
`brief`, `references`, `directions`, `reviews`, `decisions`, `handoff`.
El adaptador recibe `appearance`, `ownerDocument`, `styleNonce`, `onOpenFrame`,
`onExport` y `onError`. Los fragmentos tienen `setAppearance` y `destroy`; la vista
ofrece además `flush`. No monta iframe ni un segundo lienzo.

Los borradores del brief se confirman en cambio/desmontaje; los formularios de nuevas
referencias, direcciones y decisiones requieren su botón de guardar. Mientras una
ficha nueva está sin guardar bloquea commits externos. El host debe permitir guardar
antes de desmontar esa ficha. Las instrucciones de refinamiento se conservan al
cambiar de panel. La suscripción ignora cambios de cámara/selección para no copiar ni
serializar la evidencia de revisión en cada gesto.

`renderIdentityEvidence` es un adaptador opcional para navegador/WebView: rasteriza
las pantallas del snapshot recibido con el exportador de assets existente, a un máximo
de 1024 px por lado. El renderer del IDE puede sustituirlo para fuentes y efectos propios.
El evaluador debe observar las imágenes resultantes, no sólo analizar el JSON.

`examples/identity-host.html` conserva las tres direcciones creativas reales y la
observación del usuario sobre elegancia. Su puente permite descargar la solicitud y
entregar una respuesta JSON de un agente real. No conecta un modelo por defecto ni
califica el diseño automáticamente. Cada evaluación conserva proveedor/modelo declarado.

El adaptador recibe invalidaciones ligeras mediante `bindExtension({notify})`, sin crear
otra suscripción pública que clone el documento y sus PNG durante cada cambio de cámara.
Las cuatro capacidades se comparan sin copiar el laboratorio. Los formularios nuevos
incluyen «Descartar borrador» y el refinamiento permite limpiar su instrucción; descartar
libera la protección de escritura sin crear una referencia o decisión.
