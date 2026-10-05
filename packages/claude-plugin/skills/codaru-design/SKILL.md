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

- **iOS:** radios de 10 a 14, barra de pestañas inferior con 3 a 5 destinos, navegación por deslizamiento. Respeta `safeArea`: nada interactivo bajo la isla ni sobre el indicador de inicio.
- **Android:** botones con forma de píldora, indicador activo en la navegación, barra lateral a partir de 600 de ancho. Transiciones de escala o disolución.
- **Clases de ancho:** compacto (<600) una columna; medio (600 a 840) lista y detalle o barra lateral; expandido (≥840) dos o tres columnas.

## Plegables

- Diseña cada postura como una pantalla y enlázalas con `foldPair`: cerrado, abierto y, en un tríptico, dos paneles.
- No cruces el pliegue con texto ni acciones: un panel, un bloque de contenido. `fold.panels: 3` para tríptico.
- Al abrir no agrandes lo mismo: añade lo que en teléfono quedaba tras otra pestaña (lista y detalle, actividad).
- Usa `transition.type: "unfold"` entre la pantalla cerrada y la abierta.

## Movimiento

Anima para explicar, no para decorar: entradas de 200 a 500 ms con `ease-out`, una sola cosa moviéndose a la vez, retrasos escalonados de 60 a 100 ms en listas. Estados de carga con las bases de esqueleto. Las animaciones solo se ven en Presentar y en el HTML exportado.

## Qué entregar

Di qué pantallas creaste o cambiaste, qué decisiones de diseño tomaste y por qué, y el resumen de `./codaru lint` final. Si dejaste algún aviso sin corregir, explica el motivo.
