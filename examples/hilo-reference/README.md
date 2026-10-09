# HILO · Interpretar un HTML sin un preset

Prueba editable de Codaru Mockup construida con el CLI local. Referencia: el HTML MEXQUI facilitado por el usuario. Se leyó su CSS; no se ejecutó su JavaScript ni se copiaron los paths de sus iconos.

El lenguaje inferido combina fondo marfil, rosa, títulos ligeros, etiquetas mono y líneas finas. Escritorio tiene una composición editorial con una columna de escucha; móvil tiene una composición centrada en la canción y una segunda pantalla de cola. El mockup no incluye un motor de audio.

Los 17 controles, el icono HILO y la ilustración Resonancia son fuentes originales ARU, compiladas con el CLI instalado. Codaru conserva fuentes y SVG. No se reutiliza UX de ARU ni se selecciona un preset. `hilo.codaru-style.json` documenta el lenguaje *después* de inferirlo y permite volver a utilizarlo.

`host.ts` monta las partes embebibles del editor con chrome propio. El documento es una copia de prueba sin persistencia automática. El proyecto humano abierto en el socket predeterminado no se modificó.

## Revisión de recursos

Se revisaron los PNG reales a tamaño completo y reducido (24 px para iconos; 64 px para ilustración). `review.json` conserva veredictos explícitos de Codex ligados a la revisión exacta de cada candidato. El host los reproduce para este contenido. No lleva un modelo de IA ni aprueba contenido desconocido automáticamente; los recursos nuevos o modificados quedan pendientes. El adaptador de compilación solo reconoce fuentes que coinciden exactamente con estos artefactos ya compilados por el CLI. Para fuentes nuevas, el IDE debe invocar ARU y conectar su evaluador.

La biblioteca aprobada permite insertar/exportar SVG, PNG, iOS, Android y fuente ARU. La exportación móvil incluye imagesets de iOS y densidades drawable de Android; no crea un proyecto móvil ni un motor de reproducción.

## Abrir

En desarrollo: `/examples/hilo-reference/index.html` con Vite. La app nativa de prueba se compila con `artifacts/hilo-reference/native-config.json`. Galería y entregables: `artifacts/hilo-reference/index.html`.

Fotografías existentes del banco local, licencia Unsplash: [Zugr](https://unsplash.com/photos/yZf1quatKCA) y [Caleb Ralston](https://unsplash.com/photos/6hxvm0NzYP8). Créditos originales: `examples/aru-music/assets/photos.json`.

## Jardín de voces

La segunda página conserva el HILO original y explora un lenguaje cultural contemporáneo. Incluye escritorio, bienvenida móvil, reproductor, colección vacía, modo sin conexión, descargas y una hoja de recursos. El botón Original permite volver a la primera página; la navegación del host activa la página correspondiente antes de enfocar la pantalla.

`cultural-assets/` y `cultural-assets.json` contienen cuatro ilustraciones originales y seis iconos de navegación con fuente ARU. La investigación regional sobre listones, pliegues y encaje se registra en `artifacts/hilo-cultural/direction.json`; las aves y flores son nuevas y no afirman reproducir motivos tradicionales ni tener validación comunitaria. Las ilustraciones requieren espacio: Encuentro desde 280 px, las demás desde 160 px. Los iconos se acompañan de etiquetas a 24 px. Las fuentes conservan grupos editables; no se entregan animaciones.

Las diez piezas de la primera entrega tienen veredictos visuales vinculados a su contenido exacto. Esa entrega reunió 29 recursos revisados, sin un evaluador automático para futuros dibujos. La galería `artifacts/hilo-cultural/index.html` ofrece el prototipo, proyecto editable y `HILO-jardin-recursos.zip` con ARU, SVG, PNG, imagesets iOS y densidades Android. Los estados de conexión y descarga pertenecen al prototipo visual.

### Ampliación de la familia

`expansion-manifest.json` describe 16 iconos adicionales y cuatro ilustraciones nuevas: Seguir la hebra (búsqueda), Lo que florece (favoritas), Ramas en compás (playlist) y Frecuencia floral (estaciones). `expansion-assets.json` conserva los paquetes preparados por el CLI ARU; sus fuentes están junto a los demás dibujos en `cultural-assets/`.

La biblioteca contiene ahora 49 recursos revisados, incluidos los originales. La familia Jardín de voces reúne ocho ilustraciones y 22 iconos propios. Las cuatro ilustraciones nuevas se usan desde 180 px; los iconos se revisaron a 24 px. El menú Más vistas muestra sus pantallas móviles y una hoja de recursos con comparaciones de tamaño. La galería y el ZIP incluyen la ampliación, sus fuentes, exportaciones móviles y veredictos vinculados al contenido exacto.

## VENERO · Amealco, de cerca

Concepto editorial independiente, accesible con el botón VENERO o `?concept=venero`. Página propia `venero`, sin modificar los 659 nodos de HILO y Jardín de voces. Escritorio, cinco lecturas/vistas móviles y hoja de recursos.

18 recursos nuevos: cinco ilustraciones, doce iconos y una marca; ARU originales en `venero-assets/`, metadatos en `venero-manifest.json`. Las aprobaciones guardadas en `review.json` provienen de la revisión visual de esta sesión y se vinculan a la revisión exacta del candidato. No es un evaluador IA automático. Cambios de contenido o propósito quedan pendientes de otra evaluación.

Galería y prototipo en `artifacts/venero/`. `verification.json` conserva las pruebas de exportaciones, fuentes, navegación, aislamiento del diseño anterior y bloqueo de recursos modificados. El recorrido es un ejemplo visual, sin reserva ni persistencia de favoritos. `direction.json` distingue investigación oficial e interpretación de autor.
