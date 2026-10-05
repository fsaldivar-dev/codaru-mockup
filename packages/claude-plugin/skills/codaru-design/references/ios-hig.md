# Referencia: diseñar para iOS según las Human Interface Guidelines

Síntesis, en palabras propias, de las páginas de las HIG de Apple leídas el 5 de octubre de 2026 (Designing for iOS, Adopting Liquid Glass, Materials, Layout, Typography, Color, Dark Mode, Buttons, Tab bars, Toolbars, Lists and tables, Sheets, Search fields, Text fields, Toggles, Segmented controls, Menus, Alerts, Popovers, Motion). Donde las HIG no dan un número, se indica si el valor viene de UIKit o de la práctica, para no confundirlo con una regla oficial. La fuente manda: `developer.apple.com/design/human-interface-guidelines`.

## 1. Lo que define una app de iPhone (Designing for iOS)

- Pantalla mediana de alta densidad, sostenida con una o dos manos a 30–60 cm. Lo que está en el **centro y la mitad inferior** es más fácil de alcanzar: ahí van la navegación y las acciones frecuentes; deslizar para volver y acciones por deslizamiento en filas son parte de la plataforma.
- **Pocos controles en pantalla.** Lo secundario se descubre con una interacción mínima (menú, deslizamiento, hoja), no se amontona.
- La app debe adaptarse sola a **orientación, modo oscuro y Dynamic Type**. No se ofrece un ajuste de apariencia propio: se respeta el del sistema.
- Integra lo que el sistema ya da (widgets, búsqueda, Siri, acciones rápidas, biometría) antes de inventar equivalentes.

## 2. Liquid Glass: la capa funcional (Materials, Adopting Liquid Glass)

**Qué es.** Un material dinámico con óptica de vidrio y comportamiento fluido que forma **una capa funcional distinta** para controles y navegación (barras de pestañas, barras de herramientas, barras laterales, hojas, menús). Flota sobre el contenido; el contenido se desplaza por debajo y se transparenta.

**Reglas de uso.**
- **Nunca en la capa de contenido.** Fondos de la app, tarjetas y listas usan superficies normales; el cristal es solo para lo que navega o actúa. Excepción: el pomo de un deslizador o un interruptor se vuelve cristal mientras se arrastra.
- **Con moderación.** Los componentes del sistema ya lo traen; aplicarlo a controles propios se limita a los elementos funcionales más importantes. Varios elementos de cristal superpuestos o amontonados es un error.
- **Dos variantes.** *Regular*: difumina y ajusta la luminosidad del fondo para mantener legible el texto; es la de casi todos los componentes del sistema y la adecuada cuando hay bastante texto (alertas, barras laterales, popovers). *Clear*: muy translúcida, solo sobre fondos visualmente ricos (fotos, vídeo); si el fondo es claro se añade una capa de atenuación oscura al 35 %.
- **Sin fondos propios en barras.** Un fondo de color detrás de una barra de pestañas, de herramientas o de navegación interfiere con el material y con el *efecto de borde al desplazar*, que oscurece el contenido que pasa bajo los controles para mantener la legibilidad. El color de la barra lo pone el contenido que hay debajo.
- **El cristal no tiene color propio.** Toma el del contenido. Se tiñe solo lo que necesita énfasis (la acción principal, un indicador de estado), y el tinte va en el **fondo** del control, no en su texto o símbolo. Nunca varios controles teñidos a la vez. Si el contenido es colorido, barras y pestañas monocromas.
- **Concentricidad.** La curvatura del hardware informa la de los controles. Los radios de un elemento anidado son concéntricos con su contenedor: radio interior = radio exterior − margen. Controles, hojas, popovers y ventanas son más redondeados que antes.
- **Accesibilidad.** La transparencia y el movimiento del material se reducen con «Reducir transparencia», «Aumentar contraste» y «Reducir movimiento»; el diseño debe seguir funcionando sin ellos.

**Materiales estándar (capa de contenido).** iOS mantiene cuatro: *ultraThin*, *thin*, *regular* (por defecto) y *thick*. Más grueso = más opaco = mejor contraste para texto; más fino = más contexto del fondo. Sobre materiales se usan colores *vibrantes* del sistema para etiquetas (`label`, `secondaryLabel`, `tertiaryLabel`; `quaternaryLabel` no sobre thin/ultraThin), rellenos (`fill`, `secondaryFill`, `tertiaryFill`) y un separador.

**En Codaru.** El material `glass` del tema simula tinte, desenfoque, saturación, borde y sombra. **No hay refracción, reflejos ni cambio de tono según el contenido.** Úsalo solo en la capa funcional (barra de pestañas, barra de herramientas, hoja, menú), nunca en tarjetas o fondos, y dilo así cuando lo expliques.

