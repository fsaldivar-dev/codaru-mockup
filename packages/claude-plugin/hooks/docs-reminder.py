#!/usr/bin/env python3
"""Recordatorio de documentación del sistema de diseño.

Se ejecuta tras cada comando Bash del agente. Si el comando fue un `codaru apply` real (no --dry-run),
consulta `codaru context` y, cuando hay fichas desactualizadas o conjuntos propios sin documentar,
devuelve contexto adicional para que el agente actualice `component.doc` / `designSystem.set`.
No modifica nada; el mismo aviso no se repite mientras la situación no cambie."""
import json, os, subprocess, sys, tempfile, hashlib

def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return
    command = str((payload.get('tool_input') or {}).get('command', ''))
    if 'codaru' not in command or 'apply' not in command or '--dry-run' in command:
        return
    cwd = payload.get('cwd') or os.getcwd()
    cli = next((c for c in (os.path.join(cwd, 'codaru'), 'codaru') if os.path.exists(c) or c == 'codaru'), None)
    try:
        out = subprocess.run([cli, 'context', '--depth', '0'], cwd=cwd, capture_output=True, text=True, timeout=10).stdout
        context = json.loads(out).get('context', {})
    except Exception:
        return
    components = context.get('components') or []
    stale = [c for c in components if c.get('docStale')]
    sets = {}
    for c in components:
        sets.setdefault(c.get('set') or c['id'], c)
    undocumented = [c for c in sets.values() if not c.get('documented') and not str(c.get('set') or c['id']).startswith('kit-')]
    ds_stale = bool(context.get('designSystemStale'))
    if not stale and not undocumented and not ds_stale:
        return
    signature = hashlib.sha1(json.dumps({'s': sorted(c['id'] for c in stale), 'u': sorted(c['id'] for c in undocumented), 'd': ds_stale, 'r': context.get('revision')}, sort_keys=True).encode()).hexdigest()
    marker = os.path.join(tempfile.gettempdir(), 'codaru-docs-reminder-' + hashlib.sha1(cwd.encode()).hexdigest()[:10])
    try:
        if open(marker).read().strip() == signature:
            return
    except Exception:
        pass
    try:
        open(marker, 'w').write(signature)
    except Exception:
        pass
    names = lambda items: ', '.join((c.get('setName') or c['name']) + ' (' + c['id'] + ')' for c in items[:8]) + (' …' if len(items) > 8 else '')
    lines = ['Sistema de diseño: el lote cambió el documento.']
    if stale:
        lines.append(f'{len(stale)} con documentación anterior al cambio: {names(stale)}. Actualiza component.doc o envía {{}} si sigue vigente.')
    if ds_stale:
        lines.append('El tema cambió después de escribir los fundamentos: revisa designSystem.set (color, typography, spacing) o envía {} si siguen vigentes.')
    if undocumented:
        lines.append(f'{len(undocumented)} conjuntos propios sin documentar: {names(undocumented)}. Si son parte del sistema, documéntalos (description, why, when, how, do, dont).')
    print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PostToolUse', 'additionalContext': ' '.join(lines)}}, ensure_ascii=False))

if __name__ == '__main__':
    main()
