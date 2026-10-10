# Contratos de analítica, accesibilidad y pruebas

El editor guarda decisiones de implementación **por capa** en `experience`. El IDE conecta esa ficha al código y a sus pruebas. No incorpora SDKs de analítica, colectores, modelos, claves ni un servidor Node en ejecución. Un evento definido aquí no se emite al editar o presentar el mockup.

## Flujo

1. Selecciona el control y abre **Propiedades → Contrato del producto → Configurar contrato**. Los mismos paneles se montan independientemente.
2. Define nombre/clave de traducción, rol, teclado, foco, orden, anuncios, estados y alternativa de movimiento reducido.
3. Declara los eventos: nombre estable, disparador, propósito, decisión de consentimiento y esquema de propiedades con sus fuentes. `analytics: []` expresa que esa interacción no necesita instrumentación.
4. Define un `testId` y criterios de aceptación. Los identificadores no sustituyen nombres accesibles.
5. Exporta JSON o entrega el reporte al adaptador del IDE. Incluye revisión exacta, enlaces a implementaciones existentes, instrucciones de instrumentación y verificaciones automatizables/manuales.
6. El IDE conecta esos contratos a implementación y pruebas. La IA puede leer el reporte para preparar cambios; el reporte no aplica cambios al producto.

El ejemplo `examples/experience-host.html` contiene tres paneles independientes y un puerto de recepción local. **Enviar al IDE** entrega el reporte al callback del ejemplo; no invoca un proveedor de IA ni un servicio de analítica.

## Documento y transacciones

```ts
editor.setExperience('play', {
  accessibility: {
    role: 'button', name: 'Reproducir canción', nameKey: 'player.play',
    keyboard: ['Enter', 'Space'], focus: 'visible', focusOrder: 1,
    states: ['disabled', 'busy'], reducedMotion: true
  },
  analytics: [{
    name: 'player.track.play', trigger: 'success',
    purpose: 'Medir reproducciones confirmadas', consent: 'required',
    properties: { track_id: { type: 'string', source: 'track.id' } }
  }],
  testId: 'player-play',
  acceptance: ['Si falla la carga, anunciar el error y no emitir éxito.']
});
const plan = editor.getExperienceReport({ ids: ['play'] });
// Alternativa: { frameId: 'player-screen' }, o sin opciones para todo el documento.
// plan.revision = SHA-256 del documento fuente, como context.revision.
```

`experience.set {id,spec}` reemplaza la ficha completa en una transacción validada y deshacible; `spec:null` elimina la ficha. Las instancias heredan del maestro y pueden sobrescribir `experience` localmente. Duplicar o instanciar conserva los metadatos; el reporte avisa si un identificador explícito queda repetido, incluyendo coincidencias con identificadores sugeridos. Los documentos v1/v2 sin este campo siguen válidos. También se valida la ficha dentro de las plantillas.

No hay persistencia implícita: el host conserva el documento mediante `onChange` y guarda cuando corresponda. Los formularios confirman ediciones al salir del campo, desmontar el fragmento o destruir el editor. Un JSON inválido se conserva en pantalla y bloquea guardar/desmontar hasta corregirlo o **Descartar borrador**. Las operaciones del agente respetan `editor_busy` mientras haya un borrador. Cambios concurrentes en la ficha rechazan el guardado del borrador.

Límites: 20 eventos y 20 criterios por capa, 32 propiedades por evento, 64 KB por ficha. Nombres/testId de hasta 128 caracteres, tipos/roles/disparadores cerrados, rechazo de campos desconocidos. Los esquemas guardan tipos y fuentes; no admiten valores de muestra o código ejecutable.

## Puertos y paneles

```ts
import { createEditor } from 'codaru-mockup/core';
import { createExperienceView } from 'codaru-mockup/experience';
const editor = createEditor({ document, onChange: saveDraft });
const view = createExperienceView(editor, {
  appearance: { theme: 'dark', density: 'compact' },
  onHandoff: async report => { await ide.receiveProductContract(report); },
  onExport: report => saveContractFile(report)
});
view.mount('accessibility', accessibilitySlot);
view.mount('analytics', analyticsSlot);
view.mount('tests', testsSlot);
```

