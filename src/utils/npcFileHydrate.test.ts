import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { hydrateNpcObject, includesFromNpcText, propertiesFromNpcFile, statusStockToEntries } from './npcFileHydrate';
import type { MapObject } from '@/types';

const FIXTURES = path.resolve(__dirname, '../../tests/fixtures/flare-npcs');
const read = (name: string) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

describe('propertiesFromNpcFile (real flare-game NPCs)', () => {
  it('loads stock, buy ratio, vox, stance and talker from il_loren', () => {
    const props = propertiesFromNpcFile(read('il_loren.txt'));
    expect(props.name).toBe('Loren, Undead Trader');
    expect(props.vendor).toBe('true');
    expect(props.talker).toBe('false');
    expect(props.vendor_ratio_buy).toBe('1.5');
    expect(props.constant_stock).toContain('2:20');
    expect(props.random_stock).toBe('loot/il_loren.txt');
    expect(props.random_stock_count).toBe('5,8');
    expect(props.vox_intro).toContain('zombie_phys.ogg');
    expect(props.direction).toBe('5');
    expect(props.tilesetPath).toBe('animations/enemies/zombie.txt');
  });

  it('joins repeated vox_intro lines from kayl', () => {
    const props = propertiesFromNpcFile(read('kayl.txt'));
    expect(props.name).toBe('Kayl, Alchemist');
    expect(props.vendor).toBe('true');
    expect(props.vox_intro.split('\n').length).toBeGreaterThanOrEqual(4);
    expect(props.constant_stock).toContain('1');
    expect(props.tilesetPath).toBe('animations/npcs/peasant_woman2.txt');
  });

  it('collects every INCLUDE in abasi, in file order', () => {
    expect(includesFromNpcText(read('abasi.txt'))).toEqual([
      'npcs/base/abasi/common.txt',
      'npcs/base/abasi/quest_intro1.txt',
      'npcs/base/abasi/quest_common.txt',
    ]);
    expect(propertiesFromNpcFile(read('abasi.txt')).npc_includes).toContain('quest_intro1.txt');
  });

  it('loads dialog trees and does not copy map-instance keys from the definition', () => {
    const props = propertiesFromNpcFile(read('martigan.txt'));
    expect(props.dialogueTrees).toBeTruthy();
    const trees = JSON.parse(props.dialogueTrees);
    expect(Array.isArray(trees) && trees.length).toBeGreaterThan(0);
    expect(props).not.toHaveProperty('map_direction');
    expect(props).not.toHaveProperty('waypoints');
    expect(props).not.toHaveProperty('wander_radius');
  });
});

describe('hydrateNpcObject', () => {
  it('fills empty properties from the file and keeps map facing / a set name', () => {
    const obj = {
      id: 1, name: 'npc_1', type: 'npc', x: 3, y: 4, width: 1, height: 1,
      properties: { map_direction: '2', npcFilename: 'npcs/il_loren.txt' },
    } as MapObject;
    const out = hydrateNpcObject(obj, read('il_loren.txt'));
    expect(out.name).toBe('Loren, Undead Trader');
    expect(out.x).toBe(3);
    expect(out.properties?.map_direction).toBe('2');
    expect(out.properties?.vendor_ratio_buy).toBe('1.5');
    expect(out.properties?.vox_intro).toContain('zombie_phys.ogg');
  });

  it('does not overwrite a property the object already holds', () => {
    const obj = {
      id: 1, name: 'Custom', type: 'npc', x: 0, y: 0, width: 1, height: 1,
      properties: { vendor_ratio_buy: '3', talker: 'true' },
    } as MapObject;
    const out = hydrateNpcObject(obj, read('il_loren.txt'));
    expect(out.name).toBe('Custom');
    expect(out.properties?.vendor_ratio_buy).toBe('3');
    expect(out.properties?.talker).toBe('true');
    expect(out.properties?.constant_stock).toContain('2:20');
  });
});

describe('statusStockToEntries', () => {
  it('parses status, item:qty lists', () => {
    expect(statusStockToEntries(['quest_done,10:2,11'])).toEqual([
      { requirement: 'quest_done', items: { '10': 2, '11': 1 } },
    ]);
  });
});
