import { describe, expect, it } from 'vitest';
import { extraItemPropertyKeys, hydrateItemDraft } from './itemFileHydrate';

describe('item file hydrate', () => {
  it('fills missing official keys from the file and leaves set fields alone', () => {
    const draft = hydrateItemDraft(
      { id: 305, name: 'Lost Totem', flavor: 'Ancient', crafting_items: '750,751', dmg_min: 'ment,1', bonus: 'mp,30', _role: 'equipment' },
      { id: 305, name: 'Lost Totem', flavor: '', bonus: 'hp,1' } as Record<string, unknown>,
    );
    expect(draft.flavor).toBe('Ancient');
    expect(draft.crafting_items).toBe('750,751');
    expect(draft.dmg_min).toBe('ment,1');
    expect(draft.bonus).toBe('hp,1');
    expect(draft).not.toHaveProperty('_role');
  });

  it('lists extra keys for the Properties list', () => {
    expect(extraItemPropertyKeys({ id: 1, name: 'X', crafting_items: '1', dmg_min: 'ment,1', role: 'equipment' })).toEqual(['crafting_items', 'dmg_min']);
  });
});
