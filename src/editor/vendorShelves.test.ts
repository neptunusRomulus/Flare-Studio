import { describe, expect, it } from 'vitest';
import {
  effectiveVendorRatio,
  parseVendorShelves,
  removeStockItem,
  removeStatusStockItem,
  setStockQuantity,
  vendorItemPrices,
  vendorPriceText,
} from '@/editor/vendorShelves';

describe('vendor shelves', () => {
  it('splits stock keys into always, unlock, random and craft shelves', () => {
    const shelves = parseVendorShelves({
      constant_stock: '1001,1002:3',
      status_stock: 'vip,1003\nquest,1004:2,1005',
      random_stock: 'loot/chest.txt',
      craft_constant_stock: '2001',
      craft_status_stock: 'trained,2002',
      craft_random_stock: 'loot/craft.txt',
    });
    expect(shelves.map((s) => s.kind)).toEqual(['always', 'unlock', 'random', 'craft']);
    expect(shelves[0].items).toEqual([{ id: '1001', quantity: '', shelf: 'always' }, { id: '1002', quantity: '3', shelf: 'always' }]);
    expect(shelves[1].items.map((i) => `${i.status}:${i.id}:${i.quantity}`)).toEqual([
      'vip:1003:', 'quest:1004:2', 'quest:1005:',
    ]);
    expect(shelves[2].tables).toEqual(['loot/chest.txt']);
    expect(shelves[3].items.map((i) => i.id)).toEqual(['2001', '2002']);
    expect(shelves[3].tables).toEqual(['loot/craft.txt']);
  });

  it('ratio falls back to the global value when the NPC value is empty or 0', () => {
    expect(effectiveVendorRatio('', 1)).toBe(1);
    expect(effectiveVendorRatio('0', 0.25)).toBe(0.25);
    expect(effectiveVendorRatio('1.5', 1)).toBe(1.5);
  });

  it('price math truncates like the engine and never goes below 1', () => {
    expect(vendorItemPrices({ price: '100', buyRatio: 1.5, sellRatio: 0.25 })).toEqual({ buy: 150, sell: 25, levelScaled: false });
    expect(vendorItemPrices({ price: '7', buyRatio: 1, sellRatio: 0.25 })).toEqual({ buy: 7, sell: 1, levelScaled: false });
    expect(vendorItemPrices({ price: '0', buyRatio: 1, sellRatio: 0.25 })).toBeNull();
    expect(vendorItemPrices({ price: '', buyRatio: 1, sellRatio: 0.25 })).toBeNull();
  });

  it('price_sell overrides the computed sell price and level scaling is marked', () => {
    expect(vendorItemPrices({ price: '100', priceSell: '80', buyRatio: 1, sellRatio: 0.25 })).toEqual({ buy: 100, sell: 80, levelScaled: false });
    const scaled = vendorItemPrices({ price: 'player_level:5', buyRatio: 1, sellRatio: 0.25 });
    expect(scaled).toBeNull(); // non-numeric base is shown as unpriced
    expect(vendorPriceText(scaled)).toBe('—');
    expect(vendorPriceText({ buy: 100, sell: 25, levelScaled: true })).toBe('100+ / 25');
  });

  it('removes one item and edits quantity without touching other entries', () => {
    expect(removeStockItem('1001,1002:3,1003', '1002')).toBe('1001,1003');
    expect(removeStatusStockItem('vip,1003,1004', '1003')).toBe('vip,1004');
    expect(removeStatusStockItem('vip,1003', '1003')).toBe('');
    expect(removeStockItem('1001', '1001')).toBe('');
    expect(setStockQuantity('1001,1002:3', '1002', '5')).toBe('1001,1002:5');
    expect(setStockQuantity('1002:3', '1002', '')).toBe('1002');
  });
});
