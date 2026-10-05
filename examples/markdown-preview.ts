import { enhanceMarkdown, type MockupPreview } from '../src/preview';
import designUrl from './Forma-dispositivos.codaru.json?url';

const source = document.getElementById('source') as HTMLTextAreaElement, rendered = document.getElementById('rendered')!;
const fence = '```';
source.value = `# Pantalla de bienvenida

Desarrollar esta maqueta. Toca **Entrar a mi espacio** y luego **Desplegar** para ver el plegable abierto.

${fence}codaru-mockup
archivo: Forma-dispositivos.codaru.json
pantalla: pasaporte-cerrado-bienvenida
modo: prototipo
${fence}

## Referencia en iPhone

La misma pantalla en iPhone, en oscuro y sin interacción:

${fence}codaru-mockup
archivo: Forma-dispositivos.codaru.json
pantalla: ios-bienvenida
modo: estático
tema: oscuro
alto: 420
${fence}

## Tríptico

- Prueba los botones de postura: \`Cerrado\`, \`Dos paneles\` y \`Abierto\`.
- Cambia \`pantalla\` por un id que no exista para ver el aviso.

${fence}codaru-mockup
archivo: Forma-dispositivos.codaru.json
pantalla: triptico-abierto-espacio
${fence}
`;

const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const inline = (text: string) => escape(text).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
/** Just enough Markdown for this demo. A real client uses its own engine; the output shape is the same. */
function toHTML(markdown: string) {
  const out: string[] = [], lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], open = /^```([\w-]*)\s*$/.exec(line);
    if (open) { const body: string[] = []; while (++i < lines.length && !lines[i].startsWith('```')) body.push(lines[i]); out.push(`<pre><code class="language-${escape(open[1] || 'text')}">${escape(body.join('\n'))}</code></pre>`); }
    else if (/^#{1,2} /.test(line)) { const level = line.startsWith('## ') ? 2 : 1; out.push(`<h${level}>${inline(line.slice(level + 1))}</h${level}>`); }
    else if (line.startsWith('- ')) { const items = [line]; while (lines[i + 1]?.startsWith('- ')) items.push(lines[++i]); out.push(`<ul>${items.map(item => `<li>${inline(item.slice(2))}</li>`).join('')}</ul>`); }
    else if (line.trim()) { const text = [line]; while (lines[i + 1]?.trim() && !/^(#{1,2} |- |```)/.test(lines[i + 1])) text.push(lines[++i]); out.push(`<p>${inline(text.join(' '))}</p>`); }
  }
  return out.join('\n');
}

let previews: MockupPreview[] = [], design: Promise<string> | undefined, turn = 0;
async function render() {
  const mine = ++turn;
  previews.forEach(preview => preview.destroy()); previews = [];
  rendered.innerHTML = toHTML(source.value);
  const made = await enhanceMarkdown(rendered, {
    // This demo ships one design; a client resolves the path against the document instead.
    load: async file => { if (!file.endsWith('Forma-dispositivos.codaru.json')) throw new Error('Este ejemplo solo incluye Forma-dispositivos.codaru.json.'); return design ??= fetch(designUrl).then(response => response.text()); },
    onOpen: (block, screen) => alert(`Tu cliente abriría ${block.file} en la pantalla ${screen}.`),
  });
  if (mine === turn) previews = made; else made.forEach(preview => preview.destroy());
}
let timer = 0;
source.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(() => void render(), 250); });
void render();
