import { absolute, ancestors, children, isUnavailable, type DesignNode, type Project } from './model';

export type Scope = string | null;
export type Point = { x: number; y: number };

// A hit on a descendant selects its direct ancestor in the current scope.
export function atScope(p: Project, id: string | undefined, scope: Scope): DesignNode | undefined {
  let n = p.nodes.find(n => n.id === id);
  while (n && n.id !== scope) {
    if (n.parentId === scope) return isUnavailable(p, n) ? undefined : n;
    n = p.nodes.find(parent => parent.id === n!.parentId);
  }
}

export function commonScope(p: Project, ids: string[]): Scope {
  const paths = ids.map(id => [...ancestors(p, id).map(n => n.id), null]);
  return paths[0]?.find(id => paths.every(path => path.includes(id))) ?? null;
}

export function contains(p: Project, n: DesignNode, point: Point) {
  const a = absolute(p, n);
  return point.x >= a.x && point.y >= a.y && point.x <= a.x + n.width && point.y <= a.y + n.height;
}

// Background outside a container returns to the nearest enclosing scope.
export function scopeAtPoint(p: Project, scope: Scope, point: Point, hitId?: string): Scope {
  const path = hitId ? [hitId, ...ancestors(p, hitId).map(n => n.id)] : [];
  while (scope) {
    const n = p.nodes.find(n => n.id === scope);
    if (!n) return null;
    if (contains(p, n, point) || path.includes(scope)) return scope;
    scope = n.parentId;
  }
  return null;
}

export function inMarquee(p: Project, scope: Scope, start: Point, end: Point): string[] {
  const left = Math.min(start.x, end.x), top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x), bottom = Math.max(start.y, end.y);
  return children(p, scope).filter(n => {
    if (isUnavailable(p, n)) return false;
    const a = absolute(p, n);
    // Match only the portion visible through enclosing frame clips.
    let l = a.x, t = a.y, r = a.x + n.width, b = a.y + n.height;
    for (const frame of ancestors(p, n.id).filter(n => n.type === 'frame')) {
      const f = absolute(p, frame);
      l = Math.max(l, f.x); t = Math.max(t, f.y);
      r = Math.min(r, f.x + frame.width); b = Math.min(b, f.y + frame.height);
    }
    return r > l && b > t && l >= left && t >= top && r <= right && b <= bottom;
  }).map(n => n.id);
}
