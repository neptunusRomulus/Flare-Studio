import { describe, expect, it } from 'vitest';
import { applyStampToGrid, clampOrthogonalStampOrigin, stampFromSelection, stampTargetCell } from './stampTiles';

describe('stampFromSelection', () => {
  it('returns null for an empty selection', () => {
    expect(stampFromSelection([], 2)).toBeNull();
  });

  it('keeps the full selection bounds and skips empty cells', () => {
    const stamp = stampFromSelection([
      { x: 2, y: 3, gid: 10 },
      { x: 3, y: 3, gid: 0 },
      { x: 2, y: 4, gid: 11 },
    ], 5);
    expect(stamp).toEqual({
      width: 2,
      height: 2,
      tiles: [
        { tileId: 10, layerId: 5, x: 0, y: 0 },
        { tileId: 11, layerId: 5, x: 0, y: 1 },
      ],
    });
  });
});

describe('stamp placement', () => {
  it('clamps an orthogonal stamp so it stays on the map', () => {
    expect(clampOrthogonalStampOrigin(8, 8, 3, 2, 10, 10)).toEqual({ x: 7, y: 8 });
    expect(clampOrthogonalStampOrigin(-2, -1, 3, 2, 10, 10)).toEqual({ x: 0, y: 0 });
  });

  it('maps stamp-local cells for orthogonal and isometric maps', () => {
    expect(stampTargetCell(4, 5, 1, 2, false)).toEqual({ x: 5, y: 7 });
    expect(stampTargetCell(4, 5, 1, 2, true)).toEqual({ x: 7, y: 6 });
  });

  it('writes stamp tiles onto a grid and skips cells outside the map', () => {
    const data = [0, 0, 0, 0, 1, 0, 0, 0, 0];
    const out = applyStampToGrid(data, 3, 3, [{ x: 0, y: 0, tileId: 7 }, { x: 1, y: 0, tileId: 8 }, { x: 2, y: 0, tileId: 9 }], 1, 1);
    expect(out).toEqual([0, 0, 0, 0, 7, 8, 0, 0, 0]);
    expect(data[4]).toBe(1);
  });
});
