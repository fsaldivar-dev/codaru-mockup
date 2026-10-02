import { children, color, type DesignNode, type Project } from './model';
import { effectiveTheme, resolveNodeStyle, type GradientToken, type MaterialToken } from './themes';
import { iconLicenseNotice, iconSVG } from './icon-data';
export const fonts: Record<string, string> = { system: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' };

function gradientFor(p: Project, n: DesignNode): GradientToken | undefined {
  const set = effectiveTheme(p, n).tokens;
  if (n.fillToken && Object.hasOwn(set.gradients, n.fillToken)) return set.gradients[n.fillToken];
  if (n.gradient === 'none') return;
  return { name: 'Local', type: n.gradient, angle: n.gradientAngle, stops: [{ color: n.fill, position: 0 }, { color: n.gradientEnd, position: 100 }] };
}
function rgba(value: string, opacity: number): string {
  if (value.toLowerCase() === 'transparent') return 'rgba(0, 0, 0, 0)';
  let hex = value.slice(1);
  if (hex.length <= 4) hex = [...hex].map(c => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return `rgba(${r}, ${g}, ${b}, ${a * opacity / 100})`;
}
function backgroundFor(p: Project, n: DesignNode, material?: MaterialToken): string {
  const gradient = gradientFor(p, n);
  if (gradient) {
    const stops = gradient.stops.map(stop => `${material ? rgba(color(p, stop.color, n), material.opacity) : color(p, stop.color, n)} ${stop.position}%`).join(',');
    return gradient.type === 'linear' ? `linear-gradient(${gradient.angle}deg,${stops})` : `radial-gradient(circle at 30% 20%,${stops})`;
  }
  return material ? rgba(color(p, material.tint, n), material.opacity) : color(p, n.fill, n);
}
export function element(p: Project, n: DesignNode, preview = false): HTMLElement {
  n = { ...n, ...resolveNodeStyle(p, n) };
  const el = document.createElement('div'); el.className = 'design-node'; el.dataset.node = n.id; el.dataset.kind = n.type; el.setAttribute('aria-label', n.name);
  const context = effectiveTheme(p, n), material = n.materialToken ? context.tokens.materials[n.materialToken] : undefined;
  el.dataset.theme = context.id; el.dataset.themeMode = context.mode;
  Object.assign(el.style, {
    position: 'absolute', boxSizing: 'border-box', left: `${n.x}px`, top: `${n.y}px`, width: `${n.width}px`, height: `${n.height}px`,
    background: backgroundFor(p, n, material), color: color(p, n.color, n), border: `${material ? Math.max(1, n.strokeWidth) : n.strokeWidth}px solid ${color(p, material?.stroke ?? n.stroke, n)}`,
    borderRadius: n.type === 'ellipse' ? '50%' : `${n.radius}px ${n.radiusTR ?? n.radius}px ${n.radiusBR ?? n.radius}px ${n.radiusBL ?? n.radius}px`,
    opacity: `${n.opacity / 100}`, boxShadow: material?.shadow ? `0 ${material.shadow / 2}px ${material.shadow * 2}px rgba(10, 12, 28, 0.18)` : n.shadow ? '0 8px 22px #19102e22' : 'none',
    fontFamily: fonts[n.fontFamily], fontSize: `${n.fontSize}px`, fontWeight: `${n.fontWeight}`, lineHeight: `${n.lineHeight}`,
    textAlign: n.textAlign, display: n.hidden ? 'none' : 'block', overflow: n.type === 'frame' ? 'hidden' : 'visible',
  });
  if (material) {
    el.dataset.material = n.materialToken;
    const filter = `blur(${material.blur}px) saturate(${material.saturation}%)`;
    el.style.setProperty('backdrop-filter', filter); el.style.setProperty('-webkit-backdrop-filter', filter);
  }
  if (n.type === 'image') {
    if (n.image) { const img = document.createElement('img'); img.src = n.image; img.alt = n.name; img.draggable = false; Object.assign(img.style, { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', pointerEvents: 'none' }); el.append(img); }
    else { const stub = document.createElement('div'); stub.textContent = '▧  Imagen'; Object.assign(stub.style, { height: '100%', display: 'grid', placeItems: 'center', color: color(p, '@muted', n), background: color(p, '@accent', n), borderRadius: 'inherit' }); el.append(stub); }
  }
  if (n.type === 'icon') {
    el.setAttribute('role', 'img'); el.dataset.iconPack = n.iconPack; el.dataset.iconName = n.iconName;
    // Catalog references and restricted colors are the only inputs; SVG is never user-supplied.
    el.insertAdjacentHTML('beforeend', iconSVG(n.iconPack!, n.iconName!, color(p, n.color, n), n.width));
    Object.assign(el.querySelector('svg')!.style, { display: 'block', width: '100%', height: '100%', pointerEvents: 'none' });
  }
  if (n.type === 'input' && preview) {
    const input = document.createElement('input'); input.placeholder = n.text; input.setAttribute('aria-label', n.name); input.type = /contraseña/i.test(n.name) ? 'password' : 'text';
    Object.assign(input.style, { boxSizing: 'border-box', width: '100%', height: '100%', border: 'none', background: 'transparent', color: 'inherit', font: 'inherit', padding: '0 14px', outlineOffset: '-3px', borderRadius: 'inherit' }); el.append(input);
  } else if (n.text) {
    const text = document.createElement('div'); text.className = 'node-text'; text.textContent = n.text;
    Object.assign(text.style, { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', boxSizing: 'border-box', width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' });
    if (n.type === 'button' || n.type === 'input') Object.assign(text.style, { display: 'flex', alignItems: 'center', justifyContent: n.textAlign === 'center' ? 'center' : n.textAlign === 'right' ? 'flex-end' : 'flex-start', padding: '0 14px' });
    el.append(text);
  }
  if (preview && n.targetId) { el.dataset.target = n.targetId; el.tabIndex = 0; el.setAttribute('role', 'button'); el.style.cursor = 'pointer'; }
  for (const child of children(p, n.id)) el.append(element(p, child, preview));
  return el;
}
export function escape(s: unknown): string { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!); }
export function exportHTML(p: Project): string {
  const iconNotices = iconLicenseNotice(p.nodes.filter(n => n.type === 'icon').map(n => n.iconPack!));
  const screens = children(p, null).filter(n => n.type === 'frame' && !n.hidden);
  const content = screens.map((n, i) => {
    const el = element(p, n, true); el.id = n.id; el.classList.add('screen'); el.style.position = 'relative'; el.style.left = '0'; el.style.top = '0'; el.style.margin = '32px auto'; el.hidden = i !== 0;
    return el.outerHTML;
  }).join('\n');
  return `<!doctype html><html lang="es"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(p.name)}</title>${iconNotices ? `<script type="application/json" id="codaru-icon-licenses">${JSON.stringify(iconNotices).replaceAll('<', '\\u003c')}</script>` : ''}<style>body{margin:0;background:#ececf0;font-family:system-ui}nav{padding:14px;text-align:center;background:#fff;border-bottom:1px solid #ddd}nav button{padding:8px 14px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer}[hidden]{display:none!important}.screen{box-shadow:0 10px 60px #0001;max-width:none}#viewport{overflow:auto;min-height:calc(100vh - 62px)}[data-target]:focus-visible{outline:3px solid #7c5ce7;outline-offset:3px}</style><nav><button id="back">← Atrás</button> <span id="screen-name">${escape(screens[0]?.name || '')}</span></nav><main id="viewport">${content}</main><script>const history=[];function go(id){const next=document.getElementById(id);if(!next||!next.classList.contains('screen'))return;const current=document.querySelector('.screen:not([hidden])');if(current)history.push(current.id);document.querySelectorAll('.screen').forEach(s=>s.hidden=s!==next);document.getElementById('screen-name').textContent=next.getAttribute('aria-label');document.getElementById('viewport').scrollTo(0,0)}document.addEventListener('click',e=>{const target=e.target.closest('[data-target]');if(target)go(target.dataset.target)});document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const target=e.target.closest('[data-target]');if(target&&e.target.tagName!=='INPUT'){e.preventDefault();go(target.dataset.target)}}});document.getElementById('back').onclick=()=>{const id=history.pop();if(id){go(id);history.pop()}};</script></html>`;
}
export function exportSVG(p: Project, frame: DesignNode): string {
  const iconNotices = iconLicenseNotice(p.nodes.filter(n => n.type === 'icon').map(n => n.iconPack!));
  const gradients: string[] = []; const pieces: string[] = [];
  function draw(n: DesignNode, x: number, y: number) {
    if (n.hidden) return;
    x += n.id === frame.id ? 0 : n.x; y += n.id === frame.id ? 0 : n.y;
    n = { ...n, ...resolveNodeStyle(p, n) };
    const set = effectiveTheme(p, n).tokens, material = n.materialToken ? set.materials[n.materialToken] : undefined;
    let fill = color(p, material?.tint ?? n.fill, n); const safeId = 'g' + gradients.length;
    const gradient = gradientFor(p, n);
    if (gradient) {
      const a = (gradient.angle - 90) * Math.PI / 180, dx = Math.cos(a) * 50, dy = Math.sin(a) * 50;
      const stops = gradient.stops.map(stop => `<stop offset="${stop.position / 100}" stop-color="${color(p, stop.color, n)}"/>`).join('');
      gradients.push(gradient.type === 'linear' ? `<linearGradient id="${safeId}" x1="${50 - dx}%" y1="${50 - dy}%" x2="${50 + dx}%" y2="${50 + dy}%">${stops}</linearGradient>` : `<radialGradient id="${safeId}" cx="30%" cy="20%" r="80%">${stops}</radialGradient>`);
      fill = `url(#${safeId})`;
    }
    pieces.push(`<g opacity="${n.opacity / 100}"${material ? ' data-material-fallback="tint-and-border"' : ''}>`);
    const style = `fill="${fill === 'transparent' ? 'none' : fill}"${material ? ` fill-opacity="${material.opacity / 100}"` : ''} stroke="${color(p, material?.stroke ?? n.stroke, n)}" stroke-width="${material ? Math.max(1, n.strokeWidth) : n.strokeWidth}"`;
    if (n.type === 'ellipse') pieces.push(`<ellipse cx="${x + n.width / 2}" cy="${y + n.height / 2}" rx="${n.width / 2}" ry="${n.height / 2}" ${style}/>`);
    else {
      const limit = Math.min(n.width, n.height) / 2, r = [n.radius, n.radiusTR ?? n.radius, n.radiusBR ?? n.radius, n.radiusBL ?? n.radius].map(r => Math.min(limit, Math.max(0, r)));
      pieces.push(`<path d="M${x+r[0]},${y} H${x+n.width-r[1]} Q${x+n.width},${y} ${x+n.width},${y+r[1]} V${y+n.height-r[2]} Q${x+n.width},${y+n.height} ${x+n.width-r[2]},${y+n.height} H${x+r[3]} Q${x},${y+n.height} ${x},${y+n.height-r[3]} V${y+r[0]} Q${x},${y} ${x+r[0]},${y} Z" ${style}${n.shadow ? ' filter="url(#shadow)"' : ''}/>`);
    }
    if (n.image) pieces.push(`<image href="${n.image}" x="${x}" y="${y}" width="${n.width}" height="${n.height}" preserveAspectRatio="xMidYMid slice"/>`);
    if (n.type === 'icon') pieces.push(iconSVG(n.iconPack!, n.iconName!, color(p, n.color, n), n.width).replace('<svg ', `<svg x="${x}" y="${y}" `).replace(`height="${n.width}"`, `height="${n.height}"`));
    if (n.text) {
      const centered = n.type === 'button' || n.type === 'input'; const inset = centered ? 14 : 0;
      const ctx = document.createElement('canvas').getContext('2d')!; ctx.font = `${n.fontWeight} ${n.fontSize}px ${fonts[n.fontFamily]}`;
      const lines: string[] = [];
      for (const paragraph of n.text.split('\n')) { let line = ''; for (const word of paragraph.split(' ')) { const next = line ? line + ' ' + word : word; if (line && ctx.measureText(next).width > n.width - inset * 2) { lines.push(line); line = word; } else line = next; } lines.push(line); }
      const anchor = n.textAlign === 'center' ? 'middle' : n.textAlign === 'right' ? 'end' : 'start';
      const tx = x + (n.textAlign === 'center' ? n.width / 2 : n.textAlign === 'right' ? n.width - inset : inset);
      const ty = y + (centered ? (n.height - lines.length * n.fontSize * n.lineHeight) / 2 : 0) + n.fontSize;
      pieces.push(`<text fill="${color(p, n.color, n)}" font-family="${escape(fonts[n.fontFamily])}" font-size="${n.fontSize}" font-weight="${n.fontWeight}" text-anchor="${anchor}">${lines.map((line, i) => `<tspan x="${tx}" y="${ty + i * n.fontSize * n.lineHeight}">${escape(line)}</tspan>`).join('')}</text>`);
    }
    for (const child of children(p, n.id)) draw(child, x, y);
    pieces.push('</g>');
  }
  draw(frame, 0, 0);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}">${iconNotices ? `<metadata id="codaru-icon-licenses">${escape(iconNotices)}</metadata>` : ''}<desc>Los materiales de cristal se exportan como tintes y bordes; el desenfoque del fondo y la saturación se conservan en HTML.</desc><defs><filter id="shadow" x="-30%" y="-50%" width="160%" height="220%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-opacity=".12"/></filter>${gradients.join('')}<clipPath id="artboard"><rect width="${frame.width}" height="${frame.height}"/></clipPath></defs><g clip-path="url(#artboard)">${pieces.join('')}</g></svg>`;
}
