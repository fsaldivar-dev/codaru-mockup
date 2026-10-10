# Actualizar Sajaru desde codaru-mockup 0.8.0 a 0.10.0

La versión 0.10.0 añade fuentes del consumidor y sus capacidades compartidas entre la UI y la IA. La instalación de Sajaru no se modifica automáticamente.

## Instalación

Desde la carpeta de Sajaru:

```sh
npm install codaru-mockup@0.10.0
```

También puedes instalar el `.tgz` del release con `npm install /ruta/codaru-mockup-0.10.0.tgz`.

Si usas iframe, copia los assets de esta versión en una carpeta nueva y cambia `editorUrl`:

```sh
npx codaru-assets public/codaru-0.10.0
```

No conservar el editor HTML/JS de 0.8.0 junto al wrapper nuevo. La integración modular importa `codaru-mockup/modular` directamente y no necesita copiar el editor iframe. Si utilizas CLI nativo, incorpora `packages/tauri-plugin-codaru` 0.10.0 y el CLI compilado; el plugin anterior no conoce el nuevo comando `fonts`. Conserva los permisos existentes y un socket privado por host.

## Registro y validación por capacidades

Empaqueta los archivos y licencias en Sajaru. Para Vite/Tauri puedes importar `./fonts/marca.woff2?url`; entrega el URL generado al catálogo del editor. No guardes el URL temporal ni el registro en el JSON del diseño. Vuelve a registrar IDs al abrir cada proyecto. Pasa `fonts` a `createEditor` o a `mountCodaru`, o llama `registerFonts` en la API resultante. Espera `loadFonts` antes de seleccionar una nueva fuente o medir/exportar.

Elimina la validación fija `enum(['system','serif','mono'])` de Sajaru, sus formularios, prompts y esquemas del agente. Distingue validación del documento y validación de una edición:

```ts
// Un documento importado acepta IDs válidos aunque falte el recurso.
// Mantiene el valor y presenta editor.getFontIssues(); nunca lo convierte a system.
import { validFontId } from 'codaru-mockup/fonts';
if (!validFontId(node.fontFamily)) throw new Error('ID de fuente inválido');

// Una nueva selección debe existir en las capacidades actuales.
const catalog = await editor.getFonts(); // await sirve también para la API iframe.
const face = catalog.find(f => f.id === requested.fontFamily);
if (!face) throw new Error(`Fuente ausente: ${requested.fontFamily}`);
if (!face.builtin && !face.variants.some(v =>
  v.weight === requested.fontWeight &&
  v.style === (requested.fontStyle ?? 'normal') && v.status === 'loaded')) {
  throw new Error('Variante no disponible; consulta el catálogo actualizado');
}
```

Los genéricos (`builtin:true`) mantienen pesos intermedios heredados; su aspecto depende del sistema. Las fuentes personalizadas requieren pareja exacta. No reemplaces una familia ausente con la primera opción del selector. Muestra estado/carga/error y ofrece cargar el recurso o elegir otra fuente explícitamente.

Para la IA consulta `agent('schema')` y `agent('catalog',{kind:'fonts'})`; el contexto de un texto incluye la tipografía resuelta por tokens. Actualiza las instrucciones para permitir composiciones libres: familia y jerarquía se deciden sobre recursos disponibles, sin recetarios obligatorios. Conserva `expectedRevision`, dry-run y propuestas separadas de cambios.

## Exportación y aceptación en Sajaru

Sustituye exportación síncrona de fuentes personalizadas por `exportSVGAsync` / `exportHTMLAsync` (disponibles también en la API iframe). En assets usa `exportAsset` con los archivos autorizados para inclusión. `local()` sólo funciona como referencia: para exportar entrega bytes por URL y permiso `export:'embed'`. Revisa CSP/CORS y las licencias; consulta [Tipografía](TYPOGRAPHY.md) para restricciones de formatos.

Comprueba en el IDE real: dos familias, pesos 400/700, cursiva real, texto largo en dimensiones explícitas, ausencia de una fuente y su posterior registro; selección manual/IA, tokens, instancia con sobrescritura, undo/redo, guardar/reabrir y desmontar conservando una edición humana. Abre un HTML/SVG exportado y compara el PNG. El paquete se prueba en consumidor limpio; la instalación de Sajaru no se modifica automáticamente por esta entrega.
