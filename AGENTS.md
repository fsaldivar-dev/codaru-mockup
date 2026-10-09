# Trabajar con el diseño abierto en Codaru Mockup

Para crear o modificar un mockup en la aplicación, usa el CLI local antes de recurrir a clics o a reconstruir el JSON completo. No se necesita MCP. Lee `CLI.md` para el contrato completo.

1. Ejecuta `./codaru --help` y `./codaru context`. La app nativa debe estar abierta.
2. Acota el contexto con `--scope ID --depth 1`; respeta `truncated` y `textTruncated`.
3. Descubre recursos con `./codaru catalog --kind kits|icons --kit ID`; descubre operaciones con `./codaru schema`. No inventes IDs de recursos.
4. Escribe un lote JSON `{expectedRevision,operations}` usando la revisión actual. Valida con `./codaru apply --file ARCHIVO --dry-run` y aplica con el mismo archivo.
5. Usa el contexto que devuelve `apply`; revisa visualmente una exportación SVG o la app nativa cuando cambie la composición. JSON/SVG/HTML se exportan con `./codaru export --format ... --output ...`.

Ante `revision_conflict`, vuelve a leer y reconsidera el lote. No reemplaces la revisión a ciegas. Ante `editor_busy`, conserva el trabajo en curso de la persona. El historial es compartido: no deshagas cambios humanos para limpiar pruebas.

Para cambiar el código del editor: TypeScript sin frameworks en ejecución, Rust/Tauri para operaciones nativas y CLI. Preserva compatibilidad con proyectos v1/v2, pruebas de modelo e interfaz y revisión nativa. No añadas un servidor Node como requisito de ejecución. `npm run native:build` compila y empaqueta también el CLI. No se requiere delegación de tareas.

Para nuevas capacidades, sigue `docs/ARCHITECTURE.md`: composición de componentes, núcleo independiente de la interfaz y contratos con el IDE. Los tipos compartidos van en `src/contracts.ts`; el núcleo no debe depender de adaptadores de UI ni siquiera mediante imports de tipos. `npm test` comprueba estas fronteras. La composición reutilizable admite instancias dentro de maestros; conserva claves por ámbito, sobrescrituras locales y validación del grafo de dependencias. Las modificaciones estructurales se hacen en los maestros.

El destino principal es un editor embebido en una app Tauri existente. `npm run package:build` genera `packages/editor/dist`; `packages/tauri-plugin-codaru` se enlaza al host. Mantén el aislamiento entre instancias, la persistencia explícita y el desmontaje sin perder cambios. El ejemplo nativo utiliza `examples/tauri-host.html` para probar esa misma integración. Mide por separado paquete embebible, CLI opcional y app de ejemplo: no presentes el tamaño del frontend como el incremento total de un ejecutable anfitrión.
