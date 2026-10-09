# Recursos propios y revisión por IA

Biblioteca → Recursos muestra los vectores ARU y SVG del documento, con identidad por contenido. Un mismo nombre no fusiona dibujos distintos. El banco de fotografías e iconos externos sigue en «Banco externo». Las miniaturas se cargan en grupos de 24; el índice es local a la sesión y cede el hilo durante documentos grandes.

Los dibujos descubiertos y los importados son **candidatos**, no recursos aprobados. La revisión exige un SVG saneado, compilación coincidente del fuente ARU cuando exista, PNG reales a tamaño de uso y a 24 px (64 px para ilustraciones), y un dictamen visual de la IA del IDE. Si hay una referencia, también se revisa fidelidad. Las animaciones requieren un renderer del host que entregue al menos tres muestras temporales distintas; el renderer estático incluido no las aprueba.

La IA debe evaluar apariencia, lectura, recortes, adecuación al uso/estilo, fidelidad y animación. Puede aprobar, pedir correcciones o rechazar, con motivos y proveedor/modelo identificados. Las comprobaciones técnicas no sustituyen esta revisión. El editor no incluye un modelo, credenciales ni llamadas de red para evaluar.

```ts
const editor = createEditor({
  document,
  resourceServices: {
    compile: async source => compilarCopiaCapturadaConARU(source.text),
    // Con una vista montada se proporciona el renderer PNG estático por defecto.
    // Para headless o animación: render: async (resource, revision) => previews,
    evaluate: async request => revisarVisualmenteConLaIADelIDE(request),
    edit: async ({resourceId, revision, source}) => abrirARUEnElIDE({resourceId, revision, source}),
  },
  onResourceLibraryChange: records => guardarCatalogoDelIDE(records),
});
const id = await editor.stageResource({
  name: 'Reproducir', kind: 'icon', purpose: 'Iniciar reproducción', tags: ['audio'],
  svg: svgSaneado, source: {version: 1, filename: 'play.aru', text: fuenteCapturado},
  width: 24, height: 24,
});
const result = await editor.reviewResource(id);
if (result.status === 'approved') {
  await editor.insertResource(id, {parentId: 'pantalla', x: 32, y: 32});
  const exported = await editor.exportResource(id, {format: 'assets', platform: 'ios'});
  guardarArchivo(exported); // Base64 para ZIP/PNG; UTF-8 para SVG.
}
```

Estos puertos y métodos funcionan también con `mountCodaru` en el iframe. El anfitrión conserva la persistencia y las decisiones de modelo/costo. `getResourceLibrary()` entrega resúmenes; `getResource(id)` entrega una copia del candidato y su dictamen; `setResourceServices()` permite conectar los servicios después del montaje. `requestResourceEdit(id)` entrega una copia del fuente y la revisión al host.

Cambiar contenido, intención, dimensiones, etiquetas, referencia o servicios durante una revisión invalida esa admisión. Volver a hacer `stageResource` revoca la aprobación de esa entrada. Solo se permiten dos revisiones simultáneas. El desmontaje invalida el trabajo en curso; desmontar una vista modular conserva el núcleo y su catálogo para remontarlo.

El catálogo no se escribe dentro del proyecto ni tiene almacenamiento global implícito. Guarda el catálogo mediante el callback. Al cargarlo, pasa `record.resource` a `stageResource`: los campos externos `status` y `review` no son autoridad. Para ahorrar reevaluaciones, el IDE puede devolver un dictamen suyo previamente confiable **solo tras comprobar la revisión y los renders exactos**. No uses un callback que apruebe siempre.

La biblioteca exige aprobación para insertar copias o exportar SVG, PNG y ZIP móviles. El fuente ARU puede descargarse antes, para corregirlo. Las exportaciones normales de capas del documento siguen disponibles: este control de admisión corresponde a la biblioteca, no es un sistema de permisos del IDE. ZIP iOS/Android reutiliza los exportadores existentes; son imagesets/drawables, no AppIcon/adaptive launcher icons.

El CLI descubre `catalog --kind resources` y exporta `export --resource ID --format svg|png|assets|aru --output ...`. No existe una operación CLI para inventar una aprobación. Las revisiones se solicitan mediante el puerto del IDE.

Evidencia local: `tests/ui/resource-review-evidence.spec.ts` separa la captura de PNG de la evaluación real. El icono Musaru se inspeccionó a 256/24 px, con dictamen y hashes en `artifacts/resource-review`. Los tests de contrato usan evaluadores simulados explícitamente identificados.
