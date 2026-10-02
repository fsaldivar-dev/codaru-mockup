/** DOM ownership for independent editor fragments. No selectors or shortcuts escape the view. */
export const partSelectors = {
  canvas: '#stage', layers: '#layers', inspector: '#inspector', library: '#components',
  toolbar: '.toolbar', header: '.topbar', viewbar: '.canvas-top', breadcrumb: '.scope-bar',
  status: '.canvas-bottom', insert: '.insert-panel',
  modes: '.mode-switch', designTheme: '.theme-switch', fit: '.fit-button',
} as const;
export type EditorPart = keyof typeof partSelectors | 'dialogs';
/** Controls that live inside viewbar until they are mounted on their own. */
export const viewbarParts: readonly EditorPart[] = ['modes', 'designTheme', 'fit'];

export function createViewDOM(app: HTMLDivElement, modular: boolean) {
  const owner = app.ownerDocument, win = owner.defaultView!;
  const cleanup: Array<() => void> = [];
  const parts = {} as Record<EditorPart, HTMLElement>;
  const roots: HTMLElement[] = [app];
  for (const [name, selector] of Object.entries(partSelectors)) {
    parts[name as keyof typeof partSelectors] = app.querySelector<HTMLElement>(selector)!;
  }
  const dialogs = owner.createElement('div');
  const anchors = new Map<EditorPart, Comment>();
  if (modular) {
    for (const [name, part] of Object.entries(parts) as Array<[EditorPart, HTMLElement]>) {
      if (viewbarParts.includes(name)) { const anchor = owner.createComment(name); part.before(anchor); anchors.set(name, anchor); }
      else part.remove();
      part.hidden = false; roots.push(part);
    }
    for (const selector of ['#modal-root', '#toast', '#import-file', '#image-file']) dialogs.append(app.querySelector(selector)!);
    roots.push(dialogs);
  }
  parts.dialogs = dialogs;
  function all<E extends Element = Element>(selector: string): E[] {
    // Roots can be nested (viewbar controls), so matches are deduplicated.
    return [...new Set(roots.flatMap(root => [...(root.matches(selector) ? [root as unknown as E] : []), ...root.querySelectorAll<E>(selector)]))];
  }
  function nearestRoot(node: Node | null) {
    for (; node; node = node.parentNode) if (roots.includes(node as HTMLElement)) return node;
    return null;
  }
  function listen<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, callback: (event: HTMLElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
  function listen(target: EventTarget, type: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  function listen(target: EventTarget, type: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
    target.addEventListener(type, callback, options);
    cleanup.push(() => target.removeEventListener(type, callback, options));
  }
  const scopedListen = (type: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
    // Only the innermost root handles an event, so nested roots never run a callback twice.
    for (const root of roots) listen(root, type, event => {
      if (nearestRoot(event.target as Node | null) !== root) return;
      if (typeof callback === 'function') callback.call(root, event); else callback.handleEvent(event);
    }, options);
  };
  const activeElement = () => {
    let active = owner.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active && roots.some(root => root.contains(active)) ? active : null;
  };
  const proxy = new Proxy(owner, {
    get(target, key) {
      if (key === 'querySelector') return (selector: string) => all(selector)[0] ?? null;
      if (key === 'querySelectorAll') return all;
      if (key === 'getElementById') return (id: string) => all('#' + CSS.escape(id))[0] ?? null;
      if (key === 'activeElement') return modular ? activeElement() : target.activeElement;
      if (key === 'elementFromPoint') return (x: number, y: number) => {
        let hit = owner.elementFromPoint(x, y);
        for (let i = 0; hit?.shadowRoot && i < 10; i++) {
          const inner = hit.shadowRoot.elementFromPoint(x, y);
          if (!inner || inner === hit) break;
          hit = inner;
        }
        return hit;
      };
      if (key === 'addEventListener') return modular ? scopedListen : (type: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => listen(owner, type, callback, options);
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const events = new Proxy(app, {
    get(target, key) {
      if (key === 'addEventListener') return modular ? scopedListen : (type: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => listen(app, type, callback, options);
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return {
    document: proxy, events, parts, listen,
    onWindow: ((type: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => listen(win, type, callback, options)) as Window['addEventListener'],
    /** Return an unmounted viewbar control to its place inside viewbar. */
    restore(part: EditorPart) { anchors.get(part)?.after(parts[part]); },
    dispose() { cleanup.splice(0).forEach(fn => fn()); },
  };
}