Puedes montar una sola parte. Cada parte usa Shadow DOM, tokens comunes y nonce CSP heredado. Partes CSS: `experience-panel`, `accessibility`, `analytics`, `tests`, `experience-heading`, `experience-field`, `experience-findings`, `experience-action`, `experience-export`, `experience-handoff`. `setAppearance`, `flush` y `destroy` preservan el ciclo de vida de la sesión. Cambios de cámara no reconstruyen controles ni vuelven a ejecutar la revisión. Los reportes se calculan al cambiar documento/selección, con caché por vista.

El adaptador del editor completo usa la opción avanzada `commit(updates)` para su propio modal: realiza una transacción validada y notifica guardado/render. Los hosts habituales omiten esta opción y usan el editor público; no deben emplearla para saltar conflictos ni cambios humanos. El puerto `onHandoff` recibe una copia y devuelve una promesa; un rechazo se muestra sin modificar el documento. Sin puerto, permanece disponible la exportación local. `getExperienceReport` y `setExperience` están disponibles también en el editor iframe.

## Instrumentación y automatización

Cada entrada contiene:

- `instrumentation`: evento completo, ubicación lógica y orientación web/iOS/Android.
- `implementation`: vínculo al componente más cercano, si existe; el IDE resuelve archivos y símbolos.
- `tests.bindings`: `data-testid`, `accessibilityIdentifier` y `testTag` de Compose/resource-id equivalente. Si no hay ID explícito se sugiere uno estable derivado de la capa.
- `tests.assertions`: expectativas tipadas por categoría (rol, nombre localizado, estado, analítica, etc.) y comprobación automatizable o manual.
- `issues`: duplicados, incompatibilidad de esquemas, nombres/roles ausentes, teclado/foco pendientes, propiedades sensibles y revisión visual existente (contraste, zonas táctiles, solapamientos, recortes y área segura).

Un evento `success` se instrumenta al confirmar el resultado de una operación, `failure` en su rama de error, `submit` después de validar/aceptar el envío y `press` en la activación semántica. `view` necesita reglas de visibilidad/duración/deduplicación en el producto; `change` necesita definir confirmación/debounce. El reporte indica esos puntos y no inventa una ruta de archivo ni una línea de código cuando falta el vínculo.

El HTML de presentación expone IDs de prueba, rol, nombre, descripción, decoración y anuncios declarados. Las claves de nombre accesible usan el catálogo de localización del IDE en la vista previa. **No simula estados dinámicos, acciones de teclado, orden de foco ni resultados de operaciones**; tampoco dispara analítica. El plan de pruebas describe expectativas, no pruebas ya ejecutadas. El IDE implementa los contratos y puede generar sus pruebas de Playwright, XCTest o Compose a partir de ellos.

## CLI

```sh
./codaru --help
./codaru --socket /ruta/privada/agent.sock context --scope play --depth 1
./codaru --socket /ruta/privada/agent.sock experience --ids play
./codaru --socket /ruta/privada/agent.sock experience --frame player-screen
./codaru --socket /ruta/privada/agent.sock apply --file contract.json --dry-run
./codaru --socket /ruta/privada/agent.sock apply --file contract.json
```

El lote usa `expectedRevision` real y `operations:[{op:'experience.set',id:'play',spec:{...}}]`. El reporte es acotable por IDs/pantalla; `context` muestra un resumen y marca `experience.truncated` para contratos largos. `experience` devuelve la ficha completa. CLI, API e interfaz usan el mismo modelo. No pruebes contra el socket humano.

## Alcance de accesibilidad

Separa revisión del diseño y comprobación de la implementación. Los hallazgos no certifican WCAG. Nombre/rol/valor deben comprobarse en controles reales ([W3C 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)); el mínimo de objetivo WCAG 2.2 AA contempla tamaño de 24 × 24 CSS px y excepciones de espaciado ([W3C 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)). La revisión visual existente de Codaru conserva su recomendación de objetivos táctiles mayores; una caja del mockup no demuestra cumplimiento.

Los nombres de eventos y sus atributos mantienen un contrato explícito inspirado en la separación de identidad del evento y atributos de [OpenTelemetry](https://opentelemetry.io/docs/specs/semconv/general/events/). El reporte propio no es un exportador OTLP ni exige adoptar ese SDK.
