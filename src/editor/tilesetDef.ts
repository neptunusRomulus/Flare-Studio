export interface TilesetDefTile {
  sourceX: number;
  sourceY: number;
  width: number;
  height: number;
  originX?: number;
  originY?: number;
}

/**
 * Parse the tile= lines of a Flare tilesetdefs file.
 * Format: tile=id,left,top,width,height,origin_x,origin_y (origin optional).
 */
export function parseTilesetDefTiles(content: string): Map<number, TilesetDefTile> {
  const tiles = new Map<number, TilesetDefTile>();
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('tile=')) continue;
    const parts = line.slice(5).split(',').map((p) => parseInt(p.trim(), 10));
    if (parts.length < 5 || parts.slice(0, 5).some((n) => Number.isNaN(n))) continue;
    const [id, sourceX, sourceY, width, height, ox, oy] = parts;
    if (width <= 0 || height <= 0) continue;
    tiles.set(id, {
      sourceX,
      sourceY,
      width,
      height,
      originX: Number.isNaN(ox) || ox === undefined ? Math.floor(width / 2) : ox,
      originY: Number.isNaN(oy) || oy === undefined ? height : oy,
    });
  }
  return tiles;
}
