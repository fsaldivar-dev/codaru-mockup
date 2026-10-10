# Changelog

## 0.10.0 - 2026-10-09 (preparado, sin publicar)

- Tipografía extensible por consumidor: fuentes locales o por URL, pesos/estilos declarados, catálogo aislado y estados de carga/errores. Texto siempre editable y compatibilidad system/serif/mono y documentos v1/v2.
- API core/modular/iframe, entrada `codaru-mockup/fonts`, catálogo/esquema/contexto del agente y CLI `fonts`. Inspector y tokens muestran fuentes registradas; componentes heredan y conservan sobrescrituras de cursiva. Importaciones preservan familias desconocidas sin sustitución.
- Medición real tras cargar las fuentes; HTML/SVG asíncronos incluyen archivos autorizados y texto editable. PNG/ZIP utilizan esos archivos y rechazan referencias incompletas. Diagnósticos explícitos para fuentes o variantes ausentes.
- Documentación de permisos, licencias y restricciones; guía para actualizar Sajaru desde 0.8.0 y reemplazar su validación fija por el catálogo. No se añaden plantillas, fuentes por estilo ni servidor en ejecución.

## 0.9.0 - 2026-10-09

- Contratos por capa de accesibilidad, analítica y pruebas: paneles independientes personalizables y acceso desde el inspector; eventos con propósito, disparador y esquema; roles/nombres localizados, teclado/foco/estados y criterios de aceptación. Reporte portable con revisión exacta, vínculos de implementación, orientación por plataforma y verificaciones automatizables/manuales. API core/iframe y CLI `experience`/`experience.set`. Sin colector de datos ni SDK; revisión de diseño sin certificación WCAG.
- Anotaciones visuales compactas y cola ordenada de correcciones: envío de un lote al IDE o exportación JSON, conservación ante fallos/cambios concurrentes y propuestas separadas de cambios aplicados.

## 0.8.0 — 2026-10-09

- Comentarios del layout: hilos anclados a una selección, marcadores en el lienzo, respuestas, resolver/reabrir, borradores preservados y aviso cuando cambia o desaparece el objeto. Panel opcional `codaru-mockup/comments`, hooks `subscribeComments` y comando CLI `comments`. La IA del IDE propone; los ajustes al diseño siguen las transacciones con revisión.
- Identity Lab: brief vivo, referencias con procedencia, direcciones comparables, crítica ligada a renders y revisión exacta, decisiones, refinamiento localizado y entrega portable. Seis paneles independientes en `codaru-mockup/identity`; el host aporta la IA y persistencia.
- Composición reutilizable: instancias anidadas, propagación por dependencias, validación de ciclos, propiedades semánticas y slots intercambiables. Sobrescrituras locales y cambios estructurales en maestros; referencias de implementación por plataforma mediante puertos del IDE.
- Localización: claves, catálogos proporcionados por el IDE, cambios de idioma en la vista previa y solicitudes de traducción. No duplica pantallas ni incorpora un servicio de traducción.
- Recursos ARU: helper opcional para conservar fuentes editables, insertarlas y animarlas. Biblioteca local con candidatos, renders reales y admisión por evaluación visual de la IA del IDE; exportaciones SVG, PNG, fuente ARU y ZIP con imagesets iOS/drawables Android.
- Estilos importables: tokens, degradados y guías de composición propias. La biblioteca no obliga a una plantilla de layout. Los ejemplos Musaru y HILO demuestran composiciones de escritorio y móvil.
- Paneles coherentes: sistema común de apariencia, densidad, estados y controles; fragmentos personalizables en Shadow DOM, con nonce CSP heredado para Tauri. Los marcadores de comentario son transparentes y no interfieren con gestos del lienzo.
- Render: reutilización de contenido y cachés locales a la sesión, notificaciones de cámara sin snapshots extra y carga progresiva de miniaturas. Las cifras de rendimiento se mantienen en pruebas y evidencia local, sin atribuir mejoras a todos los consumidores.
- Compatibilidad: mantiene documentos v1/v2, aislamiento entre instancias, persistencia explícita y desmontaje que confirma ediciones. Declaraciones TypeScript compatibles con Bundler y NodeNext. El editor continúa sin dependencias de interfaz ni servidor Node en ejecución. El plugin Rust se distribuye como fuente; no se publica en crates.io.

