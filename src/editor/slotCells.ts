/** Per-cell slot references: every painted cell remembers the slot (tileset fileName) it was painted with. */
export type SlotLike = { id: number; data?: number[]; tileset?: { fileName?: string | null } | null };

/** Strip path and accumulated "<layer>_tabN_" prefixes so saved/rehydrated keys match. */
export function normalizeSlotKey(key: string | null | undefined): string | null {
  if (!key) return null;
  let n = key.replace(/\\/g, '/').trim();
  if (n.includes('/')) n = n.split('/').pop() || n;
  const re = /^[a-zA-Z]+_tab\d+_/;
  while (re.test(n)) n = n.replace(re, '');
  return n || null;
}

export function findSlotForCellKey<T extends Omit<SlotLike, 'id' | 'data'>>(
  slots: T[], key: string | null | undefined, normalize: (k: string | null | undefined) => string | null = normalizeSlotKey
): T | undefined {
  if (!key) return undefined;
  const exact = slots.find(s => s.tileset && s.tileset.fileName === key);
  if (exact) return exact;
  const nk = normalize(key);
  if (!nk) return undefined;
  return slots.find(s => s.tileset && s.tileset.fileName && normalize(s.tileset.fileName) === nk);
}

/**
 * Legacy projects stored each slot's painting in slot.data and swapped it into the layer.
 * Merge them into one shared grid: layer.data (active slot) wins, other slots fill empty cells.
 * Mutates layerData/keys, clears slot.data.
 */
export function mergeLegacySlotData(layerData: number[], keys: Array<string | null>, slots: SlotLike[], activeId: number | undefined): void {
  const size = layerData.length;
  const active = slots.find(s => s.id === activeId) ?? slots[0];
  const activeKey = active?.tileset?.fileName ?? null;
  for (let i = 0; i < size; i++) if ((layerData[i] || 0) > 0 && !keys[i]) keys[i] = activeKey;
  for (const s of slots) {
    const d = s.data;
    if (s !== active && d && d.length === size) {
      const k = s.tileset?.fileName ?? null;
      for (let i = 0; i < size; i++) {
        if ((d[i] || 0) > 0 && !((layerData[i] || 0) > 0)) { layerData[i] = d[i]; keys[i] = k; }
      }
    }
  }
  for (const s of slots) s.data = undefined;
}

/** Erase cells painted with a deleted slot (never remap them to another slot). */
export function clearSlotCells(layerData: number[], keys: Array<string | null>, removed: SlotLike[], normalize?: (k: string | null | undefined) => string | null): number {
  let n = 0;
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] && findSlotForCellKey(removed, keys[i], normalize)) { keys[i] = null; layerData[i] = 0; n++; }
  }
  return n;
}
