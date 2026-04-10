type ItemRole = 'equipment' | 'consumable' | 'quest' | 'resource' | 'book' | 'loot_groups' | 'unspecified';
type ItemResourceSubtype = 'currency' | 'material' | '';

const ITEM_ROLE_META: Record<ItemRole, { label: string; badgeClass: string; description?: string }> = {
  equipment: { label: 'Equipment', badgeClass: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30', description: 'Weapons, armor, wearable gear' },
  consumable: { label: 'Consumable', badgeClass: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', description: 'Potions, scrolls, buffs' },
  quest: { label: 'Quest / Key Item', badgeClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30', description: 'Quest progression items' },
  resource: { label: 'Resource', badgeClass: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30', description: 'Currency or crafting mats' },
  book: { label: 'Book / Lore', badgeClass: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30', description: 'Readable lore items' },
  loot_groups: { label: 'Loot Groups', badgeClass: 'bg-gradient-to-r from-orange-300 via-lime-300 to-sky-300 text-white border border-transparent shadow-sm', description: 'Shared loot group definitions' },
  unspecified: { label: 'Unspecified', badgeClass: 'bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30', description: 'No role set' }
};

const ITEM_ROLE_SELECTIONS: Array<{ id: ItemRole; label: string; description: string }> = [
  { id: 'equipment', label: 'Equipment', description: 'Wearable gear with stats, damage/absorb, requirements' },
  { id: 'consumable', label: 'Consumable', description: 'Usable items that trigger a power; can stack' },
  { id: 'quest', label: 'Quest / Key Item', description: 'Progression items; usually unsellable and single stack' },
  { id: 'resource', label: 'Resource (Currency / Material)', description: 'Currencies or crafting materials; stackable loot' },
  { id: 'loot_groups', label: 'Loot Groups', description: 'Group items for shared random loot lists' },
  { id: 'book', label: 'Book / Lore', description: 'Readable items that open a book file' }
];

const RESOURCE_SUBTYPE_META: Record<Exclude<ItemResourceSubtype, ''>, { label: string; hint: string; badgeClass: string }> = {
  currency: { label: 'Currency', hint: 'Gold, coins; high stack, symmetric price', badgeClass: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
  material: { label: 'Material', hint: 'Crafting mats or generic loot', badgeClass: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' }
};

export type { ItemRole, ItemResourceSubtype };
export { ITEM_ROLE_META, ITEM_ROLE_SELECTIONS, RESOURCE_SUBTYPE_META };