## 0.7.0 — 2026-10-07

- Render headless: `renderScreenToSVG(document, { screen?, theme?, maxWidth?, mode: 'static' })` dibuja una pantalla como SVG autocontenido sin `window`, `document` ni canvas, y `renderScreenToDataURL` lo devuelve como URL `data:` apta para `<img src>` y Markdown. Valida el documento como `renderMockup` y se ve como la vista previa estática (prueba de píxeles: menos del 1 % distinto en cinco pantallas). Nueva entrada `codaru-mockup/svg` (119,7 kB, 39,2 kB gzip); también en `preview` y `core`. `core` pasa de 128 kB a 144 kB porque su exportación SVG usa ahora este dibujo.
- `screens(document)` acepta JSON o un objeto, lo valida y devuelve las pantallas en orden de lectura con `id` estable, `name`, `role` y `page`. Sin `pantalla:`, la vista previa abre la primera pantalla en ese orden y su selector lista las pantallas así.
- Tema por tokens: `theme` en `renderMockup`, `enhanceMarkdown` y `renderScreenToSVG` acepta `light`, `dark` o un mapa de colores de Codaru (`--codaru-primary`, `--primary` o `primary`, con `mode` opcional).
- La exportación SVG del editor y de `codaru export --format svg` usa el mismo dibujo: bordes dentro de la caja, hijos desplazados por el borde, recorte de marcos anidados, degradados con la geometría de CSS, barra de estado e isla del dispositivo, y pesos intermedios de la fuente del sistema con su eje variable. Mide el texto con la tipografía real del navegador.
- La vista previa estática ya no pinta las bandas de área segura, que son una ayuda de edición.

## 0.6.0 — 2026-10-06

- Páginas: el panel Páginas agrupa las pantallas en módulos; solo la página activa se dibuja, se lista y se mide. Las pantallas se mueven de página desde Propiedades, los flujos pueden apuntar a cualquier página y Presentar recorre todas. Los documentos anteriores abren con una página «Página 1» sin cambiar. CLI: operación `page {action: create|rename|remove|move|activate, id, name?, index?, moveTo?}` (`remove` con contenido exige `moveTo`), campo `page` en los marcos raíz, `context --page` con `frames` y `nodes` por página, `lint --page`, `export --page`. Se aceptan los alias `page.*` y el campo `pageId`.
- Rol de los marcos: `role: screen | annotation | library` en los marcos raíz (Propiedades → Página y rol). Sin rol, un marco con dispositivo es pantalla y sin él anotación; los marcos nuevos quedan como pantalla. La revisión solo mide zonas táctiles, área segura y pliegue en pantallas y avisa (`role`) cuando un marco sin rol ni dispositivo contiene controles. El paquete exporta `screens(p)`, `roleOf`, `pagesOf` y `pageView`.
- Agente: comando `find {query, frame?, page?, type?, limit?}` que devuelve id, nombre, tipo, pantalla y página de cada coincidencia. Los errores de `apply` indican la operación, el campo y el valor esperado («op 3 (update): patch.fill debe ser HEX, "transparent" o "@alias"; llegó "rojo"») y `--dry-run` lista todas las operaciones que fallan. El CLI y el puente aceptan `find` y `versions`.
- Selector de tema en la barra superior: lista los temas definidos y cambia entre ellos sin abrir la configuración.
- Versiones: hitos con nombre, fecha y nota guardados comprimidos dentro del documento (hasta 30), con comparación por pantallas y restauración reversible. Diálogo «Versiones» en la barra superior; CLI `version.save`, `version.restore`, `version.remove` y comando `versions`.
- Rendimiento: mover el lienzo, seleccionar y arrastrar ya no clonan ni serializan el documento; cada pantalla conserva su DOM entre cambios y solo se redibuja la que cambió; la lista de capas se pliega por pantalla en páginas grandes y la selección solo toca sus filas; el lienzo omite el pintado de las pantallas fuera de la vista; validación y auto layout usan índices en lugar de recorrer la lista por nodo. En un documento de 50 pantallas y 2000 capas: un cambio pasa de 285 ms a 58 ms y seleccionar de 78 ms a 2 ms. Prueba de rendimiento (`tests/ui/perf.spec.ts`): 80 pantallas y 2080 capas cargan en menos de 0,5 s y mover el lienzo cuesta 0,1 ms por evento.
- Editor modular: partes nuevas `pages` (panel de páginas) y `system` (índice de la pestaña Sistema); con partes montadas, cambiar de pestaña ya no oculta Capas ni Componentes.
- Banco de recursos gratuitos en Componentes → Recursos: iconos e ilustraciones de Iconify (colecciones de código abierto, insertados como ilustración editable en el color de texto), fotos Creative Commons de Openverse (uso comercial y modificación) y fotos de relleno de Lorem Picsum. Búsqueda bajo demanda con arrastrar o clic; cada capa guarda en su nombre título, autor y licencia. Sin conexión, la pestaña lo indica y el resto del editor sigue igual. La app nativa permite esos tres dominios en su CSP.

