import { describe, it, expect } from 'vitest';
import { nextTarget, shouldHandleTabKey, MAP_TARGET_CURSOR, collapseMapLayers } from './mapTargets';
import { groupLayers } from './layerGroups';

describe('map targets', () => {
  it('cycles Ground -> Object -> Collision -> Ground (and reverse)', () => {
    expect(nextTarget('background')).toBe('object');
    expect(nextTarget('object')).toBe('collision');
    expect(nextTarget('collision')).toBe('background');
    expect(nextTarget('background', true)).toBe('collision');
  });
  it('tab guard', () => {
    const div = { tagName: 'DIV', closest: () => null };
    expect(shouldHandleTabKey({ key: 'Tab' }, 'object', div)).toBe(true);
    expect(shouldHandleTabKey({ key: 'Tab' }, 'npc', div)).toBe(false);
    expect(shouldHandleTabKey({ key: 'Tab' }, 'object', { tagName: 'INPUT' })).toBe(false);
    expect(shouldHandleTabKey({ key: 'Tab' }, 'object', { tagName: 'DIV', isContentEditable: true })).toBe(false);
    expect(shouldHandleTabKey({ key: 'Tab' }, 'object', { tagName: 'DIV', closest: () => ({}) })).toBe(false);
    expect(shouldHandleTabKey({ key: 'Tab', ctrlKey: true }, 'object', div)).toBe(false);
    expect(shouldHandleTabKey({ key: 'a' }, 'object', div)).toBe(false);
  });
  it('cursor colours', () => {
    expect(MAP_TARGET_CURSOR).toEqual({ background: '#000000', object: 'hsl(25, 95%, 53%)', collision: '#ffffff' });
  });
  it('sidebar shows one Map entry instead of three drawing layers', () => {
    const layers = groupLayers(['npc', 'background', 'collision', 'object', 'items'].map((type, id) => ({ id, type })));
    const entries = collapseMapLayers(layers);
    expect(entries.map(e => e.kind === 'map' ? 'map' : e.layer.type)).toEqual(['map', 'npc', 'items']);
    const map = entries[0];
    expect(map.kind === 'map' && map.targets.map(t => t.type)).toEqual(['background', 'object', 'collision']);
  });
});
