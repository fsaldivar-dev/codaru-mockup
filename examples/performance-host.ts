import { createEditor, createEditorView, type CodaruInvoke } from '../src/modular';
import { getEditorSession } from '../src/editor-core';
import type { Project } from '../src/model';
import design from './musaru-styles/design.codaru.json';
import riso from './style-packages/riso-editorial.codaru-style.json';

const el = (id: string) => document.getElementById(id)!;
const phases: Array<{ phase: string; ms: number }> = [];
const editor = createEditor({ document: design as unknown as Project });
const session = getEditorSession(editor);
const commit = session.store.commit.bind(session.store);
const commitPrepared = session.store.commitPrepared.bind(session.store);
session.store.commitPrepared = prepared => { const at = performance.now(); try { commitPrepared(prepared); } finally { phases.push({ phase: 'publish', ms: performance.now() - at }); } };
session.store.commit = edit => { const at = performance.now(); try { commit(edit); } finally { phases.push({ phase: 'liveCommit', ms: performance.now() - at }); } };
const bind = session.bindView.bind(session);
session.bindView = hooks => bind({ ...hooks, render: () => { const at = performance.now(); try { hooks.render(); } finally { phases.push({ phase: 'render', ms: performance.now() - at }); } } });
const native = (window as unknown as { __TAURI_INTERNALS__?: { invoke: CodaruInvoke } }).__TAURI_INTERNALS__;
const view = createEditorView(editor, { invoke: native?.invoke.bind(native), nativeAgent: !!native, appearance: { theme: 'dark' } });
for (const part of ['canvas', 'layers', 'inspector', 'library', 'toolbar', 'dialogs'] as const) view.mount(part, el(part + '-slot'));
editor.select(['style-pop']); view.fit(true);
let running = false;
// Background WKWebViews can suspend rAF; retain CPU timings without inventing frame samples.
let frameTimeouts = 0;
const frame = () => new Promise<number>(resolve => {
  const timeout = setTimeout(() => { frameTimeouts++; cancelAnimationFrame(id); resolve(performance.now()); }, 150);
  const id = requestAnimationFrame(now => { clearTimeout(timeout); resolve(now); });
});
const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)] ?? 0;
async function run() {
  if (running) return;
  running = true; (el('run') as HTMLButtonElement).disabled = true;
  const results: unknown[] = []; frameTimeouts = 0;
  const base = editor.getDocument();
  try {
    const text = base.nodes.find(n => n.id === 'style-pop-mobile-track')!;
    const master = base.nodes.find(n => n.id === 'style-pop-radio-track') ?? base.nodes.find(n => n.id === 'style-pop-transport')!;
    const editable = base.nodes.filter(n => n.type === 'text' && !n.instanceOf && !n.componentId).slice(0, 100);
    for (const scenario of ['single-text', 'master', '100-updates'] as const) {
      const samples = [];
      for (let i = 0; i < 5; i++) {
        el('status').textContent = `${scenario} · ${i + 1}/5`;
        const contextAt = performance.now();
        const ctx = await editor.agent('context', { scope: text.id, depth: 0 });
        const contextMs = performance.now() - contextAt;
        const operations = scenario === '100-updates'
          ? editable.map(n => ({ op: 'update', id: n.id, patch: { text: `${n.text} ${i % 2 ? 'B' : 'A'}` } }))
          : [{ op: 'update', id: scenario === 'master' ? master.id : text.id, patch: { text: `${scenario === 'master' ? master.text : text.text} ${i % 2 ? 'B' : 'A'}` } }];
        phases.length = 0;
        let active = true, last = await frame(); const gaps: number[] = [];
        const watch = (now: number) => { gaps.push(now - last); last = now; if (active) requestAnimationFrame(watch); };
        requestAnimationFrame(watch);
        const at = performance.now();
        const result = await editor.agent('apply', { expectedRevision: ctx.context!.revision, operations });
        const applyMs = performance.now() - at;
        if (!result.ok) throw new Error(result.error?.message);
        await frame(); await frame(); active = false;
        // Real selection/camera calls against the same mounted editor, after the edit settles.
        const interactionAt = performance.now(); editor.select([i % 2 ? 'style-pop' : 'style-pop-mobile']); editor.setViewport({ zoom: .7 + i * .01 });
        const interactionMs = performance.now() - interactionAt;
        samples.push({ contextMs, applyMs, maxFrameGapMs: gaps.length ? Math.max(...gaps) : null, interactionMs, phases: [...phases] });
      }
      results.push({ scenario, samples, p95ApplyMs: percentile(samples.map(s => s.applyMs), .95), p95InteractionMs: percentile(samples.map(s => s.interactionMs), .95) });
    }
    const report = { environment: native ? 'Tauri/WKWebView' : navigator.userAgent, visibility: document.visibilityState, frameTimeouts, nodes: base.nodes.length, documentBytes: new TextEncoder().encode(JSON.stringify(base)).length, results };
    Object.assign(window, { renderBenchmarkReport: report });
    el('summary').textContent = JSON.stringify({ environment: report.environment, visibility: report.visibility, frameTimeouts, results: (results as Array<{ scenario: string; p95ApplyMs: number; p95InteractionMs: number }>).map(r => ({ scenario: r.scenario, apply: Math.round(r.p95ApplyMs), interaction: Math.round(r.p95InteractionMs) })) });
    el('report').textContent = JSON.stringify(report, null, 2);
    el('status').textContent = 'Medición terminada · copia de prueba restaurada';
  } finally {
    editor.importDocument(base); running = false; (el('run') as HTMLButtonElement).disabled = false;
  }
}
function showLibrary(tab:'resources'|'styles'){el('layers-slot').hidden=true;el('library-slot').hidden=false;el('library-slot').querySelector('[data-codaru-part="library"]')?.shadowRoot?.querySelector<HTMLButtonElement>(`[data-library="${tab}"]`)?.click();}
el('resources').onclick=()=>showLibrary('resources');
el('styles').onclick=()=>{editor.importStyle(riso);showLibrary('styles');};
el('layers').onclick=()=>{el('library-slot').querySelector('[data-codaru-part="library"]')?.shadowRoot?.querySelector<HTMLButtonElement>('[data-library="local"]')?.click();el('layers-slot').hidden=false;el('library-slot').hidden=true;};
el('run').onclick = () => void run().catch(error => { el('report').textContent = String(error); });
Object.assign(window, { renderBenchmark: { editor, view, run } });
window.addEventListener('pagehide', () => editor.destroy(), { once: true });
