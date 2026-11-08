/** Click-to-place: an entity armed from the Entities dock is placed with the next map click (event: dragged area). */
export type ArmedEntity = { id: number; type: 'npc' | 'enemy' | 'event' } | null;
let armed: ArmedEntity = null;
const listeners = new Set<() => void>();
export const entityPlacement = {
  get: (): ArmedEntity => armed,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  arm: (a: ArmedEntity) => { armed = a; listeners.forEach(l => l()); },
  /** Clicking the same item again disarms it. */
  toggle: (a: NonNullable<ArmedEntity>) => {
    armed = armed && armed.id === a.id ? null : a;
    listeners.forEach(l => l());
  },
  clear: () => { if (armed) { armed = null; listeners.forEach(l => l()); } },
};
