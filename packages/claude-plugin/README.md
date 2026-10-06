# Plugin de Claude Code · Diseñar con Codaru Mockup

Dos skills para que un agente diseñe y revise en Codaru Mockup con criterio profesional. Son instrucciones propias de este proyecto, bajo su misma licencia BSD-3-Clause; no incluyen skills de terceros.

- **codaru-design** — flujo con el CLI y principios de diseño: jerarquía, espaciado, tipografía, color con tokens, plataformas, plegables y movimiento. Incluye `references/ios-hig.md`, una síntesis de las Human Interface Guidelines de Apple (Liquid Glass, barras, tipografía, color, controles) leída de la documentación oficial.
- **codaru-clone** — llevar una web o una app existente a Codaru: `scripts/snapshot.js` captura la página en el navegador (geometría, estilos, textos, SVG e imágenes) y la operación `dom` del CLI la importa como pantalla con su propio tema; o, en modo inspirarse, extrae una ficha de marca para diseñar el producto propio con ese estilo.
- **codaru-review** — revisión con `./codaru lint` y cómo corregir cada tipo de hallazgo.

## Usarlo

Con la app de Codaru Mockup abierta, desde la raíz de este repositorio:

```sh
claude --plugin-dir packages/claude-plugin
```

Los skills se activan solos cuando pides diseñar o revisar una maqueta, o los invocas como `/codaru-design:codaru-design` y `/codaru-design:codaru-review`.

Si prefieres no usar un plugin, copia las carpetas de `skills/` a `.claude/skills/` de tu proyecto.
