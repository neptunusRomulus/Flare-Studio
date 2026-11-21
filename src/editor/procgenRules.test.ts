import { describe, expect, it } from 'vitest';
import {
  parseProcgenFile,
  procgenRulesRelPath,
  serializeProcgenFile,
  visibleSettingKeys,
} from './procgenRules';

const BASE = `[settings]
doors_max=2
door_spacing_min=2
main_path_length_min=10
main_path_length_max=20
main_path_attempts_max=1000
branch_length_min=5
branch_length_max=10
branches_per_door_level_max=2

[chunks]
filename=maps/iron_labyrinth/links1.txt
filename=maps/iron_labyrinth/room1.txt
`;

const FLOOR = `INCLUDE maps/procgen_rules/iron_labyrinth.txt

[chunks]
filename=maps/iron_labyrinth/f1/start.txt
filename=maps/iron_labyrinth/f1/end.txt
`;

describe('procgenRules', () => {
  it('builds a maps/procgen_rules path', () => {
    expect(procgenRulesRelPath('iron_labyrinth_f1')).toBe('maps/procgen_rules/iron_labyrinth_f1.txt');
    expect(procgenRulesRelPath('maps/procgen/wrong.txt')).toBe('maps/procgen_rules/wrong.txt');
  });

  it('round-trips settings, chunks and INCLUDE, and drops empty keys', () => {
    expect(serializeProcgenFile(parseProcgenFile(BASE))).toBe(BASE);
    expect(serializeProcgenFile(parseProcgenFile(FLOOR))).toBe(FLOOR);
    const withEmpty = parseProcgenFile(`[settings]
doors_max=3
main_path_length_min=

[chunks]
filename=
filename=maps/chunks/hall.txt
`);
    expect(serializeProcgenFile(withEmpty)).toBe(`[settings]
doors_max=3

[chunks]
filename=maps/chunks/hall.txt
`);
  });

  it('keeps comments, unknown keys, unknown sections and APPEND', () => {
    const source = `# dungeon rules

[settings]
# more doors
doors_max=4
mystery=yes

APPEND maps/procgen_rules/extra.txt

# leftover rooms
[chunks]
filename=maps/chunks/start.txt

[debug]
note=keep-me
`;
    const parsed = parseProcgenFile(source);
    expect(parsed.header).toContain('dungeon rules');
    expect(parsed.parts[0]).toMatchObject({ kind: 'settings' });
    expect(parsed.parts[0].kind === 'settings' && parsed.parts[0].keys.some((row) => row.key === 'mystery' && row.value === 'yes')).toBe(true);
    expect(parsed.parts[1]).toMatchObject({ kind: 'append', path: 'maps/procgen_rules/extra.txt' });
    expect(parsed.parts[3]).toMatchObject({ kind: 'section', name: 'debug' });
    expect(serializeProcgenFile(parsed)).toBe(source);
  });

  it('shows known setting keys even when the file omitted them', () => {
    const parsed = parseProcgenFile('[settings]\ndoors_max=1\n');
    const settings = parsed.parts[0];
    if (settings.kind !== 'settings') throw new Error('expected settings');
    const keys = visibleSettingKeys(settings).map((row) => row.key);
    expect(keys[0]).toBe('doors_max');
    expect(keys).toContain('branch_length_max');
    expect(visibleSettingKeys(settings).find((row) => row.key === 'doors_max')?.value).toBe('1');
    expect(visibleSettingKeys(settings).find((row) => row.key === 'branch_length_max')?.value).toBe('');
  });
});