## 0.5.0 — 2026-10-06

### Variantes de componente

- Un conjunto agrupa definiciones por ejes (Estado, Tamaño…). Desde el inspector de un maestro, «Nueva variante» duplica el maestro como otra definición del conjunto y «+ Eje» añade un eje a todas; una instancia elige la variante por eje y conserva sus sobrescrituras por nombre de capa, manteniendo su id, posición y flujos.
- Las definiciones de un conjunto viven juntas en un contenedor «Nombre · variantes» con auto layout en fila.
- Los kits forman un conjunto por elemento con el eje Estado (Normal, Seleccionado, Deshabilitado) y materializan la definición que falte al cambiar. Figma importa los conjuntos de variantes como conjuntos con sus ejes.
- CLI: `variant.define`, `variant.create`, `variant.switch` y `component.remove` (definiciones sin instancias, con su maestro); `context` lista los componentes con su conjunto.

### Pestaña Sistema: la documentación del sistema de diseño

- Un sitio de documentación dentro del documento: índice con el avance, páginas de fundamentos (principios, color con los contrastes medidos, tipografía dibujada, espaciado y radios, movimiento, voz) y una página por componente que responde qué es, por qué, cuándo y cómo, con las variantes dibujadas por eje, la anatomía numerada de sus capas y buenas y malas prácticas que pueden mostrar una capa del documento (`[ejemplo: ID]`). Modo lectura y botón Editar.
- Documentación viva: cada ficha recuerda cómo era el componente (y los fundamentos, el tema) cuando se escribió. Si cambian después, Sistema lo marca en ámbar con «por revisar» y un contador en la pestaña, `lint` lo lista como `docs` y `context` lo expone (`docStale`, `designSystemStale`, `docsToReview`). «Marcar como revisada» o un patch vacío dan la ficha por vigente.
- CLI: `designSystem.set` (summary, brand, principles, color, typography, spacing, motion, voice) y `component.doc` (description, why, when, how, do, dont).

### Editor

- Panel izquierdo más ancho con la barra de inserción en una fila compacta de iconos; las fichas de Componentes muestran una vista previa real de cada definición y agrupan los conjuntos.

### Plugin de Claude Code

- Hook `PostToolUse`: tras cada `codaru apply` real, recuerda al agente las fichas desactualizadas, los fundamentos escritos para un tema que cambió y los conjuntos propios sin documentar, sin repetirse mientras la situación no cambie.
- `codaru-design`: cómo escribir cada página del sistema (cuatro preguntas, prácticas con ejemplo dibujado, prioridad por uso) y la sección «Higiene del documento» con seis comprobaciones que toda pasada deja hechas; `codaru-review` las repasa y documenta la regla `docs`.

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
