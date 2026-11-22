import { describe, expect, it } from 'vitest';
import { parseRandomMapList, randomMapListRelPath, serializeRandomMapList } from './randomMapList';

const TEXT = `# random caves\nmap=maps/cave_1.txt,5,7\n\n# keep unknown\ninclude=other.txt\nmap=maps/cave_2.txt\n`;

describe('random map lists', () => {
  it('parses map rows and keeps comments/unknown lines', () => {
    const lines = parseRandomMapList(TEXT);
    expect(lines.filter((line) => line.kind === 'map')).toEqual([
      { kind: 'map', map: 'maps/cave_1.txt', x: '5', y: '7' },
      { kind: 'map', map: 'maps/cave_2.txt', x: '', y: '' },
    ]);
    expect(lines.filter((line) => line.kind === 'raw').map((line) => line.raw)).toContain('# random caves');
    expect(serializeRandomMapList(lines)).toContain('include=other.txt');
  });

  it('serializes optional coordinates and a safe file path', () => {
    expect(serializeRandomMapList([
      { kind: 'map', map: 'maps/a.txt', x: '', y: '' },
      { kind: 'map', map: 'maps/b.txt', x: '2', y: '' },
    ])).toBe('map=maps/a.txt\nmap=maps/b.txt,2,0');
    expect(randomMapListRelPath('Cave List')).toBe('maps/random/lists/cave_list.txt');
  });
});
