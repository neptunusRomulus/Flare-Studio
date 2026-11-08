import { describe, it, expect } from 'vitest';
import { groupLayers, layerGroupIndex } from './layerGroups';

describe('layer groups', () => {
  it('orders layers into the four groups', () => {
    const types = ['gameSettings', 'rules', 'event', 'status', 'items', 'enemy', 'npc', 'object', 'collision', 'background'];
    expect(groupLayers(types.map(type => ({ type }))).map(l => l.type)).toEqual(
      ['collision', 'object', 'background', 'npc', 'enemy', 'event', 'items', 'status', 'rules', 'gameSettings']);
  });
  it('puts unknown layer types in the drawing group', () => {
    expect(layerGroupIndex('fog')).toBe(0);
  });
});
