---
name: codaru-design
description: Diseñar o modificar pantallas en Codaru Mockup con criterio profesional. Úsalo cuando pidan crear una maqueta, una pantalla, un flujo, adaptar un diseño a iOS, Android o plegables, o mejorar el aspecto de un diseño abierto en Codaru.
---

# Diseñar en Codaru Mockup

Trabajas sobre el diseño abierto en la app, con el CLI local `./codaru`. No reconstruyas el documento entero ni uses clics: lee, propone un lote, valida y aplica.

## Flujo

1. `./codaru context` para ver selección, pantallas y la `revision`. Acota con `--scope ID --depth 1`.
2. `./codaru schema` lista operaciones, tamaños de dispositivo (`devices`) y campos. `./codaru catalog --kind kits|icons` lista recursos. No inventes ids.
3. Escribe un lote `{"expectedRevision": "...", "operations": [...]}`. Valida con `./codaru apply --file lote.json --dry-run` y aplica con el mismo archivo.
4. `./codaru lint` y corrige lo que señale (ver el skill `codaru-review`).
5. Revisa el resultado: `./codaru export --format svg --frame ID --output vista.svg`.

Ante `revision_conflict`, vuelve a leer el contexto; no reintentes a ciegas. Ante `editor_busy`, espera: la persona está editando.

## Antes de dibujar

Decide en una frase qué debe conseguir la pantalla y cuál es su acción principal. Una pantalla, una acción principal. Si hay dos que compiten, una es secundaria.

**Con referencias.** Si te dan capturas o un diseño existente, antes de dibujar extrae por escrito sus rasgos con valores concretos y reprodúcelos tal cual, no una «versión neutra» de ellos:

1. Paleta: fondo, superficie, texto, el neutro más oscuro y el acento, con HEX muestreados de la referencia. Si la referencia es crema + oro + negro, el tema es crema + oro + negro; no lo traduzcas a marrón y beige.
2. Tipografía: familia de títulos y de cuerpo, si usa cursivas, mayúsculas con espaciado o cifras especiales, y dónde.
3. Elemento firma: lo que hace reconocible la referencia (un número enorme, un aro, un botón negro, un *eyebrow* con el nombre). Repítelo en las pantallas nuevas.
4. Formas: radios, píldoras o círculos, grosor de bordes, sombras o material.
5. Barras y controles: cómo son la barra de pestañas, los botones y los deslizadores.

Nombra el tema con la marca y entrega una tabla rasgo → dónde está en el diseño. Lo que no aparezca en la tabla no se inventa.

## Principios que aplicar

**Jerarquía.** Tres niveles como máximo por pantalla: título, contenido y apoyo. La acción principal es el elemento de más peso visual; las secundarias, con menos color o solo con borde.

**Espaciado.** Usa una escala de 4: 4, 8, 12, 16, 24, 32, 48. Más espacio entre grupos que dentro de ellos. Márgenes laterales de 16 a 24 en teléfono. No coloques nada «a ojo»: si dos elementos están casi alineados, alinéalos.

**Tipografía.** De 4 a 6 tamaños por diseño, vinculados a tokens de tipografía. Cuerpo de 14 a 16; nada por debajo de 11. Líneas de 45 a 75 caracteres. Peso para jerarquía antes que tamaño.

**Color.** Todo color sale de un token del tema (`@primary`, `@text`, `@muted`, `@surface`, `@background`, `@border`, `@accent`). Un color fijo no cambia en modo oscuro: es la causa más frecuente de texto ilegible. Texto sobre un color de marca debe usar un token que también cambie con el modo.

**Paleta.** Una paleta tiene anclas: un fondo, una superficie, un neutro realmente oscuro y un acento saturado que marca la acción principal y el estado activo. `@primary` debe contrastar al menos 3:1 con `@background` y ser un color de verdad o un neutro oscuro, nunca un tono medio apagado (marrón, ocre, gris azulado); `./codaru lint` lo marca como `palette`. «Marrón sobre beige» o «gris sobre gris claro» no es una paleta, es un filtro: todo queda en una sola banda tonal y nada destaca. Los tonos tierra y los grises cálidos van en superficies y fondos, con un acento y un oscuro que los sostengan. Un aviso de `palette` pide una decisión de paleta, no un intercambio: mover el marrón de `@primary` a `@accent` y poner el negro del texto como `@primary` deja el mismo diseño sepia con botones negros, y el lint también lo detecta.

**Contraste.** 4,5:1 para texto normal y 3:1 para texto grande (24 px, o 18,5 px en negrita), en claro y en oscuro.

**Zonas táctiles.** 44 × 44 como mínimo (48 en Android), separadas al menos 8.

**Auto layout.** Prefiere `layout: vertical|horizontal` con `padding`, `gap`, `justify` y `align` a posiciones absolutas. Usa `sizing: fill` y `hugWidth`/`hugHeight` para que el diseño aguante cambios de texto y de tamaño.

**Componentes.** Lo que se repite es un componente (`component`, `instance`), no copias.

## Por plataforma

