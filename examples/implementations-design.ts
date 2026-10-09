import { slotsDesign } from './slots-design';
import { setComponentImplementation } from '../src/implementations';
export function implementationsDesign() {
  const fixture = slotsDesign();
  for (const [platform, symbol, path] of [
    ['ios', 'CardView', 'CardView.swift'], ['android', 'Card', 'Card.kt'], ['web', 'Card', 'Card.tsx'],
  ]) setComponentImplementation(fixture.document, fixture.ids.card, platform, { symbol, path: `examples/implementation-sources/${path}`, module: 'DesignSystem' });
  return fixture;
}
