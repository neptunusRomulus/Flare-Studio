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

/** One tile from a def, in Studio's convention: origin is the pixel that sits on the diamond's bottom point. */
export interface DefSlicedTile extends TilesetDefTile {
  originX: number;
  originY: number;
  /** Sliced from a Flare tilesetdef: draw with origin, not the grid bottom-center anchor. */
  fromDef: true;
}

const baseName = (p: string) => (p.split(/[\\/]/).pop() || '').toLowerCase();

/** Image file names referenced by img= lines, in order. */
export function defImageNames(content: string): string[] {
  const out: string[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('img=')) out.push(baseName(line.slice(4).trim()));
  }
  return out;
}

/**
 * Tiles of a def that belong to one image. A def can hold several [tileset]
 * sections (img= lines); tile= lines belong to the img= above them. A def with
 * no img= line at all is treated as one section for any image.
 *
 * Flare draws a tile at (diamond center - (ox, oy)); Studio anchors at the
 * diamond's bottom point, which is groundHeight/2 lower, so originY = oy + groundHeight/2.
 */
export function defTilesForImage(content: string, imageName: string, groundHeight: number): Map<number, DefSlicedTile> {
  const want = baseName(imageName);
  const hasImg = defImageNames(content).length > 0;
  const tiles = new Map<number, DefSlicedTile>();
  let current: string | null = null;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('img=')) { current = baseName(line.slice(4).trim()); continue; }
    if (!line.startsWith('tile=')) continue;
    if (hasImg && current !== want) continue;
    const parts = line.slice(5).split(',').map((p) => parseInt(p.trim(), 10));
    if (parts.length < 5 || parts.slice(0, 5).some((n) => Number.isNaN(n))) continue;
    const [id, sourceX, sourceY, width, height, ox, oy] = parts;
    if (id <= 0 || width <= 0 || height <= 0) continue;
    const originX = ox === undefined || Number.isNaN(ox) ? Math.floor(width / 2) : ox;
    const flareOy = oy === undefined || Number.isNaN(oy) ? height - groundHeight / 2 : oy;
    tiles.set(id, { sourceX, sourceY, width, height, originX, originY: flareOy + groundHeight / 2, fromDef: true });
  }
  return tiles;
}

/**
 * Top-left screen position for drawing a tile whose diamond center is (cx, cy).
 * The origin (pixel on the diamond's bottom point) is used when known: def tiles
 * carry Flare's offset there, grid tiles carry (w/2, h) = the bottom-center anchor.
 */
export function tileDrawTopLeft(
  cx: number, cy: number, groundHeight: number, zoom: number,
  tile: { width: number; height: number; originX?: number; originY?: number },
): { x: number; y: number } {
  const groundY = cy + (groundHeight / 2) * zoom;
  if (tile.originX != null && tile.originY != null) {
    return { x: cx - tile.originX * zoom, y: groundY - tile.originY * zoom };
  }
  return { x: cx - (tile.width / 2) * zoom, y: groundY - tile.height * zoom };
}
