import type { ItemRole, ItemResourceSubtype } from '../editor/itemRoles';

export type RawItem = {
  id: number;
  name: string;
  category: string;
  filePath: string;
  fileName: string;
  role?: string;
  resourceSubtype?: string;
};

export type ItemSummary = {
  id: number;
  name: string;
  category: string;
  filePath: string;
  fileName: string;
  role: ItemRole;
  resourceSubtype?: ItemResourceSubtype;
};

const VALID_ITEM_ROLES: ItemRole[] = ['equipment', 'consumable', 'quest', 'resource', 'book', 'loot_groups', 'unspecified'];

const normalizeRole = (value: string | undefined): ItemRole => {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'loot_group') return 'loot_groups';
  if (VALID_ITEM_ROLES.includes(role as ItemRole)) return role as ItemRole;
  return 'unspecified';
};

export function normalizeItemsForState(items: RawItem[]): ItemSummary[] {
  const toResourceSubtype = (value: string | undefined): ItemResourceSubtype => {
    const subtype = String(value || '').trim().toLowerCase();
    if (subtype === 'currency' || subtype === 'material' || subtype === '') return subtype as ItemResourceSubtype;
    return '' as ItemResourceSubtype;
  };

  return items.map((item) => ({
    ...item,
    role: normalizeRole(item.role),
    resourceSubtype: toResourceSubtype(item.resourceSubtype)
  }));
}
