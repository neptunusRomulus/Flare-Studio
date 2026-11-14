import { describe, expect, it } from 'vitest';
import { parseLootChance, type LootRow } from '@/editor/lootChance';
import {
  BEHAVIOR_PRESETS,
  behaviorPresetFromValues,
  valuesFromBehaviorPreset,
} from '@/editor/enemyBehaviorPresets';
import { dropFromLootRows, summarizeEnemy } from '@/editor/enemySummary';
import { statsFromStrength, strengthFromStats, STRENGTH_STATS } from '@/editor/enemyStrength';

const item = (id: string, chance: string): LootRow => ({
  id,
  chance: parseLootChance(chance),
  quantityMin: 1,
  quantityMax: 1,
  isTable: false,
});

describe('enemy strength', () => {
  it('returns a copy of the preset stats for each tier', () => {
    const weak = statsFromStrength('weak');
    expect(weak).toEqual(STRENGTH_STATS.weak);
    weak.hp = '1';
    expect(STRENGTH_STATS.weak.hp).toBe('20');
    expect(statsFromStrength('balanced').hp).toBe('80');
    expect(statsFromStrength('strong').xp).toBe('80');
  });

  it('recognizes a tier only when HP, XP, attack and defense all match', () => {
    expect(strengthFromStats(STRENGTH_STATS.balanced)).toBe('balanced');
    expect(strengthFromStats({
      hp: '200',
      xp: '80',
      dmgMeleeMax: '24',
      absorbMax: '8',
    })).toBe('strong');
    expect(strengthFromStats({
      hp: '20',
      xp: '8',
      attack: '3',
      defense: '0',
    })).toBe('weak');
    expect(strengthFromStats({
      ...STRENGTH_STATS.balanced,
      hp: '81',
    })).toBeNull();
    expect(strengthFromStats({ hp: '80' })).toBeNull();
  });
});

describe('enemy behavior presets', () => {
  it('fills the AI numbers for each card', () => {
    expect(valuesFromBehaviorPreset('guard')).toMatchObject({
      isStationary: true,
      chancePursue: '0',
      chanceFlee: '0',
      combatStyle: 'default',
    });
    expect(valuesFromBehaviorPreset('wanders').wanderRadius).toBe('4');
    expect(valuesFromBehaviorPreset('aggressive')).toMatchObject({
      combatStyle: 'aggressive',
      chancePursue: '100',
      threatRange: '16',
    });
    expect(valuesFromBehaviorPreset('coward')).toMatchObject({
      chanceFlee: '80',
      fleeRange: '6',
    });
  });

  it('matches a card only when every written field is unchanged', () => {
    for (const id of ['guard', 'wanders', 'aggressive', 'coward'] as const) {
      expect(behaviorPresetFromValues(valuesFromBehaviorPreset(id))).toBe(id);
    }
    expect(behaviorPresetFromValues({
      ...BEHAVIOR_PRESETS.aggressive,
      chancePursue: '90',
    })).toBeNull();
  });
});

describe('enemy summary', () => {
  it('builds the header sentence from strength, role, behavior and loot', () => {
    expect(summarizeEnemy({
      strength: 'strong',
      isMelee: true,
      cooldown: '500ms',
      combatStyle: 'aggressive',
      dropName: 'Health Potion',
      dropChance: 'usually',
    })).toBe('A strong melee enemy that hits fast, chases from far away and usually drops Health Potion.');
  });

  it('uses An for an enemy with no extra adjectives', () => {
    expect(summarizeEnemy({})).toBe('An enemy.');
  });

  it('describes mixed roles, wandering, fleeing and standing still', () => {
    expect(summarizeEnemy({
      strength: 'balanced',
      isMelee: true,
      isRanged: true,
      isBoss: true,
      isStationary: true,
    })).toBe('A balanced melee and ranged boss that stands still.');
    expect(summarizeEnemy({
      wanderRadius: '4',
      chanceFlee: '80',
      dropName: 'Rusty Key',
      dropChance: 'rarely',
    })).toBe('An enemy that wanders, flees easily and rarely drops Rusty Key.');
  });

  it('picks a drop line from loot rows, preferring Always, then the highest chance', () => {
    const names = (id: string) => ({ '1': 'Health Potion', '2': 'Rusty Key' }[id] || id);
    expect(dropFromLootRows([
      item('2', '5'),
      item('1', 'fixed'),
    ], names)).toEqual({ dropName: 'Health Potion', dropChance: 'always' });
    expect(dropFromLootRows([
      item('2', '5'),
      item('1', '50'),
    ], names)).toEqual({ dropName: 'Health Potion', dropChance: 'usually' });
    expect(dropFromLootRows([item('currency', '20')], names)).toEqual({
      dropName: 'currency',
      dropChance: 'sometimes',
    });
    expect(dropFromLootRows([], names)).toBeNull();
  });
});
