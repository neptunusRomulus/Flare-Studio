import { describe, expect, it } from 'vitest';
import { buildProjectBackup, normalizeProjectBackup } from './projectSession';

const now = Date.now();

describe('projectSession backup', () => {
  it('packs and restores multiple dirty maps plus editor drafts', () => {
    const packed = buildProjectBackup({
      timestamp: now,
      currentMapName: 'keep',
      currentSnapshot: { mapName: 'keep', mapWidth: 8, heroX: 1 },
      mapDrafts: [
        { mapName: 'dungeon', snapshot: { mapName: 'dungeon', mapWidth: 20, objects: [{ type: 'npc' }] } },
        { mapName: 'keep', snapshot: { mapName: 'keep', mapWidth: 99 } }, // current wins, not overwritten
      ],
      editors: {
        books: [{ path: 'books/lore.txt', content: 'hello' }],
        cutscenes: [],
      },
    });
    expect(packed.version).toBe(2);
    expect(packed.maps.map((m) => m.mapName)).toEqual(['keep', 'dungeon']);
    expect(packed.maps[0].snapshot.mapWidth).toBe(8);
    expect(packed.editors).toEqual({ books: [{ path: 'books/lore.txt', content: 'hello' }] });

    const restored = normalizeProjectBackup(packed);
    expect(restored?.mapName).toBe('keep');
    expect(restored?.maps).toHaveLength(2);
    expect(restored?.maps.find((m) => m.mapName === 'dungeon')?.snapshot.objects).toEqual([{ type: 'npc' }]);
    expect(restored?.editors.books).toEqual([{ path: 'books/lore.txt', content: 'hello' }]);
  });

  it('reads a v1 single-map backup as one map draft', () => {
    const restored = normalizeProjectBackup({
      timestamp: now,
      mapName: 'old_hall',
      mapWidth: 12,
      objects: [],
    });
    expect(restored?.maps).toEqual([
      expect.objectContaining({ mapName: 'old_hall', snapshot: expect.objectContaining({ mapWidth: 12 }) }),
    ]);
    expect(restored?.editors).toEqual({});
  });

  it('rejects stale backups', () => {
    expect(normalizeProjectBackup({ timestamp: now - 25 * 60 * 60 * 1000, mapName: 'x' })).toBe(null);
  });
});
