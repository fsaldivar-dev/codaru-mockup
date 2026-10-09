import { blank, node, createComponent, instantiate, updateNode, subtree, createVariant, syncComponents, validate } from '../src/model';

/** Disposable integration fixture; never reads or replaces the person's open document. */
export function nestedDesign() {
  const p = blank(); p.name = 'Componentes · De una pieza a una pantalla';
  p.pages = [{ id: 'main', name: 'Composición' }, { id: 'variants', name: 'Variantes' }]; p.activePageId = 'main';
  p.nodes.push(node('frame', { id: 'library', name: 'Biblioteca · Maestros', role: 'library', x: 30, y: 40, width: 340, height: 550, fill: '#ffffff' }),
    node('frame', { id: 'screen', name: 'Mi espacio · Instancias', role: 'screen', x: 430, y: 40, width: 390, height: 550, fill: '#f4f5fa' }));
  const text = (id: string, parentId: string, content: string, x: number, y: number, width: number, fontSize = 14) => node('text', { id, parentId, name: id, text: content, x, y, width, height: fontSize * 1.7, fontSize, color: '#252636', fontWeight: 600 });
  p.nodes.push(text('library-title', 'library', 'Una biblioteca, muchas pantallas', 24, 20, 292, 19), text('icon-caption', 'library', '01  SÍMBOLO', 24, 68, 260, 11));
  p.nodes.push(node('group', { id: 'symbol', name: 'Símbolo', parentId: 'library', x: 24, y: 101, width: 22, height: 22 }), node('ellipse', { id: 'symbol-dot', name: 'Punto', parentId: 'symbol', x: 2, y: 2, width: 18, height: 18, fill: '#7255db' }));
  const symbol = createComponent(p, 'symbol').id;
  p.nodes.push(text('button-caption', 'library', '02  BOTÓN + SÍMBOLO', 24, 140, 280, 11));
  p.nodes.push(node('group', { id: 'button', name: 'Botón', parentId: 'library', x: 24, y: 177, width: 272, height: 48, radius: 12, fill: '#7255db' }), text('button-label', 'button', 'Abrir proyecto', 42, 12, 218, 14));
  updateNode(p, 'button-label', { color: '#ffffff' }); const buttonSymbol = instantiate(p, symbol, 'button', 12, 13);
  updateNode(p, subtree(p, buttonSymbol).find(n => n.type === 'ellipse')!.id, { fill: '#ffffff' });
  const button = createComponent(p, 'button').id;
  const quiet = createVariant(p, button, { Estado: 'Suave' });
  updateNode(p, quiet.masterId, { fill: '#4e596c' });
  // Keep the variant sheet out of this compact example's first page.
  const variantContainer = p.nodes.find(n => n.id === quiet.containerId)!;
  updateNode(p, variantContainer.id, { x: 24, y: 175, layout: 'free', width: 290, height: 52, padding: 0, hugWidth: false, hugHeight: false, strokeWidth: 0 });
  p.nodes.push(node('frame', { id: 'variant-sheet', name: 'Variantes de botón', page: 'variants', role: 'library', width: 340, height: 200 }));
  updateNode(p, 'button', { x: 0, y: 0 }); updateNode(p, quiet.masterId, { parentId: 'variant-sheet', x: 24, y: 24 });
  p.nodes.push(text('card-caption', 'library', '03  TARJETA + BOTÓN', 24, 256, 280, 11));
  p.nodes.push(node('group', { id: 'card', name: 'Tarjeta', parentId: 'library', x: 20, y: 294, width: 300, height: 180, radius: 18, fill: '#f4f5fa', stroke: '#e5e6ed', strokeWidth: 1 }),
    text('card-title', 'card', 'Tu próximo proyecto', 18, 18, 264, 19), text('card-copy', 'card', 'Todo empieza con una buena idea.', 18, 53, 264, 12));
  instantiate(p, button, 'card', 14, 110);
  const card = createComponent(p, 'card').id;
  p.nodes.push(text('screen-title', 'screen', 'Mi espacio', 28, 25, 334, 26), text('screen-copy', 'screen', 'Piezas compartidas. Detalles propios.', 28, 65, 334, 13));
  const first = instantiate(p, card, 'screen', 45, 113), second = instantiate(p, card, 'screen', 45, 325);
  const firstTitle = subtree(p, first).find(n => n.componentKey === 'card-title')!;
  updateNode(p, firstTitle.id, { text: 'Proyecto Aurora' });
  const secondTitle = subtree(p, second).find(n => n.componentKey === 'card-title')!;
  updateNode(p, secondTitle.id, { text: 'Proyecto Bosque' });
  const localLabel = subtree(p, second).find(n => n.componentKey === 'button-label')!;
  updateNode(p, localLabel.id, { text: 'Continuar mi proyecto' });
  syncComponents(p);
  return { document: validate(p), ids: { symbol, button, card, first, second, localLabel: localLabel.id, quiet: quiet.componentId } };
}