- **iOS:** sigue las Human Interface Guidelines, no un «estilo móvil» genérico. Ver el apartado «Diseñar para iOS» más abajo; antes de empezar pregunta qué versión mínima (iOS 15–18 clásico o iOS 26 con Liquid Glass) si no te la dieron.
- **Android:** botones con forma de píldora, indicador activo en la navegación, barra lateral a partir de 600 de ancho. Transiciones de escala o disolución.
- **Clases de ancho:** compacto (<600) una columna; medio (600 a 840) lista y detalle o barra lateral; expandido (≥840) dos o tres columnas.

## Diseñar para iOS

Lee `references/ios-hig.md` de este skill antes de diseñar una pantalla de iPhone: resume las Human Interface Guidelines de Apple (Liquid Glass, materiales, barras, búsqueda, hojas, composición, tipografía, color, controles y movimiento) con los números y las reglas, y termina con una lista de comprobación. Lo esencial:

- **Dos capas.** Controles y navegación (barra de pestañas, barras de herramientas, hojas, menús) van en la capa funcional de **Liquid Glass**, que flota sobre el contenido. El contenido (fondos, listas, tarjetas) nunca lleva cristal. Sin fondos de color en las barras; el color lo pone el contenido que pasa por debajo.
- **Tipografía del sistema con sus estilos** (Large Title 34, Title 1 28, Title 2 22, Title 3 20, Headline 17/600, Body 17, Callout 16, Subhead 15, Footnote 13, Caption 12/11) como tokens; cuerpo a 17, mínimo 11.
- **Navegación**: título grande que se encoge al desplazar, Atrás estándar; barra de pestañas flotante con pocas pestañas, etiquetas de una palabra y símbolos rellenos; búsqueda **abajo** o como pestaña separada al final; una sola acción prominente por barra, al final; máximo tres grupos de cristal.
- **Contenido**: lo textual en listas agrupadas con inserción, no en tarjetas con sombra; colores semánticos del tema; interruptores solo en filas; campos con etiqueta y botón Borrar; hojas con asa, Cancelar al inicio y Hecho al final.
- **Un botón prominente por pantalla**, 44 × 44 pt en todo lo tocable, estilo (no tamaño) para jerarquizar, rol destructivo en rojo y nunca primario.
- **Color escaso sobre cristal**: tinte solo en el fondo del botón prominente; barras monocromas si el contenido es colorido; todo funciona en claro, oscuro y contraste aumentado (4,5:1 mínimo, 7:1 para colores propios).
- **Movimiento con propósito**: transiciones de pila con deslizamiento, hojas hacia arriba; nada se mueve porque sí.
- **Concentricidad**: radios interiores concéntricos con sus contenedores; formas más redondeadas que en iOS 18.

**Versión mínima.** Pregunta cuál es si no te la dieron. Con iOS 26 o posterior aplica todo lo anterior. Con iOS 15–18 las barras son opacas o translúcidas pero no flotan, las hojas tienen menos radio y los botones son rectángulos redondeados de 12–14 en lugar de cápsulas; el resto (tipografía, listas, color, 44 pt, una acción prominente) es igual. No mezcles las dos en un mismo flujo.

**En Codaru.** El material `glass` del tema es una simulación (tinte, desenfoque, saturación, borde, sombra), sin refracción ni reacción al contenido: úsalo solo en la capa funcional y dilo cuando expliques el resultado. Inserta al menos un control con `{"op":"kit","kit":"ios",…}` para que exista el tema `kit-ios-v1`, y asigna `themeId: "kit-ios-v1"` y `kitId: "ios"` a cada pantalla. Los controles del kit (`./codaru catalog --kind kits --kit ios`) sustituyen a dibujar botones, campos, interruptores, segmentos, barras y hojas a mano.

## Plegables

- Diseña cada postura como una pantalla y enlázalas con `foldPair`: cerrado, abierto y, en un tríptico, dos paneles.
- No cruces el pliegue con texto ni acciones: un panel, un bloque de contenido. `fold.panels: 3` para tríptico.
- Al abrir no agrandes lo mismo: añade lo que en teléfono quedaba tras otra pestaña (lista y detalle, actividad).
- Usa `transition.type: "unfold"` entre la pantalla cerrada y la abierta.

## Movimiento

Anima para explicar, no para decorar: entradas de 200 a 500 ms con `ease-out`, una sola cosa moviéndose a la vez, retrasos escalonados de 60 a 100 ms en listas. Estados de carga con las bases de esqueleto. Las animaciones solo se ven en Presentar y en el HTML exportado.

## Qué entregar

Antes de dar por terminado un flujo, comprueba que tiene:

- Un **elemento protagonista por pantalla** (el número, el aro, el botón, la ilustración), no solo cabecera + tarjetas + barra.
- Un **degradado real** en el momento de marca: `gradientStops` de 3 o 4 paradas o un degradado del tema (`./codaru catalog` y las sugerencias del tema). Si en todo el flujo no hay ninguno, no está terminado.
- Una **animación de entrada** en Presentar y, si hay ilustración, una animación propia.
- **Instancias** de los componentes que definiste; definir componentes y luego dibujar copias es trabajo perdido.
- `./codaru lint` sin errores ni avisos de `palette`.

Di qué pantallas creaste o cambiaste, qué decisiones de diseño tomaste y por qué, la tabla de rasgos si hubo referencias, y el resumen de `./codaru lint` final. Si dejaste algún aviso sin corregir, explica el motivo.
