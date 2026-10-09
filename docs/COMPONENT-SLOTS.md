# Contenido intercambiable: slots

Un slot es una propiedad pública de tipo `slot` que vincula una instancia dentro de un maestro. Cada espacio contiene **un componente**, tiene un contenido predeterminado y permite entre 1 y 32 definiciones elegidas por su autor. No crea un segundo árbol: usa las instancias, plantillas e historial del editor.

## Crear y usar

1. Inserta una instancia en un maestro, por ejemplo Avatar dentro de Tarjeta. Ajusta su posición y tamaño: ese será el espacio.
2. Selecciona esa instancia y pulsa **Exponer propiedad en Tarjeta**. Elige **Contenido (slot)**, escribe su nombre y clave, marca los componentes permitidos y elige el contenido predeterminado.
3. Selecciona una instancia de Tarjeta y cambia su **Cabecera** desde **Propiedades del componente**. El contenido cambia sin desvincular la tarjeta.
4. **Restablecer** vuelve al contenido del maestro. Cambiar el selector del maestro modifica el predeterminado; las instancias con una elección propia lo conservan.

El slot debe pertenecer directamente al maestro: puede estar dentro de grupos normales, pero no atravesar otra instancia. Para definir un espacio dentro de un componente anidado, edita el maestro de ese componente. Después puedes editar su slot seleccionando la instancia anidada.

El ID de la capa raíz, nombre, posición, tamaño, sizing, límites y comportamiento de tamaño al contenido se conservan. El contenido nuevo aporta su propio diseño; los cambios posteriores de su maestro siguen propagándose. La distribución del padre sigue resolviendo el tamaño y la posición según sus reglas.

Se conservan las sobrescrituras de capas compatibles por ruta completa de nombre/tipo y posición entre hermanos homónimos, igual que en las variantes. Las capas incompatibles dejan de formar parte del contenido; **Deshacer recupera la composición anterior**. Las personalizaciones fuera del slot permanecen intactas. Un vínculo de propiedad que apuntaba al interior de otro componente puede quedar no disponible al sustituirlo: no se redirige a otra capa arbitraria.

## Contrato del IDE y la IA

Los slots usan las APIs públicas existentes, disponibles en core, modular e iframe:

```ts
editor.apply([{
  op: 'component.property.define',
  componentId: cardDefinitionId,
  key: 'cabecera',
  property: {
    type: 'slot', label: 'Cabecera', targetId: headerInstanceInMaster,
    allowedComponents: [avatarDefinitionId, logoDefinitionId, statusDefinitionId],
  },
}]);

const slots = editor.getComponentProperties(cardInstanceId)
  .filter(property => property.type === 'slot');
// value: ID actual; defaultComponentId: ID del contenido del maestro;
// options: IDs permitidos; components: [{id, name}]; overridden; available.

editor.setComponentProperty(cardInstanceId, 'cabecera', logoDefinitionId);
editor.setComponentProperty(cardInstanceId, 'cabecera', null); // heredar de nuevo
editor.setComponentProperty(cardMasterNodeId, 'cabecera', statusDefinitionId); // nuevo predeterminado
```

`allowedComponents` contiene IDs de definición; `targetId` es el ID de la instancia de contenido en el maestro. El predeterminado vive en esa instancia, no en otra copia de metadatos. Inclúyelo en la lista de permitidos. `null` restablece y no significa un espacio vacío. Para un contenido vacío, el autor puede ofrecer un componente vacío explícito.

`context --scope ID --depth 0` incluye los slots y sus opciones; `schema` explica el contrato. Usa `component.property.set` con el ID de componente elegido, la revisión actual y el flujo habitual de dry-run/apply. Los slots se guardan en el JSON v2 como propiedades opcionales. Los documentos anteriores v1/v2 siguen abriéndose.

El IDE conserva la propiedad del guardado, de sus controles y del catálogo de traducciones. Cambiar contenido conserva `textKey` en las capas compatibles que lo hayan personalizado; en las demás se hereda la clave del componente elegido. Los catálogos de localización y los tokens de tema siguen sus reglas actuales.

## Límites explícitos

- Máximo 32 propiedades por definición, incluidos slots; máximo 32 opciones por slot. Una capa solo puede ser destino de un slot.
- Las opciones son IDs exactos. Una variante también debe estar permitida para usarla en el slot.
- Se validan dependencias, incluidas opciones sin instancias visibles. Una opción que crea un ciclo se rechaza antes de confirmar; se mantienen los límites de profundidad y 3.000 capas del documento.
- No se elimina una definición mientras un slot la ofrece. Quita primero esa referencia.
- Para quitar un slot o una opción con reemplazos incompatibles activos, restablece esas instancias primero. La transacción inválida se revierte entera.
- Si se elimina la capa vinculada, el control queda no disponible y su contrato puede repararse o eliminarse.
- Esta entrega intercambia un componente completo por espacio; no añade listas variables, código ejecutable ni una exportación automática de SwiftUI/Compose.

## Ejemplo y verificación

`examples/slots-host.html` muestra Avatar, Logo y Estado como contenidos de una tarjeta, con controles del host y fragmentos del editor. No guarda por defecto. Para probar persistencia, `?persist=NOMBRE` la habilita **explícitamente en ese host de ejemplo**, usando una clave de localStorage propia; el motor sigue sin asumir persistencia.

`tests/component-slots.test.ts` cubre composición, opciones, variantes, ciclos, tamaños, localización, borrado, duplicación, desvinculación, serialización, historia y agente. Las pruebas de interfaz verifican creación/configuración visual, controles del host, iframe, recuperación tras recarga, desmontaje y exportaciones.
