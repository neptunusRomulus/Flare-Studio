import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { findTilesetDefForImage } = require('../../electron/tilesetDefLookup.cjs');

function makeMod(root: string, mod: string, defs: Record<string, string>, pngs: string[] = []) {
  const m = path.join(root, mod);
  fs.mkdirSync(path.join(m, 'tilesetdefs'), { recursive: true });
  fs.mkdirSync(path.join(m, 'images', 'tilesets'), { recursive: true });
  for (const [n, t] of Object.entries(defs)) fs.writeFileSync(path.join(m, 'tilesetdefs', n), t);
  for (const p of pngs) fs.writeFileSync(path.join(m, 'images', 'tilesets', p), '');
  return m;
}

describe('findTilesetDefForImage', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsdef-'));
  const mods = path.join(root, 'mods');
  const fc = makeMod(mods, 'fantasycore', {
    'tileset_cave_and_dungeon.txt': 'img=images/tilesets/tileset_cave.png\ntile=1,0,0,1,1\n',
    'tileset_cave.txt': 'img=images/tilesets/tileset_cave.png\ntile=2,0,0,1,1\n',
    'tileset_grassland.txt': 'img=images/tilesets/tileset_grassland.png\nimg=images/tilesets/tileset_grassland_water.png\n',
  }, ['tileset_cave.png', 'tileset_grassland_water.png']);

  it('finds the def in the PNG\'s own mod, preferring the def named after the image', () => {
    const found = findTilesetDefForImage(path.join(fc, 'images', 'tilesets', 'tileset_cave.png'));
    expect(path.basename(found.path)).toBe('tileset_cave.txt');
  });
  it('matches a later img= section too', () => {
    const found = findTilesetDefForImage(path.join(fc, 'images', 'tilesets', 'tileset_grassland_water.png'));
    expect(path.basename(found.path)).toBe('tileset_grassland.txt');
  });
  it('falls back to the engine mods by file name for a PNG elsewhere', () => {
    const elsewhere = path.join(root, 'Desktop', 'tileset_cave.png');
    fs.mkdirSync(path.dirname(elsewhere), { recursive: true });
    fs.writeFileSync(elsewhere, '');
    expect(findTilesetDefForImage(elsewhere, [])).toBeNull();
    expect(path.basename(findTilesetDefForImage(elsewhere, [mods]).path)).toBe('tileset_cave.txt');
    expect(path.basename(findTilesetDefForImage('tileset_cave.png', [mods]).path)).toBe('tileset_cave.txt');
  });
  it('returns null when nothing references the image', () => {
    expect(findTilesetDefForImage('my_own.png', [mods])).toBeNull();
    expect(findTilesetDefForImage('notes.txt', [mods])).toBeNull();
  });
});
