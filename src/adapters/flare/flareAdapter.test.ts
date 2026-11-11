import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  emptyProject,
  exportEnemyFile,
  exportItemFile,
  exportMapText,
  exportNpcFile,
  exportPowerFile,
  exportProject,
  exportTilesetText,
  formatCurrency,
  importMapText,
  launchPlan,
  migrateFiles,
  tilePixelOffset,
  toIntFlare,
  validateText,
} from './flareAdapter.cjs';

const fixture = (name: string) =>
  fs.readFileSync(path.resolve(process.cwd(), 'tests/fixtures/export', name), 'utf8');

const villageMap = {
  width: 2,
  height: 2,
  tileset: 'tilesetdefs/tileset_village.txt',
  heroX: 1,
  heroY: 0,
  title: 'Village',
  layers: [
    { type: 'rules', rows: [[9, 9], [9, 9]] },
    { type: 'background', visible: true, rows: [[1, 1], [1, 0]] },
    { type: 'object', visible: false, rows: [[0, 0], [0, 4]] },
  ],
  knownEnemyCategories: ['antlion'],
  events: [
    {
      tooltip: 'Event',
      activate: 'on_trigger',
      location: '1,0,1,1',
      intermap_id: 'gate',
      mapmod_toggle: 'object,0,1,4,0',
      requires_tile: 'background,1,0,1',
      requires_not_tile: 'object,0,1,4',
      reward_currency: '1,500',
      power_stats: 'enemies/dummy.txt',
      power_level: 'hero_level,1',
      spawn_level: 'fixed,2',
      procgen_filename: 'maps/procgen/rules.txt',
    },
  ],
  enemies: [{ category: 'enemy', level: '1,2', location: '0,1,1,1' }],
  npcs: [
    {
      type: 'npc',
      filename: 'npcs/merchant.txt',
      location: '1,1,1,1',
      waypoints: '0,0;1,1',
      wander_radius: '2',
    },
  ],
};

describe('FlareAdapter golden files', () => {
  it('writes the village map the engine can parse', () => {
    const exported = exportMapText(villageMap);
    expect(exported.errors).toEqual([]);
    expect(exported.text).toBe(fixture('village.map.txt'));
    expect(exported.text).not.toContain('music=');
    expect(exported.text).not.toContain('tilewidth=');
    expect(exported.text).not.toContain('type=rules');
    expect(exported.text).toContain('type=collision');
    const again = exportMapText(importMapText(exported.text));
    expect(again.errors).toEqual([]);
    expect(again.text).toBe(exported.text);
  });

  it('keeps Tiled tilewidth, tileheight and orientation on the map header', () => {
    const text = fs.readFileSync(path.resolve(process.cwd(), 'tests/fixtures/flare-maps/tiled_header.txt'), 'utf8');
    const imported = importMapText(text) as {
      tilewidth?: number;
      tileheight?: number;
      orientation?: string;
      backgroundColor?: string;
    };
    expect(imported.tilewidth).toBe(192);
    expect(imported.tileheight).toBe(96);
    expect(imported.orientation).toBe('isometric');
    const exported = exportMapText(imported);
    expect(exported.errors).toEqual([]);
    expect(exported.text).toContain('tilewidth=192');
    expect(exported.text).toContain('tileheight=96');
    expect(exported.text).toContain('orientation=isometric');
    expect(exported.text).toContain('background_color=0,0,0,255');
    const again = exportMapText(importMapText(exported.text));
    expect(again.errors).toEqual([]);
    expect(again.text).toBe(exported.text);
    expect(validateText('maps', exported.text, 'maps/tiled_header.txt')).toEqual([]);
  });

  it('keeps unknown map header keys such as location= on a round-trip', () => {
    const text = [
      '[header]',
      'width=1',
      'height=1',
      'hero_pos=0,0',
      'location=0,0,3',
      'custom_note=keep-me',
      '',
      '[event]',
      'type=event',
      'location=0,0,1,1',
      'activate=on_load',
      'intermap=maps/lab_welcome.txt,5,8',
      '',
    ].join('\n');
    const exported = exportMapText(importMapText(text));
    expect(exported.errors).toEqual([]);
    const header = exported.text.split('[event]')[0];
    expect(header).toContain('location=0,0,3');
    expect(header).toContain('custom_note=keep-me');
    expect(exported.text).toContain('intermap=maps/lab_welcome.txt,5,8');
    const eventBlock = exported.text.split('[event]')[1];
    expect(eventBlock).toContain('location=0,0,1,1');
    const again = exportMapText(importMapText(exported.text));
    expect(again.text).toBe(exported.text);
  });

  it('moves item power keys into powers/powers.txt and keeps APPEND', () => {
    const items = exportItemFile([
      { id: 12, name: 'Sword', item_type: 'main', dmg_min: 2, dmg_max: 4, speed: 8, type: 'fixed' },
    ]);
    expect(items.text).toBe(fixture('sword.item.txt'));
    expect(items.text.startsWith('APPEND')).toBe(true);
    expect(items.text).not.toContain('speed=');
    expect(items.text).not.toContain('\ntype=');
    expect(exportPowerFile(items.powers)).toBe(fixture('sword.power.txt'));
  });

  it('writes an enemy file without gold, waypoints, or gfx', () => {
    const enemy = exportEnemyFile({
      name: 'Antlion',
      level: 1,
      gfx: 'animations/antlion.txt',
      categories: 'antlion',
      render_layers: 'body',
      gold: 10,
      waypoints: '1,1',
      script: 'nope',
      wander_radius: 4,
    });
    expect(enemy.text).toBe(fixture('antlion.enemy.txt'));
    expect(enemy.warnings.join(' ')).toContain('gold');
  });

  it('writes NPC dialog currency as one integer and portrait_him', () => {
    const text = exportNpcFile({
      name: 'Merchant',
      gfx: 'animations/npcs/merchant.txt',
      waypoints: '0,0',
      wander_radius: 3,
      customProperties: {
        dialogueTrees: [
          {
            id: 'hello',
            topic: 'Hello',
            dialogues: [{ speaker: 'npc', text: 'Welcome', portrait: 'images/portraits/m.png' }],
            rewards: [{ type: 'gold', value: '1,250' }],
          },
        ],
      },
    });
    expect(text).toBe(fixture('merchant.npc.txt'));
    expect(text).not.toContain('waypoints=');
    expect(text).not.toContain('portrait=');
  });

  it('map [npc] block writes engine keys: direction, one-line waypoints, spawn requirements', () => {
    const exported = exportMapText({
      width: 1,
      height: 1,
      heroX: 0,
      heroY: 0,
      layers: [],
      events: [],
      enemies: [],
      npcs: [
        {
          filename: 'npcs/guard.txt',
          location: '2,2,1,1',
          direction: '3',
          waypoints: '1,1,2,2',
          requires_status: 'village_saved',
          requires_not_status: 'dead',
        },
      ],
    });
    const npcBlock = exported.text.split('[npc]')[1].split('\n\n')[0];
    expect(npcBlock).toContain('direction=3');
    expect(npcBlock).toContain('waypoints=1,1,2,2');
    expect(npcBlock).toContain('requires_status=village_saved');
    expect(npcBlock).toContain('requires_not_status=dead');
    expect(npcBlock).not.toContain('spawn_direction');
    // reading the map back keeps the same keys
    const again = importMapText(exported.text) as { npcs?: Array<Record<string, string>> };
    const npc = (again.npcs || [])[0];
    expect(npc.direction).toBe('3');
    expect(npc.waypoints).toBe('1,1,2,2');
    expect(exportMapText(again).text).toBe(exported.text);
  });

  it('exports the tile offset derived from MapRenderer centerTile', () => {
    expect(tilePixelOffset(32, 32, 32)).toEqual({ offsetX: 32, offsetY: 16 });
    const text = exportTilesetText({
      tileSizeY: 32,
      tilesets: [{ fileName: 'ground.png', tiles: [{ id: 1, x: 0, y: 0, width: 64, height: 32 }] }],
    });
    expect(text).toBe(fixture('tileset.txt'));
  });
});

