import { describe, expect, it, vi } from 'vitest';
import { TileMapEditor } from './TileMapEditor';

type Selection = {
  x: number;
  y: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
  tileWidth?: number;
  tileHeight?: number;
};

function paletteEditor(overrides: Record<string, unknown> = {}) {
  return {
    tilesetImage: { width: 64, height: 32 },
    tilesetTileWidth: 32,
    tilesetTileHeight: 32,
    tileSizeX: 32,
    tileSizeY: 32,
    tilesetColumns: 2,
    detectedTileData: new Map<number, { sourceX: number; sourceY: number }>(),
    activeLayerId: 3,
    stamps: new Map(),
    setActiveStamp: vi.fn(),
    setStampTool: vi.fn(),
    stampCallback: vi.fn(),
    ...overrides,
  };
}

const twoTileRow: Selection = {
  x: 0,
  y: 0,
  width: 64,
  height: 32,
  cols: 2,
  rows: 1,
  tileWidth: 32,
  tileHeight: 32,
};

describe('TileMapEditor.setTileSelection', () => {
  it('builds a stamp from a palette selection and returns true', () => {
    const editor = paletteEditor();
    const ok = TileMapEditor.prototype.setTileSelection.call(editor, twoTileRow);
    expect(ok).toBe(true);
    expect(editor.setActiveStamp).toHaveBeenCalledOnce();
    expect(editor.setStampTool).toHaveBeenCalledOnce();
    expect(editor.stampCallback).toHaveBeenCalledOnce();
    expect(editor.stamps.size).toBe(1);
    const stamp = [...editor.stamps.values()][0];
    expect(stamp.width).toBe(2);
    expect(stamp.height).toBe(1);
    expect(stamp.fromPaletteSelection).toBe(true);
    expect(stamp.name).toBe('Tileset Selection');
    expect(stamp.tiles).toEqual([
      { tileId: 1, layerId: 3, x: 0, y: 0 },
      { tileId: 2, layerId: 3, x: 1, y: 0 },
    ]);
  });

  it('maps tiles through detectedTileData when source coordinates match', () => {
    const editor = paletteEditor();
    editor.detectedTileData.set(11, { sourceX: 0, sourceY: 0 });
    editor.detectedTileData.set(22, { sourceX: 32, sourceY: 0 });
    const ok = TileMapEditor.prototype.setTileSelection.call(editor, twoTileRow);
    expect(ok).toBe(true);
    const stamp = [...editor.stamps.values()][0];
    expect(stamp.tiles.map((t: { tileId: number }) => t.tileId)).toEqual([11, 22]);
  });

  it('returns false when no tileset image is loaded or the selection is empty', () => {
    const noImage = paletteEditor({ tilesetImage: null });
    expect(TileMapEditor.prototype.setTileSelection.call(noImage, twoTileRow)).toBe(false);

    const empty = paletteEditor();
    expect(TileMapEditor.prototype.setTileSelection.call(empty, {
      x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0,
    })).toBe(false);
  });
});
