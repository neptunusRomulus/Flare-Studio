import { describe, it, expect } from 'vitest';
import { tilesetDisplayName, tabLabel } from './tabLabel';

describe('tilesetDisplayName', () => {
  it('derives a readable name from the file name', () => {
    expect(tilesetDisplayName('tileset_snowplains_ice.png')).toBe('snowplains_ice');
    expect(tilesetDisplayName('background_tab3_tileset_grassland.png')).toBe('grassland');
    expect(tilesetDisplayName('background-tab_dungeon.png')).toBe('dungeon');
    expect(tilesetDisplayName('object_tab2_background_tab1_cave.png')).toBe('cave');
    expect(tilesetDisplayName('/a/b/my_walls.png')).toBe('my_walls');
    expect(tilesetDisplayName(null)).toBe('');
  });
});

describe('tabLabel', () => {
  it('prefers a custom name, then the tileset, then Tab N', () => {
    expect(tabLabel({ name: 'Walls' }, 0)).toBe('Walls');
    expect(tabLabel({ name: 'Tab 3', tileset: { fileName: 'tileset_cave.png' } }, 2)).toBe('cave');
    expect(tabLabel({ name: 'Tab 2' }, 1)).toBe('Tab 2');
    expect(tabLabel({}, 4)).toBe('Tab 5');
  });
});
