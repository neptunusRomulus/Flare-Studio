import type { ItemRole, ItemResourceSubtype } from '../editor/itemRoles';

export function normalizeItemsForState(items: Array<{ id: number; name: string; category: string; filePath: string; fileName: string; role?: string; resourceSubtype?: string }>) {
  const toResourceSubtype = (value: string | undefined): ItemResourceSubtype => {
    if (value === 'currency' || value === 'material' || value === '') return value as ItemResourceSubtype;
    return '' as ItemResourceSubtype;
  };

  return items.map((item) => ({
    ...item,
    role: (item.role as ItemRole) || 'unspecified',
    resourceSubtype: toResourceSubtype(item.resourceSubtype)
  }));
}
