import { describe, expect, it } from 'vitest';
import { clipboardFromTiles, pasteTileGrid } from './tileClipboard';

describe('clipboardFromTiles', () => {
  it('returns null for an empty selection', () => {
    expect(clipboardFromTiles([])).toBeNull();
  });

  it('stores cells relative to the top-left of the selection', () => {
    const clip = clipboardFromTiles([
      { x: 4, y: 5, gid: 7, tilesetKey: 'a.png' },
      { x: 5, y: 5, gid: 8 },
      { x: 4, y: 6, gid: 9, tilesetKey: null },
    ]);
    expect(clip).toEqual({
      originX: 4,
      originY: 5,
      cells: [
        { dx: 0, dy: 0, gid: 7, tilesetKey: 'a.png' },
        { dx: 1, dy: 0, gid: 8, tilesetKey: null },
        { dx: 0, dy: 1, gid: 9, tilesetKey: null },
      ],
    });
  });
});

describe('pasteTileGrid', () => {
  it('writes the clipboard at the new origin and skips out-of-bounds cells', () => {
    const clip = clipboardFromTiles([
      { x: 0, y: 0, gid: 2, tilesetKey: 't.png' },
      { x: 1, y: 0, gid: 3, tilesetKey: 't.png' },
      { x: 0, y: 1, gid: 4 },
    ]);
    if (!clip) throw new Error('clipboard');
    const data = [0, 0, 0, 0, 1, 0, 0, 0, 0];
    const { data: out, tilesetWrites } = pasteTileGrid(data, 3, 3, clip, 1, 1);
    expect(out).toEqual([0, 0, 0, 0, 2, 3, 0, 4, 0]);
    expect(data).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0]);
    expect(tilesetWrites).toEqual([
      { index: 4, key: 't.png' },
      { index: 5, key: 't.png' },
      { index: 7, key: null },
    ]);
  });

  it('clips a paste that hangs off the map edge', () => {
    const clip = clipboardFromTiles([
      { x: 0, y: 0, gid: 9 },
      { x: 1, y: 0, gid: 8 },
    ]);
    if (!clip) throw new Error('clipboard');
    const { data: out, tilesetWrites } = pasteTileGrid([1, 1, 1, 1], 2, 2, clip, 1, 1);
    expect(out).toEqual([1, 1, 1, 9]);
    expect(tilesetWrites).toHaveLength(1);
  });
});
