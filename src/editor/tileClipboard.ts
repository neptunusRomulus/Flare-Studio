export type TileCell = { x: number; y: number; gid: number; tilesetKey?: string | null };

export type TileClipboard = {
  originX: number;
  originY: number;
  cells: Array<{ dx: number; dy: number; gid: number; tilesetKey?: string | null }>;
};

export function clipboardFromTiles(tiles: TileCell[]): TileClipboard | null {
  if (!tiles.length) return null;
  const originX = Math.min(...tiles.map((tile) => tile.x));
  const originY = Math.min(...tiles.map((tile) => tile.y));
  return {
    originX,
    originY,
    cells: tiles.map((tile) => ({
      dx: tile.x - originX,
      dy: tile.y - originY,
      gid: tile.gid,
      tilesetKey: tile.tilesetKey ?? null,
    })),
  };
}

export function pasteTileGrid(
  data: number[],
  width: number,
  height: number,
  clipboard: TileClipboard,
  originX: number,
  originY: number
): { data: number[]; tilesetWrites: Array<{ index: number; key: string | null }> } {
  const next = data.slice();
  const tilesetWrites: Array<{ index: number; key: string | null }> = [];
  for (const cell of clipboard.cells) {
    const x = originX + cell.dx;
    const y = originY + cell.dy;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const index = y * width + x;
    next[index] = cell.gid;
    if (cell.tilesetKey !== undefined) tilesetWrites.push({ index, key: cell.tilesetKey ?? null });
  }
  return { data: next, tilesetWrites };
}
