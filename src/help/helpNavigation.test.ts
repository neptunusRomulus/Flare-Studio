import { describe, expect, it } from 'vitest';
import { canGoHelp, layerForHelpTarget, layerTypeForHelpTarget } from '@/help/helpNavigation';

const layers = [
  { id: 'a', type: 'background' },
  { id: 'q', type: 'rules' },
  { id: 'b', type: 'npc' },
];

describe('help navigation', () => {
  it('maps a topic to the layer it talks about', () => {
    expect(layerTypeForHelpTarget('npc')).toBe('npc');
    expect(layerTypeForHelpTarget('quest-map')).toBe('rules');
    expect(layerForHelpTarget('npc', layers)?.id).toBe('b');
    expect(layerForHelpTarget('quest-map', layers)?.id).toBe('q');
    expect(layerForHelpTarget('items', layers)).toBeUndefined();
  });

  it('only offers a target the project can actually show', () => {
    const deps = { hasSettings: true, layerTypes: layers.map((l) => l.type), hasProjectPath: true };
    expect(canGoHelp('npc', deps)).toBe(true);
    expect(canGoHelp('items', deps)).toBe(false);
    expect(canGoHelp('display', deps)).toBe(true);
    expect(canGoHelp('quest-map', deps)).toBe(true);
    expect(canGoHelp('quest-map', { ...deps, hasProjectPath: false })).toBe(false);
    expect(canGoHelp('display', { ...deps, hasSettings: false })).toBe(false);
  });
});
