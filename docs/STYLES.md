# Musaru: laboratorio de 23 estilos

En la app de ejemplo Codaru Mockup, el botón **Musaru · estilos** abre un laboratorio independiente. El selector elige una familia y **Desktop / Mobile** enfoca su composición. **Presentar** reproduce las animaciones; el CTA del escritorio abre la pantalla móvil del mismo estilo, y Atrás vuelve al escritorio.

Son 23 propuestas, con dos viewports por propuesta. El catálogo inicial tenía seis exploraciones y se amplió con otras 17. Cada estilo se rediseñó y revisó de forma individual: Pop, Frutiger Aero, Dark Aero, Frutiger Fruits, Frutiger Aurora, Frutiger Eco, MusicArt, Material 3 tonal, Material 3 Expressive, Apple minimalista, Minimalista monocromático, Cristal / Liquid Glass, Futurista minimalista, Clay / relieve suave, Cyberpunk / neón, Memphis retro, Y2K cromado, Esqueumórfico, DORFic, Frutiger Metro, Funky Seasons / Four Colors, Sci-fi industrial y Console gloss tienen revisión individual en desktop y móvil. La auditoría final verificó el catálogo, las fuentes, la navegación y la persistencia del ejemplo nativo. El original Jardín nocturno permanece en otra página del documento como referencia, fuera del catálogo de 23.

El laboratorio es un documento Codaru real: texto, imágenes, rectángulos, grupos, tokens y vectores ARU editables. El selector navega entre propuestas ya diseñadas; no convierte automáticamente cualquier aplicación a otro estilo. El chrome del editor conserva su sistema visual, separado del tema del producto.

## Revisión individual: Pop

Pop se compone como un fanzine de escritorio, con tipografía grande, fotografías en recortes distintos y radio lateral reutilizable. Móvil se diseña como una radio de bolsillo con carcasa, pantalla pequeña, rejilla de altavoz, progreso ondulado y pausa en forma de pegatina. Los controles `pop-v2-*.aru` son dibujos propios; no son cambios de color sobre el kit anterior. La identidad del componente maestro se conserva.

Antes de pasar a otra familia se revisan composición, controles, jerarquía, versión móvil y navegación en Presentar. Pasar pruebas de navegación no equivale a aprobar la dirección visual.

## Revisión individual: Frutiger Aero · sin aqua

Un reproductor panorámico sobre cielo y colinas, con disco fotográfico circular, consola de cristal y cola lateral. La versión móvil es una cápsula de bolsillo con cámara de controles propia. Los 13 fuentes `aero-v2-*.aru` aportan biseles, inlays, reflejos y paisajes sin agua. Nubes y hoja tienen movimiento suave en Presentar, respetando movimiento reducido. Se conserva el ID del maestro del transporte.

## Revisión individual: Dark Aero

Un tocadiscos de negro piano con vinilo de surcos finos, brazo cromado, etiqueta fotográfica y receptor estéreo al frente. La cola de álbumes es vertical. Móvil usa un vinilo descentrado que se recorta en el borde, fader lateral y consola compacta propia. Las 13 fuentes `dark-v2-*.aru` incluyen teclas con bisel metálico, encoder, vinilo, brazo, vúmetro y logotipo originales. La etiqueta gira y el vúmetro cambia suavemente de brillo en Presentar, respetando movimiento reducido. Se conserva la identidad del maestro de transporte.

## Revisión individual: Frutiger Fruits

Una frutería sonora con carátulas de recortes distintos y un exprimidor musical cítrico reutilizable. La carcasa naranja incluye visor fotográfico, volumen lateral, gajos de avance y pausa de hoja con semillas blancas. Móvil cambia de composición: fotografía a toda anchura, transición crema orgánica y progreso dividido en gajos. Las 13 fuentes `fruits-v2-*.aru` aportan frutas, carcasa, controles e iconos originales; la hoja y la cosecha se mueven suavemente en Presentar, respetando movimiento reducido. Se conserva el maestro del transporte.

## Revisión individual: Frutiger Aurora

Una sala de escucha nocturna atravesada por cintas de luz. La carátula ocupa un ala de cristal; una consola curva flota bajo el título y la cola se distribuye en tres plataformas de distinta posición y escala. Móvil tiene su propio recorrido vertical: siguiente canción, ala fotográfica, título, progreso curvo, pausa descentrada y columna de volumen. Las 14 fuentes `aurora-v2-*.aru` aportan controles plegados, logotipo, alas, cintas y progreso originales. Las cintas se mueven suavemente en Presentar, respetando movimiento reducido. Se conserva la identidad del maestro del transporte.

