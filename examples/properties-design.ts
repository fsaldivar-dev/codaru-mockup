import { nestedDesign } from './nested-design';
import { subtree, syncComponents, validate, updateNode } from '../src/model';
import { defineComponentProperty } from '../src/component-properties';
export function propertiesDesign() {
  const fixture = nestedDesign(), p = fixture.document;
  p.name = 'Propiedades · Un contrato para cada tarjeta';
  const dot = p.nodes.find(n => n.id === 'symbol-dot')!; dot.type = 'icon'; dot.iconPack = 'material'; dot.iconName = 'star'; dot.color = '#7255db'; dot.fill = 'transparent';
  p.nodes.find(n => n.id === 'card-copy')!.textKey = 'card.description';
  syncComponents(p);
  for (const n of p.nodes.filter(n => n.type === 'icon' && n.id !== dot.id)) updateNode(p,n.id,{fill:'transparent',color:'#ffffff'});
  syncComponents(p);
  const nested = subtree(p, 'card'), button = nested.find(n => n.instanceOf === fixture.ids.button)!;
  const icon = nested.find(n => n.type === 'icon')!;
  for (const [key, property] of Object.entries({
    titulo: { type: 'text' as const, targetId: 'card-title', label: 'Título' },
    accion: { type: 'text' as const, targetId: nested.find(n => n.componentKey === 'button-label')!.id, label: 'Texto del botón' },
    icono: { type: 'icon' as const, targetId: icon.id, label: 'Icono' },
    descripcion: { type: 'visibility' as const, targetId: 'card-copy', label: 'Mostrar descripción' },
    estado: { type: 'variant' as const, targetId: button.id, axis: 'Estado', label: 'Estilo del botón' },
  })) defineComponentProperty(p, fixture.ids.card, key, property);
  syncComponents(p); return { ...fixture, document: validate(p) };
}