describe('FileParser rules', () => {
  it('reads 1,500 as 1 and writes the amount the studio meant', () => {
    expect(toIntFlare('1,500')).toBe(1);
    expect(toIntFlare('1500')).toBe(1500);
    expect(formatCurrency('1,500')).toBe('500');
    expect(formatCurrency('1500')).toBe('1500');
    expect(formatCurrency(250)).toBe('250');
  });

  it('refuses a layer row whose tile count is not the map width', () => {
    const project = emptyProject('Bad');
    project.maps = [
      {
        id: 'bad',
        width: 2,
        height: 1,
        heroX: 0,
        heroY: 0,
        layers: [{ type: 'background', rows: [[1]] }],
        events: [],
        enemies: [],
        npcs: [],
      },
    ];
    const exported = exportProject(project);
    expect(exported.files).toEqual([]);
    expect(exported.errors.length).toBeGreaterThan(0);
    const issues = validateText(
      'maps',
      '[header]\nwidth=2\nheight=1\n\n[layer]\ntype=background\nformat=dec\ndata=\n1\n',
      'maps/bad.txt'
    );
    expect(issues.some((issue) => issue.level === 'error')).toBe(true);
  });

  it('rejects an unknown item key', () => {
    const issues = validateText('items', 'APPEND\n\n[item]\nid=1\nname=X\nnot_a_key=1\n', 'items/items.txt');
    expect(issues.some((issue) => issue.message.includes('not_a_key'))).toBe(true);
  });
});

describe('launch plan and migration', () => {
  it('builds mods with the project last and keeps --load-slot', () => {
    const plan = launchPlan(
      { meta: { name: 'Village', requires: ['fantasycore', 'alpha_mod:0.1', 'default', 'village'] } },
      { loadSlot: '2' }
    );
    expect(plan.mods).toEqual(['fantasycore', 'alpha_mod', 'village']);
    expect(plan.args).toContain('--mods=fantasycore,alpha_mod,village');
    expect(plan.args).toContain('--load-slot=2');
  });

  it('backs up text files and writes project.json once', () => {
    const migrated = migrateFiles(
      {
        'settings.txt': 'description=Old Town\nversion=1.2\n',
        'maps/Town_Map.txt': fixture('village.map.txt'),
        'npcs/merchant.txt': fixture('merchant.npc.txt'),
      },
      'Old Town'
    );
    expect(migrated.backup).toEqual(expect.arrayContaining(['settings.txt', 'maps/Town_Map.txt', 'npcs/merchant.txt']));
    expect(migrated.errors).toEqual([]);
    const names = migrated.files.map((file) => file.path);
    expect(names).toContain('project.json');
    expect(names).toContain('content/maps/town_map.json');
    expect(names).toContain('.editor/session.json');
    const settings = migrated.files.find((file) => file.path === 'settings.txt');
    expect(settings?.content).toContain('description=Old Town');
    const npc = migrated.files.find((file) => file.path === 'npcs/merchant.txt');
    expect(npc?.content).toContain('him=Welcome');
    expect(npc?.content).toContain('portrait_him=');
    const index = JSON.parse(migrated.files.find((file) => file.path === 'project.json')?.content || '{}');
    expect(index.schemaVersion).toBe(1);
    expect(index.editor).toBeUndefined();
  });
});
