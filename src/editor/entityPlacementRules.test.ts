import { describe, expect, it } from 'vitest';
import { isPlaced, placedOfType, UNPLACED } from './entityPlacementRules';

describe('entity placement rules', () => {
  it('unplaced dock entities are left out of the map', () => {
    const objs = [
      { id: 1, type: 'npc', x: UNPLACED, y: UNPLACED },
      { id: 2, type: 'npc', x: 3, y: 4 },
      { id: 3, type: 'enemy', x: 0, y: 0 },
      { id: 4, type: 'event', x: -1, y: -1 },
    ];
    expect(placedOfType(objs, 'npc').map((o) => o.id)).toEqual([2]);
    expect(placedOfType(objs, 'enemy').map((o) => o.id)).toEqual([3]);
    expect(placedOfType(objs, 'event')).toEqual([]);
    expect(isPlaced({ x: 0, y: 0 })).toBe(true);
  });
});
