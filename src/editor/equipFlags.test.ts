import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { parseEquipFlags, serializeEquipFlags } from './equipFlags';

const DEFAULT_FLAGS = readFileSync('/home/ism/Projects/Flare/flare-engine/mods/default/engine/equip_flags.txt', 'utf8');
const FANTASY_FLAGS = readFileSync('/home/ism/Projects/Flare/flare-game/mods/fantasycore/engine/equip_flags.txt', 'utf8');
const EMPYREAN_FLAGS = readFileSync('/home/ism/Projects/Flare/flare-game/mods/empyrean_campaign/engine/equip_flags.txt', 'utf8');

describe('equip_flags.txt', () => {
  it('keeps the default file as comments when there are no flags', () => {
    const file = parseEquipFlags(DEFAULT_FLAGS);
    expect(file.flags).toEqual([]);
    expect(file.header).toContain('# Equipment flags');
    expect(serializeEquipFlags(file, DEFAULT_FLAGS)).toContain('# Equipment flags');
  });

  it('parses Fantasycore flags and Empyrean APPEND', () => {
    const fantasy = parseEquipFlags(FANTASY_FLAGS);
    expect(fantasy.flags.map((flag) => flag.id)).toEqual(['melee', 'ranged', 'mental', 'shield', 'slingshot', 'bow']);
    expect(fantasy.flags[0].name).toBe('melee weapon');
    expect(parseEquipFlags(serializeEquipFlags(fantasy, FANTASY_FLAGS)).flags).toEqual(fantasy.flags);

    const empyrean = parseEquipFlags(EMPYREAN_FLAGS);
    expect(empyrean.header).toContain('APPEND');
    expect(empyrean.flags).toEqual([{ id: 'throw_axe', name: 'throwing axe' }]);
    expect(serializeEquipFlags(empyrean, EMPYREAN_FLAGS).startsWith('APPEND')).toBe(true);
    expect(parseEquipFlags(serializeEquipFlags(empyrean, EMPYREAN_FLAGS)).flags).toEqual(empyrean.flags);
  });

  it('omits empty names and drops flags without an id', () => {
    const text = serializeEquipFlags({ header: '', flags: [{ id: 'bow', name: '' }, { id: '', name: 'no id' }] });
    expect(text).toBe('[flag]\nid=bow\n');
    expect(text).not.toContain('name=');
  });
});
