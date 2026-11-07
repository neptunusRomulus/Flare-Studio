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

import { defTilesForImage, defImageNames, tileDrawTopLeft } from './tilesetDef';

const MULTI = [
  '[tileset]',
  'img=images/tilesets/tileset_grassland.png',
  'tile=16,1061,2698,192,96,96,48',
  'tile=40,10,20,170,255,74,244',
  '[tileset]',
  'img=images/tilesets/tileset_grassland_water.png',
  'tile=200,0,0,192,96,96,-48',
].join('\n');

describe('defTilesForImage', () => {
  it('takes only the tiles of the matching img= section', () => {
    expect(defImageNames(MULTI)).toEqual(['tileset_grassland.png', 'tileset_grassland_water.png']);
    const g = defTilesForImage(MULTI, 'tileset_grassland.png', 96);
    expect([...g.keys()]).toEqual([16, 40]);
    const w = defTilesForImage(MULTI, '/x/y/TILESET_GRASSLAND_WATER.png', 96);
    expect([...w.keys()]).toEqual([200]);
    expect(defTilesForImage(MULTI, 'tileset_cave.png', 96).size).toBe(0);
  });
  it('converts Flare offsets to the bottom-point origin (originY = oy + ground/2)', () => {
    const g = defTilesForImage(MULTI, 'tileset_grassland.png', 96);
    expect(g.get(16)).toMatchObject({ sourceX: 1061, sourceY: 2698, width: 192, height: 96, originX: 96, originY: 96 });
    expect(g.get(40)).toMatchObject({ originX: 74, originY: 292 });
    expect(defTilesForImage(MULTI, 'tileset_grassland_water.png', 96).get(200)).toMatchObject({ originY: 0 });
  });
  it('a def without img= lines applies to any image', () => {
    expect(defTilesForImage('tile=3,0,0,192,96,96,48', 'mine.png', 96).size).toBe(1);
  });
});

describe('tileDrawTopLeft', () => {
  const cx = 500, cy = 300;
  it('matches Flare: top-left = diamond center - (ox, oy)', () => {
    // def tile ox=74, oy=244 -> origin (74, 244 + 48)
    expect(tileDrawTopLeft(cx, cy, 96, 1, { width: 170, height: 255, originX: 74, originY: 292 })).toEqual({ x: cx - 74, y: cy - 244 });
    // water edge oy=-48
    expect(tileDrawTopLeft(cx, cy, 96, 1, { width: 192, height: 96, originX: 96, originY: 0 })).toEqual({ x: cx - 96, y: cy + 48 });
  });
  it('grid tiles keep the bottom-center anchor', () => {
    expect(tileDrawTopLeft(cx, cy, 96, 1, { width: 192, height: 96 })).toEqual({ x: cx - 96, y: cy - 48 });
    expect(tileDrawTopLeft(cx, cy, 96, 1, { width: 192, height: 96, originX: 96, originY: 96 })).toEqual({ x: cx - 96, y: cy - 48 });
  });
  it('scales with zoom', () => {
    expect(tileDrawTopLeft(cx, cy, 96, 2, { width: 192, height: 96, originX: 96, originY: 96 })).toEqual({ x: cx - 192, y: cy - 96 });
  });
});
