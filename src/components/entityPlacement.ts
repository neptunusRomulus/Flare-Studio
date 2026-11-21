/** Click-to-place: an entity armed from the Entities dock is placed with the next map click (event: dragged area). */
export type ArmedNpcOrEnemy = { type: 'npc' | 'enemy'; id: number };
export type ArmedEvent = { type: 'event'; script: string };
export type ArmedEntity = ArmedNpcOrEnemy | ArmedEvent | null;
let armed: ArmedEntity = null;
const listeners = new Set<() => void>();

function same(a: ArmedEntity, b: NonNullable<ArmedEntity>): boolean {
  if (!a || a.type !== b.type) return false;
  if (a.type === 'event' && b.type === 'event') return a.script === b.script;
  if (a.type !== 'event' && b.type !== 'event') return a.id === b.id;
  return false;
}

export const entityPlacement = {
  get: (): ArmedEntity => armed,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  arm: (a: ArmedEntity) => { armed = a; listeners.forEach(l => l()); },
  /** Clicking the same item again disarms it. */
  toggle: (a: NonNullable<ArmedEntity>) => {
    armed = same(armed, a) ? null : a;
    listeners.forEach(l => l());
  },
  clear: () => { if (armed) { armed = null; listeners.forEach(l => l()); } },
};
