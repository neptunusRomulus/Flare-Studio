/** Pure stamp helpers: build a stamp from selected tiles and compute placement cells. */

export type SelectionTile = { x: number; y: number; gid: number };
export type StampCell = { tileId: number; layerId: number; x: number; y: number };

export function stampFromSelection(tiles: SelectionTile[], layerId: number): { width: number; height: number; tiles: StampCell[] } | null {
  if (!tiles.length) return null;
  const minX = Math.min(...tiles.map((t) => t.x));
  const minY = Math.min(...tiles.map((t) => t.y));
  const maxX = Math.max(...tiles.map((t) => t.x));
  const maxY = Math.max(...tiles.map((t) => t.y));
  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    tiles: tiles.filter((t) => t.gid > 0).map((t) => ({ tileId: t.gid, layerId, x: t.x - minX, y: t.y - minY })),
  };
}

export function clampOrthogonalStampOrigin(
  gridX: number,
  gridY: number,
  stampWidth: number,
  stampHeight: number,
  mapWidth: number,
  mapHeight: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(gridX, mapWidth - stampWidth)),
    y: Math.max(0, Math.min(gridY, mapHeight - stampHeight)),
  };
}

/** Map a stamp-local cell onto the map. Isometric uses the engine's cx+ry / -cx+ry offset. */
export function stampTargetCell(
  originX: number,
  originY: number,
  dx: number,
  dy: number,
  isometric = false,
): { x: number; y: number } {
  if (isometric) return { x: originX + dx + dy, y: originY - dx + dy };
  return { x: originX + dx, y: originY + dy };
}

export function applyStampToGrid(
  data: number[],
  mapWidth: number,
  mapHeight: number,
  tiles: Array<{ x: number; y: number; tileId: number }>,
  originX: number,
  originY: number,
  isometric = false,
): number[] {
  const next = data.slice();
  for (const tile of tiles) {
    const { x, y } = stampTargetCell(originX, originY, tile.x, tile.y, isometric);
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) continue;
    next[y * mapWidth + x] = tile.tileId;
  }
  return next;
}
