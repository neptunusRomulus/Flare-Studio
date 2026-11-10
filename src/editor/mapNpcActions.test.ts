import { describe, expect, it } from 'vitest';
import { deleteMapNpcInstanceAction, nearestFreeTile, npcOccupiedTiles } from './mapNpcActions';

describe('nearestFreeTile', () => {
  it('prefers the tile to the east, then south, when the origin is taken', () => {
    const occupied = new Set(['2,2']);
    expect(nearestFreeTile(2, 2, occupied, 10, 10)).toEqual({ x: 3, y: 2 });
    expect(nearestFreeTile(2, 2, new Set(['2,2', '3,2']), 10, 10)).toEqual({ x: 2, y: 3 });
  });

  it('stays inside the map and returns null when every tile is taken', () => {
    expect(nearestFreeTile(0, 0, new Set(['0,0']), 1, 1)).toBeNull();
    expect(nearestFreeTile(0, 0, new Set(['0,0']), 2, 1)).toEqual({ x: 1, y: 0 });
  });
});

describe('deleteMapNpcInstanceAction', () => {
  const guard = (id: number, name = 'Guard') => ({ id, type: 'npc' as const, name, properties: { npcFilename: 'npcs/guard.txt' } });
  it('unplaces the last copy so the definition stays, and removes extras', () => {
    expect(deleteMapNpcInstanceAction([guard(1)], 1)).toBe('unplace');
    expect(deleteMapNpcInstanceAction([guard(1), guard(2)], 1)).toBe('remove');
    expect(deleteMapNpcInstanceAction([guard(1), { id: 2, type: 'npc' as const, name: 'Other', properties: { npcFilename: 'npcs/other.txt' } }], 1)).toBe('unplace');
  });
});

describe('npcOccupiedTiles', () => {
  it('ignores unplaced NPCs and the instance being copied', () => {
    const tiles = npcOccupiedTiles([
      { id: 1, type: 'npc', x: 1, y: 1 },
      { id: 2, type: 'npc', x: -1, y: -1 },
      { id: 3, type: 'enemy', x: 2, y: 2 },
    ], 1);
    expect([...tiles]).toEqual([]);
  });
});
