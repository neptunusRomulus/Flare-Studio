import { npcFileForActor } from '@/editor/npcInstances';
import type { MapObject } from '@/types';

export type OccupiedTile = { x: number; y: number };

/** Tiles occupied by other NPCs (two NPCs cannot share a tile). */
export function npcOccupiedTiles(objects: Array<Pick<MapObject, 'id' | 'type' | 'x' | 'y'>>, exceptId?: number): Set<string> {
  const tiles = new Set<string>();
  for (const object of objects) {
    if (object.type !== 'npc' || object.id === exceptId) continue;
    if (object.x < 0 || object.y < 0) continue;
    tiles.add(`${object.x},${object.y}`);
  }
  return tiles;
}

/** Nearest free map tile to (x,y), searching in expanding rings. Prefers east, then south, west, north. */
export function nearestFreeTile(
  x: number,
  y: number,
  occupied: Set<string>,
  mapWidth: number,
  mapHeight: number,
): { x: number; y: number } | null {
  const inside = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < mapWidth && ty < mapHeight;
  const tryTile = (tx: number, ty: number) => (inside(tx, ty) && !occupied.has(`${tx},${ty}`) ? { x: tx, y: ty } : null);
  const here = tryTile(x, y);
  if (here) return here;
  const max = Math.max(mapWidth, mapHeight);
  for (let r = 1; r <= max; r++) {
    const ring: Array<{ x: number; y: number }> = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        ring.push({ x: x + dx, y: y + dy });
      }
    }
    // East, south, west, north first, then the rest of the ring (clockwise-ish).
    const order = (p: { x: number; y: number }) => {
      const dx = p.x - x, dy = p.y - y;
      if (dx === r && dy === 0) return 0;
      if (dx === 0 && dy === r) return 1;
      if (dx === -r && dy === 0) return 2;
      if (dx === 0 && dy === -r) return 3;
      const angle = Math.atan2(dy, dx);
      return 4 + (angle < 0 ? angle + Math.PI * 2 : angle);
    };
    ring.sort((a, b) => order(a) - order(b));
    for (const p of ring) {
      const hit = tryTile(p.x, p.y);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Delete a placed map instance: remove the object when another copy of the
 * same definition remains, otherwise unplace it so the definition stays in the dock.
 */
export function deleteMapNpcInstanceAction(
  objects: Array<Pick<MapObject, 'id' | 'type' | 'name' | 'properties'>>,
  id: number,
): 'remove' | 'unplace' | null {
  const target = objects.find((o) => o.id === id);
  if (!target || target.type !== 'npc') return null;
  const file = npcFileForActor(target);
  const others = objects.some((o) => o.id !== id && o.type === 'npc' && npcFileForActor(o) === file);
  return others ? 'remove' : 'unplace';
}