## Revisión individual: Frutiger Eco

Un invernadero sonoro con campana de cristal, fotografía circular como sol de una planta, borde editorial y estante abierto de semillas musicales. El transporte reutilizable se apoya en un lecho de raíces. Móvil tiene un ecosistema ancho propio y controles de hoja sobre una base de tierra. Las 15 fuentes `eco-v2-*.aru` aportan plantas, cristal, logotipo, teclas, progreso de tallo y bases originales. Las hojas se mueven suavemente en Presentar, respetando movimiento reducido. Se conserva la identidad del maestro del transporte y se ajustan los tokens Eco a marfil, musgo y celadón con títulos serif.

## Revisión individual: Outline redondeado · MusicArt

Un archivo de escucha con ficha fotográfica, título grande, índice abierto de canciones y una tira de transporte reutilizable. Móvil recompone la ficha con fotografía primero, título en dos líneas, audífonos en el margen y controles abiertos. Las 19 fuentes `outline-v2-*.aru` incluyen símbolos de 48 unidades con trazo 2.4 para tamaño 24px, instrumentos, variantes de margen con grosor óptico, partitura y progreso. Todos son contornos verdes sin relleno ni efectos. El logotipo, las notas y el dibujo móvil tienen movimiento de trazo en Presentar, respetando movimiento reducido. Este estilo inicial no tenía maestro; se creó uno y se conservaron las identidades anteriores. Se retiraron los gradientes y materiales de vidrio heredados de su tema inicial.

## Revisión individual: Material 3 tonal

Una sala con rail de navegación, mezcla diaria, listas abiertas y panel de reproducción persistente. Móvil resume la mezcla arriba y recompone los controles en una superficie propia con pausa en cápsula; la próxima canción queda visible. Las 14 fuentes `material-v2-*.aru` aportan iconos, ilustración orbital y progreso originales, planos y sin vidrio. Los arcos de la ilustración se dibujan suavemente en Presentar, respetando movimiento reducido. Este estilo inicial no tenía maestro; se creó uno sin alterar los anteriores. El tema incorpora pares de roles primary/onPrimary, primaryContainer/onPrimaryContainer, secondaryContainer/onSecondaryContainer y superficies tonales. Los pares usados en claro superan contraste 4.5:1. Se retiraron los gradientes y materiales heredados.

