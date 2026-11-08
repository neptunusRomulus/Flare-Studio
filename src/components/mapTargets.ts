/** "Map" sidebar entry = Ground (background), Object and Collision drawing targets. UI-only merge. */
export type MapTarget = 'background' | 'object' | 'collision';
export const MAP_TARGETS: MapTarget[] = ['background', 'object', 'collision'];
export const MAP_TARGET_LABEL: Record<MapTarget, string> = { background: 'Ground', object: 'Object', collision: 'Collision' };

/** Brush / hover outline colour per target (one place to swap). Object = --primary orange. */
export const MAP_TARGET_CURSOR: Record<MapTarget, string> = {
  background: '#000000',
  object: 'hsl(25, 95%, 53%)',
  collision: '#ffffff',
};

export const MAP_TAB_HELP = 'Press Tab to switch between Ground, Object and Collision while the Map layer is selected.';

export function isMapTarget(t: string | null | undefined): t is MapTarget {
  return !!t && (MAP_TARGETS as string[]).includes(t);
}

export function nextTarget(cur: MapTarget, reverse = false): MapTarget {
  const i = MAP_TARGETS.indexOf(cur);
  const n = MAP_TARGETS.length;
  return MAP_TARGETS[(i + (reverse ? n - 1 : 1)) % n];
}

/** Tab should cycle targets only when Map is active and focus is not in a text field or dialog. */
export function shouldHandleTabKey(e: { key: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }, activeType: string | null | undefined,
  target: { tagName?: string; isContentEditable?: boolean; closest?: (s: string) => unknown } | null): boolean {
  if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return false;
  if (!isMapTarget(activeType)) return false;
  if (target) {
    const tag = (target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return false;
    if (typeof target.closest === 'function' && target.closest('[role="dialog"],[role="alertdialog"]')) return false;
  }
  return true;
}

/** Sidebar entries: the three drawing layers collapse into one 'map' entry at the first drawing layer's position. */
export type SidebarEntry<L> = { kind: 'layer'; layer: L } | { kind: 'map'; targets: L[] };
export function collapseMapLayers<L extends { type?: string }>(layers: L[]): Array<SidebarEntry<L>> {
  const out: Array<SidebarEntry<L>> = [];
  const targets = MAP_TARGETS.map(t => layers.find(l => l.type === t)).filter(Boolean) as L[];
  let placed = false;
  for (const l of layers) {
    if (isMapTarget(l.type)) {
      if (!placed && targets.length) { out.push({ kind: 'map', targets }); placed = true; }
      continue;
    }
    out.push({ kind: 'layer', layer: l });
  }
  return out;
}

let lastTarget: MapTarget = 'background';
export function rememberTarget(t: MapTarget): void { lastTarget = t; }
export function getLastTarget(): MapTarget { return lastTarget; }
