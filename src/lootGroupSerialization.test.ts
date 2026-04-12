import { describe, it, expect } from 'vitest';
import { serializeLootGroupText, parseLootGroupText } from './hooks/useItems';

describe('loot group serialization', () => {
  it('serializes loot group data to engine .txt format and parses it back', () => {
    const payload = {
      id: 'loot_chest',
      name: 'Loot Chest',
      description: 'Test loot group',
      loot_chance_value: '0.75',
      requires_status: 'gold_key',
      requires_level: '2,5',
      quantity_per_level: '1,2',
      loot_contents: {
        '1': 2,
      },
    };

    const serialized = serializeLootGroupText(payload);
    expect(serialized).toContain('id=loot_chest');
    expect(serialized).toContain('name=Loot Chest');
    expect(serialized).toContain('description=Test loot group');
    expect(serialized).toContain('[loot]');
    expect(serialized).toContain('id=1');
    expect(serialized).toContain('quantity=2');

    const parsed = parseLootGroupText(serialized);
    expect(parsed).toEqual(expect.objectContaining({
      id: 'loot_chest',
      name: 'Loot Chest',
      description: 'Test loot group',
      loot: expect.any(Array),
    }));
    expect(parsed.loot).toHaveLength(1);
    expect((parsed.loot as Array<Record<string, unknown>>)[0]).toMatchObject({
      'loot.id': '1',
      'loot.quantity': '2',
    });
  });
});
