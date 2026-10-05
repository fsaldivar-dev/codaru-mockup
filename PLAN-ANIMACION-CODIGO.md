# Animación, variantes y traducción a código

Plan de trabajo: animaciones (entregado), variantes y traducción a CSS, componentes y SwiftUI. Se basa en el modelo actual (`src/model.ts`, `src/themes.ts`, `src/render.ts`) y en conocimiento de las plataformas; las APIs de SwiftUI citadas deben confirmarse compilando contra cada SDK antes de darlas por buenas (ver «Cómo se garantiza que funciona»).

## Decisiones tomadas · 2026-10-05

- **Primero las animaciones.** Entregado: transiciones entre pantallas, ilustraciones SVG con animador y operaciones de IA/CLI (ver «Entregado»).
- **«Modificadores» eran variantes.** La sección 1 pasa a ser variantes de componente.
- **SwiftUI mínimo: iOS 15.** Se genera una sola rama compatible con iOS 15; las APIs de versiones posteriores quedan fuera salvo petición.
- **Ilustraciones ligeras.** Solo se reproducen en la vista previa y el HTML exportado, sin reproductor externo ni Lottie.

## Entregado

- `src/motion.ts`: saneado de SVG sin DOM, validación de animaciones y transiciones, y un reproductor basado en Web Animations que el HTML exportado incluye tal cual.
- `src/animator.ts`: animador de fotogramas clave, cargado bajo demanda.
- Campos opcionales en el documento: `svg`, `animations` y `transition`. Los proyectos v1/v2 existentes se abren sin cambios.
- Pendiente de esta fase: animación inteligente entre pantallas (emparejar capas por nombre), línea de tiempo visual y selección de capas con clic sobre la ilustración.

## Orden restante

1. **Variantes** de componente.
2. **Traducción a CSS/HTML y componentes web.**
3. **Traducción a SwiftUI** para iOS 15.

## 1. Variantes

Hoy los kits tienen tres estados visuales fijos (`default`, `selected`, `disabled`) que se eligen al insertar. La propuesta es que cualquier componente propio los tenga:

- Un componente maestro declara **variantes con nombre** (por ejemplo «Primario / Secundario» o «Normal / Pulsado / Deshabilitado»). Cada variante guarda solo las propiedades que cambian respecto a la base.
- Cada instancia elige su variante en Propiedades; sus sobrescrituras de texto se conservan al cambiar.
- En el prototipo, una variante puede activarse como estado (`hover`, `pressed`) con una transición, reutilizando el reproductor ya entregado.
- IA/CLI: operaciones `variant.add/update/remove` y `variant` en `instance` y `update`.
- En código: las variantes se traducen a `props` en componentes web y a un `enum` con `switch` de estilo en SwiftUI.

## 2. Traducción a código

### Arquitectura

Un paso común y un emisor por destino:

1. **Resolver**: tokens, herencia de tema por pantalla, instancias y sobrescrituras → árbol sin referencias.
2. **Representación intermedia (IR)**: `stack` (vertical, horizontal, superpuesto), `text`, `shape`, `image`, `icon`, `control`, más sus estilos, variantes y enlaces de navegación.
3. **Emisores**: CSS/HTML, componente web, SwiftUI. Cada uno declara qué soporta por versión y qué alternativa usa si no.
4. **Informe de fidelidad**: lista lo que se aproximó (por ejemplo, vidrio sin refracción) en vez de fallar en silencio.

El punto débil es el layout libre. Un elemento con «Organización: Libre» solo puede traducirse a coordenadas absolutas, que no se adaptan a otros tamaños. El exportador lo hará, lo marcará en el informe y ofrecerá «convertir en fila/columna» cuando los hijos estén alineados.

### Destinos web

| Destino | Salida | Notas |
| --- | --- | --- |
| CSS + HTML semántico | `tokens.css` con variables por tema y modo, clases por componente, flexbox para filas/columnas | Distinto de la exportación HTML actual, que es un prototipo autocontenido |
| Componente | React (TSX + CSS) y Custom Elements sin dependencias | Los componentes maestros se convierten en componentes con `props` para texto e instancias |

Dos perfiles de CSS:

- **Compatible**: flexbox, variables, `backdrop-filter` con prefijo `-webkit-`, `prefers-color-scheme`.
- **Moderno**: anidado nativo, `color-mix()`, `light-dark()`, consultas de contenedor, View Transitions y `@starting-style`.

### SwiftUI (mínimo iOS 15)

Se genera para iOS 15 / macOS 12, que es la fila base. Las filas siguientes quedan como referencia de lo que se ganaría subiendo el mínimo; no se emiten.

| Mínimo | Lo que se puede emitir | Alternativa en versiones anteriores |
| --- | --- | --- |
| iOS 15 / macOS 12 | `VStack/HStack/ZStack`, `.background(.ultraThinMaterial)`, `foregroundStyle`, `LinearGradient/RadialGradient`, `.animation(_:value:)` | Base de todo lo generado |
| iOS 16 / macOS 13 | `NavigationStack`, `Grid`, `.gradient` | `NavigationView` |
| iOS 17 / macOS 14 | `PhaseAnimator`, `KeyframeAnimator`, `containerRelativeFrame`, `.symbolEffect` | Animaciones encadenadas con `withAnimation` y retardos |
| iOS 18 / macOS 15 | `MeshGradient`, `navigationTransition(.zoom)` | Degradado lineal; transición estándar |
| iOS 26 / macOS 26 | `glassEffect()` (Liquid Glass) | Material `.ultraThinMaterial` con borde y sombra |

Correspondencias del modelo:

- **Tokens de color** → extensión de `Color` con variante clara/oscura; alternativa con catálogo de assets.
- **Tipografía** → `.font(.system(size:weight:design:))`; `serif` y `mono` usan `design`.
- **Degradados del tema** → `LinearGradient` con todas las paradas; el ángulo se convierte a `UnitPoint`.
- **Iconos**: Material y Lucide no son SF Symbols. Se exportan como SVG en el catálogo de assets; una tabla opcional y revisada a mano puede sugerir el SF Symbol equivalente.
- **Navegación** (`targetId`) → `NavigationLink` o cambio de estado, con la transición elegida.

### Cómo se garantiza que funciona

- **Web**: Playwright renderiza el código generado y lo compara con el lienzo por diferencia de píxeles con tolerancia.
- **SwiftUI**: el job de macOS del CI ejecuta `swiftc -typecheck` sobre lo generado, una vez por versión mínima. Sin esa comprobación no se anuncia una versión como soportada.
- **Pruebas de oro**: el ejemplo Forma y la galería de kits se exportan en cada destino y se comparan con salidas guardadas.
- **CLI**: `./codaru export --format css|react|element|swiftui --target ios17 --output DIR`, con el informe de fidelidad en JSON para que una IA pueda corregir el diseño.

## Decisiones pendientes

1. Componentes web: ¿React, Custom Elements o ambos?
2. ¿Se acepta que el layout libre se exporte con coordenadas absolutas y aviso?
3. ¿Las variantes deben poder combinarse en dos ejes (tipo × estado) o basta una lista simple?
