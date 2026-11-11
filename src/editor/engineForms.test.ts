import { describe, expect, it } from 'vitest';
import {
  collectSectionIds, parseHeroLayers, parseHeroOptions, parseLootSettings, parseXpTable,
  serializeHeroLayers, serializeHeroOptions, serializeXpTable, unknownIds, upsertLootSettings,
} from './engineForms';

describe('engineForms', () => {
  it('round-trips an XP table and keeps comments', () => {
    const text = '# xp\nlevel=1,0\nlevel=2,256\n';
    expect(parseXpTable(text)).toEqual([{ level: '1', xp: '0' }, { level: '2', xp: '256' }]);
    expect(serializeXpTable([{ level: '1', xp: '0' }, { level: '3', xp: '10' }], text)).toBe('# xp\nlevel=1,0\nlevel=3,10\n');
  });

  it('updates loot currency and vendor ratios without dropping other keys', () => {
    const text = 'APPEND\nsfx_loot=soundfx/x.ogg\ncurrency_name=Gold\nvendor_ratio_sell=0.25\n';
    const next = upsertLootSettings(text, { currency_name: 'Silver', vendor_ratio_buy: '1.0' });
    expect(parseLootSettings(next)).toMatchObject({ currency_name: 'Silver', vendor_ratio_sell: '0.25', vendor_ratio_buy: '1.0' });
    expect(next).toContain('sfx_loot=soundfx/x.ogg');
    expect(next.startsWith('APPEND')).toBe(true);
  });

  it('parses hero options and layers', () => {
    const options = parseHeroOptions('option=0,male,head_short,images/portraits/male01.png,Delrek\n');
    expect(options[0]).toEqual({ index: '0', base: 'male', head: 'head_short', portrait: 'images/portraits/male01.png', name: 'Delrek' });
    expect(serializeHeroOptions(options, '# hero\n')).toContain('option=0,male,head_short,images/portraits/male01.png,Delrek');
    const layers = parseHeroLayers('layer=SW,main,feet,legs\n');
    expect(layers[0]).toEqual({ direction: 'SW', types: 'main,feet,legs' });
    expect(serializeHeroLayers(layers)).toBe('layer=SW,main,feet,legs\n');
  });

  it('collects ids and reports unknown actionbar/equipment entries, ignoring 0', () => {
    const ids = collectSectionIds({ 'items/items.txt': '[item]\nid=4\n[item]\nid=5\n', 'powers/a.txt': '[power]\nid=7\n' }, ['item', 'power']);
    expect([...ids].sort()).toEqual(['4', '5', '7']);
    expect(unknownIds('4,9,0', ids, { allowZero: true })).toEqual(['9']);
    expect(unknownIds('7,8', ids)).toEqual(['8']);
  });
});
