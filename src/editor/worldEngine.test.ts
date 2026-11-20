import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  DEATH_PENALTY_KEYS,
  GAMEPLAY_KEYS,
  MISC_KEYS,
  parseKeyedValues,
  upsertKeyedValues,
} from './worldEngine';

const DEFAULT_MISC = readFileSync('/home/ism/Projects/Flare/flare-engine/mods/default/engine/misc.txt', 'utf8');
const DEFAULT_DEATH = readFileSync('/home/ism/Projects/Flare/flare-engine/mods/default/engine/death_penalty.txt', 'utf8');
const DEFAULT_GAMEPLAY = readFileSync('/home/ism/Projects/Flare/flare-engine/mods/default/engine/gameplay.txt', 'utf8');

describe('world engine files', () => {
  it('parses gameplay and keeps comments when upserting', () => {
    expect(parseKeyedValues(DEFAULT_GAMEPLAY, GAMEPLAY_KEYS).enable_playgame).toBe('0');
    const next = upsertKeyedValues(DEFAULT_GAMEPLAY, GAMEPLAY_KEYS, { enable_playgame: '1' });
    expect(next).toContain('# Does mod include gameplay data');
    expect(parseKeyedValues(next, GAMEPLAY_KEYS).enable_playgame).toBe('1');
  });

  it('round-trips death_penalty keys and can omit an emptied key', () => {
    const parsed = parseKeyedValues(DEFAULT_DEATH, DEATH_PENALTY_KEYS);
    expect(parsed).toMatchObject({ enable: 'true', permadeath: 'false', currency: '50', xp_total: '0', random_item: 'false' });
    const next = upsertKeyedValues(DEFAULT_DEATH, DEATH_PENALTY_KEYS, { currency: '' });
    expect(next).toContain('# toggle all death penalties');
    expect(next).not.toContain('currency=');
    expect(parseKeyedValues(next, DEATH_PENALTY_KEYS).currency).toBe('');
  });

  it('leaves commented default misc keys alone until they are set', () => {
    const parsed = parseKeyedValues(DEFAULT_MISC, MISC_KEYS);
    expect(parsed.save_prefix).toBe('');
    expect(parsed.window_title).toBe('');
    const unchanged = upsertKeyedValues(DEFAULT_MISC, MISC_KEYS, {});
    expect(unchanged).toContain('# Miscellaneous engine settings');
    expect(unchanged).toContain('#save_hpmp=');
    const next = upsertKeyedValues(DEFAULT_MISC, MISC_KEYS, { save_prefix: 'flare' });
    expect(next).toContain('#save_hpmp=');
    expect(parseKeyedValues(next, MISC_KEYS).save_prefix).toBe('flare');
  });
});
