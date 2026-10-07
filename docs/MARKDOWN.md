# Maquetas dentro de Markdown

Un documento puede mostrar una pantalla de un diseño de Codaru con un bloque de código. Tu cliente lo convierte en una vista previa en vivo; en cualquier otro visor el bloque se lee como texto, con el archivo y la pantalla a la vista.

````markdown
Desarrollar esta maqueta:

```codaru-mockup
archivo: diseno/forma.codaru.json
pantalla: screen-login
modo: prototipo
```
````

| Clave | Valor | Por defecto |
| --- | --- | --- |
| `archivo` | Ruta del diseño, tal como quieras escribirla en el documento | obligatorio |
| `pantalla` | Id de la pantalla (recomendado, no cambia al renombrar) o su nombre exacto | la primera |
| `modo` | `prototipo` (navega, anima y cambia de postura) o `estático` | `prototipo` |
| `tema` | `claro` u `oscuro` (para tokens de color, usa la opción `theme` del cliente) | el del diseño |
| `alto` | Alto máximo de la vista en píxeles, de 80 a 4000 | 640 |

También se aceptan las claves en inglés: `file`, `screen`, `mode`, `theme` y `height`. Una clave desconocida es un error visible, para que un error de escritura no pase inadvertido.

## Integrarlo en tu cliente

La entrada `codaru-mockup/preview` no carga el editor. Funciona sobre el HTML que produce cualquier motor de Markdown (markdown-it, marked, remark…), porque todos convierten el bloque en `<pre><code class="language-codaru-mockup">`.

```ts
import { enhanceMarkdown } from 'codaru-mockup/preview';

// Después de renderizar el Markdown en `contenedor`:
const previews = await enhanceMarkdown(contenedor, {
  // Tú decides cómo se lee el archivo: disco con Tauri, fetch, caché del proyecto…
  load: async (archivo, bloque) => leerArchivoRelativoAlDocumento(archivo),
  // Opcional: muestra el botón «Abrir en el editor».
  onOpen: (bloque, pantalla) => abrirEnCodaru(bloque.file, pantalla),
});

// Al cerrar o volver a renderizar el documento:
previews.forEach(preview => preview.destroy());
```

- `load` recibe la ruta tal como está en el documento y devuelve el JSON como texto u objeto. Resolver rutas relativas al Markdown es cosa del cliente.
- Cada vista vive en su propio Shadow DOM: sus estilos no afectan al documento ni al revés. Hereda las variables `--codaru-*` del contenedor (`--codaru-border`, `--codaru-surface`, `--codaru-text`, `--codaru-accent`, `--codaru-canvas`, `--codaru-font-family`).
- Si el bloque está mal escrito, el archivo no carga o la pantalla no existe, el bloque original se conserva y aparece una explicación encima.
- El diseño se valida antes de dibujarse y no se ejecuta ningún script del archivo.
- `theme` en `enhanceMarkdown` o en `renderMockup` acepta `'light'`, `'dark'` o un mapa de tokens de color de Codaru, escritos como variables CSS o por nombre: `{ '--codaru-primary': '#e4572e', '--codaru-surface': '#fffaf2', mode: 'dark' }`. Los tokens sustituyen los colores del tema que usa cada pantalla; el `tema:` del bloque sigue eligiendo el modo.
- Sin `pantalla:`, se muestra la primera pantalla en orden de lectura (página por página, de arriba abajo y de izquierda a derecha). El selector del prototipo lista las pantallas en ese orden.

Para un solo bloque, o si tu motor permite registrar un renderizador por lenguaje, usa las piezas sueltas:

```ts
import { parseMockupBlock, renderMockup } from 'codaru-mockup/preview';

const bloque = parseMockupBlock(textoDelBloque);
const preview = renderMockup(elemento, await cargar(bloque.file), bloque);
preview.show('otra-pantalla'); preview.screen(); preview.destroy();
```

## Imágenes sin montar nada

Para miniaturas de tarjetas, imágenes dentro de documentos o capturas de un handoff, `renderScreenToSVG` dibuja una pantalla como SVG autocontenido. Es una función pura: no usa `window`, `document` ni canvas, así que corre en el navegador, en un worker, en Node o en un puente headless. Valida el documento igual que `renderMockup`.

```ts
import { screens, renderScreenToSVG, renderScreenToDataURL } from 'codaru-mockup/svg';

const lista = screens(diseno);             // [{ id, name, role, page, width, height, … }] en orden de lectura
const svg = renderScreenToSVG(diseno, { screen: lista[0].id, mode: 'static', maxWidth: 320, theme: 'dark' });
img.src = renderScreenToDataURL(diseno, { screen: 'screen-login', theme: { '--codaru-primary': '#e4572e' } });
const markdown = `![Bienvenida](${renderScreenToDataURL(diseno, { screen: 'screen-login' })})`;
```

- `screen` es el id de la pantalla o su nombre exacto; sin él, la primera en orden de lectura. El id es el del nodo: no cambia al reordenar, mover ni renombrar pantallas, y es el mismo que acepta `pantalla:`.
- `theme` acepta lo mismo que en la vista previa. `maxWidth` reduce el dibujo, nunca lo amplía. `mode` solo admite `'static'`: se dibuja la pantalla, sin navegación ni animación.
- El resultado se ve como la vista previa estática: mismos rellenos, degradados, bordes, radios, sombras, iconos, ilustraciones, imágenes incrustadas, barra de estado, isla o cámara del dispositivo y bisagra de los plegables. El cristal se dibuja como tinte y borde, sin el desenfoque del fondo. El texto se corta en líneas con métricas propias de la fuente del sistema; en un navegador, la exportación SVG del editor mide con la tipografía real.
- La URL de `renderScreenToDataURL` funciona tal cual en `<img src>`, en CSS `url()` y en un enlace de imagen Markdown: no contiene espacios, comillas ni paréntesis.
- Con iconos, el SVG lleva como metadatos las licencias de sus colecciones (`licenses: false` las omite, por ejemplo para miniaturas que el host acredita por su cuenta).
- `codaru-mockup/svg` solo trae el modelo, los iconos y el dibujo; `codaru-mockup/preview` y `codaru-mockup/core` exportan las mismas funciones.

## Ejemplo para verlo

Con `npm run dev`, abre `http://127.0.0.1:1432/examples/markdown-preview.html`: a la izquierda editas el Markdown y a la derecha se ve como lo mostraría tu cliente. El código está en [markdown-preview.ts](../examples/markdown-preview.ts).

## Para una IA

El bloque da el archivo y el id de la pantalla. Con el diseño abierto en Codaru, `./codaru context --scope ID --depth 2` devuelve su estructura exacta; así «desarrolla esta maqueta» apunta a algo concreto.

## Fuera de tu cliente

GitHub y otros visores no ejecutan esto: muestran el bloque como texto. Si el documento también debe verse allí, añade debajo una imagen de la pantalla: un archivo exportado (`./codaru export --format svg --frame ID --output ruta.svg`) o, al exportar el Markdown, la URL de `renderScreenToDataURL`.
