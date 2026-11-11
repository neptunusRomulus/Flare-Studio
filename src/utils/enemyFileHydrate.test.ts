import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { enemyFilePath, formatStatProperty, hydrateEnemyObject, propertiesFromEnemyFile, statsFromProperties } from './enemyFileHydrate';
import type { MapObject } from '@/types';

const fixture = (name: string) => readFileSync(new URL(`../../tests/fixtures/flare-enemies/${name}`, import.meta.url), 'utf8');

const emptyEnemy = (over: Partial<MapObject> = {}): MapObject => ({
  id: 1,
  type: 'enemy',
  name: 'enemy_1',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  properties: {},
  ...over,
} as MapObject);

describe('enemy file hydrate', () => {
  it('reads includes, repeated stats and named fields from a real enemy file', () => {
    const props = propertiesFromEnemyFile(fixture('il_goblin.txt'));
    expect(props.include).toBe('enemies/base/goblin.txt');
    expect(props.name).toBe('Labyrinth Goblin');
    expect(props.level).toBe('1');
    expect(props.speed).toBe('2.8');
    expect(props.stat).toContain('hp,40');
    expect(props.stat).toContain('accuracy,75');
    expect(props.rarity).toBe('common');
  });

  it('fills only missing object properties and keeps a user-facing name', () => {
    const text = fixture('goblin_minecart.txt');
    const hydrated = hydrateEnemyObject(emptyEnemy({ name: 'Cart Guard', properties: { speed: '9', include: '' } as MapObject['properties'] }), text);
    expect(hydrated.name).toBe('Cart Guard');
    expect(hydrated.properties).toMatchObject({
      speed: '9',
      include: 'enemies/base/goblin.txt',
      combat_style: 'passive',
      suppress_hp: 'true',
      animations: 'animations/enemies/goblin_minecart.txt',
      tilesetPath: 'animations/enemies/goblin_minecart.txt',
    });
  });

  it('maps the typo thread_range to threat_range', () => {
    const props = propertiesFromEnemyFile('name=X\nthread_range=8,16\n');
    expect(props.threat_range).toBe('8,16');
    expect(props).not.toHaveProperty('thread_range');
  });

  it('builds an enemies/*.txt path from filename or sourcePath', () => {
    expect(enemyFilePath('/proj', emptyEnemy({ properties: { enemyFilename: 'goblin.txt' } as MapObject['properties'] }))).toBe('/proj/enemies/goblin.txt');
    expect(enemyFilePath('/proj', emptyEnemy({ properties: { sourcePath: 'enemies/base/antlion.txt' } as MapObject['properties'] }))).toBe('/proj/enemies/base/antlion.txt');
  });

  it('reads individual stats from stat= lines and keeps extras on save', () => {
    const props = propertiesFromEnemyFile('name=X\nstat=hp,40\nstat=accuracy,75\nstat=dmg_ment_min,4\n');
    expect(props.hp).toBe('40');
    expect(props.accuracy).toBe('75');
    expect(props.dmg_ment_min).toBe('4');
    expect(props.stat).toContain('hp,40');
    const stats = statsFromProperties(props);
    expect(stats).toMatchObject({ hp: '40', accuracy: '75', dmg_ment_min: '4' });
    stats.hp = '55';
    delete stats.accuracy;
    const written = formatStatProperty(stats, props.stat);
    expect(written).toBe('hp,55\ndmg_ment_min,4');
  });
});
