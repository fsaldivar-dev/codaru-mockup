/** One shared popover for every color: theme palette, custom solids and, for fills, theme and custom gradients. */
export interface GradientValue { type: 'linear' | 'radial'; angle: number; stops: Array<{ color: string; position: number }>; }
export interface PickerContext {
  /** Resolve a token reference to a HEX color or `transparent`. */
  resolve(value: string): string;
  /** Theme color tokens, by id, already resolved. */
  tokens: Record<string, string>;
}
export interface GradientOptions {
  /** The fill's current gradient, custom or from the theme. */
  value?: GradientValue;
  /** Id of the linked theme gradient, when the fill uses one. */
  themeId?: string;
  theme: Array<{ id: string; name: string; value: GradientValue }>;
  commit(value: GradientValue): void;
  pickTheme(id: string): void;
}
interface PickerOptions extends PickerContext { anchor: HTMLElement; value: string; commit(value: string): void; gradient?: GradientOptions; }

/**
 * Starting points in the families that current interface work leans on: aurora blends of teal,
 * violet and pink, warm sunsets, soft pastels, neon on dark, and muted earth tones. Original values.
 */
export const gradientSuggestions: Array<{ name: string; value: GradientValue }> = [
  { name: 'Aurora', value: { type: 'linear', angle: 135, stops: [{ color: '#22d3ee', position: 0 }, { color: '#818cf8', position: 45 }, { color: '#e879f9', position: 100 }] } },
  { name: 'Boreal', value: { type: 'linear', angle: 120, stops: [{ color: '#0f172a', position: 0 }, { color: '#0e7490', position: 40 }, { color: '#34d399', position: 75 }, { color: '#a7f3d0', position: 100 }] } },
  { name: 'Laguna', value: { type: 'linear', angle: 90, stops: [{ color: '#2a7b9b', position: 0 }, { color: '#57c785', position: 50 }, { color: '#eddd53', position: 100 }] } },
  { name: 'Atardecer', value: { type: 'linear', angle: 160, stops: [{ color: '#fde68a', position: 0 }, { color: '#fb923c', position: 35 }, { color: '#f43f5e', position: 70 }, { color: '#7c3aed', position: 100 }] } },
  { name: 'Durazno', value: { type: 'linear', angle: 135, stops: [{ color: '#ffe4d6', position: 0 }, { color: '#ffb199', position: 55 }, { color: '#ff8fa3', position: 100 }] } },
  { name: 'Holográfico', value: { type: 'linear', angle: 110, stops: [{ color: '#fbc2eb', position: 0 }, { color: '#a6c1ee', position: 35 }, { color: '#c2f5e9', position: 68 }, { color: '#fdf3c0', position: 100 }] } },
  { name: 'Lavanda', value: { type: 'linear', angle: 180, stops: [{ color: '#eef2ff', position: 0 }, { color: '#c7d2fe', position: 50 }, { color: '#f5d0fe', position: 100 }] } },
  { name: 'Neón', value: { type: 'linear', angle: 135, stops: [{ color: '#0b1026', position: 0 }, { color: '#4f46e5', position: 45 }, { color: '#db2777', position: 80 }, { color: '#fb7185', position: 100 }] } },
  { name: 'Medianoche', value: { type: 'radial', angle: 0, stops: [{ color: '#6366f1', position: 0 }, { color: '#312e81', position: 45 }, { color: '#0b1026', position: 100 }] } },
  { name: 'Brasa', value: { type: 'radial', angle: 0, stops: [{ color: '#fef08a', position: 0 }, { color: '#f97316', position: 45 }, { color: '#9f1239', position: 100 }] } },
  { name: 'Tierra', value: { type: 'linear', angle: 135, stops: [{ color: '#e7d8c9', position: 0 }, { color: '#c49a6c', position: 50 }, { color: '#6f4e37', position: 100 }] } },
  { name: 'Salvia', value: { type: 'linear', angle: 150, stops: [{ color: '#f1f5e9', position: 0 }, { color: '#b7c9a8', position: 50 }, { color: '#5f7a61', position: 100 }] } },
];

let active: (() => void) | null = null;
export function closeColorPicker() { active?.(); }

