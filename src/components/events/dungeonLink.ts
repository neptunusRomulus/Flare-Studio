import { dungeonSlugFromIntermap, intermapForHost, type MapStyle } from '@/editor/randomDungeon';

/** `maps/cave.txt`, `cave`, `C:\world\maps\cave` → `cave.txt`. */
export function currentMapFile(mapName: string | null | undefined): string {
  const leaf = String(mapName || '').replace(/\\/g, '/').split('/').pop() || String(mapName || '');
  return leaf.toLowerCase().endsWith('.txt') ? leaf : `${leaf}.txt`;
}

/**
 * The style a new random dungeon inherits: the editor's ground tile first, then whatever the current
 * map's header declares, so the dungeon matches the map the event sits on.
 */
export function mapStyleFrom(args: {
  ground?: { width?: number; height?: number; orientation?: string | null } | null;
  header?: { tileset?: string | null; tilewidth?: string | number | null; tileheight?: string | number | null; orientation?: string | null } | null;
}): MapStyle {
  const style: MapStyle = {};
  const ground = args.ground;
  if (ground) {
    if (ground.width) style.tilewidth = ground.width;
    if (ground.height) style.tileheight = ground.height;
    if (ground.orientation) style.orientation = ground.orientation ?? undefined;
  }
  const header = args.header;
  if (header) {
    if (header.tileset) style.tileset = header.tileset;
    if (header.tilewidth) style.tilewidth = header.tilewidth;
    if (header.tileheight) style.tileheight = header.tileheight;
    if (header.orientation) style.orientation = header.orientation ?? undefined;
  }
  return style;
}

/** The dungeon a linked map already points at, or '' when the link is not a dungeon host. */
export function dungeonSlugForLink(teleportMap: string | null | undefined): string {
  const raw = String(teleportMap || '').trim();
  return (raw ? dungeonSlugFromIntermap(intermapForHost(raw)) : '') ?? '';
}

/** `maps/cave_room_2.txt` → `cave_room_2`, the map tab name the editor opens. */
export function dungeonRoomMapName(relPath: string): string {
  return String(relPath || '').replace(/\\/g, '/').replace(/^maps\//, '').replace(/\.txt$/i, '');
}
