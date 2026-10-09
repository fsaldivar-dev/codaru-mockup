# Propiedades públicas de componentes

Cada definición puede exponer hasta 32 controles: texto, icono, visibilidad, un eje de variante de una instancia anidada y contenido intercambiable (slot). Los controles pertenecen al documento y se guardan en `Component.properties`. No hay una segunda copia de los valores: el texto, icono, visibilidad y variante viven en las capas y usan sus sobrescrituras existentes.

## Desde el editor

Selecciona un maestro o una capa dentro de él y pulsa **Exponer propiedad**. Elige la capa, tipo, nombre visible y una clave estable, como `titulo`. Al seleccionar una instancia, **Propiedades del componente** muestra sus controles. Cambiar el maestro propaga los valores heredados; cada instancia puede conservar sus cambios. El botón de restablecer quita únicamente los campos de esa propiedad.

El icono utiliza los cuatro catálogos locales existentes. Una propiedad de variante expone valores de variantes ya definidas que sean compatibles con los otros ejes; no crea automáticamente todos los estados de un kit. Para crear variantes se mantiene la API `variant.create`/`variant.switch` y la biblioteca.

Eliminar un control conserva los valores visuales y sus sobrescrituras. Eliminar la capa vinculada deja el control como no disponible; el autor puede volver a vincularlo desde **Editar**. No se busca otro destino por un nombre parecido. Al crear una variante del componente se copian las propiedades con los IDs de su nueva plantilla. Al cambiar una variante anidada se usa la correspondencia existente por ruta, tipo/nombre y posición entre hermanos del mismo nombre; una estructura incompatible deja el control no disponible.

## Controles propios del IDE

La API es la misma en `codaru-mockup/core`, `codaru-mockup/modular` y el editor iframe. El IDE puede usar sus propios controles sin montar el inspector.

```ts
const properties = editor.getComponentProperties(cardInstanceId);
// { key, type, label, targetId, resolvedTargetId, available, reason?,
//   value?, overridden, options?, textKey?, axis? }

editor.setComponentProperty(cardInstanceId, 'titulo', 'Mi proyecto');
editor.setComponentProperty(cardInstanceId, 'icono', { pack: 'web', name: 'heart' });
editor.setComponentProperty(cardInstanceId, 'mostrarDescripcion', false);
editor.setComponentProperty(cardInstanceId, 'estado', 'Suave');
editor.setComponentProperty(cardInstanceId, 'titulo', null); // restablecer
```

`getComponentProperties` devuelve copias independientes. Cada llamada de escritura es una transacción validada y deshacible; `.apply` permite agrupar varias. Los controles deben liberar el foco de una edición activa antes de una escritura externa. No hay escritura mientras la vista está ocupada por un gesto o diálogo. `subscribe` mantiene sincronizados los controles del IDE y del editor.

```ts
editor.apply([
  { op: 'component.property.define', componentId: cardDefinitionId, key: 'titulo',
    property: { type: 'text', targetId: titleLayerInMaster, label: 'Título' } },
  { op: 'component.property.set', id: cardInstanceId, key: 'titulo', value: 'Proyecto Aurora' },
]);
```

`targetId` identifica una capa de la plantilla/maestro de esa definición, incluso si está dentro de otra instancia. `resolvedTargetId` identifica la capa concreta en el uso consultado. Las claves admiten letras ASCII, números, guion y guion bajo, empiezan por letra y tienen hasta 64 caracteres; las etiquetas hasta 80. Los textos admiten hasta 10.000 caracteres. `null` elimina solo los overrides del vínculo: texto, pareja de icono, hidden o instanceOf. En una capa de maestro sin sobrescritura no cambia su valor.

**Localización:** cambiar texto modifica el origen/respaldo y conserva `textKey`. Un catálogo activo sigue mostrando la traducción del IDE; editar la traducción continúa siendo responsabilidad del host. Texto vacío es un valor válido y se distingue de restablecer con `null`.

Los documentos v1/v2 anteriores no necesitan propiedades ni migración. No se añaden paquetes de ejecución, un servidor ni un formato nuevo. Los slots de un componente por espacio están implementados; consulta [COMPONENT-SLOTS.md](COMPONENT-SLOTS.md) para sus opciones, reemplazos y límites.

## IA y CLI

`context --scope ID --depth 0` incluye `properties` para maestros e instancias. Expone los controles disponibles, opciones, valor de origen y vínculo resuelto. Los textos se acotan a 240 caracteres con `textTruncated: true`. No uses el valor truncado para reemplazar el original.

Con la revisión actual, crea un lote y valida/aplica el mismo archivo:

```json
{
  "expectedRevision": "REVISION_ACTUAL",
  "operations": [
    { "op": "component.property.set", "id": "ID_INSTANCIA", "key": "titulo", "value": "Mi espacio" }
  ]
}
```

`component.property.define`, `component.property.remove` y `component.property.set` se descubren con `schema`. El agente conserva conflictos de revisión, editor ocupado y una entrada de historial por lote.

El ejemplo `examples/properties-host.html` muestra controles propios del host junto con los fragmentos de capas, lienzo e inspector. Es un documento aislado, sin persistencia automática.
