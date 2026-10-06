# Changelog

## Sin publicar

- Skill `codaru-design`: sección «Higiene del documento» con seis comprobaciones que toda pasada deja hechas: variantes en su contenedor, capas con nombre, sin componentes huérfanos, colores por token (sin `off-theme`), documentación sellada y sin pantallas sueltas; `codaru-review` las repasa.
- Documentación viva: cada ficha del sistema recuerda cómo era el componente (y los fundamentos, el tema) cuando se escribió. Si cambian después, Sistema lo marca en ámbar con «por revisar» y un contador en la pestaña, `lint` lo lista como `docs`, `context` lo expone (`docStale`, `designSystemStale`, `docsToReview`) y el plugin de Claude Code añade un hook que recuerda al agente actualizar la documentación tras cada `apply`. «Marcar como revisada» o un patch vacío dan la ficha por vigente.
- Pestaña **Sistema**: la documentación del sistema de diseño dentro del documento, como un sitio: índice con el avance, páginas de fundamentos (principios, color con contrastes medidos, tipografía dibujada, espaciado y radios, movimiento, voz) y una página por componente que responde qué es, por qué, cuándo y cómo, con variantes por eje, anatomía numerada y buenas y malas prácticas que pueden mostrar una capa del documento (`[ejemplo: ID]`). Modo lectura y botón Editar. Se guarda en el JSON; la IA lo lee en `context` y lo escribe con `designSystem.set` y `component.doc`.
- Panel izquierdo: la barra de inserción pasa a una fila compacta de iconos y el panel es más ancho, así Capas y Componentes tienen el espacio; las fichas de Componentes muestran una vista previa real de cada definición.
- Variantes: las definiciones de un conjunto viven juntas en un contenedor «Nombre · variantes» con auto layout en fila, en lugar de quedar sueltas en el lienzo.
- Variantes de componente: un conjunto agrupa definiciones por ejes (Estado, Tamaño…). Desde el inspector de un maestro, «Nueva variante» duplica el maestro junto al original como otra definición del conjunto y «+ Eje» añade un eje a todas; una instancia elige la variante por eje y conserva sus sobrescrituras por nombre de capa, manteniendo su id, posición y flujos. Los kits forman un conjunto por elemento con el eje Estado y materializan la definición que falte al cambiar. Figma importa los conjuntos de variantes como conjuntos con sus ejes. CLI: `variant.define`, `variant.create`, `variant.switch`; `context` lista los componentes con su conjunto.

## 0.4.0 — 2026-10-06

### Importar una web o una app existente

- `scripts/snapshot.js` (skill `codaru-clone`) se ejecuta dentro de cualquier página y captura lo visible: geometría, fondos y degradados, bordes, radios, sombras, tipografía, textos, SVG en línea e imágenes del mismo dominio (reducidas a 2× su tamaño en pantalla, 1,5 MB de tope, `images:false` para omitirlas). No envía nada a ningún sitio.
- Operación `dom` en `codaru apply`: importa la instantánea como una pantalla del tamaño del viewport, con un tema «Importado · dominio» derivado de los colores y las tipografías más usados, capas vinculadas a esos tokens, SVG saneados como ilustraciones e imágenes como imágenes; lo que no se pudo capturar queda anotado.
- Skill `codaru-clone`: replicar la app propia pixel a pixel para rediseñarla, o extraer la ficha de marca de un sitio (paleta, tipografía, ritmo, elemento firma, tono) y diseñar el producto propio con ese estilo sin copiarlo.

### Lienzo: la IA diseñando a la vista

- Cada lote del agente dibuja partículas que se asientan sobre lo creado o modificado, los elementos nuevos entran con un fundido, las pantallas vacías recién creadas se muestran como esqueleto y una píldora «Diseñando · N pantallas, N cambios» resume el progreso, con una burbuja de aumento al pasar el ratón. No reacciona a cambios manuales y respeta «Reducir movimiento».

### Revisión de diseño

