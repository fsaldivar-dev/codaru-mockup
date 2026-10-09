# Assets para iOS y Android

Selecciona el grupo de una ilustración, componente o varias capas y abre **Propiedades → Exportar asset**. Puedes guardar SVG, PNG a 1x, un paquete iOS, Android o un ZIP con ambas plataformas. La selección múltiple forma una sola composición, no un archivo por capa.

El fondo es transparente. Se incluyen hijos visibles, degradados, bordes y sombras; el fondo de la pantalla se excluye salvo que selecciones la pantalla completa. El tamaño abarca la selección, los hijos que sobresalen y el margen de sus sombras. Exportar conserva el documento, la selección y el historial.

## Desde la IA

Con la app abierta, descubre los IDs reales mediante `context` o `find`:

```sh
./codaru context --depth 1
./codaru find --query ilustración
./codaru export --format assets --ids ID_DEL_GRUPO --platform all --name bienvenida --output bienvenida.zip
./codaru export --format svg --ids ID_DEL_GRUPO --output bienvenida.svg
./codaru export --format png --ids ID_DEL_GRUPO --width 240 --scale 3 --output bienvenida@3x.png
```

Sustituye `ID_DEL_GRUPO` por un ID del documento. Sin `--ids` se usa la selección actual; `--ids uno,dos` exporta las dos capas juntas. `--node ID` es un alias de selección única. `--frame ID` conserva la exportación de pantalla completa, también en PNG o ZIP.

- `--platform ios|android|all`: contenido del ZIP; por defecto `all`.
- `--width N`: ancho lógico en pt/dp, manteniendo la proporción. Incluye los márgenes de sombra. Sin él se usan las dimensiones del diseño.
- `--padding N`: margen transparente adicional en unidades del diseño, antes de escalar.
- `--scale N`: escala del PNG individual, entre 0.25 y 4. El ZIP siempre usa las escalas de cada plataforma.
- `--name TEXTO`: nombre de los recursos; se normaliza a letras ASCII minúsculas, números y guiones bajos compatibles con Android.

PNG y ZIP requieren `--output`. El CLI guarda los bytes y devuelve ruta, tamaño, revisión, advertencias y lista de archivos, sin imprimir base64. El editor montado rasteriza en su WebView, sin servidor Node. Ante `editor_busy`, termina la interacción activa y vuelve a exportar.

## Importar el ZIP

```text
source/bienvenida.svg
ios/Assets.xcassets/Contents.json
ios/Assets.xcassets/bienvenida.imageset/
  Contents.json
  bienvenida.png
  bienvenida@2x.png
  bienvenida@3x.png
android/res/drawable-mdpi/bienvenida.png
android/res/drawable-hdpi/bienvenida.png
android/res/drawable-xhdpi/bienvenida.png
android/res/drawable-xxhdpi/bienvenida.png
android/res/drawable-xxxhdpi/bienvenida.png
manifest.json
README.txt
```

**iOS:** arrastra `bienvenida.imageset` al catálogo del proyecto. Úsalo con `Image("bienvenida")` en SwiftUI o `UIImage(named: "bienvenida")` en UIKit. El catálogo declara las escalas [1x, 2x y 3x de Apple](https://developer.apple.com/library/archive/documentation/Xcode/Reference/xcode_ref-Asset_Catalog_Format/ImageSetType.html).

**Android:** copia las carpetas `drawable-*` a `app/src/main/res` y referencia `@drawable/bienvenida` o `R.drawable.bienvenida`. Las [densidades Android](https://developer.android.com/training/multiscreen/screendensities) mdpi, hdpi, xhdpi, xxhdpi y xxxhdpi usan factores 1, 1.5, 2, 3 y 4. Un asset de 240 × 180 dp produce imágenes de 240 × 180 hasta 960 × 720 px.

## Botones propios en el IDE

El inspector es opcional. Tu botón puede utilizar la sesión compartida:

```ts
import { assetBytes } from 'codaru-mockup/assets';

const result = await editor.exportAsset({
  ids: ['ilustracion'], // Omitir para usar la selección actual.
  format: 'assets', platform: 'all', name: 'bienvenida', width: 240,
});
const bytes = assetBytes(result); // Uint8Array para el sistema de archivos del host.
// result.filename, result.mime, result.files y result.warnings describen la entrega.
```

Con el plugin Tauri actualizado puedes abrir su diálogo nativo:

```ts
await invoke('plugin:codaru|save_document', {
  content: result.content, encoding: result.encoding,
  filename: result.filename, extension: 'zip',
});
```

La entrada `codaru-mockup/assets` expone además `exportAsset(document, options)` sin sesión y `renderAssetToSVG(document, { ids })` sin DOM. PNG y ZIP necesitan navegador/WebView; SVG funciona también en Node y workers. `editor.agent('export', { format: 'assets', ids, platform: 'all' })` devuelve el mismo resultado con revisión. En JavaScript, los binarios se transportan como base64 y `assetBytes` los decodifica.

## Alcance

El resultado es estático. El SVG conserva geometría editable y avisos de licencia de los iconos; conserva ese fuente y sus créditos al distribuir recursos de terceros. Los PNG fijan los colores y las fuentes del momento de exportar. No se generan código SwiftUI/Compose, animaciones, VectorDrawable XML, PDF vectorial ni variantes automáticas claro/oscuro.

El cristal conserva tinte, borde y sombra, sin desenfoque del contenido que estaba detrás: ese efecto depende del fondo de la aplicación. El SVG conserva texto con fuentes del sistema y puede variar en otro equipo. Estas simplificaciones aparecen en `warnings` y en el manifiesto del ZIP.

Cada imagen se limita a 8192 px por lado y 16 megapíxeles; el paquete a 40 MB. Si se excede, reduce `width` o selecciona una pieza más pequeña. No hay dependencias nuevas en ejecución: el ZIP se escribe localmente y el canvas rasteriza el SVG.
