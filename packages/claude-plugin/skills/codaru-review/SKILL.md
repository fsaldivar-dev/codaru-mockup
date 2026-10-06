---
name: codaru-review
description: Revisar un diseño de Codaru Mockup y corregir sus problemas. Úsalo cuando pidan auditar, revisar, hacer lint, comprobar contraste, modo oscuro, accesibilidad o coherencia de un diseño abierto en Codaru.
---

# Revisar un diseño en Codaru Mockup

## Flujo

1. `./codaru lint` (o `--frame ID` para una pantalla). Devuelve `summary`, `issues` y, por cada hallazgo, `node`, `frame`, `rule`, `severity`, `message`, `mode` y `fix`.
2. Agrupa por causa, no por elemento: veinte textos con poco contraste suelen ser un solo color fijo repetido.
3. Corrige con un lote de `./codaru apply`, empezando por los errores. Valida antes con `--dry-run`.
4. Vuelve a ejecutar `./codaru lint` hasta que no queden errores. Los avisos y notas se corrigen o se justifican.

## Reglas y cómo resolverlas

| Regla | Qué significa | Corrección habitual |
| --- | --- | --- |
| `contrast` | El texto no llega a 4,5:1 (3:1 si es grande) contra su fondo real | `fix` dice la causa. Color fijo: cámbialo por un token que contraste en ambos modos. Token débil: ajusta su valor con la operación `theme`; se arreglan a la vez todos los textos que lo usan |
| `target` | Acción de menos de 44 × 44 | Amplía el elemento o su contenedor táctil |
| `text-size` | Texto de menos de 11 px | Súbelo; 12 para texto secundario |
| `text-fit` | El texto estimado no cabe en su caja | Amplía la caja o acorta el texto. Es una estimación: compruébalo en una exportación |
| `overflow` | Sobresale de la pantalla y se recorta | Recolócalo o usa auto layout |
| `safe-area` | Texto o acción bajo la barra de estado, la cámara o el indicador de inicio | Muévelo dentro de `safeArea` |
| `hinge` | Texto o acción cruza la línea del pliegue | Déjalo en un solo panel |
| `overlap` | Dos acciones se superponen | Sepáralas 8 o más |
| `off-theme` | Color fijo casi igual a un token | Sustitúyelo por el token indicado en `fix` |
| `alignment` | Bordes a 1–3 px de alinearse | Iguala `x`, o usa auto layout |
| `gradient` | Degradado entre un neutro oscuro y un acento cálido (negro a oro): a mitad de camino se vuelve oliva | Tonos de un mismo color o vecinos; separa negro y oro con línea o borde |
| `accent-fill` | Chip pequeño con un acento cálido saturado de fondo y texto oscuro encima: contrasta, pero parece una señal de aviso | Acento como texto, icono o borde, o tinte del acento (12–15 %) con texto en el acento oscurecido; el relleno sólido solo en la acción principal y superficies grandes |
| `scale` | Demasiados tamaños de texto o radios en una pantalla | Reduce la escala y vincula a tokens |
| `palette` | `@primary` del tema no contrasta 3:1 con el fondo (error), es un tono medio apagado sin saturación, o es un neutro y `@accent` tampoco tiene color (aviso): la paleta se lee como una sola banda | Cambia el color principal del tema con `theme`: un acento saturado o un neutro realmente oscuro; deja los tonos tierra y grises para superficies |

## Criterio

- `mode: "dark"` en un hallazgo de contraste significa que el diseño solo se revisó en claro. Es el fallo más común y casi siempre se arregla con tokens.
- No silencies un hallazgo cambiando el diseño a peor: bajar la opacidad del fondo para «pasar» el contraste no es una corrección.
- La revisión no ve la intención. Comprueba además lo que no detecta: que haya una acción principal clara, que la jerarquía se lea de arriba abajo y que cada postura de un plegable tenga sentido por sí sola.
- En la app, «Revisar el diseño» muestra lo mismo como lista y como mapa de calor sobre el lienzo.

## Qué entregar

El resumen antes y después (`errors`, `warnings`, `notes`), qué cambiaste agrupado por causa, y lo que queda sin corregir con su motivo.
