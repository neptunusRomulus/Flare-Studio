/**
 * Tileset slots are shared per map by the tile layers (Background + Object), like Flare where a map
 * has one tileset list and every tile layer uses the same ids. Collision keeps its own palette.
 * Storage key for the shared list: 'background'.
 */
export const SHARED_SLOT_LAYERS = ['background', 'object'];
export const SHARED_SLOT_KEY = 'background';

export function slotGroup(layerType: string): string {
  return SHARED_SLOT_LAYERS.includes(layerType) ? SHARED_SLOT_KEY : layerType;
}

/** Map whose 'object' key aliases the shared 'background' entry. */
export class SharedSlotMap<V> extends Map<string, V> {
  get(k: string) { return super.get(slotGroup(k)); }
  set(k: string, v: V) { return super.set(slotGroup(k), v); }
  has(k: string) { return super.has(slotGroup(k)); }
  delete(k: string) { return super.delete(slotGroup(k)); }
}

type RawTab = { id: number; tileset?: { fileName?: string | null } | null; [k: string]: unknown };

/**
 * Migrate saved per-layer slot lists into the shared list.
 * Background slots first, then Object slots whose image (normalized file name) isn't already present.
 * Empty Object slots are dropped. Returns the merged lists and active ids (old 'object' entries removed).
 */
export function mergeSharedSlotLists(
  layerTabs: Record<string, RawTab[]> | undefined,
  active: Record<string, number> | undefined,
  normalize: (k: string | null | undefined) => string | null,
): { layerTabs: Record<string, RawTab[]> | undefined; active: Record<string, number> | undefined; dropped: number[] } {
  if (!layerTabs) return { layerTabs, active, dropped: [] };
  const out: Record<string, RawTab[]> = { ...layerTabs };
  const bg = Array.isArray(layerTabs.background) ? [...layerTabs.background] : [];
  const obj = Array.isArray(layerTabs.object) ? layerTabs.object : [];
  const dropped: number[] = [];
  const seen = new Set(bg.map(t => normalize(t.tileset?.fileName ?? null)).filter(Boolean) as string[]);
  const ids = new Set(bg.map(t => t.id));
  for (const t of obj) {
    const k = normalize(t.tileset?.fileName ?? null);
    if (!k || seen.has(k) || ids.has(t.id)) { dropped.push(t.id); continue; }
    seen.add(k); ids.add(t.id); bg.push(t);
  }
  if (bg.length > 0 || obj.length > 0) out.background = bg;
  delete out.object;
  let act = active;
  if (active) {
    act = { ...active };
    if (act.background === undefined && act.object !== undefined && ids.has(act.object)) act.background = act.object;
    delete act.object;
  }
  return { layerTabs: out, active: act, dropped };
}
