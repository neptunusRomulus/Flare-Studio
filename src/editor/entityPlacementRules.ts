/**
 * Entities in the dock are definitions; a map instance exists only once placed.
 * Unplaced entities sit at -1,-1 and are not written to the Flare map.
 */
export const UNPLACED = -1;

export function isPlaced(object: { x: number; y: number }): boolean {
  return object.x >= 0 && object.y >= 0;
}

/** Objects that belong in the map file ([npc], [enemy], [event] blocks). */
export function placedOfType<T extends { type: string; x: number; y: number }>(objects: T[], type: string): T[] {
  return objects.filter((o) => o.type === type && isPlaced(o));
}
