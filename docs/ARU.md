# ARU: iconos e ilustraciones propios

ARU es la herramienta opcional de autoría. Codaru conserva el fuente `.aru` junto a un SVG saneado y permite animar las capas desde su animador. Las fotografías siguen en el banco de recursos. No se añade ARU Studio, Sharp ni un servidor Node al editor embebible. Node y ARU solo se necesitan al preparar recursos. Codaru no llama a modelos automáticamente.

## Preparar e importar

```sh
npm install -g @fsaldivar.dev/aru@0.7.0
aru help
aru context mi-icono.aru
aru render mi-icono.aru --out vista.png
# Incluido como bin de codaru-mockup:
npx codaru-aru mi-icono.aru --out mi-icono.aru.codaru.json
# En este checkout:
node packages/editor/scripts/prepare-aru.mjs mi-icono.aru --out mi-icono.aru.codaru.json
```

Si ARU no está en PATH, pasa `--aru /ruta/al/bin/aru`. El helper valida el dibujo, rechaza avisos de ARU, compila una copia del texto capturado y no reemplaza archivos existentes. Cada fuente/SVG admite hasta 400 kB; el importador limita el paquete a 1.2 MB.

En **Biblioteca → Recursos → Importar recurso ARU**, elige el paquete preparado; también se admite desde **Insertar → Ilustración**. Si está seleccionada una ilustración, la actualiza; en otro caso añade una al frame actual. Las fotografías no se reemplazan por esta importación.

El paquete tiene `{format:'codaru-aru/1',source:string,svg:string,filename:string}`. `filename` es un nombre `.aru` sin rutas. El host también puede prepararlo mediante la API pública `createIllustrator({text}).svg()` de ARU. Codaru sanea y valida el resultado, pero no certifica la correspondencia entre fuente y SVG aportados por un host externo.

## IA y transacciones

```ts
editor.apply([{op:'aru', data:recursoPreparado, id:'mi-icono', parentId:'pantalla', width:32}]);
```

El CLI admite la misma operación en un lote `{expectedRevision,operations}`. Un ID nuevo inserta; un ID de vector existente actualiza dibujo y fuente conservando posición, tamaño y animaciones cuyos targets sigan presentes. Un ID de otro tipo se rechaza. Una transacción, una entrada de Deshacer.

```sh
./codaru context --scope mi-icono --depth 1
./codaru apply --file lote.json --dry-run
./codaru apply --file lote.json
./codaru export --format aru --ids mi-icono --output mi-icono.aru
```

El contexto devuelve `illustration:{format,filename,sourceLength,editable}` sin transmitir el fuente completo. `layers` lista los IDs aceptados por `animate`. ARU 0.7.0 exporta SVG sin los nombres originales de las piezas: Codaru asigna `capa-N` según el orden del SVG. Tras un redibujo, revisa esos targets: conservar un ID no garantiza que represente la misma pieza. La jerarquía original sigue disponible con `aru context`.

No se importan las animaciones CSS de ARU: añade animaciones declarativas con el animador o `animate`. Presentar y HTML las reproducen respetando movimiento reducido; SVG, PNG y paquetes móviles son estáticos. Se omiten filtros de material, scripts y referencias externas; curvas, rellenos, bordes y degradados compatibles se conservan.

## Host del IDE

```ts
const editor=createEditor({document,onIllustrationRequest:({nodeId,source})=>{
  abrirIlustrador({nodeId,text:source.text,filename:source.filename});
}});
await editor.requestIllustration('mi-icono');
```

`mountCodaru(...,{onIllustrationRequest})` ofrece el mismo contrato. El inspector habilita **Editar ilustración en el IDE** cuando existe el callback. Se entrega una copia: modificarla no cambia el documento. El host conserva archivos y navegación y valida la revisión antes de aplicar el resultado; cancelar no escribe nada.

`codaru-mockup/aru` exporta `prepareAruAsset` y los tipos del contrato, sin cargar el motor ARU. Reemplazar el SVG directamente quita el fuente anterior para evitar exportar un fuente obsoleto.

Los ZIP iOS/Android incluyen `source/aru/ID-NOMBRE.aru`, además del SVG y los PNG. Son imágenes de uso general (`imageset`/`drawable`), no un catálogo AppIcon ni adaptive launcher icons. Conserva el proyecto Codaru para sus animaciones y los fuentes ARU para editar curvas.

## Prueba Musaru

`examples/aru-music/index.html` monta fragmentos con una sesión propia, sin persistencia implícita. Incluye escritorio, reproducción móvil y una hoja de identidad: 16 controles originales, icono de app y una ilustración vectorial. Los fuentes se crearon con ARU. Las tres fotografías reales vienen del banco Picsum; autores/licencias permanecen en capas y `assets/photos.json`. No incluye pistas ni reproducción de audio.

El icono late; el vinilo y los destellos se animan por separado en Presentar. El inspector entrega el fuente al panel del host; **Importar resultado** usa revisión esperada. El proyecto se creó mediante CLI con validación previa en una app aislada, sin sustituir el documento de la persona.

## Admisión de recursos reutilizables

La nueva biblioteca separa un dibujo del documento de un recurso aprobado. Fuente/SVG, renders reales y criterio visual de la IA del IDE deben corresponder a la misma revisión. Sin servicio de evaluación el dibujo sigue pendiente. Se puede exportar su fuente para corregirlo; insertar/exportar desde biblioteca requiere aprobación. Consulta [RESOURCE-LIBRARY.md](RESOURCE-LIBRARY.md).

Las guías ARU de [estilos portátiles](STYLE-PACKAGES.md) amplían los lenguajes disponibles para el IDE, sin instalar presets ni cargar el runtime ARU dentro del editor.
