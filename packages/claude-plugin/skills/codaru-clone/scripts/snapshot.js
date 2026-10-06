/*
 * Codaru · instantánea del DOM. Se ejecuta dentro de cualquier página (consola del navegador,
 * herramienta de JavaScript de un agente, Playwright o como bookmarklet) y devuelve un JSON con
 * los elementos visibles, su geometría y sus estilos calculados, listo para importar en Codaru
 * con la operación `dom` del CLI. No envía nada a ningún sitio: todo queda en la página.
 *
 *   codaruSnapshot()                      → objeto con la instantánea
 *   codaruSnapshot({ maxHeight: 4000 })   → limita la altura capturada (6000 px por defecto)
 *   codaruSnapshot({ download: true })    → además descarga <título>.dom.codaru.json
 */
(function () {
  const MAX_ELEMENTS = 2500, MAX_TEXT = 2000, MAX_SVG = 60, MAX_SVG_CHARS = 60000, MAX_IMAGES = 24, MAX_IMAGE_CHARS = 420000;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE', 'IFRAME', 'CANVAS', 'VIDEO', 'AUDIO', 'OBJECT', 'EMBED', 'MAP', 'AREA', 'BR']);
  const BLOCK = new Set(['block', 'flex', 'grid', 'table', 'list-item', 'flow-root', 'table-row', 'table-cell', 'inline-block', 'inline-flex', 'inline-grid']);

  function parseColor(value) {
    const m = /rgba?\(([^)]+)\)/.exec(value || ''); if (!m) return undefined;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat); const a = parts.length > 3 ? parts[3] : 1;
    if (!(a > 0) || parts.length < 3) return undefined;
    const h = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return '#' + h(parts[0]) + h(parts[1]) + h(parts[2]) + (a < 1 ? h(a * 255) : '');
  }
  function parseGradient(image) {
    const m = /(linear|radial)-gradient\((.*)\)$/.exec(image || ''); if (!m) return undefined;
    const body = m[2]; let angle = 180;
    const head = body.split(',')[0].trim();
    if (/deg$/.test(head)) angle = parseFloat(head);
    else if (/^to /.test(head)) angle = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270, 'to top right': 45, 'to right top': 45, 'to bottom right': 135, 'to right bottom': 135, 'to bottom left': 225, 'to left bottom': 225, 'to top left': 315, 'to left top': 315 }[head] ?? 180;
    const stops = []; const re = /(rgba?\([^)]+\))\s*([\d.]+%)?/g; let s;
    while ((s = re.exec(body)) && stops.length < 16) { const color = parseColor(s[1]); if (color) stops.push({ color, position: s[2] ? parseFloat(s[2]) : -1 }); }
    if (stops.length < 2) return undefined;
    stops.forEach((stop, i) => { if (stop.position < 0) stop.position = Math.round(i * 100 / (stops.length - 1)); });
    return { type: m[1], angle: Math.round(angle), stops };
  }
  function family(cs) { return (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim(); }
  function normalize(text) { return (text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT); }

  function snapshot(options) {
    options = options || {};
    const maxHeight = options.maxHeight || 6000;
    const vw = window.innerWidth, height = Math.min(document.documentElement.scrollHeight || document.body.scrollHeight || window.innerHeight, maxHeight);
    const elements = [], notes = {}, note = m => { notes[m] = (notes[m] || 0) + 1; };
    let images = 0, svgs = 0;
    const bodyStyle = getComputedStyle(document.body), htmlStyle = getComputedStyle(document.documentElement);
    const bodyBg = parseColor(bodyStyle.backgroundColor) || parseColor(htmlStyle.backgroundColor);

    function walk(el, parent) {
      if (elements.length >= MAX_ELEMENTS) { note('La página tiene más de 2500 elementos visibles: el resto no se capturó.'); return; }
      if (!(el instanceof Element) || SKIP.has(el.tagName)) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
      const r = el.getBoundingClientRect(), x = r.left + window.scrollX, y = r.top + window.scrollY;
      if (y > height || x + r.width < 0 || x > vw) return;
      const isSVG = el instanceof SVGSVGElement, tag = el.tagName.toLowerCase();
      if (r.width < 1 || r.height < 1) { if (!isSVG) for (const child of el.children) walk(child, parent); return; }
      // The page itself is the screen: its background becomes the frame fill, never a box around everything.
      if (el === document.body || el === document.documentElement) { for (const child of el.children) walk(child, parent); return; }
      const bg = parseColor(cs.backgroundColor), gradient = parseGradient(cs.backgroundImage);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !gradient) note('Imágenes de fondo CSS: no se capturan; queda el color de fondo.');
      const borderWidth = cs.borderTopStyle !== 'none' ? parseFloat(cs.borderTopWidth) || 0 : 0, borderColor = borderWidth ? parseColor(cs.borderTopColor) : undefined;
      const radius = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(v => Math.min(parseFloat(v) || 0, Math.min(r.width, r.height) / 2));
      const shadow = cs.boxShadow && cs.boxShadow !== 'none';
      const font = { family: family(cs), size: parseFloat(cs.fontSize) || 16, weight: parseInt(cs.fontWeight, 10) || 400, lineHeight: parseFloat(cs.lineHeight) || Math.round((parseFloat(cs.fontSize) || 16) * 1.2), align: cs.textAlign === 'center' ? 'center' : cs.textAlign === 'right' || cs.textAlign === 'end' ? 'right' : 'left', italic: cs.fontStyle === 'italic' };
      const color = parseColor(cs.color);
      const base = { i: elements.length, p: parent, tag, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100, opacity: Math.round(parseFloat(cs.opacity) * 100) || 100 };
      const box = (bg || gradient || (borderWidth && borderColor) || shadow) ? { bg, gradient, border: borderWidth && borderColor ? { width: borderWidth, color: borderColor } : undefined, radius, shadow } : undefined;

      if (isSVG) {
        if (svgs >= MAX_SVG) { note('Más de 60 SVG: el resto se importó como caja.'); if (box) elements.push({ ...base, kind: 'box', ...box }); return; }
        const svg = el.outerHTML; if (svg.length > MAX_SVG_CHARS) { note('SVG de más de 60 KB: se omitió.'); return; }
        svgs++; elements.push({ ...base, kind: 'svg', svg, color }); return;
      }
      if (tag === 'img') {
        let image = '';
        if (images < MAX_IMAGES) {
          try { const c = document.createElement('canvas'); c.width = el.naturalWidth || r.width; c.height = el.naturalHeight || r.height; c.getContext('2d').drawImage(el, 0, 0); const data = c.toDataURL('image/png'); if (data.length <= MAX_IMAGE_CHARS) { image = data; images++; } else note('Imágenes de más de 300 KB: se importaron como caja.'); }
          catch (e) { note('Imágenes de otro dominio: el navegador no deja leerlas; se importaron como caja.'); }
        } else note('Más de 24 imágenes: el resto se importó como caja.');
        elements.push({ ...base, kind: 'img', image, src: (el.currentSrc || el.src || '').slice(0, 500), alt: normalize(el.alt), radius, ...(box || {}) }); return;
      }
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        elements.push({ ...base, kind: 'input', text: normalize(el.value || el.placeholder || ''), font, color, ...(box || { radius }) }); return;
      }
      const role = el.getAttribute('role');
      const isButton = tag === 'button' || role === 'button' || ((tag === 'a' || role === 'link') && (bg || gradient || (borderWidth && borderColor)));
      if (isButton) {
        elements.push({ ...base, kind: 'button', text: normalize(el.innerText), font, color, href: tag === 'a' ? (el.getAttribute('href') || '').slice(0, 300) : undefined, ...(box || { radius }) }); return;
      }
      const direct = normalize(Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join(' '));
      const blockChild = Array.from(el.children).some(c => BLOCK.has(getComputedStyle(c).display) || c instanceof SVGSVGElement || c.tagName === 'IMG');
      let parentIndex = parent;
      if (box) { elements.push({ ...base, kind: 'box', ...box }); parentIndex = base.i; }
      if (direct && !blockChild) {
        const inline = { ...base, i: elements.length, p: parentIndex, kind: 'text', text: normalize(el.innerText), font, color, href: tag === 'a' ? (el.getAttribute('href') || '').slice(0, 300) : undefined };
        elements.push(inline); return;
      }
      if (direct) { note('Texto mezclado con bloques: se capturó por partes.'); elements.push({ ...base, i: elements.length, p: parentIndex, kind: 'text', text: direct, font, color }); }
      for (const child of el.children) walk(child, parentIndex);
    }
    walk(document.body, null);
    const result = {
      format: 'codaru-dom-snapshot', version: 1, url: location.href, title: document.title, captured: new Date().toISOString(),
      viewport: { width: vw, height: window.innerHeight }, height, body: { bg: bodyBg, font: family(bodyStyle), color: parseColor(bodyStyle.color) },
      elements, notes: Object.entries(notes).map(([m, c]) => c > 1 ? m + ' (' + c + ')' : m),
    };
    if (options.download) {
      const blob = new Blob([JSON.stringify(result)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = (document.title || 'pagina').replace(/[^\w.-]+/g, '-').slice(0, 60) + '.dom.codaru.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    return result;
  }
  window.codaruSnapshot = snapshot;
  return snapshot;
})();
