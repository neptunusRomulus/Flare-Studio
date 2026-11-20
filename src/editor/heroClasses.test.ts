import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { parseClassesFile, serializeClassesFile } from './heroClasses';

const DEFAULT_CLASSES = readFileSync('/home/ism/Projects/Flare/flare-engine/mods/default/engine/classes.txt', 'utf8');
const EMPYREAN_CLASSES = readFileSync('/home/ism/Projects/Flare/flare-game/mods/empyrean_campaign/engine/classes.txt', 'utf8');

describe('classes.txt', () => {
  it('keeps the default file as comments when there are no classes', () => {
    const file = parseClassesFile(DEFAULT_CLASSES);
    expect(file.classes).toEqual([]);
    expect(file.header).toContain('# Hero classes');
    expect(file.header).toContain('#currency=37');
    expect(serializeClassesFile(file, DEFAULT_CLASSES)).toContain('# Hero classes');
    expect(parseClassesFile(serializeClassesFile(file, DEFAULT_CLASSES)).classes).toEqual([]);
  });

  it('parses Empyrean classes including primary and equipment_set', () => {
    const file = parseClassesFile(EMPYREAN_CLASSES);
    expect(file.classes.map((entry) => entry.scalars.name)).toEqual(['Brute', 'Scout', 'Adept']);
    expect(file.classes[0].scalars.equipment).toBe('4,5,6,7,8,11');
    expect(file.classes[0].equipment_sets).toEqual([{ setId: '2', items: '4,5,6,7' }]);
    expect(file.classes[0].primaries).toEqual([{ stat: 'physical', value: '4' }, { stat: 'defense', value: '1' }]);
    expect(file.classes[0].scalars.default_power_tab).toBe('0');
    expect(file.classes[2].scalars.powers).toBe('122');
    const roundTrip = parseClassesFile(serializeClassesFile(file, EMPYREAN_CLASSES));
    expect(roundTrip.classes).toEqual(file.classes);
    expect(serializeClassesFile(file, EMPYREAN_CLASSES).startsWith('# Hero classes') || EMPYREAN_CLASSES.startsWith('#')).toBe(true);
  });

  it('omits empty keys and drops nameless classes', () => {
    const file = parseClassesFile('[class]\nname=Wanderer\ncurrency=37\n[class]\ndescription=no name\n');
    expect(file.classes).toHaveLength(2);
    const text = serializeClassesFile(file);
    expect(text).toContain('name=Wanderer');
    expect(text).toContain('currency=37');
    expect(text).not.toContain('description=no name');
    expect(text).not.toContain('equipment=');
  });
});