- Nueva revisión: contraste en claro y oscuro contra el fondo real, zonas táctiles, texto pequeño o que no cabe, recortes, área segura, pliegue, acciones superpuestas, colores fuera del tema, desalineaciones y escalas. Lista por pantalla y mapa de calor en el lienzo. Comando `codaru lint [--frame ID]`, también para la IA.
- Regla `palette`: error si `@primary` no contrasta 3:1 con `@background`; aviso si es un tono medio apagado (croma OKLCH < 0,08) que ni destaca como acento ni ancla como neutro oscuro, o si es un neutro y `@accent` tampoco tiene color. Por tema en uso y en ambos modos; en el panel, bajo «Paleta del tema», abre Temas.
- Regla `accent-fill`: un chip pequeño (≤ 80 px) relleno con un acento cálido saturado y texto oscuro encima contrasta, pero se lee como señal de aviso.
- Regla `gradient`: un degradado que pasa por un tono oliva (neutro oscuro a acento cálido, como negro a oro) se embarra a mitad de camino.
- Ejemplos Forma y multiplataforma: el texto sobre color de marca usa tokens y pasan la revisión sin errores en claro y en oscuro.

### Skills para Claude Code (`packages/claude-plugin`)

- `codaru-design`: flujo con el CLI y principios de diseño; «Con referencias» (extraer paleta, tipografía, elemento firma, formas y barras con valores concretos y reproducirlos); «Paleta» con anclas; «El acento como fondo», «Indicadores» (3:1), «El blanco manda» y «Degradados que no embarran»; mínimos de entrega (protagonista por pantalla, un degradado real, animación de entrada, instancias de componentes, lint limpio). Incluye `references/ios-hig.md`, una síntesis de las Human Interface Guidelines de Apple (Liquid Glass, barras, búsqueda, hojas, tipografía, color, controles, movimiento) con una lista de comprobación para iPhone.
- `codaru-review`: auditar y corregir con el lint, regla por regla.
- `codaru-clone`: ver arriba.

### Editor

