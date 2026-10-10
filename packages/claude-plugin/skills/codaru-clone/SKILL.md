---
name: codaru-clone
description: Llevar una web o una app existente a Codaru Mockup. Úsalo cuando pidan clonar, replicar, importar o maquetar una página a partir de una URL, copiar el estilo o el branding de un sitio, o pasar una app ya hecha (web, React, SwiftUI) a pantallas de Codaru para rediseñarla.
---

# Importar una web o una app existente en Codaru Mockup

Dos modos, y lo primero es saber cuál piden:

- **Replicar**: la persona quiere su página o su app tal cual, pixel a pixel, para rediseñarla desde ahí. Resultado: pantallas que calcan la geometría, los colores y los textos reales.
- **Inspirarse**: la persona quiere el *concepto* y el *branding* de un sitio (paleta, tipografía, ritmo, tono) aplicados a su propio producto. Resultado: una ficha de marca y pantallas nuevas diseñadas con `codaru-design`, no una copia.

Si no está claro, pregunta. Replicar un sitio ajeno para publicarlo como propio no es un uso que debas ayudar a completar; replicar la app o la web de la propia persona, o inspirarse en el estilo de otra, sí.

## 1. Capturar la página

La captura la hace `scripts/snapshot.js` de este skill dentro de la página, en el navegador. Recoge los elementos visibles con su geometría y sus estilos calculados (fondos, degradados, bordes, radios, sombras, tipografía, color), los textos, los SVG en línea y las imágenes del mismo dominio. No envía nada a ningún sitio.

Cómo ejecutarlo, según lo que tengas:

- **Navegador integrado o Claude in Chrome**: abre la URL, fija el viewport al dispositivo que quieras (390 × 844 para iPhone, 1440 para escritorio), ejecuta el contenido de `snapshot.js` con la herramienta de JavaScript y después `JSON.stringify(codaruSnapshot())`. Guarda el resultado en un archivo `pagina.dom.codaru.json`.
- **Consola del navegador de la persona**: pega el script, ejecuta `codaruSnapshot({ download: true })` y pídele el archivo que se descarga.
- **Playwright u otra automatización**: `page.addScriptTag({ path: 'scripts/snapshot.js' })` y `page.evaluate(() => codaruSnapshot())`.

Opciones: `maxHeight` (6000 px por defecto) para páginas largas. Captura cada estado que importe por separado: menú abierto, pestaña activa, formulario con error. Cada captura es una pantalla.

Para una **app nativa** (SwiftUI, Android) no hay DOM: pide capturas de pantalla, mide con ellas y reconstruye con `codaru-design` usando el kit de la plataforma; si la app tiene una vista web o un storybook, captúralo con el script. Si la persona tiene el diseño en Figma, el plugin de Figma importa mejor que cualquier captura.

## 2. Importar

Una operación de `./codaru apply`:

```json
{ "expectedRevision": "…", "operations": [{ "op": "dom", "data": <contenido del .dom.codaru.json> }] }
```

Crea una pantalla del tamaño del viewport a la derecha de las existentes, un tema `Importado · dominio` con los colores de la página (`@background`, `@surface`, `@text`, `@muted`, `@primary`, `@border`, `@accent`) y tokens de tipografía para los estilos más usados, y vincula cada capa al token que coincide. Lo que no se pudo capturar queda anotado en el contexto de respuesta: imágenes de otro dominio (quedan como caja), fondos CSS, cursivas, fuentes no incluidas.

Comprueba con una exportación SVG que la pantalla se parece a la página. Lo habitual tras importar:

1. `./codaru lint` y corregir lo que señale.
2. Convertir las tarjetas repetidas en un componente con instancias (la importación deja copias).
3. Sustituir las cajas «(no capturada)» por imágenes reales o ilustraciones del catálogo.
4. Si la página tenía fuentes propias, elegir el equivalente más cercano (sistema, serif o mono) y anotarlo en la entrega.
5. Añadir flujos entre pantallas si se capturaron varios estados.

## 3. Modo inspirarse: la ficha de marca

Antes de diseñar nada, escribe la ficha a partir de la captura y de una exportación de la pantalla importada:

| Rasgo | Valor concreto |
| --- | --- |
| Paleta | HEX de fondo, superficie, texto, neutro oscuro y acento, con la proporción en que aparecen |
| Tipografía | familia de títulos y de cuerpo, escala (tamaños que usa), pesos, mayúsculas con espaciado, cursivas |
| Ritmo | márgenes laterales, separación entre bloques, altura de controles, radios |
| Elemento firma | lo que hace reconocible el sitio: un número enorme, un filete, un aro, un botón negro |
| Tono | cómo escribe: largo o corto, formal o directo, qué promete |

Después diseña las pantallas del producto de la persona con `codaru-design` aplicando la ficha, no copiando bloques de la página. No reutilices logotipos, ilustraciones ni textos del sitio original; ni las imágenes capturadas. Borra la pantalla importada al terminar si solo servía de referencia, o déjala aparte con el nombre «Referencia · dominio».

## Qué entregar

Qué se capturó y con qué viewport, qué quedó fuera (y por qué), la ficha de marca si fue modo inspirarse, y el resumen de `./codaru lint` final.

## Fuentes reales (0.10.0)

Consulta `./codaru catalog --kind fonts` y `./codaru fonts` antes de seleccionar fuentes. Usa el ID y una variante cargada; no reduzcas una fuente propia a system/serif/mono ni simules sus pesos. Los importadores conservan referencias pendientes para fuentes desconocidas y lo informan: el IDE registra sus archivos/variantes. Una revisión debe señalar fuentes ausentes, pesos no disponibles o recursos fallidos. La carga precede a medir o exportar. Comprueba edición, previsualización y exportación con texto editable; registra restricciones de inclusión/licencias del consumidor. Las dimensiones y restricciones explícitas mandan; no impongas recetas por sector ni posiciones tipográficas.
