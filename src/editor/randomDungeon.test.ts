import { describe, expect, it } from 'vitest';
import { parseProcgenFile } from './procgenRules';
import {
  DEFAULT_ROOM_SIZE,
  LINK_RECTS_28,
  buildDungeonRulesFile,
  buildHostMapText,
  buildOpeningsMapText,
  buildRoomMapText,
  dungeonPaths,
  dungeonSlugFromIntermap,
  dungeonStatus,
  hostDimensions,
  intermapForHost,
  linkRectsForSize,
  listProcgenMaps,
  nextRoomRelPath,
  parseMapHeader,
  parseRequiresFromProjectFiles,
  roomRelPath,
  roomSizeFromRooms,
  slugifyDungeonName,
  uniqueDungeonSlug,
  withRulesRooms,
} from './randomDungeon';

describe('random dungeon helpers', () => {
  it('keeps official 28×28 opening rectangles exact and scales others', () => {
    expect(linkRectsForSize(28, 28)).toEqual(LINK_RECTS_28);
    const half = linkRectsForSize(14, 14);
    expect(half.north).toEqual({ x: 5, y: 0, w: 5, h: 3 });
    expect(half.east.x + half.east.w).toBeLessThanOrEqual(14);
    expect(half.south.y + half.south.h).toBeLessThanOrEqual(14);
  });

  it('sizes the host map like Empyrean (12-tile pad, 5×5 of 28)', () => {
    expect(hostDimensions(28, 28)).toEqual({
      width: 164,
      height: 164,
      event: { x: 12, y: 12, w: 140, h: 140 },
    });
  });

  it('builds a sealed blank room, hidden openings map, and host with a procgen event', () => {
    const style = { tileset: 'tilesetdefs/tileset_ruins.txt', tilewidth: 192, tileheight: 96, orientation: 'isometric' };
    const room = buildRoomMapText({ width: 28, height: 28, type: 'start', style, title: 'Entrance' });
    const header = parseMapHeader(room);
    expect(header).toMatchObject({ width: 28, height: 28, procgenType: 'start', tileset: 'tilesetdefs/tileset_ruins.txt', heroX: 13, heroY: 13 });
    expect(room).toContain('[layer]');
    expect(room).not.toContain('procgen_link=');

    const openings = buildOpeningsMapText({ width: 28, height: 28, style });
    expect(parseMapHeader(openings).procgenType).toBe('links');
    expect(openings).toContain('procgen_link=north');
    expect(openings).toContain('location=9,0,10,6');
    expect(openings).toContain('procgen_link=east');
    expect(openings).toContain('location=22,9,6,10');

    const host = buildHostMapText({
      roomWidth: 28,
      roomHeight: 28,
      rulesPath: 'maps/procgen_rules/dungeon.txt',
      style,
      title: 'Dungeon',
    });
    expect(parseMapHeader(host)).toMatchObject({ width: 164, height: 164, heroX: 0, heroY: 0 });
    expect(host).toContain('location=12,12,140,140');
    expect(host).toContain('procgen_filename=maps/procgen_rules/dungeon.txt');
    expect(host).not.toContain('procgen_type=');
  });

  it('serializes beginner rules with doors_max=0', async () => {
    const { serializeDungeonRules } = await import('./randomDungeon');
    const text = serializeDungeonRules(buildDungeonRulesFile({
      openingsPath: 'maps/dungeon/openings.txt',
      rooms: ['maps/dungeon_entrance.txt', 'maps/dungeon_exit.txt'],
    }));
    expect(text).toContain('doors_max=0');
    expect(text).toContain('filename=maps/dungeon/openings.txt');
    expect(text).toContain('filename=maps/dungeon_entrance.txt');
    expect(text).toContain('filename=maps/dungeon_exit.txt');
  });

  it('reports status in the approved order of issues', () => {
    const entrance = { path: 'maps/d_entrance.txt', type: 'start', width: 28, height: 28, title: '' };
    const exit = { path: 'maps/d_exit.txt', type: 'end', width: 28, height: 28, title: '' };
    const room = { path: 'maps/d_room.txt', type: 'normal', width: 28, height: 28, title: '' };
    expect(dungeonStatus([], true)).toBe('Entrance missing');
    expect(dungeonStatus([entrance], true)).toBe('Exit missing');
    expect(dungeonStatus([entrance, exit], false)).toBe('Openings map missing');
    expect(dungeonStatus([entrance, exit, { ...room, width: 20 }], true)).toBe('Rooms are different sizes');
    expect(dungeonStatus([entrance, exit, room], true)).toBe('Ready');
  });

  it('locks later room size to the first present room, otherwise 28', () => {
    expect(roomSizeFromRooms([])).toEqual({ width: DEFAULT_ROOM_SIZE, height: DEFAULT_ROOM_SIZE });
    expect(roomSizeFromRooms([{ width: 20, height: 24, missing: false }])).toEqual({ width: 20, height: 24 });
  });

  it('allocates unique room paths and reads a host intermap back to a slug', () => {
    expect(dungeonPaths('My Dungeon').host).toBe('maps/my_dungeon.txt');
    expect(dungeonPaths('My Dungeon').openings).toBe('maps/my_dungeon/openings.txt');
    expect(roomRelPath('my_dungeon', 'start', 1)).toBe('maps/my_dungeon_entrance.txt');
    expect(nextRoomRelPath('my_dungeon', 'normal', ['maps/my_dungeon_room.txt'])).toBe('maps/my_dungeon_room_2.txt');
    expect(uniqueDungeonSlug('dungeon', ['dungeon', 'dungeon_2'])).toBe('dungeon_3');
    expect(slugifyDungeonName('Random Dungeon')).toBe('random_dungeon');
    expect(dungeonSlugFromIntermap('maps/my_dungeon.txt,0,0')).toBe('my_dungeon');
    expect(dungeonSlugFromIntermap('maps/spawn.txt')).toBe(null);
    expect(intermapForHost('maps/my_dungeon.txt')).toBe('maps/my_dungeon.txt');
  });

  it('lists start/normal/end maps from the project and required mods, skipping rules files', async () => {
    const files: Record<string, string> = {
      '/proj/project.json': JSON.stringify({ requires: ['fantasycore'] }),
      '/proj/settings.txt': 'requires=fantasycore,empyrean_campaign\n',
      '/proj/maps/town.txt': '[header]\nwidth=10\nheight=10\n',
      '/proj/maps/dungeon_entrance.txt': '[header]\nwidth=28\nheight=28\nprocgen_type=start\ntitle=My entrance\n',
      '/opt/flare-game/mods/empyrean_campaign/maps/iron_labyrinth/room1.txt': '[header]\nwidth=28\nheight=28\nprocgen_type=normal\n',
      '/opt/flare-game/mods/empyrean_campaign/maps/procgen_rules/iron_labyrinth.txt': '[chunks]\nfilename=maps/iron_labyrinth/room1.txt\n',
      '/opt/flare-engine/mods/fantasycore/maps/spawn.txt': '[header]\nwidth=4\nheight=4\n',
    };
    const dirs: Record<string, Array<{ name: string; isDirectory?: boolean }>> = {
      '/proj/maps': [
        { name: 'town.txt' },
        { name: 'dungeon_entrance.txt' },
        { name: 'procgen_rules', isDirectory: true },
      ],
      '/opt/flare-game/mods/empyrean_campaign/maps': [
        { name: 'iron_labyrinth', isDirectory: true },
        { name: 'procgen_rules', isDirectory: true },
      ],
      '/opt/flare-game/mods/empyrean_campaign/maps/iron_labyrinth': [{ name: 'room1.txt' }],
      '/opt/flare-game/mods/empyrean_campaign/maps/procgen_rules': [{ name: 'iron_labyrinth.txt' }],
      '/opt/flare-engine/mods/fantasycore/maps': [{ name: 'spawn.txt' }],
    };
    const listed = await listProcgenMaps({
      projectPath: '/proj',
      flarePath: '/opt/flare-engine',
      fs: {
        readFile: async (abs) => files[abs] || '',
        readDir: async (abs) => dirs[abs] || [],
      },
    });
    expect(listed.map((row) => row.path)).toEqual([
      'maps/dungeon_entrance.txt',
      'maps/iron_labyrinth/room1.txt',
    ]);
    expect(listed[0].title).toBe('My entrance');
    expect(parseRequiresFromProjectFiles('{}', 'requires=empyrean_campaign\n')).toEqual(['empyrean_campaign']);
  });
});