La dirección toma los roles de color, formas y jerarquía de la [guía oficial de Material 3](https://developer.android.com/develop/ui/compose/designsystems/material3). Es un mockup con tipografía del sistema; no incluye Compose ni cálculo dinámico del color desde el wallpaper. La revisión visual de esta entrega corresponde al modo claro.

## Revisión individual: Material 3 Expressive

Un escenario de escucha centrado en Golden hour: titular amplio, portada circular con halo de pétalos, isla de acciones horizontal y cola de canciones en filas. La pausa domina por tamaño y contención; el progreso ondulado tiene pista restante y manejador propios. Móvil se compone de nuevo: título arriba, portada descentrada junto a ilustración rítmica, grupo de controles al alcance y siguiente canción al pie. No se reduce la sala tonal anterior. Las 14 fuentes `expressive-v2-*.aru` incluyen formas, símbolos y progreso editables; los pétalos oscilan suavemente en Presentar y se detienen con movimiento reducido. Se creó un maestro de reproducción sin alterar los ocho existentes.

Dirección informada por la [investigación oficial de Material 3 Expressive](https://design.google/library/expressive-material-design-google-research): jerarquía por tamaño, forma y contención, conservando etiquetas y cola reconocible. Colores planos cálidos con contrapunto menta; los pares de texto usados en claro superan 4.5:1. La revisión visual corresponde al modo claro. Es un mockup con tipografía del sistema, sin Compose, motor físico de resortes ni audio real.

## Revisión individual: Apple minimalista

Biblioteca editorial de escritorio con sidebar completa, reproductor compacto superior, portada destacada y recomendaciones abiertas. La reproducción móvil ocupa su propia vista: portada grande, canción, progreso fino, controles amplios y utilidades al pie. Los 20 archivos `apple-v2-*.aru` son geometrías originales editables; incluyen iconos, marca de nota plegada e ilustración de bucles sonoros para un artista ficticio. No son SF Symbols. El medidor de tres barras tiene pulsos discretos en ambos tamaños y respeta movimiento reducido. Se creó el maestro de la barra superior conservando los nueve existentes.

La dirección se apoya en agrupación, jerarquía y espacio de la [guía de layout de Apple](https://developer.apple.com/design/human-interface-guidelines/layout). Acento rojo contenido, superficies claras, separadores finos y tipografía del sistema. Los pares de texto revisados superan 4.5:1 en modo claro. Es una interpretación minimalista, sin Glass; no pretende implementar todos los comportamientos de UIKit o AppKit. El prototipo no reproduce audio real. La revisión visual corresponde al modo claro.

## Revisión individual: Minimalista monocromático

Una sesión editorial de escritorio en tres columnas desiguales: título y controles, portada geométrica y cola numerada. Móvil invierte la polaridad y recompone el arte como un paisaje horizontal; título y pausa cuadrada comparten una fila, con controles y próxima canción debajo. Las 19 fuentes `mono-v2-*.aru` incluyen símbolos geométricos y dos portadas originales del mismo universo nocturno. La portada es ilustración vectorial propia, sin fotografías, filtros o gradientes. Los arcos se dibujan lentamente en Presentar y se detienen con movimiento reducido.

Negro, blanco y grises neutros en todos los vectores. Combinación de tipografía del sistema y rótulos monoespaciados, reglas finas y radios cero. Se creó un maestro para el bloque de escucha conservando los diez anteriores. Se revisó escritorio en claro y móvil en oscuro; los pares de texto evaluados superan 4.5:1 en ambos modos. El prototipo demuestra navegación y animación, sin audio real.

## Revisión individual: Cristal / Liquid Glass

Una noche fotográfica con títulos y cola sobre el contenido, navegación flotante y mando vertical de vidrio. Móvil recompone la escena en retrato, con ilustración de lentes propia y dock horizontal para reproducción, progreso y volumen. Las 14 fuentes `glass-v2-*.aru` incluyen controles e ilustraciones editables; sus reflejos se dibujan lentamente y respetan movimiento reducido. Las fotografías conservan créditos en sus capas. Se creó un maestro para el mando conservando los once anteriores.

La [guía de materiales de Apple](https://developer.apple.com/design/human-interface-guidelines/materials) informa la separación entre contenido y controles. Tokens glassRegular y glassClear definen tinte, opacidad, blur, saturación y borde; sceneShade y phoneShade protegen la lectura sobre la fotografía. El contraste de tinta de los materiales, calculado sobre negro como caso mínimo de luminosidad del fondo, supera 4.5:1. Revisión visual en modo claro.

Presentar y HTML mantienen el desenfoque CSS del fondo; PNG/SVG exportados por CLI conservan tinte y borde. La galería muestra capturas del HTML y enlaza el fallback por separado. Es una simulación sin refracción física ni material UIKit/AppKit nativo; no reproduce audio real.

## Revisión individual: Futurista minimalista

Un instrumento de escucha de escritorio: título centrado, portada circular dentro de un dial radial, controles opuestos y pausa integrada en el anillo. Mezcla, guardar, cola y volumen quedan como satélites; las siguientes canciones ocupan una tira abierta al pie. Móvil tiene una sintonía vertical propia: título en dos líneas, portada en cápsula junto a una escala de progreso, barra de transporte horizontal y utilidades debajo.

Las 15 fuentes `future-v2-*.aru` contienen iconos geométricos y dos instrumentos originales editables. Un eco cian se dibuja lentamente en cada viewport; progreso y marcador permanecen estáticos. Respeta movimiento reducido. No usa gradientes, vidrio, neón ni paneles de telemetría. Se creó el maestro del dial radial conservando los doce anteriores. Ambos viewports se revisaron en claro, con pares de texto superiores a 4.5:1. Los cambios de pantalla son directos: la transición fade dejó la pantalla saliente superpuesta en esta sesión nativa y se retiró de los dos enlaces de este estilo. El prototipo no reproduce audio real.

## Revisión individual: Clay / relieve suave

Una almohada sonora de escritorio con portada en cavidad, teclas elevadas, progreso hundido y utilidades dentro de una carcasa mate. La cola se organiza aparte en dos piezas pastel; una tercera lleva al formato de bolsillo. Móvil recompone el objeto como una cápsula lavanda vertical, con portada centrada, teclas de guijarro menta, pausa grande y siguiente canción fuera de la carcasa.

Las 18 fuentes `clay-v2-*.aru` incluyen iconos de geometría redondeada, dos carcasas, progreso, teclas desktop y móviles diferentes, una escultura de audífonos y un brote de bolsillo. Gradientes amplios y siluetas de sombra simulan volumen 2D sin filtros o reflejos metálicos. Las esculturas respiran suavemente en Presentar y se detienen con movimiento reducido; el progreso permanece estático. Las fotografías conservan sus créditos. Se creó un maestro para la almohada conservando los trece anteriores.

Se revisaron ambos viewports en claro. El token onClay asegura contraste superior a 4.5:1 incluso sobre los extremos oscuros de las carcasas pastel; el texto secundario de fondo usa muted. Los cambios de pantalla son directos. El prototipo demuestra composición, navegación y movimiento; no reproduce audio real ni incorpora un motor 3D.

## Revisión individual: Cyberpunk / neón

Una frecuencia nocturna con rail mínimo, carátula fotográfica panorámica intervenida por una ciudad ARU original, título grande y cola abierta. La consola recortada se sitúa bajo la carátula y separa reproducción, tiempos y progreso. Móvil tiene una ciudad más alta recompuesta en retrato junto al canal 08; el título se apila debajo y una consola escalonada organiza pausa lateral, teclas y volumen.

Las 20 fuentes `cyber-v2-*.aru` contienen símbolos angulares, teclas desktop y móviles diferentes, dos consolas, marcos y dos siluetas urbanas originales editables. Señal lima y acento magenta sobre carbón, sin gradientes, filtros ni desenfoque sobre los glifos. El halo se construye con trazos superpuestos en la ilustración. Solo la señal y la baliza decorativas tienen movimiento lento, respetando movimiento reducido; el progreso permanece estático. Las fotografías conservan créditos en sus capas. Se creó un maestro para la consola conservando los catorce anteriores.

Ambos viewports se revisaron en oscuro. Los pares de texto, símbolos principales y acentos sobre la consola superan 4.5:1. Navegación directa entre vistas. Es una dirección gráfica de música nocturna, sin telemetría ornamental ni audio real.

## Revisión individual: Memphis retro

Una edición musical de imprenta con título y controles abiertos a la izquierda, collage fotográfico central, índice de utilidades estrecho y dos entradas desiguales de cola al pie. La pausa azul en arco y las teclas con líneas forman parte del juego geométrico. Móvil se recompone como un cartel vertical: franja de título amarilla, portada circular con rail azul y disco coral de pausa entre teclas propias.

Las 20 fuentes `memphis-v2-*.aru` incluyen símbolos de geometría sólida, variantes desktop y móvil de teclas y pausa, dos escenarios de portada, marcos, progreso y una pequeña escultura gráfica de altavoz. Colores planos sobre papel crema, puntos, arcos, triángulos y zigzags, sin gradientes, sombras o filtros. Solo el zigzag decorativo tiene un dibujo lento en Presentar y se detiene con movimiento reducido; el progreso permanece estático. Las fotografías conservan sus créditos. Se creó el maestro del juego de escucha conservando los quince anteriores.

Ambos viewports se revisaron en claro. Los pares de texto y las barras de pausa sobre azul o coral superan 4.5:1. Navegación directa entre vistas. Es una interpretación gráfica propia del perfil Memphis; el prototipo no reproduce audio real.

## Revisión individual: Y2K cromado

Un aparato musical aerodinámico sobre fondo hielo, con colección lateral de recortes ovales, carátula circular atravesada por una órbita rosa y pantalla violeta oscura. Las teclas cromadas se sitúan a la derecha y las utilidades bajo la carátula, dentro de la carcasa. Móvil se recompone como un colgante vertical: portada oval arriba, pantalla central, utilidades compactas y teclas en triángulo alrededor de una pausa alargada.

Las 20 fuentes `y2k-v2-*.aru` incluyen marca orbital, estrella metálica, dos carcasas, dos órbitas, progreso, símbolos y teclas con proporciones propias para cada viewport. Los gradientes `polishedChrome`, `rimChrome` y `pinkMetal` se conservan en el tema. El cromado usa gradientes y capas vectoriales 2D, sin filtros ni shader 3D. Los textos y símbolos se colocan sobre superficies uniformes; los pares de texto revisados superan 4.5:1. Solo el reflejo orbital tiene un dibujo lento en Presentar, detenido con movimiento reducido; el progreso permanece estático.

Ambos viewports se revisaron en claro. Se conservan las fotografías con créditos y los dieciséis maestros anteriores. Navegación directa entre vistas; el prototipo no reproduce audio real.

## Revisión individual: Esqueumórfico

Una pletina de sobremesa en madera de nogal y metal cálido, con cassette de etiqueta fotográfica, dos carretes, vúmetro de aguja y controles de piano. La colección se sitúa fuera del aparato como fundas de álbumes. Las utilidades y el dial se apoyan en una placa mate; el título serif y el fondo crema acompañan el carácter de objeto físico.

Móvil es un aparato propio: caja rectangular con correa de tela, LCD pequeño, cassette compacto, rueda lateral y teclas horizontales. Las 24 fuentes `skeuo-v2-*.aru` incluyen ambas carcasas, cinta, carretes, vúmetro, teclas, dial, marca y símbolos. Madera, metal y relieve se dibujan con gradientes y capas vectoriales 2D, sin filtros. El tema conserva `walnut`, `brass` y `brushedMetal`. Los dos carretes giran lentamente como ilustración en Presentar y se detienen con movimiento reducido; nivel y progreso permanecen estáticos.

Ambos viewports se revisaron en claro. Los pares de texto, pantalla y símbolos sobre sus superficies uniformes superan 4.5:1. Se mantienen créditos fotográficos y los diecisiete maestros anteriores. Navegación directa entre vistas; no hay audio real ni nivel de salida medido.

## Revisión individual: DORFic

Una instalación musical diurna con portal naranja elevado, arquitectura blanca de caras planas, suelo geométrico y cola escalonada. El título y los controles quedan abiertos a la izquierda, separados de la fotografía editable. Las teclas son cuñas con símbolos sobre caras uniformes; la pausa tiene un volumen naranja propio.

Móvil cambia a una escena vertical con portal propio, teclas pequeñas en el borde, título de canción en dos líneas y una pausa alta de corte diagonal a su lado. Las 21 fuentes `dorfic-v2-*.aru` incluyen ambas escenas y marcos, controles independientes para cada viewport, marca cúbica, progreso, pequeñas esculturas geométricas y estantes de cola. Los tokens `whiteSolid`, `orangeSolid` y `whiteSide` conservan la profundidad dibujada en 2D, sin filtros ni motor 3D. Un objeto geométrico por vista flota lentamente en Presentar y se detiene con movimiento reducido; progreso y fotografía permanecen estáticos.

Ambos viewports se revisaron en claro. Los pares de texto y los símbolos sobre las caras naranjas o blancas superan 4.5:1. Se mantienen fotografías con créditos y los dieciocho maestros anteriores. Navegación directa entre vistas; no hay audio real. Es una interpretación del perfil de [DORFic](https://frutiger-aero.org/DORFic), sin promesa de fidelidad histórica.

## Revisión individual: Frutiger Metro

Un cartel urbano musical en lima, magenta y cian junto a una franja de escucha oscura. Figura bailando con audífonos, altavoz inclinado, círculos expansivos, notas, curvas y ciudad recortada. El título ocupa el espacio del cartel; carátula, tiempos y controles se concentran en el lateral. Dos entradas de cola descansan sobre la ciudad.

Móvil usa otra pose de medio cuerpo y un collage fotográfico circular propio, con pausa negra lateral, teclas sobre recortes blancos y siguiente canción en una etiqueta de cinta. Las 28 fuentes `metro-v2-*.aru` incluyen ambas figuras, campos gráficos, símbolos, controles y marcos. Son vectores planos sin gradientes, sombras o filtros. Solo una curva decorativa por vista se dibuja lentamente en Presentar y se detiene con movimiento reducido; progreso y fotografía permanecen estáticos.

Ambos viewports se revisaron en claro. Se comprobaron pares de texto y controles sobre lima, cian, papel y el panel oscuro, con contraste superior a 4.5:1. Se mantienen fotografías con créditos y los diecinueve maestros anteriores. Navegación directa entre vistas; no hay audio real. Interpretación musical del perfil [Frutiger Metro](https://frutiger-aero.org/frutiger-metro), sin promesa de fidelidad histórica.

## Revisión individual: Funky Seasons / Four Colors

Una familia de productos identificada por lima, azul cielo, fucsia y mandarina, siguiendo el énfasis de [Four Colors en CARI](https://cari.institute/aesthetics/four-colors) en personalizar un mismo producto mediante color. Escritorio usa una unidad mandarina horizontal con fotografía lateral, pantalla blanca amplia y teclas circulares. Los audífonos mantienen una misma silueta en cuatro colores separados.

Móvil es un portátil fucsia vertical con hombros curvos, pantalla propia, pausa cuadrada y teclas de pastilla. La siguiente canción y el volumen quedan fuera de la carcasa. Las 22 fuentes `funky-v2-*.aru` son editables; carcasas y gradientes 2D no usan filtros SVG ni simulación física. Un audífono por vista flota suavemente en Presentar y se detiene con movimiento reducido. Los tiempos y progreso permanecen estáticos.

Revisión en claro en ambos viewports, con contraste de texto y símbolos comprobado sobre superficies neutras. Se conservan fotografías acreditadas y los veinte maestros anteriores. El color se presenta como identidad visual, sin implementar un selector interactivo. Navegación entre desktop y móvil; sin audio real.

## Revisión individual: Sci-fi industrial skeuomorfo

Orbital es una estación musical de ciencia ficción con carcasa modular de titanio, juntas, esquinas achaflanadas, tornillos, biseles y respiradero. Pantalla y colección a la izquierda; rueda moleteada, teclas de transporte y utilidades a la derecha. La fotografía de noche mantiene su función de carátula y no se convierte en una textura de la interfaz.

Móvil usa un receptor propio con protecciones de goma en las esquinas, pieza superior, pantalla vertical, rueda pequeña, pausa alta y teclas laterales. El conector inferior cierra el objeto. Las 25 fuentes `scifi-v2-*.aru` incluyen carcasas, pantallas, ruedas, símbolos, tornillos y controles, con gradientes 2D editables y sin filtros SVG. No simula iluminación física ni copia insignias de franquicias.

Revisión oscura en ambas vistas. Se comprobaron textos sobre fondos uniformes y símbolos sobre la zona central de las teclas. Un piloto decorativo por vista pulsa suavemente en Presentar, respetando movimiento reducido. No se animan niveles o progreso como si existiera reproducción. Se conservan fotografías acreditadas y los veintiún maestros anteriores. Navegación directa entre vistas; sin audio real.

## Revisión individual: Console gloss · Blades / NXE

Escritorio como un dashboard doméstico con tres paneles cerrados curvos en azul, ocre y verde. La colección activa ocupa una superficie blanca con encabezado verde; lista, carátula y teclas de plástico pulido conviven dentro del panel. Progreso y volumen descansan sobre el suelo del dashboard. Se interpreta el lenguaje de Blades sin copiar marcas de consola.

Móvil crea una escena propia: fotografía frontal enmarcada y cubiertas vectoriales inclinadas a los lados, título, progreso y un dock de bolsillo redondeado. Las 28 fuentes `console-v2-*.aru` contienen paneles, símbolos, marcos, controles y gradientes 2D editables. La profundidad es una composición de planos 2D; no hay un motor de perspectiva o filtros SVG. Referencia contextual: [temas de NXE en Xbox Wire](https://news.xbox.com/en-us/2008/07/16/what-your-themes-could-look-like-in-new-xbox-experience/).

Revisión clara en ambas vistas. Se comprobaron textos sobre panel, suelo y selección verde, y símbolos sobre la zona central de las teclas. Un reflejo por vista cambia lentamente de opacidad en Presentar y se detiene con movimiento reducido. Se conservan fotografías acreditadas y los veintidós maestros anteriores. El CTA conecta desktop y móvil. Pestañas y controles de audio son propuestas visuales, sin navegación real de colección o reproducción.

Las 23 familias y sus 46 vistas tienen revisión individual terminada. `docs/STYLE-PROGRESS.json` registra el cierre; `artifacts/musaru-styles/final-audit/` conserva la auditoría del catálogo, fuentes, navegación, movimiento reducido, compilación y reapertura nativa. Se verificó que Pop aprobado y el proyecto original permanecen intactos.

## Familias incluidas

| Perfil ARU | Dirección de la propuesta |
| --- | --- |
| `outline-rounded` | MusicArt: contornos uniformes, sin relleno en los símbolos |
| `material-3` | Jerarquía tonal, superficies coordinadas |
| `material-3-expressive` | Formas expresivas, color tonal y jerarquía fuerte |
| `apple-minimal` | Aire, precisión y acabados discretos |
| `monochrome` | Contraste blanco/negro y composición editorial |
| `liquid-glass` | Capas translúcidas sobre fotografía y medallón vectorial |
| `futuristic-minimal` | Geometría precisa y un acento controlado |
| `clay` | Volumen mate y curvas suaves |
| `cyberpunk` | Contraste nocturno, señal luminosa y tipografía técnica |
| `memphis` | Geometría gráfica, ritmo y contraste |
| `y2k-chrome` | Metal pulido, reflejos concentrados y silueta dinámica |
| `skeuomorphic` | Cassette, carcasa, madera y controles físicos |
| `pop-cartoon` | Slime, stickers, contornos gruesos y sombras desplazadas |
| `frutiger-aero` | Aire, paisaje, biseles y reflejos; sin escenas acuáticas |
| `dark-aero` | Negro piano, vinilo y bordes luminosos |
| `frutiger-fruits` | Color cítrico y superficies pulidas |
| `frutiger-aurora` | Cintas de luz, cielo nocturno y transparencias |
| `frutiger-eco` | Invernadero sonoro, naturaleza y tecnología |
| `dorfic` | Blanco, naranja y geometría tecnológica diurna |
| `frutiger-metro` | Composición vectorial dinámica y recortes de color |
| `funky-seasons` | Lima, azul cielo, rosa y naranja |
| `skeuomorphic-scifi` | Carcasa modular, pantalla hundida y rueda moleteada |
| `console-gloss` | Paneles curvos de salón en escritorio; escena de carátulas en profundidad en móvil |

Los identificadores y criterios vienen de `aru styles` en ARU 0.7.0; `examples/musaru-styles/catalog.json` conserva cues y restricciones del catálogo. Las etiquetas son direcciones prácticas, no una certificación oficial de Material, Apple ni una reconstrucción histórica exacta. Referencia para Aero: [Consumer Aesthetics Research Institute](https://cari.institute/aesthetics/frutiger-aero); para Aurora: [catálogo comunitario](https://frutiger-aero.org/frutiger-aurora). No se copiaron imágenes de esas colecciones.

## Fuentes, exportaciones y límites

- Los dibujos originales están en `examples/musaru-styles/assets/`, con sus paquetes preparados. Los controles conservan el fuente ARU en el documento. El ZIP final incluye los 419 fuentes usados por las 46 vistas y `source-map.json` para relacionarlos con cada capa. La variante blanca del play aprobado de Pop se conserva en `assets/variants/style-pop-cta-play/`, sin cambiar su fuente dentro del documento; así no se confunde con la variante oscura del mismo nombre. Las exploraciones iniciales quedan fuera de ese ZIP.
- Las fotografías reales reutilizan el banco de Musaru, con autores y procedencia en `examples/aru-music/assets/photos.json` y en el nombre de cada capa.
- Cada estilo tiene tema propio con colores y tokens adecuados a su familia; usa gradientes y materiales cuando corresponde. Las composiciones móviles tienen controles separados y contexto de reproducción; no son un escritorio escalado.
- Presentar/HTML simulan vidrio y profundidad. SVG/PNG/paquetes móviles son estáticos y simplifican el vidrio. Los volúmenes son ilustraciones 2D, no un motor 3D.
- Las fuentes disponibles son `system`, `serif` y `mono`. No se incluye la tipografía comercial Frutiger ni un selector de fuentes personalizadas.
- El prototipo no reproduce audio real. Los elementos sin conexión declarada son maquetación.

La creación se hizo mediante contexto/schema, lotes con revisión esperada, dry-run y apply en una app aislada. El proyecto principal de la persona no se reemplaza. El ejemplo nativo carga este laboratorio como otra vista del host; el paquete embebible no incorpora las fotografías ni los documentos de demostración.

El host del laboratorio guarda sus cambios en IndexedDB (`codaru-musaru-style-lab`), separado del almacenamiento del proyecto principal. Antes de volver a **Mi proyecto**, espera a que termine la escritura; si falla, conserva el editor abierto y pide exportar un archivo. La persistencia se implementa con `onChange` y está fuera del paquete del editor. También puedes guardar una copia con el botón habitual de exportar JSON.
