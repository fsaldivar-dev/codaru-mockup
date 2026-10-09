# Vínculos entre diseño y código

Las definiciones pueden guardar una referencia de implementación por plataforma. El editor emite una intención para abrirla; el IDE resuelve el símbolo o archivo y conserva el control de la navegación. No se añaden dependencias, un servidor, lectura de código ni generación automática de SwiftUI, Compose o web.

## Documento y herencia

Campo opcional de `Component`, compatible con documentos v1/v2 existentes:

```json
{
  "implementations": {
    "ios": { "symbol": "CardView", "path": "Sources/Views/CardView.swift", "module": "DesignSystem" },
    "android": { "symbol": "Card", "path": "app/src/main/java/ui/Card.kt" },
    "web": { "symbol": "Card", "module": "@app/ui" }
  }
}
```

- Una definición admite hasta 16 plataformas. La clave tiene 1–32 caracteres: minúsculas, números y guiones, empezando con una letra. Se admiten plataformas propias; ios, android, web, macos, linux y windows son sugerencias.
- `symbol` es obligatorio, hasta 200 caracteres. `module` es opcional, hasta 200. `path` es opcional, hasta 512, relativo al workspace, con `/`; no admite URLs, rutas absolutas, segmentos vacíos, `.` o `..`, codificación `%`, query ni fragmentos. Los valores no contienen controles ni espacios al inicio/final.
- Se guarda metadato declarativo, sin código ni callbacks. El host decide si existe el símbolo y cómo resolverlo dentro de su workspace; las referencias pueden quedar desactualizadas si se renombra el código.
- Todas las instancias consultan su definición. No existen sobrescrituras locales de estas referencias.
- Al seleccionar una capa interna se usa su maestro/instancia más cercano. Una instancia anidada sin vínculos devuelve una lista vacía, sin caer en los vínculos del componente exterior.
- Un slot consulta la definición actualmente elegida. Cambiar variante consulta la variante destino; crear una variante copia los vínculos iniciales, que después se editan independientemente.
- Duplicar una instancia conserva la referencia a su definición. Desvincularla elimina ese vínculo exterior; los componentes anidados siguen vinculados. Una definición retenida por instancias continúa funcionando aunque su maestro visual haya sido eliminado.

## API del host

Los tipos `ImplementationReference`, `ComponentImplementations` e `ImplementationRequest` se exportan desde la raíz, `core` y `modular`.

```ts
import { createEditor, createEditorView } from 'codaru-mockup/modular';

const editor = createEditor({
  document,
  onChange: document => host.saveDesign(document),
  onImplementationRequest: async ({ platform, reference, nodeId, ownerId, componentId }) => {
    await host.openSymbol({ platform, ...reference });
  },
});

editor.setImplementation(componentId, 'ios', {
  symbol: 'CardView', path: 'Sources/Views/CardView.swift',
});
const context = editor.getImplementations(selectedNodeId);
await editor.requestImplementation(selectedNodeId, 'ios');
editor.setImplementation(componentId, 'ios', null); // Desvincular; deshacer lo restaura.
```

`getImplementations` devuelve `{nodeId, ownerId, componentId, componentName, implementations}` o `null` si la capa está fuera de componentes. Una capa inexistente produce error. Los resultados y la intención son copias aisladas. `setImplementation` es una transacción validada y reversible; su borrado final quita el campo opcional. Una petición de navegación no modifica documento, selección, revisión ni historial. Si el host falla, la promesa rechaza y la UI muestra el error.

`editor.getState().canOpenImplementation` indica si existe el callback. Sin él, el inspector conserva los vínculos y muestra los botones de apertura deshabilitados. `mountCodaru` acepta el mismo callback y su API expone los mismos tres métodos. Desmontar una vista conserva la sesión y el callback; destruir la sesión o el iframe impide nuevas peticiones.

El inspector permite añadir, editar y borrar vínculos en el maestro. En una instancia ofrece abrir cada implementación o ir al maestro para editar. El campo es compartido, por eso no se edita como una propiedad local de la instancia.

## IA y CLI

`schema` describe la operación. En `context`, cada nodo devuelto dentro de un componente incluye `implementation` con su propietario y referencias; no se adjuntan referencias de otras definiciones del catálogo. Se conserva el límite de 100 nodos, `depth` y `truncated`. Para acotar:

```sh
./codaru context --scope ID_CAPA --depth 0
./codaru schema
./codaru apply --file enlaces.json --dry-run
./codaru apply --file enlaces.json
```

```json
{
  "expectedRevision": "REVISION_DEL_CONTEXTO",
  "operations": [{
    "op": "component.implementation.set",
    "componentId": "ID_DEFINICION",
    "platform": "ios",
    "reference": { "symbol": "CardView", "path": "Sources/Views/CardView.swift" }
  }]
}
```

`reference: null` elimina una referencia. UI, host e IA comparten validación e historial. Se respetan `editor_busy`, validación atómica y `revision_conflict`. El CLI no navega ni lee archivos de código: el IDE/IA decide si necesita solicitar ese archivo mediante sus propias herramientas.

## Ejemplo y límites

`examples/implementations-host.html` monta fragmentos independientes y abre tres archivos de ejemplo incluidos en `examples/implementation-sources/`. El resolvedor y el panel de código pertenecen al host del ejemplo; no entran al paquete del editor. Estos fragmentos SwiftUI/Compose/React ilustran destinos de navegación, no son un exportador de código ni bibliotecas compiladas. Se rechazan rutas fuera de esos tres ejemplos para evidenciar los errores del host.

Sin parámetros, el ejemplo no guarda automáticamente. `?persist=NOMBRE` habilita explícitamente el guardado del documento por ese host en una clave local separada. La integración con un IDE real debe conectar su resolvedor, navegación y persistencia.

Fuera del alcance: sincronización bidireccional, vigilancia de archivos, renombrado automático, análisis del repositorio, índices LSP propios y generación de código. La referencia es un puente pequeño hacia las capacidades que ya tiene el IDE.
