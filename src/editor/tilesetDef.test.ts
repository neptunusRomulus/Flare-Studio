import { describe, it, expect } from 'vitest';
import { parseTilesetDefTiles } from './tilesetDef';

describe('parseTilesetDefTiles', () => {
  it('keeps Flare tile ids, sizes and origins', () => {
    const tiles = parseTilesetDefTiles(
      '[tileset]\nimg=images/tilesets/tileset_grassland.png\ntile=16,1061,2698,192,96,96,48\n# c\ntile=200,10,20,64,128\n',
    );
    expect(tiles.size).toBe(2);
    expect(tiles.get(16)).toEqual({ sourceX: 1061, sourceY: 2698, width: 192, height: 96, originX: 96, originY: 48 });
    expect(tiles.get(200)).toEqual({ sourceX: 10, sourceY: 20, width: 64, height: 128, originX: 32, originY: 128 });
  });

  it('skips broken lines', () => {
    expect(parseTilesetDefTiles('tile=1,2,3\ntile=x,1,1,1,1').size).toBe(0);
  });
});
