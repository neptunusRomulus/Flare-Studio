import { describe, expect, it } from 'vitest';
import {
  expectedDropsPerKill,
  formatLootChance,
  formatLootProperty,
  formatLootRow,
  formatLootSummary,
  lootChanceLabel,
  parseLootChance,
  parseLootProperty,
  parseLootTableText,
  parseLootValue,
  randomDropProbabilities,
} from './lootChance';

describe('parseLootChance', () => {
  it('maps the five words and keeps unknown numbers as Custom', () => {
    expect(parseLootChance('fixed')).toEqual({ kind: 'word', word: 'Always', stored: 'fixed' });
    expect(parseLootChance('50')).toEqual({ kind: 'word', word: 'Often', stored: '50' });
    expect(parseLootChance('20')).toEqual({ kind: 'word', word: 'Sometimes', stored: '20' });
    expect(parseLootChance('5')).toEqual({ kind: 'word', word: 'Rare', stored: '5' });
    expect(parseLootChance('1')).toEqual({ kind: 'word', word: 'Very rare', stored: '1' });
    expect(parseLootChance('12')).toEqual({ kind: 'custom', percent: 12, stored: '12' });
    expect(parseLootChance('100')).toEqual({ kind: 'custom', percent: 100, stored: '100' });
    expect(lootChanceLabel(parseLootChance('12'))).toBe('Custom 12%');
    expect(formatLootChance(parseLootChance('12'))).toBe('12');
    expect(formatLootChance(parseLootChance('fixed'))).toBe('fixed');
  });
});

describe('parseLootValue', () => {
  it('parses item, chance, and quantity the way LootManager does', () => {
    expect(parseLootValue('198,1')).toMatchObject([
      { id: '198', quantityMin: 1, quantityMax: 1, isTable: false },
    ]);
    expect(formatLootChance(parseLootValue('198,1')[0].chance)).toBe('1');
    expect(parseLootValue('750,20,1,2')).toMatchObject([
      { id: '750', quantityMin: 1, quantityMax: 2, isTable: false },
    ]);
    expect(parseLootValue('currency,100,20,40')).toMatchObject([
      { id: 'currency', quantityMin: 20, quantityMax: 40, isTable: false },
    ]);
    expect(parseLootValue('loot/chest_level_6.txt')).toMatchObject([
      { id: 'loot/chest_level_6.txt', isTable: true },
    ]);
  });

  it('round-trips compact lines when rewritten', () => {
    expect(formatLootRow(parseLootValue('198,1')[0])).toBe('198,1');
    expect(formatLootRow(parseLootValue('750,20,1,2')[0])).toBe('750,20,1,2');
    expect(formatLootRow(parseLootValue('currency,fixed,5,10')[0])).toBe('currency,fixed,5,10');
    expect(formatLootRow(parseLootValue('currency,100,20,40')[0])).toBe('currency,100,20,40');
    // Trailing default quantity is canonicalized away.
    expect(formatLootRow(parseLootValue('2,3,1')[0])).toBe('2,3');
    expect(parseLootValue('2,3,1')[0]).toMatchObject({ quantityMin: 1, quantityMax: 1 });
  });
});

describe('parseLootProperty', () => {
  it('splits repeated loot= values and keeps table paths', () => {
    const rows = parseLootProperty('loot/chest_level_6.txt\n198,1');
    expect(rows).toHaveLength(2);
    expect(rows[0].isTable).toBe(true);
    expect(rows[1].id).toBe('198');
    expect(formatLootProperty(rows)).toBe('loot/chest_level_6.txt\n198,1');
  });
});

describe('parseLootTableText', () => {
  it('reads shorthand lines, INCLUDE, and [loot] blocks', () => {
    const rows = parseLootTableText(`# gold
loot=currency,100,20,40

INCLUDE loot/chest_common.txt

[loot]
id=2
chance=5
quantity=1,2
`);
    expect(rows.map((row) => row.id)).toEqual(['currency', 'loot/chest_common.txt', '2']);
    expect(formatLootChance(rows[0].chance)).toBe('100');
    expect(rows[1].isTable).toBe(true);
    expect(formatLootChance(rows[2].chance)).toBe('5');
    expect(rows[2].quantityMax).toBe(2);
  });
});

describe('expected drop math', () => {
  it('always includes fixed items once per kill, even with several rolls', () => {
    const rows = [
      ...parseLootValue('91,fixed,1,1'),
      ...parseLootValue('2,50'),
    ];
    const lines = expectedDropsPerKill({ rows, lootCountMin: 3, lootCountMax: 3 });
    const map = Object.fromEntries(lines.map((line) => [line.id, line.expected]));
    expect(map['91']).toBe(1);
    // 50% is the only random chance, so it wins half of each of 3 rolls
    expect(map['2']).toBe(1.5);
  });

  it('gives the random slot to the lowest chance that still beats the roll', () => {
    const rows = [
      ...parseLootValue('10,50'),
      ...parseLootValue('11,20'),
      ...parseLootValue('12,5'),
    ];
    const probs = randomDropProbabilities(rows);
    // P(c) = 5/100, P(b) = 15/100, P(a) = 30/100, none = 50/100
    expect(probs[0]).toBeCloseTo(0.3);
    expect(probs[1]).toBeCloseTo(0.15);
    expect(probs[2]).toBeCloseTo(0.05);
  });

  it('splits a tied chance evenly and does not treat 100 like fixed', () => {
    const rows = [
      ...parseLootValue('10,100'),
      ...parseLootValue('11,20'),
      ...parseLootValue('12,20'),
    ];
    const probs = randomDropProbabilities(rows);
    // roll 0-20: b and c share; roll 20-100: a wins. P(a)=0.8, P(b)=P(c)=0.1
    expect(probs[0]).toBeCloseTo(0.8);
    expect(probs[1]).toBeCloseTo(0.1);
    expect(probs[2]).toBeCloseTo(0.1);
  });

  it('inlines loot tables into the same pool and writes the 10-kill sentence', () => {
    const rows = parseLootProperty('loot/chest.txt\n91,fixed');
    const summary = formatLootSummary({
      rows,
      kills: 10,
      itemName: (id) => (id === '91' ? 'Health Potion' : id),
      currencyName: 'Gold',
      expandTable: (path) => (path === 'loot/chest.txt' ? parseLootValue('currency,fixed,2,2') : undefined),
    });
    expect(summary).toBe('Over 10 kills you get on average: 20 Gold, 10 Health Potion');
  });

  it('names an unexpanded table in the summary', () => {
    const summary = formatLootSummary({ rows: parseLootValue('loot/level_5.txt') });
    expect(summary).toBe('Over 10 kills you get on average: loot/level_5.txt');
  });
});
