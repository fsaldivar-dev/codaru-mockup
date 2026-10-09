import { sameData } from './content-cache';
// Visual feedback while an agent builds the design: particles that settle into each new or
// changed element, a "Diseñando…" pill with a magnifying bubble, and skeletons for frames an
// agent created but has not filled yet. Nothing here touches the model.
import type { DesignNode, Project } from './model';
import { absolute, clone, isNormalizedProject, layoutProject, syncComponents, validate } from './model';

export type Camera = () => { pan: { x: number; y: number }; zoom: number };

type Particle = { x0: number; y0: number; x1: number; y1: number; size: number; delay: number; phase: number };
type Burst = { node: string; start: number; particles: Particle[] };

const PARTICLE_LIFE = 950, SETTLE = 4000, SESSION = 20000, MAGNIFY = 1.7;

export function createBuildingFeedback(options: { stage: HTMLElement; artboards: () => HTMLElement; project: () => Project; camera: Camera; document?: Document }) {
  const doc = options.document ?? document;
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = doc.createElement('canvas'); canvas.className = 'building-layer'; canvas.setAttribute('aria-hidden', 'true');
  const pill = doc.createElement('div'); pill.className = 'building-pill'; pill.setAttribute('role', 'status'); pill.hidden = true;
  pill.innerHTML = '<span class="building-dot"></span><span class="building-text"></span><span class="building-lens" aria-hidden="true"><span class="building-lens-text"></span></span>';
  options.stage.append(canvas, pill);
  const textEl = pill.querySelector<HTMLElement>('.building-text')!, lens = pill.querySelector<HTMLElement>('.building-lens')!, lensText = pill.querySelector<HTMLElement>('.building-lens-text')!;

  let bursts: Burst[] = [], changes = 0, frames = new Set<string>(), lastApply = 0, raf = 0, hideTimer: ReturnType<typeof setTimeout> | undefined, disposed = false;
  const created = new Map<string, number>();

  // The bubble magnifies the pill text under the pointer: a scaled copy, offset so the point under
  // the cursor stays put, clipped by a circle that follows the pointer.
  pill.addEventListener('pointerenter', () => pill.classList.add('lens-on'));
  pill.addEventListener('pointerleave', () => pill.classList.remove('lens-on'));
  pill.addEventListener('pointermove', e => {
    const r = pill.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    lens.style.left = `${x}px`; lens.style.top = `${y}px`;
    lensText.style.transform = `translate(${-x * (MAGNIFY - 1)}px,${-y * (MAGNIFY - 1)}px) scale(${MAGNIFY})`;
  });

  // Compare against what the store itself would produce, so the one-time normalization of a freshly
  // opened document (component sync, auto layout, defaults) never reads as agent changes.
  function snapshot(p: Project) {
    let base = p;
    if (!isNormalizedProject(p)) {
      base = clone(p);
      try { syncComponents(base); layoutProject(base); base = validate(base); } catch { base = p; }
    }
    return new Map(base.nodes.map(n => [n.id, n]));
  }

  // Called around an agent commit: diff the project before/after and start a burst per node that
  // appeared or changed. Returns the ids so the caller can mark their DOM.
  function track(before: Map<string, DesignNode>, p: Project) {
    const now = performance.now(), touched: string[] = [];
    for (const n of p.nodes) {
      const prev = before.get(n.id);
      if (sameData(prev, n)) continue;
      touched.push(n.id);
      if (prev === undefined && n.type === 'frame') created.set(n.id, now);
      const frame = frameIdOf(p, n); if (frame) frames.add(frame);
    }
    if (!touched.length) return touched;
    changes += touched.length; lastApply = now;
    if (!reduced()) {
      const nodes = new Map(p.nodes.map(n => [n.id, n])), rect = options.stage.getBoundingClientRect(), camera = options.camera();
      let budget = Math.max(0, 1200 - bursts.reduce((sum, b) => sum + b.particles.length, 0));
      for (const id of touched) {
        if (!budget) break;
        const n = nodes.get(id)!; if (n.hidden) continue;
        const at = absolute(p, n), x = at.x * camera.zoom + camera.pan.x, y = at.y * camera.zoom + camera.pan.y;
        if (x > rect.width || y > rect.height || x + n.width * camera.zoom < 0 || y + n.height * camera.zoom < 0) continue;
        const particles = scatter(p, n).slice(0, budget); budget -= particles.length;
        bursts.push({ node: id, start: now, particles });
      }
    }
    showPill(); tick();
    return touched;
  }

  function scatter(p: Project, n: DesignNode): Particle[] {
    const at = absolute(p, n), w = Math.max(n.width, 4), h = Math.max(n.height, 4);
    // Big surfaces get more dots, but not so many that a full screen becomes a blizzard.
    const count = Math.round(Math.min(220, Math.max(16, Math.sqrt(w * h) / 2.4)));
    const spread = Math.max(40, Math.min(w, h) * .6);
    return Array.from({ length: count }, () => {
      const x1 = at.x + Math.random() * w, y1 = at.y + Math.random() * h, a = Math.random() * Math.PI * 2, d = spread * (.4 + Math.random());
      return { x0: x1 + Math.cos(a) * d, y0: y1 + Math.sin(a) * d, x1, y1, size: 5 + Math.random() * 6, delay: Math.random() * 220, phase: Math.random() * Math.PI * 2 };
    });
  }

  function tick() { if (!raf && !disposed) raf = requestAnimationFrame(draw); }

  function draw() {
    raf = 0; if (disposed) return;
    const now = performance.now(), rect = options.stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) { canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); }
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    const { pan, zoom } = options.camera();
    bursts = bursts.filter(b => now - b.start < PARTICLE_LIFE + 260);
    const accent = getComputedStyle(options.stage).getPropertyValue('--accent').trim() || '#a18aee';
    ctx.fillStyle = accent; ctx.shadowColor = accent; ctx.shadowBlur = 6;
    for (const b of bursts) for (const q of b.particles) {
      const t = Math.min(1, Math.max(0, (now - b.start - q.delay) / PARTICLE_LIFE)); if (t <= 0) continue;
      const e = 1 - Math.pow(1 - t, 3), x = q.x0 + (q.x1 - q.x0) * e, y = q.y0 + (q.y1 - q.y0) * e;
      const twinkle = .6 + .4 * Math.sin(now / 90 + q.phase), size = q.size * (1 - t * .55) * twinkle;
      ctx.globalAlpha = (t < .15 ? t / .15 : 1 - Math.max(0, (t - .6) / .4)) * .95;
      ctx.beginPath(); ctx.arc(x * zoom + pan.x, y * zoom + pan.y, Math.max(1.2, size), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    canvas.classList.toggle('active', bursts.length > 0);
    if (bursts.length) tick();
  }

  function showPill() {
    const n = frames.size;
    const text = `Diseñando · ${n} ${n === 1 ? 'pantalla' : 'pantallas'}, ${changes} ${changes === 1 ? 'cambio' : 'cambios'}`;
    textEl.textContent = text; lensText.textContent = text; pill.hidden = false; pill.classList.add('visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { pill.classList.remove('visible'); setTimeout(() => { if (!pill.classList.contains('visible')) { pill.hidden = true; changes = 0; frames = new Set(); } }, 300); }, SETTLE);
  }

  // Frames created by the agent in this session and still empty read as skeletons, not blank cards.
  function decorate(p: Project, touched: string[]) {
    const root = options.artboards(), now = performance.now();
    for (const [id, at] of created) if (now - at > SESSION || !p.nodes.some(n => n.id === id)) created.delete(id);
    for (const [id] of created) {
      if (p.nodes.some(n => n.parentId === id)) { created.delete(id); continue; }
      root.querySelector<HTMLElement>(`.design-node[data-node="${id}"]`)?.classList.add('building-skeleton');
    }
    if (reduced() || !touched.length) return;
    for (const id of touched) root.querySelector<HTMLElement>(`.design-node[data-node="${id}"]`)?.classList.add('building-in');
  }

  function dispose() { disposed = true; cancelAnimationFrame(raf); clearTimeout(hideTimer); canvas.remove(); pill.remove(); }

  return { snapshot, track, decorate, dispose, active: () => !pill.hidden || bursts.length > 0, lastApply: () => lastApply };
}

function frameIdOf(p: Project, n: DesignNode): string | null {
  let cur: DesignNode | undefined = n;
  while (cur && cur.type !== 'frame') cur = p.nodes.find(x => x.id === cur!.parentId);
  return cur?.id ?? null;
}
