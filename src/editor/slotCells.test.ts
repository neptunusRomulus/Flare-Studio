import { describe, it, expect } from 'vitest';
import { findSlotForCellKey, mergeLegacySlotData, clearSlotCells, normalizeSlotKey } from './slotCells';
import { assignExportOffsets } from './tilesetIds';

const slot1 = { id: 1, tileset: { fileName: 'background_tab1_grass.png' } };
const slot2 = { id: 2, tileset: { fileName: 'background_tab2_stone.png' } };

describe('slot cells', () => {
  it('cells painted from different slots each resolve to their own slot', () => {
    const data = [0, 0, 0, 0];
    const keys: Array<string | null> = [null, null, null, null];
    // paint with slot1 (active), switch to slot2, paint: grid is shared, keys per cell
    data[0] = 5; keys[0] = slot1.tileset.fileName;
    data[1] = 5; keys[1] = slot2.tileset.fileName;
    expect(findSlotForCellKey([slot1, slot2], keys[0])).toBe(slot1);
    expect(findSlotForCellKey([slot1, slot2], keys[1])).toBe(slot2);
    expect(data).toEqual([5, 5, 0, 0]);
  });

  it('resolves plain paint-time keys against prefixed save keys after reload', () => {
    expect(normalizeSlotKey('/x/y/background_tab3_background_tab3_stone.png')).toBe('stone.png');
    expect(findSlotForCellKey([slot1, slot2], 'stone.png')).toBe(slot2);
  });

  it('serialization roundtrip keeps per-cell slot keys', () => {
    const saved = JSON.parse(JSON.stringify({ layerCellTilesetKeys: { background: ['grass.png', 'stone.png', null] } }));
    const keys = saved.layerCellTilesetKeys.background as Array<string | null>;
    expect(keys.map(k => findSlotForCellKey([slot1, slot2], k)?.id ?? null)).toEqual([1, 2, null]);
  });

  it('migrates legacy per-slot data into one grid', () => {
    const data = [3, 0, 0];
    const keys: Array<string | null> = [null, null, null];
    const s1 = { ...slot1, data: [3, 0, 0] };
    const s2 = { ...slot2, data: [7, 0, 9] };
    mergeLegacySlotData(data, keys, [s1, s2], 1);
    expect(data).toEqual([3, 0, 9]);
    expect(keys).toEqual([slot1.tileset.fileName, null, slot2.tileset.fileName]);
    expect(s2.data).toBeUndefined();
  });

  it('deleting a slot erases only its cells', () => {
    const data = [1, 2];
    const keys: Array<string | null> = ['grass.png', 'stone.png'];
    expect(clearSlotCells(data, keys, [slot2])).toBe(1);
    expect(data).toEqual([1, 0]);
    expect(keys).toEqual(['grass.png', null]);
  });

  it('export ids map each cell to its own slot tileset entry', () => {
    const offsets = assignExportOffsets([{ count: 10 }, { count: 10 }]);
    const off = new Map([['grass.png', offsets[0]], ['stone.png', offsets[1]]]);
    const cells = [{ local: 4, key: 'background_tab1_grass.png' }, { local: 4, key: 'stone.png' }];
    const gids = cells.map(c => off.get(normalizeSlotKey(c.key)!)! + c.local - 1);
    expect(gids).toEqual([4, 14]);
  });
});