## 3. Navegación y barras (Tab bars, Toolbars, Search fields, Sheets)

**Barra de pestañas.**
- Para **navegar entre secciones**, nunca para acciones. Visible siempre salvo bajo un modal. No se ocultan ni desactivan pestañas aunque su contenido no esté disponible: se explica el vacío dentro.
- Pocas pestañas; evitar que aparezca «Más». Etiqueta de **una palabra** bajo cada icono. Iconos SF Symbols **rellenos**.
- En iOS **flota sobre el contenido en la parte inferior**, con fondo de Liquid Glass. Puede **minimizarse al desplazar** (y volver al tocar o al llegar arriba). Puede llevar un **accesorio** (como el reproductor mínimo de Música) que se alinea con ella al minimizarse.
- Puede tener una **pestaña de búsqueda** separada al final (ver Búsqueda). Insignia roja solo para información crítica.
- Si el contenido es colorido, pestañas monocromas o acento con diferenciación suficiente.
- *Métricas de UIKit, no de la HIG:* 49 pt de alto en teléfono más el área segura inferior; icono ≈ 24–28 pt; etiqueta ≈ 10 pt.

**Barra de herramientas y barra de navegación** (las HIG las tratan juntas; en iOS la de arriba se llama barra de navegación).
- Contiene título, controles de navegación (atrás, búsqueda) y acciones. Lo contrario de la barra de pestañas: **actúa sobre la vista**.
- **Título grande** en el primer nivel, que pasa a título estándar al desplazar y vuelve al llegar arriba. Título breve (menos de 15 caracteres); nunca el nombre de la app.
- Botones **Atrás** y **Cerrar** estándar con sus símbolos: no un texto «Atrás» ni una «X» inventada.
- Pocos elementos: lo esencial en la barra y lo demás en un menú **Más**. Símbolos del sistema **sin borde** (el grupo ya da el contenedor), y texto solo para acciones que un símbolo no expresa (Editar). No mezclar texto e icono dentro de un mismo grupo de cristal; si hay varios botones de texto, espaciador fijo entre ellos.
- **Agrupación**: borde inicial (atrás, mostrar barra lateral, título), centro (controles comunes), borde final (acciones que deben permanecer, inspectores, búsqueda, Más, y la acción principal). Agrupar por función y frecuencia; máximo **tres grupos**. Cada grupo comparte un fondo de cristal.
- **Una sola acción principal** con estilo `.prominent` (Hecho, Enviar), teñida, al final de la barra.
- Sin fondos ni tintes propios en la barra; usar el efecto de borde al desplazar para separarla del contenido. Componentes estándar dentro, con radios concéntricos con la barra.

**Búsqueda (iOS).** Tres sitios: como pestaña, en una barra de herramientas o en línea con el contenido.
- **Pestaña de búsqueda**, siempre al final y separada del resto: estilo *estándar* (lleva a una página de búsqueda con sugerencias; para explorar) o *botón* (abre el teclado directamente; para resolver rápido).
- **En una barra inferior** cuando la búsqueda es prioritaria: campo expandido o botón según el espacio; al tocarlo sube con el teclado. Ejemplos: Ajustes (único elemento), Mail y Notas (junto a otros controles).
- **Arriba** solo si hay que respetar contenido en la parte inferior o no hay barra inferior.
- **En línea** sobre la lista que filtra, cuando la posición refuerza el alcance; puede fijarse arriba al desplazar.
- Texto de marcador que explique qué se puede buscar; resultados mientras se escribe; sugerencias y recientes; barra de ámbito y *tokens* para acotar.

**Hojas.**
- Para una tarea acotada y relacionada con el contexto; para flujos largos, vista a pantalla completa.
- Modal o no modal (una hoja no modal deja actuar sobre la vista de detrás, como el formato de texto en Notas).
- **Cancelar** al inicio de la barra superior, **Hecho** al final; Hecho siempre acompañado de Cancelar o Atrás; nunca los tres a la vez. Una sola hoja a la vez.
- **Detents**: *large* (completa) y *medium* (≈ mitad), más valores propios. Incluir el **asa** (grabber) si es redimensionable; soportar deslizar para cerrar, con hoja de acción de confirmación si hay cambios sin guardar.
- Con Liquid Glass las hojas tienen **más radio**, las medias quedan **separadas del borde** dejando ver el contenido, y al expandirse a completa se vuelven más opacas. Las **hojas de acción** salen del control que las origina, no del borde inferior.

## 4. Composición (Layout)

