import { describe, it, expect } from 'vitest';
import { assignExportOffsets } from './tilesetIds';

const globalId = (offset: number, localId: number) => offset + localId - 1;

describe('assignExportOffsets', () => {
  it('def-sliced tilesets keep Flare ids (round-trip local -> global = def id)', () => {
    const grass = { count: 300, defIds: [16, 17, 250] };
    const water = { count: 320, defIds: [300, 310] }; // same def, disjoint ids
    const [o1, o2] = assignExportOffsets([grass, water]);
    expect(grass.defIds.map((id) => globalId(o1, id))).toEqual([16, 17, 250]);
    expect(water.defIds.map((id) => globalId(o2, id))).toEqual([300, 310]);
  });
  it('shifts a def tileset whose ids clash with an earlier one', () => {
    const [o1, o2] = assignExportOffsets([{ count: 20, defIds: [16, 20] }, { count: 20, defIds: [16] }]);
    expect(o1).toBe(1);
    expect(globalId(o2, 16)).toBeGreaterThan(20);
  });
  it('grid tilesets follow after the highest used id, like before when alone', () => {
    expect(assignExportOffsets([{ count: 10 }, { count: 5 }])).toEqual([1, 11]);
    const [d, g] = assignExportOffsets([{ count: 40, defIds: [40] }, { count: 5 }]);
    expect(d).toBe(1);
    expect(g).toBe(41);
  });
});