function parse(color: string) {
  let hex = /^#([\da-f]{3,8})$/i.exec(color)?.[1] ?? '';
  if (hex.length === 3 || hex.length === 4) hex = [...hex].map(c => c + c).join('');
  if (hex.length !== 6 && hex.length !== 8) return { r: 255, g: 255, b: 255, a: color === 'transparent' ? 0 : 1 };
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1 };
}
function toHSV(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  const h = !d ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: max ? d / max : 0, v: max };
}
function toRGB(h: number, s: number, v: number) {
  const f = (n: number) => { const k = (n + h / 60) % 6; return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255); };
  return [f(5), f(3), f(1)];
}
const pair = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
const hexOf = (r: number, g: number, b: number, a: number) => `#${pair(r)}${pair(g)}${pair(b)}${a < 1 ? pair(a * 255) : ''}`;
const copy = (g: GradientValue): GradientValue => ({ type: g.type, angle: g.angle, stops: g.stops.map(stop => ({ ...stop })) });

export function openColorPicker(options: PickerOptions) {
  closeColorPicker();
  const doc = options.anchor.ownerDocument, rootNode = options.anchor.getRootNode(), view = doc.defaultView!;
  // The popover lives beside the panel that opened it, so re-rendering that panel keeps it open.
  const container = rootNode instanceof ShadowRoot ? rootNode : doc.body;
  const esc = (text: string) => text.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const resolved = (color: string) => { try { return options.resolve(color); } catch { return '#ffffff'; } };
  const css = (g: GradientValue, angle = g.angle) => { const stops = g.stops.map(stop => `${resolved(stop.color)} ${stop.position}%`).join(','); return g.type === 'linear' ? `linear-gradient(${angle}deg,${stops})` : `radial-gradient(circle,${stops})`; };
  const first = parse(resolved(options.value)), seed = toHSV(first.r, first.g, first.b), [r2, g2, b2] = toRGB((seed.h + 45) % 360, Math.max(seed.s, .45), Math.min(1, seed.v + .15));
  const g = options.gradient;
  let mode: 'solid' | 'gradient' = g?.value ? 'gradient' : 'solid', themeId = g?.themeId ?? '';
  let gradient: GradientValue = g?.value ? copy(g.value) : { type: 'linear', angle: 135, stops: [{ color: options.value || '#7955e8', position: 0 }, { color: hexOf(r2, g2, b2, 1), position: 100 }] };
  let stop = gradient.stops[0], solid = options.value;
  let h = 0, s = 0, v = 1, a = 1, token = '';
  /** Load the color being edited (the solid, or the selected stop) into the controls. */
  function adopt(color: string) { const c = parse(resolved(color)); ({ h, s, v } = toHSV(c.r, c.g, c.b)); a = c.a; token = color.startsWith('@') ? color.slice(1) : ''; }
  adopt(mode === 'gradient' ? stop.color : solid);

  const el = doc.createElement('div'); el.className = 'color-picker'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Selector de color');
  const swatches = (items: Array<{ name: string; value: GradientValue }>, attribute: string, ids?: string[]) => items.map((item, i) => `<button ${attribute}="${esc(ids?.[i] ?? String(i))}" title="${esc(item.name)}" aria-label="${esc(item.name)}"><i style="background:${esc(css(item.value))}"></i></button>`).join('');
  el.innerHTML = `${g ? `<div class="cp-tabs" role="tablist"><button role="tab" data-tab="solid">Sólido</button><button role="tab" data-tab="gradient">Degradado</button></div>
    <div class="cp-gradient">${g.theme.length ? `<h4>Degradados del tema</h4><div class="cp-swatches cp-wide">${swatches(g.theme, 'data-theme-gradient', g.theme.map(t => t.id))}</div>` : ''}
      <h4>Sugerencias</h4><div class="cp-swatches cp-wide">${swatches(gradientSuggestions, 'data-suggestion')}</div>
      <h4>Personalizado</h4><div class="cp-bar" aria-label="Paradas del degradado"><div class="cp-bar-fill"></div></div>
      <div class="cp-row cp-controls"><div class="cp-segment" role="group" aria-label="Tipo de degradado"><button data-type="linear">Lineal</button><button data-type="radial">Radial</button></div><label>Ángulo<input type="number" class="cp-angle" min="0" max="360" step="1" aria-label="Ángulo del degradado"/></label><label>Posición<input type="number" class="cp-position" min="0" max="100" step="1" aria-label="Posición de la parada"/></label><button class="cp-remove" data-remove-stop aria-label="Quitar parada" title="Quitar parada">×</button></div></div>` : ''}
    <div class="cp-color">${g ? '<h4 class="cp-stop-title"></h4>' : ''}<div class="cp-area" tabindex="0" role="slider" aria-label="Saturación y brillo" aria-valuetext=""><span class="cp-thumb"></span></div>
      <div class="cp-row"><span class="cp-preview"><i></i></span><div class="cp-sliders"><input type="range" class="cp-hue" min="0" max="360" step="1" aria-label="Tono"/><input type="range" class="cp-alpha" min="0" max="100" step="1" aria-label="Opacidad"/></div></div>
      <div class="cp-values"><label class="cp-hex">HEX<input aria-label="HEX" maxlength="130" spellcheck="false"/></label>${['R', 'G', 'B', 'A'].map(channel => `<label>${channel}<input type="number" data-channel="${channel}" min="0" max="${channel === 'A' ? 100 : 255}" step="1" aria-label="${channel === 'A' ? 'Opacidad %' : 'Canal ' + channel}"/></label>`).join('')}</div>
      <h4>Colores del tema</h4><div class="cp-swatches" role="group" aria-label="Colores del tema">${Object.entries(options.tokens).map(([id, color]) => `<button data-token="${esc(id)}" title="@${esc(id)}" aria-label="Token ${esc(id)}"><i style="background:${esc(color)}"></i></button>`).join('')}<button data-none title="Sin color" aria-label="Sin color (transparente)"><i></i></button></div></div>`;
  const $ = <T extends HTMLElement>(selector: string) => el.querySelector<T>(selector)!;
  const area = $('.cp-area'), hue = $<HTMLInputElement>('.cp-hue'), alpha = $<HTMLInputElement>('.cp-alpha'), hex = $<HTMLInputElement>('.cp-hex input');
  const focused = (node: Element) => doc.activeElement === node || (rootNode as ShadowRoot).activeElement === node;
  const value = () => { const [r, gg, b] = toRGB(h, s, v); return token ? `@${token}` : a === 0 ? 'transparent' : hexOf(r, gg, b, a); };
  function place() {
    const anchor = options.anchor.isConnected ? options.anchor.getBoundingClientRect() : el.getBoundingClientRect(), height = el.offsetHeight, width = el.offsetWidth;
    // After the opener re-renders, keep the place and only pull the popover back into view.
    if (!options.anchor.isConnected) { el.style.top = `${Math.max(8, Math.min(parseFloat(el.style.top) || 8, view.innerHeight - height - 8))}px`; return; }
    el.style.left = `${Math.max(8, Math.min(anchor.left, view.innerWidth - width - 8))}px`;
    el.style.top = `${Math.max(8, anchor.bottom + 6 + height > view.innerHeight ? Math.min(anchor.top - height - 6, view.innerHeight - height - 8) : anchor.bottom + 6)}px`;
  }
  function draw() {
    const [r, gg, b] = toRGB(h, s, v);
    el.style.setProperty('--cp-hue', `hsl(${h} 100% 50%)`); el.style.setProperty('--cp-solid', `rgb(${r} ${gg} ${b})`); el.style.setProperty('--cp-color', `rgb(${r} ${gg} ${b} / ${a})`);
    Object.assign($('.cp-thumb').style, { left: `${s * 100}%`, top: `${(1 - v) * 100}%` });
    area.setAttribute('aria-valuetext', `Saturación ${Math.round(s * 100)}%, brillo ${Math.round(v * 100)}%`);
    hue.value = String(Math.round(h)); alpha.value = String(Math.round(a * 100));
    if (!focused(hex)) hex.value = value();
    el.querySelectorAll<HTMLInputElement>('[data-channel]').forEach(input => { if (!focused(input)) input.value = String(input.dataset.channel === 'A' ? Math.round(a * 100) : [r, gg, b]['RGB'.indexOf(input.dataset.channel!)]); });
    el.querySelectorAll<HTMLElement>('[data-token]').forEach(button => button.classList.toggle('active', button.dataset.token === token));
    if (!g) return;
    el.querySelectorAll<HTMLElement>('[data-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.tab === mode)));
    $('.cp-gradient').hidden = mode !== 'gradient';
    $('.cp-stop-title').textContent = mode === 'gradient' ? `Color de la parada ${gradient.stops.indexOf(stop) + 1}` : 'Personalizado';
    el.querySelectorAll<HTMLElement>('[data-theme-gradient]').forEach(button => button.classList.toggle('active', button.dataset.themeGradient === themeId));
    el.querySelectorAll<HTMLElement>('[data-type]').forEach(button => button.classList.toggle('active', button.dataset.type === gradient.type));
    $('.cp-bar-fill').style.background = css({ ...gradient, type: 'linear' }, 90);
    const bar = $('.cp-bar');
    bar.querySelectorAll('.cp-stop').forEach(handle => handle.remove());
    gradient.stops.forEach((item, i) => {
      const handle = doc.createElement('button'); handle.className = `cp-stop${item === stop ? ' active' : ''}`; handle.dataset.stop = String(i);
      handle.setAttribute('aria-label', `Parada ${i + 1}, ${Math.round(item.position)}%`); handle.style.left = `${item.position}%`; handle.style.setProperty('--stop', resolved(item.color));
      bar.append(handle);
    });
    const angle = $<HTMLInputElement>('.cp-angle'), position = $<HTMLInputElement>('.cp-position');
    if (!focused(angle)) angle.value = String(Math.round(gradient.angle)); angle.disabled = gradient.type === 'radial';
    if (!focused(position)) position.value = String(Math.round(stop.position));
    $<HTMLButtonElement>('.cp-remove').disabled = gradient.stops.length <= 2;
  }
  /** One undo entry: the edited color goes to the solid fill or to the selected stop. */
  function commit() {
    if (mode === 'gradient' && g) { stop.color = value(); themeId = ''; commitGradient(); }
    else { solid = value(); options.commit(solid); draw(); }
  }
  function commitGradient() {
    gradient.stops.sort((x, y) => x.position - y.position); themeId = '';
    g!.commit(copy(gradient)); draw();
  }
  function selectStop(next: GradientValue['stops'][number]) { stop = next; adopt(stop.color); draw(); }
  function setMode(next: typeof mode) { mode = next; adopt(mode === 'gradient' ? stop.color : solid); draw(); place(); }
  function point(e: PointerEvent) {
    const r = area.getBoundingClientRect();
    s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); v = 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    if (a === 0) a = 1; token = ''; draw();
  }
  area.onpointerdown = e => { area.setPointerCapture(e.pointerId); point(e); };
  area.onpointermove = e => { if (area.hasPointerCapture(e.pointerId)) point(e); };
  area.onpointerup = e => { if (area.hasPointerCapture(e.pointerId)) { area.releasePointerCapture(e.pointerId); commit(); } };
  area.onkeydown = e => {
    const step = e.shiftKey ? .1 : .02, move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (!move[e.key]) return;
    e.preventDefault(); e.stopPropagation(); s = Math.max(0, Math.min(1, s + move[e.key][0])); v = Math.max(0, Math.min(1, v + move[e.key][1])); token = ''; commit();
  };
  hue.oninput = () => { h = Number(hue.value); if (a === 0) a = 1; token = ''; draw(); }; alpha.oninput = () => { a = Number(alpha.value) / 100; token = ''; draw(); };

  if (g) {
    const bar = $('.cp-bar');
    let dragging: GradientValue['stops'][number] | null = null;
    const at = (e: PointerEvent) => { const r = bar.getBoundingClientRect(); return Math.round(Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100))); };
    bar.onpointerdown = e => {
      const handle = (e.target as HTMLElement).closest<HTMLElement>('.cp-stop');
      if (handle) { dragging = gradient.stops[Number(handle.dataset.stop)]; selectStop(dragging); }
      else if (gradient.stops.length < 16) {
        // A new stop takes the color the gradient already has at that point.
        const position = at(e), ordered = [...gradient.stops].sort((x, y) => x.position - y.position);
        const after = ordered.find(item => item.position >= position) ?? ordered.at(-1)!, before = [...ordered].reverse().find(item => item.position <= position) ?? ordered[0];
        const t = after.position === before.position ? 0 : (position - before.position) / (after.position - before.position), from = parse(resolved(before.color)), to = parse(resolved(after.color));
        dragging = { color: hexOf(from.r + (to.r - from.r) * t, from.g + (to.g - from.g) * t, from.b + (to.b - from.b) * t, from.a + (to.a - from.a) * t), position };
        gradient.stops.push(dragging); selectStop(dragging);
      } else return;
      bar.setPointerCapture(e.pointerId); e.preventDefault();
    };
    bar.onpointermove = e => { if (dragging && bar.hasPointerCapture(e.pointerId)) { dragging.position = at(e); draw(); } };
    bar.onpointerup = e => { if (dragging && bar.hasPointerCapture(e.pointerId)) { bar.releasePointerCapture(e.pointerId); dragging = null; commitGradient(); el.querySelector<HTMLElement>('.cp-stop.active')?.focus({ preventScroll: true }); } };
    bar.onkeydown = e => {
      const handle = (e.target as HTMLElement).closest<HTMLElement>('.cp-stop'); if (!handle) return;
      const item = gradient.stops[Number(handle.dataset.stop)], step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { item.position = Math.max(0, Math.min(100, item.position + (e.key === 'ArrowLeft' ? -step : step))); stop = item; }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && gradient.stops.length > 2) { gradient.stops.splice(gradient.stops.indexOf(item), 1); stop = gradient.stops[0]; adopt(stop.color); }
      else return;
      e.preventDefault(); e.stopPropagation(); commitGradient(); el.querySelector<HTMLElement>('.cp-stop.active')?.focus({ preventScroll: true });
    };
  }
  el.onchange = e => {
    e.stopPropagation();
    const input = e.target as HTMLInputElement;
    if (input === hue || input === alpha) { commit(); return; }
    if (input === hex) {
      const text = hex.value.trim(), normalized = /^[\da-f]{3,8}$/i.test(text) ? `#${text}` : text;
      const known = /^@[A-Za-z0-9][A-Za-z0-9_-]*$/.test(normalized) && Object.hasOwn(options.tokens, normalized.slice(1));
      if (known || /^(?:#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})|transparent)$/i.test(normalized)) { adopt(normalized.toLowerCase()); hex.value = value(); commit(); }
      else { hex.setCustomValidity('Escribe un HEX como #7955e8, transparent o un token como @primary.'); hex.reportValidity(); hex.setCustomValidity(''); }
      return;
    }
    if (!input.checkValidity()) { input.reportValidity(); return; }
    if (input.dataset.channel) {
      const [r, gg, b] = toRGB(h, s, v), channels = { R: r, G: gg, B: b, [input.dataset.channel]: Number(input.value) };
      if (input.dataset.channel === 'A') a = Number(input.value) / 100; else { ({ h, s, v } = toHSV(channels.R, channels.G, channels.B)); if (a === 0) a = 1; }
      token = ''; commit();
    } else if (input.classList.contains('cp-angle')) { gradient.angle = Number(input.value); commitGradient(); }
    else if (input.classList.contains('cp-position')) { stop.position = Number(input.value); commitGradient(); }
  };
  el.onclick = e => {
    const button = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!button) return;
    if (button.dataset.tab) setMode(button.dataset.tab as typeof mode);
    else if (button.dataset.token) { token = button.dataset.token; adopt(`@${token}`); commit(); }
    else if ('none' in button.dataset) { token = ''; a = 0; commit(); }
    else if (button.dataset.type) { gradient.type = button.dataset.type as GradientValue['type']; commitGradient(); }
    else if ('removeStop' in button.dataset) { if (gradient.stops.length > 2) { gradient.stops.splice(gradient.stops.indexOf(stop), 1); stop = gradient.stops[0]; adopt(stop.color); commitGradient(); } }
    else if (button.dataset.suggestion) { gradient = copy(gradientSuggestions[Number(button.dataset.suggestion)].value); stop = gradient.stops[0]; adopt(stop.color); commitGradient(); }
    else if (button.dataset.themeGradient && g) {
      // Linking keeps the token; editing a stop afterwards turns it into a custom copy.
      const linked = g.theme.find(item => item.id === button.dataset.themeGradient)!;
      gradient = copy(linked.value); stop = gradient.stops[0]; adopt(stop.color); themeId = linked.id; g.pickTheme(linked.id); draw();
    }
  };
  el.onkeydown = e => { if (e.key !== 'Tab' && e.key !== 'Escape') e.stopPropagation(); };
  const outside = (e: Event) => { if (!e.composedPath().includes(el)) close(); };
  // Escape closes the popover first, wherever the focus is, before the editor acts on it.
  const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  function close() { doc.removeEventListener('pointerdown', outside, true); doc.removeEventListener('keydown', escape, true); el.remove(); if (active === close) active = null; }
  container.append(el); draw(); place();
  doc.addEventListener('pointerdown', outside, true); doc.addEventListener('keydown', escape, true); active = close;
  area.focus({ preventScroll: true });
}

/**
 * Open the picker for a chip whose data-pick names the text input it drives (by aria-label).
 * The picker writes into that input and fires `change`, so every panel keeps its own commit logic.
 */
export function pickColorFor(chip: HTMLElement, context: PickerContext) {
  const scope = chip.getRootNode() as Document | ShadowRoot;
  const input = () => [...scope.querySelectorAll<HTMLInputElement>('input')].find(el => el.getAttribute('aria-label') === chip.dataset.pick);
  openColorPicker({ ...context, anchor: chip, value: input()?.value ?? '', commit: value => { const el = input(); if (el) { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); } } });
}
