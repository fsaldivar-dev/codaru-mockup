# Plugin de Claude Code · Diseñar con Codaru Mockup

Dos skills para que un agente diseñe y revise en Codaru Mockup con criterio profesional. Son instrucciones propias de este proyecto, bajo su misma licencia BSD-3-Clause; no incluyen skills de terceros.

- **codaru-design** — flujo con el CLI y principios de diseño: jerarquía, espaciado, tipografía, color con tokens, plataformas, plegables y movimiento.
- **codaru-review** — revisión con `./codaru lint` y cómo corregir cada tipo de hallazgo.

## Usarlo

Con la app de Codaru Mockup abierta, desde la raíz de este repositorio:

```sh
claude --plugin-dir packages/claude-plugin
```

Los skills se activan solos cuando pides diseñar o revisar una maqueta, o los invocas como `/codaru-design:codaru-design` y `/codaru-design:codaru-review`.

Si prefieres no usar un plugin, copia las carpetas de `skills/` a `.claude/skills/` de tu proyecto.