- **Orden de lectura**: lo importante arriba y al inicio. Alinear para que se pueda escanear; sangrar para mostrar subordinación. Agrupar con espacio, contenedores o separadores.
- **Revelación progresiva**: menos cosas a la vez; disclosure, menús, vistas anidadas y secciones desplazables.
- **Diferenciar controles de contenido** con el material y el efecto de borde, no con una banda de color. El fondo a pantalla completa se extiende bajo barras laterales, de herramientas y de pestañas.
- **Área segura**: nada de contenido ni controles bajo la isla dinámica, la barra de estado, el indicador de inicio o una barra. Respetar márgenes y guías del sistema.
- **Clases de tamaño**, no tipo de dispositivo ni orientación: compacto/regular en horizontal y vertical. Mantener la misma funcionalidad al cambiar; con más espacio, barra de pestañas → barra lateral.
- **Dynamic Type**: el diseño debe aguantar tamaños grandes: filas que crecen, elementos en horizontal que pasan a vertical, menos columnas.
- **Zona táctil mínima 44 × 44 pt**, con espacio alrededor para distinguir cada control.
- *Métricas habituales, no de la HIG:* márgenes laterales 16 pt en teléfono (20 en pantallas anchas); barra de navegación 44 pt más barra de estado, título grande ≈ 52 pt adicionales.

## 5. Tipografía (Typography)

- SF Pro es la fuente del sistema; New York (NY), la serif del sistema. Minimizar familias; evitar pesos Ultralight, Thin y Light. En Codaru: `system` ≈ SF Pro, `serif` ≈ NY, `mono` ≈ SF Mono.
- **Tamaño por defecto 17 pt; mínimo 11 pt** (iOS). Jerarquía con peso, tamaño y color, manteniéndola al cambiar el tamaño de texto.
- **Estilos de texto** (tamaño Large, el predeterminado) — defínelos como tokens de tipografía:

| Estilo | Peso | Tamaño | Interlineado | Énfasis |
| --- | --- | --- | --- | --- |
| Large Title | Regular | 34 | 41 | Bold |
| Title 1 | Regular | 28 | 34 | Bold |
| Title 2 | Regular | 22 | 28 | Bold |
| Title 3 | Regular | 20 | 25 | Semibold |
| Headline | Semibold | 17 | 22 | Semibold |
| Body | Regular | 17 | 22 | Semibold |
| Callout | Regular | 16 | 21 | Semibold |
| Subhead | Regular | 15 | 20 | Semibold |
| Footnote | Regular | 13 | 18 | Semibold |
| Caption 1 | Regular | 12 | 16 | Semibold |
| Caption 2 | Regular | 11 | 13 | Semibold |

  En Codaru, `lineHeight` = interlineado ÷ tamaño (Body 22/17 ≈ 1,3; Large Title 41/34 ≈ 1,2).
- El título grande de la barra es Large Title en **Bold**. Los encabezados de sección de listas usan ahora **capitalización de título**, no mayúsculas.
- Tracking: SF Pro aprieta entre 13 y 23 pt (−6 a −26 milésimas de em) y abre a partir de 24 pt; NY abre en tamaños pequeños y aprieta en grandes. Codaru no ajusta el tracking; no es necesario para una maqueta.

## 6. Color y modo oscuro (Color, Dark Mode)

- **Un color, un significado.** El color de marca que marca interactividad no se usa para texto decorativo.
- Todo color debe funcionar en **claro, oscuro y contraste aumentado**. Un color propio lleva variantes clara y oscura aunque la app sea de una sola apariencia, porque el cristal las necesita.
- **Colores semánticos**, no valores fijos: fondos *system* (systemBackground, secondary, tertiary) para vistas normales y *grouped* para listas agrupadas; primario para la vista, secundario para agrupar, terciario dentro de lo secundario. Etiquetas `label`, `secondaryLabel`, `tertiaryLabel`, `quaternaryLabel`; `placeholderText`, `separator`, `link`. No se redefine su significado (el separador no es un color de texto).
- En oscuro los colores no son la inversión del claro; hay fondos *base* y *elevated* para dar profundidad entre capas. Contraste **mínimo 4,5:1**; para colores propios, apuntar a **7:1** sobre todo en texto pequeño. Atenuar imágenes con fondo blanco en oscuro.
- Con Liquid Glass: color escaso; énfasis en el **fondo** del botón prominente (acento) y nada más; etiquetas monocromas en barras si el contenido es colorido; sin solapar colores parecidos entre contenido y controles en el estado de reposo.
- En Codaru: `@background` ≈ systemBackground/systemGroupedBackground, `@surface` ≈ secondarySystemGroupedBackground (la celda), `@text` ≈ label, `@muted` ≈ secondaryLabel, `@border` ≈ separator, `@primary` ≈ acento. Texto sobre el acento con un token que cambie con el modo (`@surface`), nunca `#ffffff` fijo.

## 7. Controles (Buttons, Toggles, Segmented controls, Text fields, Lists)

