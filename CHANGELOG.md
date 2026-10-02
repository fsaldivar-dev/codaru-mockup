# Changelog

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
