import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CORE_STAT_KEYS,
  damageTypeStatIds,
  parseDamageTypes,
  serializeDamageTypes,
  parseHeroStats,
  parsePrimaryStats,
  parseResourceStats,
  parseTitles,
  renamePrimaryInHeroStats,
  serializeHeroStats,
  serializePrimaryStats,
  serializeResourceStats,
  serializeTitles,
} from './statsTitles';

const DEFAULT_PRIMARY = readFileSync('/home/ism/Projects/Flare/flare-engine/mods/default/engine/primary_stats.txt', 'utf8');
const EMPYREAN_TITLES = readFileSync('/home/ism/Projects/Flare/flare-game/mods/empyrean_campaign/engine/titles.txt', 'utf8');
const EMPYREAN_STATS = readFileSync('/home/ism/Projects/Flare/flare-game/mods/empyrean_campaign/engine/stats.txt', 'utf8');
const DEFAULT_DAMAGE = readFileSync('/home/ism/Projects/Flare/flare-engine/mods/default/engine/damage_types.txt', 'utf8');
const EMPYREAN_DAMAGE = readFileSync('/home/ism/Projects/Flare/flare-game/mods/empyrean_campaign/engine/damage_types.txt', 'utf8');
const DEFAULT_RESOURCE = readFileSync('/home/ism/Projects/Flare/flare-engine/mods/default/engine/resource_stats.txt', 'utf8');

describe('primary_stats.txt', () => {
  it('parses Flare default primary stats and round-trips ids and names', () => {
    const parsed = parsePrimaryStats(DEFAULT_PRIMARY);
    expect(parsed).toEqual([
      { id: 'physical', name: 'Physical' },
      { id: 'mental', name: 'Mental' },
      { id: 'offense', name: 'Offense' },
      { id: 'defense', name: 'Defense' },
    ]);
    expect(parsePrimaryStats(serializePrimaryStats(parsed))).toEqual(parsed);
  });

  it('serializes a newly added primary stat', () => {
    const text = serializePrimaryStats([...parsePrimaryStats(DEFAULT_PRIMARY), { id: 'Spirit', name: 'Spirit' }]);
    expect(text).toContain('id=spirit');
    expect(text).toContain('name=Spirit');
    expect(text).not.toContain('APPEND');
  });
});

describe('titles.txt', () => {
  it('parses official Empyrean titles including hybrid primary_stat lists', () => {
    const titles = parseTitles(EMPYREAN_TITLES);
    expect(titles[0]).toMatchObject({ title: 'Grand Master', level: '20', primary_stat_1: '' });
    expect(titles.find((row) => row.title === 'Assassin')).toMatchObject({
      level: '12',
      primary_stat_1: 'physical',
      primary_stat_2: 'offense',
    });
    expect(titles.find((row) => row.title === 'Exiled')).toMatchObject({ title: 'Exiled', level: '' });
    expect(titles.length).toBeGreaterThan(20);
    expect(titles.some((row) => row.title === "Grand Master")).toBe(true);
  });

  it('round-trips title fields including status and power', () => {
    const input = [
      '[title]',
      'title=Champion',
      'level=10',
      'power=42',
      'requires_status=quest_done',
      'requires_not_status=cursed',
      'primary_stat=physical,defense',
      '',
    ].join('\n');
    const parsed = parseTitles(input);
    expect(parsed[0]).toEqual({
      title: 'Champion',
      level: '10',
      power: '42',
      requires_status: 'quest_done',
      requires_not_status: 'cursed',
      primary_stat_1: 'physical',
      primary_stat_2: 'defense',
    });
    expect(parseTitles(serializeTitles(parsed))).toEqual(parsed);
  });
});