**Botones.**
- Zona de 44 × 44 pt mínimo y estado pulsado siempre.
- Estilo = tamaño + color + forma; contenido = símbolo, texto o ambos; rol = normal, **primario**, cancelar, **destructivo** (rojo del sistema). El primario nunca es destructivo.
- **Uno o dos botones prominentes por vista**; la jerarquía se marca con **estilo, no con tamaño** (dos botones de distinto tamaño juntos confunden).
- Si el contenido es colorido, etiquetas de botón monocromas.
- Con Liquid Glass hay estilos `glass` y `glassProminent` (UIKit: glass, prominentGlass, clearGlass); forma más redondeada, nueva talla extra grande; los botones se transforman en menús y popovers con fluidez.
- Un botón que tarda muestra un indicador de actividad y puede cambiar su texto («Pagando…»).
- *Métricas habituales, no de la HIG:* botón prominente ≈ 50 pt de alto; estilos UIKit *plain*, *gray*, *tinted* (acento al ~15 %) y *filled*; con cristal, forma de cápsula.

**Interruptores** solo dentro de una fila de lista, sin etiqueta propia; fuera de una lista, un botón con estado. Verde por defecto, cambiarlo solo si hace falta y con contraste suficiente. **Control segmentado** para cambiar entre subvistas muy relacionadas; para secciones, pestañas.

**Campos de texto.** Para poco texto; marcador que explique el propósito y, como desaparece, una etiqueta aparte. Campo seguro para contraseñas. Varios campos: apilados, mismo ancho, bien espaciados. Botón **Borrar** al final; imagen al inicio para indicar el propósito. Teclado adecuado. Validar al salir del campo (correo) o antes (usuario, contraseña).

**Listas y tablas.** Lo textual va en listas, no en rejillas de tarjetas. Estilo *grouped* (encabezados, pies y espacio entre grupos) o *plain*. Disclosure indicator para navegar; botón de información solo para detalles de la fila. Texto breve por fila. Con Liquid Glass, filas y padding **más altos**, secciones con **más radio**, encabezados en capitalización de título. *Métricas de UIKit:* fila mínima 44 pt; grupo con inserción y radio ≈ 10 pt (mayor en iOS 26); separadores alineados tras el icono.

**Alertas, hojas de acción, menús, popovers.** Alerta para informar o confirmar algo con consecuencias; **hoja de acción** para elegir entre opciones de una acción intencionada. Menús con iconos en las acciones comunes; en iOS, disposición *small* (fila de cuatro iconos), *medium* (tres con etiqueta) o *large*; las acciones de arriba del menú coinciden con las de deslizamiento. **Popovers no en vistas compactas**: en iPhone se usa una hoja.

## 8. Movimiento (Motion)

- Con propósito; nada gratuito. Breve y preciso; realista y en la dirección del gesto (lo que baja se cierra hacia arriba). Cancelable; no bloquear a la persona.
- No añadir movimiento a interacciones frecuentes: el sistema ya lo pone. Opcional: respetar «Reducir movimiento» y dar la información también sin animación.
- Liquid Glass responde más al tacto directo que al trackpad. Símbolos animados donde aporten.
- En Codaru: transiciones de pila con `slide-left` (entrar) y `slide-right` (volver); hojas con `slide-up`; disolver solo entre pestañas o estados, no entre niveles de la misma jerarquía.

## 9. Iconos de app (resumen)

Capas que el sistema ilumina y refracta; formas sólidas y superpuestas, sin efectos propios; variantes clara, oscura, transparente y teñida; se compone en Icon Composer. La máscara la pone el sistema (rectángulo redondeado). No aplica a las maquetas de pantalla, pero sí si se pide el icono.

## 10. Lista de comprobación para una pantalla de iPhone en Codaru

1. Pantalla con tamaño de iPhone, `skin`, `safeArea`, `themeId: "kit-ios-v1"` y `kitId: "ios"`.
2. Tipografía: estilos de la tabla como tokens; cuerpo 17; nada bajo 11; títulos grandes en Bold.
3. Barra de navegación con título grande o estándar y Atrás estándar; **barra de pestañas flotante de cristal** si hay secciones; búsqueda abajo si la hay.
4. Capa de contenido sin cristal: fondo agrupado, listas con inserción para texto y ajustes, tarjetas solo para contenido realmente «de tarjeta».
5. Un botón prominente por pantalla, 44 × 44 mínimo en todo lo tocable, estado pulsado.
6. Colores por tokens; funciona en claro y oscuro; `./codaru lint` sin errores.
7. Movimiento: solo transiciones de navegación y, si acaso, una entrada.
8. Explicar la versión mínima elegida y qué queda fuera (por ejemplo, que el cristal es simulado).
