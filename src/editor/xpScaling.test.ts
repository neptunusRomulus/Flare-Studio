import { describe, expect, it } from 'vitest';
import {
  DEFAULT_XP_SCALING,
  normalizeXpScalingPath,
  parseXpScalingTable,
  serializeXpScalingTable,
  xpScalingRelPath,
} from './xpScaling';

const IL = `[absolute]
level=1,1
level=2,2
level=3,4
`;

describe('xpScaling', () => {
  it('normalizes table paths', () => {
    expect(xpScalingRelPath('IL Table')).toBe('enemies/xp_scaling/IL_Table.txt');
    expect(normalizeXpScalingPath('il.txt')).toBe('enemies/xp_scaling/il.txt');
    expect(normalizeXpScalingPath('enemies/xp_scaling/il.txt')).toBe('enemies/xp_scaling/il.txt');
  });

  it('parses absolute rows and keeps a header comment on serialize', () => {
    const withComment = `# Insontius League\n${IL}`;
    expect(parseXpScalingTable(withComment)).toEqual({
      header: '# Insontius League',
      absolute: [
        { level: '1', multiplier: '1' },
        { level: '2', multiplier: '2' },
        { level: '3', multiplier: '4' },
      ],
      relative: [],
    });
    expect(serializeXpScalingTable(parseXpScalingTable(withComment), withComment)).toBe(withComment);
  });

  it('round-trips absolute and relative sections and omits empty ones', () => {
    const text = `${DEFAULT_XP_SCALING}[absolute]\nlevel=1,1\n`;
    const parsed = parseXpScalingTable(text);
    expect(parsed.relative).toEqual([
      { level: '-10', multiplier: '0.25' },
      { level: '0', multiplier: '1' },
      { level: '10', multiplier: '1.5' },
    ]);
    expect(parsed.absolute).toEqual([{ level: '1', multiplier: '1' }]);
    expect(serializeXpScalingTable({ ...parsed, absolute: [] })).toBe(DEFAULT_XP_SCALING);
    expect(serializeXpScalingTable({ header: '', absolute: [], relative: [] })).toBe('\n');
  });
});