describe('stats.txt', () => {
  it('parses Empyrean hero stats and keeps the render_layers section', () => {
    const file = parseHeroStats(EMPYREAN_STATS);
    expect(file.scalars.stat_points_per_level).toBe('5');
    expect(file.scalars.power_points_per_level).toBe('2');
    expect(file.scalars.max_points_per_stat).toBe('75');
    expect(file.scalars.speed).toBe('6');
    expect(file.scalars.sfx_step).toBe('cloth');
    expect(file.scalars.cooldown_hit).toBe('1s');
    expect(file.scalars.categories).toBe('hero');
    expect(file.base.hp).toBe('200');
    expect(file.perLevel.hp).toBe('50');
    expect(file.perPrimary).toContainEqual({ primary: 'physical', stat: 'hp', value: '20' });
    expect(file.base.scroll_min).toBe('15');
    expect(file.trailing).toContain('[render_layers]');
    expect(file.trailing).toContain('INCLUDE engine/hero_layers.txt');

    const again = parseHeroStats(serializeHeroStats(file));
    expect(again.scalars).toEqual(file.scalars);
    expect(again.base).toEqual(file.base);
    expect(again.perLevel).toEqual(file.perLevel);
    expect(again.perPrimary).toEqual(file.perPrimary);
    expect(again.trailing).toContain('INCLUDE engine/hero_layers.txt');
  });

  it('renames a primary id in per-primary bonuses', () => {
    const file = parseHeroStats('stat_per_primary=physical,hp,20\n');
    expect(renamePrimaryInHeroStats(file, 'physical', 'body').perPrimary[0].primary).toBe('body');
  });
});

describe('damage_types.txt and resource_stats.txt', () => {
  it('fills default min/max/resist ids the way the engine does', () => {
    const defaults = parseDamageTypes(DEFAULT_DAMAGE);
    expect(defaults.map((type) => type.id)).toEqual(['melee', 'ranged', 'ment']);
    expect(defaults[0]).toMatchObject({ min: 'dmg_melee_min', max: 'dmg_melee_max', resist: '' });
    expect(damageTypeStatIds(defaults[0])).toMatchObject({ min: 'dmg_melee_min', max: 'dmg_melee_max', resist: 'melee_resist' });
    const empyrean = parseDamageTypes(EMPYREAN_DAMAGE);
    expect(empyrean.find((type) => type.id === 'fire')).toMatchObject({
      min: 'dmg_fire_min',
      max: 'dmg_fire_max',
      name_short: 'Fire',
      elemental: 'true',
    });
    expect(damageTypeStatIds(empyrean.find((type) => type.id === 'fire')!)).toMatchObject({ resist: 'fire_resist' });
    expect(empyrean.find((type) => type.id === 'scroll')?.min).toBe('scroll_min');
    expect(serializeDamageTypes(defaults, DEFAULT_DAMAGE)).toContain('id=melee');
    expect(serializeDamageTypes(empyrean, EMPYREAN_DAMAGE).startsWith('APPEND')).toBe(true);
    expect(parseDamageTypes(serializeDamageTypes(empyrean, EMPYREAN_DAMAGE))).toEqual(empyrean);
  });

  it('treats the default resource file as empty and round-trips a new pool', () => {
    expect(parseResourceStats(DEFAULT_RESOURCE)).toEqual([]);
    const text = serializeResourceStats([{
      ...parseResourceStats('[resource_stat]\nstat_base=stamina\nstat_regen=stamina_regen\nlevelup_restore=true\n')[0],
    }]);
    expect(text).toContain('stat_base=stamina');
    expect(parseResourceStats(text)[0]).toMatchObject({ stat_base: 'stamina', stat_regen: 'stamina_regen', levelup_restore: 'true' });
  });
});

describe('core stats', () => {
  it('lists the hardcoded Stats.cpp keys and no more', () => {
    expect(CORE_STAT_KEYS.has('hp')).toBe(true);
    expect(CORE_STAT_KEYS.has('resist_mp_steal')).toBe(true);
    expect(CORE_STAT_KEYS.has('dmg_melee_min')).toBe(false);
    expect(CORE_STAT_KEYS.size).toBe(26);
  });
});