- Markdown: bloque ```` ```codaru-mockup ```` y entrada `codaru-mockup/preview` para que un cliente muestre pantallas en vivo dentro de un documento, como prototipo o estáticas, sin cargar el editor.
- Auto layout: padding por lado, reparto (inicio, centro, final, repartido), alineación transversal (estirar, inicio, centro, final), salto de línea, ajuste del contenedor al contenido y tamaño mínimo y máximo de los hijos. Sin estos campos el comportamiento es el anterior.
- Figma: el auto layout se conserva con alineación, padding por lado, salto de línea y ajuste al contenido solo cuando Codaru reproduce la misma geometría; el plugin exporta además los modos de tamaño y el estirado de cada hijo.
- Inspector: con un token de tipografía o de radio vinculado, los campos muestran el valor que realmente se dibuja y avisan del vínculo; editar uno desvincula el token y conserva los demás valores.
- Campos: al enfocarlos muestran un borde de 1 px en el color principal del tema, en Presentar, en Markdown y en el HTML exportado.
- Exportación SVG: las ilustraciones que usan `currentColor` toman el color del elemento; antes salían en negro.

## 0.3.0 — 2026-10-05

Animación, color, dispositivos y plegables, e importación desde Figma. El paquete sigue sin dependencias de ejecución.

**Cambio de comportamiento:** la rueda mueve el lienzo; el zoom pasa a ⌘/Ctrl + rueda y al pellizco.

- Pantallas: tamaños de dispositivo para iOS, Android, plegables y escritorio, con giro y clase de ancho (compacto, medio, expandido).
- Plegables: pliegue vertical u horizontal con ancho de bisagra, guía sobre el lienzo y transiciones «Desplegar» y «Plegar» en Presentar y en el HTML exportado: la pantalla exterior gira sobre la bisagra y deja ver los paneles interiores. Campos opcionales `device` y `fold`.
- Importación desde Figma: plugin `packages/figma-plugin` que exporta la selección o la página, e importador que añade pantallas, componentes, tokens e ilustraciones al documento con un informe de lo simplificado.
- Áreas seguras por pantalla (con guías en el lienzo) y marcos de dispositivo: barra de estado, isla o cámara, indicador de inicio y bisel al presentar.
- Plegables por categoría: iPhone Duo (cerrado y abierto) y, en Android, Pasaporte (libro), Flip (almeja) y Tríptico (doble bisagra, tres paneles).
- Posturas emparejadas: al presentar, y en el HTML exportado, un botón alterna entre la pantalla plegada y la desplegada.
- Ejemplo «iOS, Android y plegables»: Forma recreado en 21 pantallas para iPhone, iPhone Duo, teléfono Android, Pasaporte, Flip y Tríptico, en cada postura (`examples/Forma-dispositivos.codaru.json`).
- Selector de color propio en todos los campos de color (inspector, paleta del tema, editor de temas, paradas de degradado, materiales y animador): colores del tema, sólidos personalizados con transparencia, HEX y RGBA.
- Relleno: degradados personalizados con hasta 16 paradas (barra con paradas arrastrables, lineal o radial, ángulo), degradados del tema y doce sugerencias. Campo nuevo opcional `gradientStops`.
- Ilustraciones: sube un SVG (se sanea y cada forma queda como capa) y anímalo con el animador de fotogramas clave. También anima cualquier otro elemento.
- Animador: color de relleno y de borde por fotograma con selector y tokens del tema, y bases «Esqueleto» (pulso de color y brillo de carga).
- Transiciones entre pantallas por conexión: disolver, deslizar en cuatro sentidos y escalar, con duración y curva.
- Las animaciones y transiciones se reproducen en «Presentar» y en el HTML exportado; el lienzo y SVG siguen estáticos.
- IA/CLI: operaciones `vector` y `animate`, `transition` en `flow`, y `layers`/`animations` en el contexto.
- Relleno: el selector «Tipo» lista los degradados del tema; al elegir uno se vincula, se previsualiza y cambia con el tema y el modo.
- Lienzo: la rueda y los dos dedos del trackpad mueven el lienzo en vertical y horizontal. El zoom pasa a ⌘/Ctrl + rueda y pellizco; Shift + rueda desplaza en horizontal.

## 0.2.0 — 2026-10-02

Integración por piezas, sin iframe.

- `codaru-mockup/core`: sesión del editor sin DOM, con documento, selección por ámbitos, historial, transacciones validadas, suscripciones y API de IA.
- `codaru-mockup/modular`: `createEditorView()` monta lienzo, capas, inspector, biblioteca, barras y diálogos en contenedores separados del host, en Shadow DOM, con una sola sesión compartida.
- Los controles de la barra de vista se montan también por separado: `modes`, `designTheme` y `fit`.
- Apariencia del editor independiente de los temas del diseño: `setAppearance()`, tokens `--codaru-*` heredables y `::part()` por pieza.
- Desmontar una pieza o la vista confirma los campos en edición y conserva documento, selección e historial; varias sesiones permanecen aisladas.
- Ejemplo `examples/modular-host.html` y guía `docs/INTEGRATION.md`, con tamaños medidos por punto de entrada.
- `mountCodaru()` y el editor completo en iframe no cambian. El plugin Rust y el CLI no tienen cambios funcionales.

## 0.1.0 — 2026-10-02

Primera versión pública de Codaru Mockup.

- Editor embebible para aplicaciones Tauri, sin dependencias JavaScript de ejecución.
- Montaje/desmontaje, persistencia explícita, notificación de cambios y API TypeScript.
- Pantallas, selección por niveles, zoom, componentes, historial y prototipos navegables.
- Temas, modos claro/oscuro, degradados, tipografía, radios y simulación de vidrio.
- Cinco kits con 100 componentes y cuatro familias con 96 iconos vectoriales.
- API de IA con contexto acotado, catálogo, validación previa y lotes atómicos con revisión.
- Plugin Tauri 2 reutilizable y CLI opcional mediante socket Unix privado.
- Exportaciones JSON, HTML y SVG.

El CLI está verificado en macOS. El transporte para Windows, integración móvil y refracción dinámica de Liquid Glass no forman parte de esta versión.
