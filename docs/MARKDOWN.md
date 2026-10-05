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
| `tema` | `claro` u `oscuro` | el del diseño |
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

Para un solo bloque, o si tu motor permite registrar un renderizador por lenguaje, usa las piezas sueltas:

```ts
import { parseMockupBlock, renderMockup } from 'codaru-mockup/preview';

const bloque = parseMockupBlock(textoDelBloque);
const preview = renderMockup(elemento, await cargar(bloque.file), bloque);
preview.show('otra-pantalla'); preview.screen(); preview.destroy();
```

## Ejemplo para verlo

Con `npm run dev`, abre `http://127.0.0.1:1432/examples/markdown-preview.html`: a la izquierda editas el Markdown y a la derecha se ve como lo mostraría tu cliente. El código está en [markdown-preview.ts](../examples/markdown-preview.ts).

## Para una IA

El bloque da el archivo y el id de la pantalla. Con el diseño abierto en Codaru, `./codaru context --scope ID --depth 2` devuelve su estructura exacta; así «desarrolla esta maqueta» apunta a algo concreto.

## Fuera de tu cliente

GitHub y otros visores no ejecutan esto: muestran el bloque como texto. Si el documento también debe verse allí, añade debajo una imagen exportada de la pantalla (`./codaru export --format svg --frame ID --output ruta.svg`).
