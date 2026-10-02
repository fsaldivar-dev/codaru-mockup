# Temas y kits de Codaru Mockup

## Alcance aprobado

Mantener el editor local y ligero, sin servidor Node en ejecución ni dependencias de interfaz adicionales. Crear cinco kits originales: iOS, macOS, Android, Linux (estética GNOME) y Web. Cada kit tendrá 20 componentes editables, con variantes normal, seleccionado y deshabilitado cuando correspondan visualmente.

El tema contendrá colores, degradados con múltiples paradas, materiales, tipografía y radios. Cada perfil incluirá modos claro y oscuro; las pantallas podrán heredar el tema del documento o elegir otro perfil y modo. Los elementos conservarán referencias a tokens para actualizarse juntos.

El material de vidrio simulará transparencia, tinte, desenfoque, saturación, borde y sombra. No se implementará refracción óptica dinámica. El prototipo HTML conservará el efecto; SVG usará una representación estática simplificada. Los kits serán originales, sin distribuir recursos oficiales de Apple ni fuentes externas.

## Desarrollo y reparto

1. **Motor de temas — subagente theme_engine.** Esquema v2, migración v1, validación, herencia, renderizado y exportación. Archivos: model.ts, themes.ts, render.ts y pruebas del motor.
2. **Catálogos — subagente platform_kits.** Cinco kits de 20 componentes, variantes, inserción reutilizable y carga de definiciones bajo demanda. Archivos: kits.ts y pruebas de kits.
3. **Interfaz e integración — agente principal.** Editor de temas, biblioteca con búsqueda, selección de plataforma y variante, propiedades de pantalla y vínculos a tokens. Plan, documentación, pruebas de integración y revisión nativa.

Los subagentes comparten un contrato de datos y tienen archivos separados. Se evita repetir investigaciones y ejecutar suites completas durante cada cambio.

## Criterios de aceptación

- «Temas» abre un editor accesible desde la barra superior; permite crear perfiles y tokens y editar ambos modos.
- Cambiar un token actualiza todos los elementos vinculados y se puede deshacer.
- Dos pantallas pueden usar perfiles y modos distintos dentro del mismo documento.
- Los cinco kits ofrecen 100 componentes en total. Insertar dos veces reutiliza la definición; los hijos siguen siendo editables y seleccionables.
- El borrador y los archivos v1 se migran sin perder capas, componentes ni paletas. Guardar y volver a abrir preserva temas y vínculos.
- Vidrio y degradados funcionan en el lienzo y en HTML; SVG documenta su simplificación.
- Compilación, pruebas del modelo, flujos de UI y apertura de la aplicación nativa. Preservar el borrador del usuario durante la revisión.
- Medir tamaño final del bundle y catálogos. Referencia previa: aplicación macOS de aproximadamente 4.42 MiB y JS/CSS de 89,625 bytes.

## Fuera de esta entrega

Animación física del vidrio, componentes nativos reales, colaboración en red, kits oficiales redistribuidos, componentes anidados y sistemas completos GNOME/KDE por versión. Las variantes son estados visuales de mockup; no añaden lógica de aplicación.

## Entrega verificada · 2026-10-02

Los tres bloques de desarrollo están completados. El catálogo contiene 100 componentes y un archivo de demostración con cinco pantallas. Se aprobaron 21 pruebas de modelo y las 21 pruebas de interfaz (la ejecución completa detectó un selector ambiguo en una prueba nueva; se corrigió y las cuatro pruebas nuevas pasaron de nuevo). Compilación TypeScript, Vite y Tauri correcta.

En la aplicación macOS se revisaron el editor de temas, el cambio de ángulo de un degradado y su Deshacer, la vista de vidrio, la carga de kits, la inserción y la selección múltiple de hijos de una instancia. Los cambios temporales se revirtieron y el borrador Forma quedó conservado.

Tamaño final: aplicación 4.47 MiB; JavaScript y CSS 134,377 bytes, incluido el módulo diferido de kits de 16.25 kB. La galería JSON completa ocupa 1,260,235 bytes y no se incluye en el bundle. No se añadieron dependencias en ejecución. Evidencia y límites: `artifacts/VALIDACION.md`.
