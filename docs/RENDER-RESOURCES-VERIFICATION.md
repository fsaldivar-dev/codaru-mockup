# Render, recursos ARU y estilos externos

Verificación local del 8 de octubre de 2026. Los cambios están en el código y en el paquete local; esta tarea no publica una versión.

## Rendimiento medido

La prueba monta el proyecto Musaru completo: 2,022 objetos y 9,060,819 bytes. Ejecuta cinco muestras por escenario usando operaciones reales del agente; restaura su propia copia al terminar. Cada lote conserva una sola entrada de historial. Los tiempos p95 con cinco muestras son sensibles a variaciones del equipo y no representan una garantía para todos los documentos.

| Escenario | Chromium antes, p95 | Chromium final, p95 | Reducción | Interacción posterior, p95 |
| --- | ---: | ---: | ---: | ---: |
| Cambiar texto | 330.0 ms | 165.5 ms | 49.8% | 14.8 ms |
| Modificar maestro | 336.5 ms | 166.5 ms | 50.5% | 14.9 ms |
| Lote de 100 cambios | 340.4 ms | 156.2 ms | 54.1% | 15.3 ms |

El resultado final de Chromium tiene visibilidad `visible` y cero esperas agotadas de `requestAnimationFrame`. Las mejoras evitan validaciones/copias repetidas, indexan relaciones y reutilizan DOM y SVG sin conservar firmas basadas solamente en longitud. Hay cachés limitadas por cantidad y memoria. El procesamiento del lote sigue siendo síncrono: estos resultados no prometen 60 fps durante una edición grande.

Evidencia reproducible: `artifacts/render-performance/baseline-chromium.json` y `final-chromium.json`. Comando:

```sh
CODARU_PERF_LABEL=final npx playwright test tests/ui/render-benchmark.spec.ts --project=ui --workers=1 --reporter=line
```

La compilación nativa final obtuvo 193/177/155 ms de aplicación y 22/20/20 ms de interacción con WKWebView `visible` y cero esperas agotadas de rAF. Se observó la copia restaurada al terminar y se inspeccionaron los paneles Recursos/Estilos, incluido su repintado. Los valores redondeados mostrados por la app están conservados en `final-native-observed.json`. La línea base nativa y un intento intermedio reportaron `hidden`, por lo que **no permiten afirmar una mejora porcentual nativa**; el intento oculto se conserva en `final-native-hidden-observed.json` para distinguirlo de la aceptación visible.

## Biblioteca ARU y revisión

- El proyecto Musaru descubre 470 dibujos, con identidad por contenido, propósito, etiquetas y origen. El catálogo independiente y las miniaturas se cargan por páginas.
- Un candidato importado comienza pendiente. La aprobación requiere que el IDE compile la fuente, genere PNG reales y aporte un evaluador de IA que inspeccione esas imágenes. Cambiar contenido, intención o servicios invalida una evaluación en curso y la aprobación anterior.
- Reutilizar y exportar SVG/PNG/recursos móviles desde la biblioteca exige aprobación. La fuente ARU puede exportarse pendiente para corregirla. El CLI no ofrece un atajo para aprobar.
- La biblioteca no incluye un modelo ni un aprobador automático. El IDE debe configurar `resourceServices` y guardar explícitamente el catálogo. Las respuestas simuladas de las pruebas no constituyen validación de IA.
- Una respuesta tardía del catálogo o de sus miniaturas conserva la pestaña actual. Se corrigió una carrera que podía reemplazar Estilos por Recursos después de navegar; dos pruebas retrasan esas respuestas deliberadamente.
- El icono de Musaru fue inspeccionado por la IA de esta sesión en PNG de 256 y 24 px. La evidencia vincula fuente, revisión y hashes de píxeles. La exportación aprobada produjo un ZIP con SVG, fuente ARU y ocho PNG para iOS/Android; se verificaron integridad y dimensiones.
- El exportador móvil produce imágenes de recursos (`imageset`/`drawable`), no todos los requisitos de un icono de lanzamiento. Las animaciones requieren un renderer del host con al menos tres muestras temporales distintas; el renderer predeterminado es estático.

Evidencia: `artifacts/resource-review/`, incluido `musaru-approved-ios-android.zip` y `mobile-export-verified.json`. El CLI nativo exportó la fuente original sin alterarla y rechazó exportar SVG de un candidato pendiente. Contrato: `docs/RESOURCE-LIBRARY.md`.

## Estilos portables

Se pueden importar y exportar paquetes `codaru-style/1` con tokens, degradados, temas claro/oscuro y guías separadas para composición, controles, tipografía, móvil, movimiento y ARU. La IA los descubre por contexto y catálogo. El ejemplo nuevo es Risografía editorial, disponible en `examples/style-packages/`.

Aplicar tokens mantiene la geometría. Las guías permiten diseñar una composición propia; no generan automáticamente otra pantalla ni instalan presets en ARU. El catálogo admite hasta 100 paquetes; el límite existente de 32 temas materializados permanece. Contrato: `docs/STYLE-PACKAGES.md`.

## Comprobaciones e integración

- TypeScript limpio; 165 pruebas de modelo/arquitectura; 19 pruebas Rust.
- Suite de interfaz: 117 aprobadas y una captura manual de IA omitida por diseño. Tras corregir la carrera del panel, las siete pruebas específicas de Recursos/Estilos pasaron, incluidas dos regresiones nuevas. La captura/revisión real se ejecutó aparte; la reproducción y exportación con sus hashes también pasaron.
- Benchmark final con comprobación de los accesos a Recursos/Estilos aprobado. Pruebas específicas de estilos, recursos, aislamiento, revisión concurrente, desmontaje e iframe aprobadas.
- Paquete instalado desde su tarball en un consumidor limpio: núcleo, tipos TypeScript, superficies fragmentadas e iframe verificados, incluida revisión de su captura de interfaz.
- Compilación Tauri final y CLI listos. El banco de prueba usa `dev.codaru.render-qa` y `/tmp/codaru-render-qa/agent.sock`, sin reemplazar la sesión de trabajo de la persona.

Los contratos compartidos permanecen independientes de adaptadores de interfaz; el IDE conserva persistencia, modelo de IA, edición de fuentes y personalización. No se añadió un servidor Node ni un framework en ejecución.

## Peso por entrega

| Entrega | Bytes | Alcance |
| --- | ---: | --- |
| Runtime embebible | 1,209,003 | Suma de JS/CSS/HTML de todas las entradas |
| Runtime gzip | 388,315 | Compresión por archivo; no es memoria RAM |
| Distribución del editor | 1,365,865 | Runtime, tipos y licencias |
| Tarball npm local | 418,585 | `/tmp/codaru-mockup-0.7.0.tgz` |
| CLI opcional | 453,216 | Ejecutable local de esta plataforma |
| App de ejemplo QA | 5,812,102 | Bundle Tauri local, 5.54 MiB |

El tamaño del frontend no equivale al incremento del ejecutable del IDE. Ese incremento debe medirse al enlazar el plugin en el anfitrión real.
