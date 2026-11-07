import { describe, it, expect } from 'vitest';
import { tilesetDisplayName, tabLabel } from './tabLabel';

describe('tilesetDisplayName', () => {
  it('derives a readable name from the file name', () => {
    expect(tilesetDisplayName('tileset_snowplains_ice.png')).toBe('Snowplains Ice');
    expect(tilesetDisplayName('snowplains_ice.png')).toBe('Snowplains Ice');
    expect(tilesetDisplayName('/a/b/tileset_grassland.png')).toBe('Grassland');
    expect(tilesetDisplayName(null)).toBe('');
  });
});

describe('tabLabel', () => {
  it('prefers a custom name, then the tileset, then Tab N', () => {
    expect(tabLabel({ name: 'Walls' }, 0)).toBe('Walls');
    expect(tabLabel({ name: 'Tab 3', tileset: { fileName: 'tileset_cave.png' } }, 2)).toBe('Cave');
    expect(tabLabel({ name: 'Tab 2' }, 1)).toBe('Tab 2');
    expect(tabLabel({}, 4)).toBe('Tab 5');
  });
});
