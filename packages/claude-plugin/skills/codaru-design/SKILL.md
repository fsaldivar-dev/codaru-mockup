---
name: codaru-design
description: Diseñar o modificar pantallas en Codaru Mockup con criterio profesional. Úsalo cuando pidan crear una maqueta, una pantalla, un flujo, adaptar un diseño a iOS, Android o plegables, o elevar, pulir o hacer más premium un diseño abierto en Codaru que se ve genérico.
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

## Principios que aplicar

**Jerarquía.** Tres niveles como máximo por pantalla: título, contenido y apoyo. La acción principal es el elemento de más peso visual; las secundarias, con menos color o solo con borde.

**Espaciado.** Usa una escala de 4: 4, 8, 12, 16, 24, 32, 48. Más espacio entre grupos que dentro de ellos. Márgenes laterales de 16 a 24 en teléfono. No coloques nada «a ojo»: si dos elementos están casi alineados, alinéalos.

**Tipografía.** De 4 a 6 tamaños por diseño, vinculados a tokens de tipografía. Cuerpo de 14 a 16; nada por debajo de 11. Líneas de 45 a 75 caracteres. Peso para jerarquía antes que tamaño.

**Color.** Todo color sale de un token del tema (`@primary`, `@text`, `@muted`, `@surface`, `@background`, `@border`, `@accent`). Un color fijo no cambia en modo oscuro: es la causa más frecuente de texto ilegible. Texto sobre un color de marca debe usar un token que también cambie con el modo.

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

## Elevar un diseño que se ve genérico

«Genérico» no se arregla añadiendo cosas: se arregla decidiendo. Antes de tocar nada, escribe una **dirección** en dos frases: qué debe sentir quien lo usa y qué hace a esta app distinta de otra del mismo tipo. Toda decisión posterior se justifica con esa dirección; si no la sirve, no se hace.

Después, en este orden:

1. **Un momento de marca por flujo.** Elige el elemento que la pantalla hará suyo (la bienvenida, el destacado, el estado vacío) y dale un tratamiento que el resto no tiene: un degradado del tema con 3 o 4 paradas, una ilustración animada, un título grande con un peso inesperado. Un solo momento; dos compiten.
2. **Tipografía con contraste.** Título de 28 a 34 con peso 700 o más y `lineHeight` de 1,1 a 1,2; cuerpo de 14 a 16 con peso 400; apoyos de 12 a 13 en `@muted`. Que el salto entre niveles se note; dos tamaños a 2 px de distancia es ruido.
3. **Profundidad en lugar de bordes.** Fondo `@background`, superficies `@surface`, lo elevado con sombra suave o con el material de vidrio del tema. Reserva el borde de 1 px para campos de formulario; el resto se separa con color de superficie y espacio.
4. **Un acento y neutros.** El color de marca va solo en la acción principal, el elemento activo y el momento de marca. Lo demás en neutros del tema. Si hay un segundo acento, es para estados (éxito, aviso), no para decorar.
5. **Ritmo.** Separación 24 a 32 entre bloques, 8 a 12 dentro de ellos; márgenes laterales iguales en toda la pantalla. Deja aire alrededor del momento de marca: el espacio es parte de él.
6. **Radios con intención.** Dos valores: uno para contenedores (16 a 24) y otro para controles (10 a 14). Botones de píldora solo en Android o cuando sea una decisión de marca.
7. **Detalle en lo pequeño.** Iconos del catálogo junto a las etiquetas de navegación, miniaturas con el tono de marca, un indicador de estado con color, textos de apoyo con contenido real en lugar de «Lorem» o «Texto».
8. **Movimiento contenido.** Entrada escalonada del contenido al llegar y una animación en el momento de marca. Nada más se mueve.
9. **Lo que se repite, componente.** Tarjetas, filas, botones: una definición, instancias con sobrescritura de texto.

**Lo que delata una plantilla, aunque esté bien hecho.** Evítalo salvo que la dirección lo pida por escrito:

- Degradado morado-rosa-naranja «de tendencia» como fondo del destacado.
- Destellos, estrellas y brillos como decoración; anillos y blobs abstractos como «ilustración».
- Animar todos los elementos. Si se mueve todo, nada importa: animan la entrada del bloque principal y el momento de marca, y poco más.
- Un segundo y tercer acento añadidos al tema «para dar vida». Si hace falta otro color, es un estado.

Evitarlos significa sustituirlos por algo propio, no borrarlos y dejar el hueco: si quitas una ilustración de catálogo, pon una propia; si quitas un degradado de tendencia, pon profundidad con material o con dos tonos cercanos del acento.
- Texto de relleno o genérico («Algo increíble está por tomar forma») donde cabe contenido real del producto.
- Pantallas del mismo flujo con tamaños o marcos distintos entre sí, o pantallas sueltas usadas como borrador y dejadas en el lienzo.
- Botones de navegación («Volver») flotando en un hueco en lugar de en la cabecera o en la barra.

Lo que sí distingue: una decisión tipográfica clara (por ejemplo, serif solo en títulos y marca), una paleta corta y segura, asimetría con intención, contenido verosímil, y un detalle propio repetido con constancia (una forma, un radio, una manera de marcar lo activo).

Comprueba al final: ¿se puede señalar en la pantalla lo que la hace distinta? ¿Hay una sola acción principal? ¿Cada elemento tiene un tamaño o peso que explica su importancia? Si una respuesta es no, vuelve a la dirección.

Explica a la persona cada decisión en una línea y qué alternativa descartaste. Lo premium se nota también en que las decisiones se pueden defender.

## Movimiento

Anima para explicar, no para decorar: entradas de 200 a 500 ms con `ease-out`, una sola cosa moviéndose a la vez, retrasos escalonados de 60 a 100 ms en listas. Estados de carga con las bases de esqueleto. Las animaciones solo se ven en Presentar y en el HTML exportado.

## Qué entregar

Di qué pantallas creaste o cambiaste, qué decisiones de diseño tomaste y por qué, y el resumen de `./codaru lint` final. Si dejaste algún aviso sin corregir, explica el motivo.
