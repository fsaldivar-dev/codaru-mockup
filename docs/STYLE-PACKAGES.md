# Lenguajes visuales externos

Un estilo portátil `codaru-style/1` contiene identidad/versionado, un `DesignTheme` completo (claro/oscuro, colores, degradados, materiales, tipografía y radios), y guías separadas de composición, tipografía, controles, móvil, movimiento y cosas a evitar. Opcionalmente aporta una paleta e instrucciones para ARU. No contiene JavaScript, comandos ejecutables ni un layout fijo.

El ejemplo `examples/style-packages/riso-editorial.codaru-style.json` añade risografía editorial, fuera del laboratorio Musaru. En Biblioteca → Estilos puedes importar JSON, leer sus guías (incluida móvil), aplicar tokens a una pantalla seleccionada o al proyecto, y exportar el archivo portátil.

```ts
import {parseStylePackage} from 'codaru-mockup/styles';
const style = parseStylePackage(jsonExterno);
editor.importStyle(style); // Un paso de Deshacer; persiste en el documento.
editor.applyStyle(style.id, {frameId: 'inicio', mode: 'light'});
const guidance = editor.getStyle(style.id)?.guidance;
```

Importar no cambia las capas; aplicar copia los tokens a `style-ID` y asigna ese tema al ámbito elegido. Las geometrías y los controles quedan intactos. Los colores, fuentes, radios y degradados cambian en elementos que usen las referencias correspondientes. Si un diseño exige tokens ausentes en el tema entrante, la validación rechaza la transacción completa. Los temas existentes y las personalizaciones del IDE permanecen separados.

Para diseñar realmente otro estilo, la IA lee sus guías y cambia la composición con operaciones de diseño: jerarquía, navegación, controles, ilustraciones y versión móvil. Una paleta nueva por sí sola no constituye un rediseño.

El CLI admite operaciones `style.import {data:paquete}` y `style.apply {id,frameId?,mode?}` en el flujo habitual de revisión esperada, dry-run y apply. `catalog --kind styles` lista estilos, `--kit ID` entrega el paquete completo. `context` incluye el catálogo y `styleGuidance` del primer nodo raíz del contexto; para ámbitos con varios temas usa scopes concretos. El contexto resume cada categoría en cuatro líneas de hasta 240 caracteres e indica `styleGuidanceTruncated`; consulta `catalog --kind styles --kit ID` para leer todo. Las descripciones resumidas indican `textTruncated`. Las guías se entregan como contenido, no instrucciones de sistema.

Los documentos sin este campo siguen funcionando. `stylePackages` es opcional, compatible con lectura v1/v2. El catálogo admite 100 paquetes; sigue vigente el límite de 32 temas materializados por documento. Reimportar el mismo ID sustituye su definición; vuelve a aplicar explícitamente sus tokens cuando quieras actualizar el tema activo.

El campo `aru` comunica paleta y dirección de dibujo al anfitrión: no registra automáticamente estilos en ARU ni en Codaru Desktop. Cada host decide cómo pasar esas guías a su herramienta y mantiene la revisión visual obligatoria de los nuevos recursos.
