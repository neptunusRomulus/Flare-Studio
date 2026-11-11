/** Fill missing item-editor fields from a parsed Flare item file record. */

const STUDIO_ONLY = new Set(['role', 'resourceSubtype', 'category', 'filePath', 'fileName', '_role', '_resourceSubtype']);

/** First-class ItemEditDialog fields (not shown in the extra Properties list). */
export const ITEM_FORM_KEYS = new Set([
  'id', 'name', 'flavor', 'icon', 'level', 'quality', 'no_stash', 'quest_item', 'pickup_status',
  'price', 'price_per_level', 'price_sell', 'max_quantity', 'item_type', 'type', 'equip_flags',
  'requires_level', 'requires_stat', 'requires_class', 'disable_slots', 'gfx', 'bonus', 'bonus_power_level',
  'dmg', 'abs', 'trait_elemental', 'power', 'power_desc', 'replace_power', 'script', 'book', 'book_is_readable',
  'soundfx', 'stepfx', 'loot_animation', 'randomizer_def', 'loot_drops_max', 'wall_power', 'use_hazard',
  'post_power', 'post_effect', 'speed', 'radius', 'requires_hpmp_state', 'requires_item', 'new_state',
  'modifier_damage', 'lifespan', 'face',
]);

/** Official item keys that the form does not give a dedicated field. */
export const ITEM_EXTRA_CATALOG: Array<{ id: string; label: string; tooltip: string }> = [
  { id: 'dmg_min', label: 'Minimum damage', tooltip: 'dmg_min' },
  { id: 'dmg_max', label: 'Maximum damage', tooltip: 'dmg_max' },
  { id: 'abs_min', label: 'Minimum absorb', tooltip: 'abs_min' },
  { id: 'abs_max', label: 'Maximum absorb', tooltip: 'abs_max' },
  { id: 'crafting_items', label: 'Crafting items', tooltip: 'crafting_items' },
  { id: 'soundfx_craft', label: 'Crafting sound', tooltip: 'soundfx_craft' },
  { id: 'soundfx_craft_override', label: 'Override crafting sound', tooltip: 'soundfx_craft_override' },
];

export function isStudioOnlyItemKey(key: string): boolean {
  return STUDIO_ONLY.has(key) || key.startsWith('_');
}

export function hydrateItemDraft<T extends Record<string, unknown>>(file: Record<string, unknown>, draft: T): T {
  const next: Record<string, unknown> = { ...draft };
  for (const [key, value] of Object.entries(file)) {
    if (isStudioOnlyItemKey(key)) continue;
    const current = next[key];
    const empty = current == null || current === '';
    if (!empty) continue;
    if (Array.isArray(value)) {
      if (value.length) next[key] = value.join('\n');
    } else if (value != null && String(value) !== '') {
      next[key] = value;
    }
  }
  return next as T;
}

export function extraItemPropertyKeys(item: Record<string, unknown>): string[] {
  const keys = new Set<string>();
  for (const key of Object.keys(item)) {
    if (ITEM_FORM_KEYS.has(key) || isStudioOnlyItemKey(key)) continue;
    if (item[key] === undefined || item[key] === null) continue;
    keys.add(key);
  }
  return [...keys].sort();
}
