import { describe, expect, it } from 'vitest';
import { currentMapFile, dungeonRoomMapName, dungeonSlugForLink, mapStyleFrom } from '@/components/events/dungeonLink';

describe('currentMapFile', () => {
  it('keeps the leaf name and always ends in .txt', () => {
    expect(currentMapFile('cave')).toBe('cave.txt');
    expect(currentMapFile('maps/cave.txt')).toBe('cave.txt');
    expect(currentMapFile('C:\\world\\maps\\Cave')).toBe('Cave.txt');
    expect(currentMapFile(null)).toBe('.txt');
  });
});

describe('mapStyleFrom', () => {
  it('prefers the map header over the editor ground size', () => {
    const style = mapStyleFrom({
      ground: { width: 32, height: 32, orientation: 'isometric' },
      header: { tileset: 'tileset.png', tilewidth: '64', tileheight: '48', orientation: 'orthogonal' },
    });
    expect(style).toEqual({ tileset: 'tileset.png', tilewidth: '64', tileheight: '48', orientation: 'orthogonal' });
  });

  it('falls back to the ground size when there is no header', () => {
    expect(mapStyleFrom({ ground: { width: 32, height: 32, orientation: 'isometric' } }))
      .toEqual({ tilewidth: 32, tileheight: 32, orientation: 'isometric' });
    expect(mapStyleFrom({})).toEqual({});
  });
});

describe('dungeonSlugForLink', () => {
  it('reads the slug out of a map link; whether the rules exist is checked on disk', () => {
    expect(dungeonSlugForLink('maps/cave_dungeon.txt')).toBe('cave_dungeon');
    expect(dungeonSlugForLink('maps/cave.txt')).toBe('cave');
    expect(dungeonSlugForLink('maps/spawn.txt')).toBe('');
    expect(dungeonSlugForLink('')).toBe('');
  });
});

describe('dungeonRoomMapName', () => {
  it('turns a room path into the map tab name', () => {
    expect(dungeonRoomMapName('maps/cave_room_2.txt')).toBe('cave_room_2');
    expect(dungeonRoomMapName('cave_room_2.txt')).toBe('cave_room_2');
  });
});
