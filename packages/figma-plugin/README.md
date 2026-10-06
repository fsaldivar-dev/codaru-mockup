# Plugin de Figma · Exportar a Codaru Mockup

Lleva tus propios archivos de Figma a Codaru Mockup. El plugin lee la selección o la página y guarda un archivo `.figma.codaru.json`; Codaru lo limpia y lo convierte al abrirlo. No necesita token, cuenta ni red: el manifiesto declara que no accede a ningún dominio.

## Instalarlo (una sola vez)

Hace falta la **app de escritorio de Figma**; los plugins en desarrollo no se pueden cargar desde el navegador.

1. Abre cualquier archivo en Figma.
2. Menú **Plugins → Development → Import plugin from manifest…**
3. Elige `packages/figma-plugin/manifest.json` de este repositorio.

Queda disponible en **Plugins → Development → Exportar a Codaru Mockup** para todos tus archivos.

## Exportar

1. Selecciona los marcos o componentes que quieras llevarte, o no selecciones nada para exportar la página.
2. Ejecuta **Plugins → Development → Exportar a Codaru Mockup**.
3. Elige «Solo la selección» o «Toda la página actual» y pulsa **Exportar**.
4. Guarda el archivo `.figma.codaru.json` que se descarga.

## Importar en Codaru

1. En Codaru, pulsa **Abrir proyecto** (icono de carpeta) o, sin nada seleccionado, **Importar de Figma o abrir .json** en el panel Documento.
2. Elige el archivo `.figma.codaru.json`.

Las pantallas se **añaden** a la derecha de tu documento, sin reemplazarlo, y un diálogo resume qué se importó y qué se simplificó. Deshacer quita la importación completa. Para probar sin Figma, abre `examples/ejemplo.figma.codaru.json`.

Una IA puede hacer lo mismo con la operación `{"op":"figma","data":{…contenido del archivo…}}` de `./codaru apply`.

## Qué se convierte

| En Figma | En Codaru |
| --- | --- |
| Marcos de primer nivel | Pantallas |
| Marcos anidados, grupos | Tarjetas y grupos |
| Rectángulos, elipses, texto | Sus equivalentes, con relleno, borde, radios y opacidad |
| Degradados lineales y radiales | Degradados de varias paradas |
| Estilos de color y de texto | Tokens del tema, con las capas vinculadas |
| Vectores, operaciones booleanas, líneas, estrellas | Ilustraciones SVG saneadas (animables) |
| Imágenes de hasta 3 MB | Imágenes incrustadas |
| Componentes sueltos de la página | Componentes, reunidos en una pantalla «Componentes de Figma» |
| Auto layout | Filas y columnas con padding, reparto y alineación |

## Qué se limpia o se simplifica

- Las capas ocultas y los grupos vacíos se descartan.
- Los nombres genéricos («Frame 427», «Rectangle 12») se sustituyen por el tipo de capa.
- Las **instancias** llegan como copias independientes y cada **variante** como un componente separado.
- El auto layout se conserva (dirección, padding por lado, reparto, alineación, salto de línea y ajuste al contenido) cuando Codaru coloca los hijos igual que Figma. Si no coincide, por ejemplo con hijos en posición absoluta o espaciado negativo, se mantienen las posiciones sin auto layout.
- Las tipografías se muestran con la fuente de sistema, serif o monoespaciada más parecida.
- Las sombras se aproximan con la sombra estándar; desenfoques, rotaciones, máscaras y rellenos angulares se omiten.
- El límite es de 3000 capas por exportación.

El diálogo de importación enumera cada uno de estos casos con cuántas capas afectó.

## Estado

La conversión está cubierta por pruebas que ejecutan el código real del plugin contra una simulación de la API de Figma. El plugin todavía no se ha ejecutado dentro de Figma: si falla con algún archivo, el mensaje aparece en el propio plugin.

Los conjuntos de variantes (`Estado=Activo`) se importan como conjuntos de Codaru con sus ejes; una instancia puede cambiar de variante desde el inspector.
