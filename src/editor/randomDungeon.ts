/** Beginner-facing Random dungeon helpers on top of Flare 1.15 procgen rules. */

import { exportMapText } from '@/adapters/flare/flareAdapter.cjs';
import { candidateEnginePaths, parseProjectRequires } from '@/editor/engineFileFallback';
import { parseModSettings } from '@/editor/modSettings';
import {
  PROCGEN_RULES_DIR,
  collectChunkFilenames,
  parseMapProcgenType,
  parseProcgenFile,
  serializeProcgenFile,
  type ProcgenFile,
  type ProcgenKey,
} from '@/editor/procgenRules';
import { projectRoot } from '@/editor/projectFiles';

export const DEFAULT_ROOM_SIZE = 28;
export const DEFAULT_GRID = 5;
export const HOST_PADDING = 12;

/** Official Empyrean Iron Labyrinth openings on a 28×28 links map. */
export const LINK_RECTS_28 = {
  north: { x: 9, y: 0, w: 10, h: 6 },
  south: { x: 9, y: 22, w: 10, h: 6 },
  west: { x: 0, y: 9, w: 6, h: 10 },
  east: { x: 22, y: 9, w: 6, h: 10 },
} as const;

export const CARD_TYPES = ['start', 'normal', 'end'] as const;
export type DungeonCardType = (typeof CARD_TYPES)[number];

export const DEFAULT_DUNGEON_SETTINGS: Record<string, string> = {
  doors_max: '0',
  main_path_length_min: '10',
  main_path_length_max: '20',
  main_path_attempts_max: '1000',
  branch_length_min: '5',
  branch_length_max: '10',
  branches_per_door_level_max: '2',
  door_spacing_min: '2',
};

export type LinkSide = keyof typeof LINK_RECTS_28;
export type LinkRect = { x: number; y: number; w: number; h: number };

export type MapHeaderInfo = {
  width: number;
  height: number;
  tileset: string;
  tilewidth: string;
  tileheight: string;
  orientation: string;
  procgenType: string;
  title: string;
  heroX: number;
  heroY: number;
};

export type DungeonPaths = {
  slug: string;
  host: string;
  openings: string;
  rules: string;
};

export type DungeonRoom = {
  path: string;
  type: string;
  width: number;
  height: number;
  title: string;
  missing?: boolean;
};

export type DungeonStatus =
  | 'Ready'
  | 'Entrance missing'
  | 'Exit missing'
  | 'Openings map missing'
  | 'Rooms are different sizes';

export type MapStyle = {
  tileset?: string;
  tilewidth?: number | string;
  tileheight?: number | string;
  orientation?: string;
  backgroundColor?: string;
};

type DungeonFs = {
  readFile: (absPath: string) => Promise<string | null | undefined>;
  readDir?: (absPath: string) => Promise<Array<{ name: string; isDirectory?: boolean }> | null | undefined>;
};

export function slugifyDungeonName(name: string): string {
  const slug = String(name || 'dungeon')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^.*\//, '')
    .replace(/\.txt$/i, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return slug.toLowerCase() || 'dungeon';
}

export function uniqueDungeonSlug(desired: string, taken: Iterable<string>): string {
  const base = slugifyDungeonName(desired);
  const used = new Set([...taken].map((value) => value.toLowerCase()));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

export function dungeonPaths(slug: string): DungeonPaths {
  const id = slugifyDungeonName(slug);
  return {
    slug: id,
    host: `maps/${id}.txt`,
    openings: `maps/${id}/openings.txt`,
    rules: `${PROCGEN_RULES_DIR}/${id}.txt`,
  };
}

export function roomRelPath(slug: string, type: DungeonCardType, index: number): string {
  const id = slugifyDungeonName(slug);
  const stem = type === 'start' ? 'entrance' : type === 'end' ? 'exit' : 'room';
  const suffix = index <= 1 ? '' : `_${index}`;
  return `maps/${id}_${stem}${suffix}.txt`;
}

export function nextRoomRelPath(slug: string, type: DungeonCardType, existing: Iterable<string>): string {
  const used = new Set([...existing].map((value) => value.replace(/\\/g, '/')));
  let index = 1;
  let path = roomRelPath(slug, type, index);
  while (used.has(path)) {
    index += 1;
    path = roomRelPath(slug, type, index);
  }
  return path;
}

/** Scale official 28×28 link regions, keeping the Empyrean values exact at 28. */
export function linkRectsForSize(width: number, height: number): Record<LinkSide, LinkRect> {
  const w = Math.max(1, Math.floor(width) || DEFAULT_ROOM_SIZE);
  const h = Math.max(1, Math.floor(height) || DEFAULT_ROOM_SIZE);
  if (w === DEFAULT_ROOM_SIZE && h === DEFAULT_ROOM_SIZE) {
    return {
      north: { ...LINK_RECTS_28.north },
      south: { ...LINK_RECTS_28.south },
      west: { ...LINK_RECTS_28.west },
      east: { ...LINK_RECTS_28.east },
    };
  }
  const scale = (rect: LinkRect, axisW: number, axisH: number): LinkRect => ({
    x: Math.max(0, Math.round((rect.x * axisW) / DEFAULT_ROOM_SIZE)),
    y: Math.max(0, Math.round((rect.y * axisH) / DEFAULT_ROOM_SIZE)),
    w: Math.max(1, Math.round((rect.w * axisW) / DEFAULT_ROOM_SIZE)),
    h: Math.max(1, Math.round((rect.h * axisH) / DEFAULT_ROOM_SIZE)),
  });
  const north = scale(LINK_RECTS_28.north, w, h);
  const south = scale(LINK_RECTS_28.south, w, h);
  const west = scale(LINK_RECTS_28.west, w, h);
  const east = scale(LINK_RECTS_28.east, w, h);
  south.y = Math.min(h - south.h, south.y);
  east.x = Math.min(w - east.w, east.x);
  north.w = Math.min(north.w, w - north.x);
  south.w = Math.min(south.w, w - south.x);
  west.h = Math.min(west.h, h - west.y);
  east.h = Math.min(east.h, h - east.y);
  return { north, south, west, east };
}

export function hostDimensions(roomW: number, roomH: number, grid = DEFAULT_GRID, padding = HOST_PADDING) {
  const cellW = Math.max(1, Math.floor(roomW) || DEFAULT_ROOM_SIZE);
  const cellH = Math.max(1, Math.floor(roomH) || DEFAULT_ROOM_SIZE);
  const cells = Math.max(1, Math.floor(grid) || DEFAULT_GRID);
  const pad = Math.max(0, Math.floor(padding));
  return {
    width: pad * 2 + cellW * cells,
    height: pad * 2 + cellH * cells,
    event: { x: pad, y: pad, w: cellW * cells, h: cellH * cells },
  };
}

export function parseMapHeader(text: string): MapHeaderInfo {
  const info: MapHeaderInfo = {
    width: 0,
    height: 0,
    tileset: '',
    tilewidth: '',
    tileheight: '',
    orientation: '',
    procgenType: '',
    title: '',
    heroX: 0,
    heroY: 0,
  };
  let inHeader = false;
  let seenSection = false;
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[')) {
      const name = line.slice(1, -1).trim().toLowerCase();
      if (!seenSection && name === 'header') {
        inHeader = true;
        seenSection = true;
        continue;
      }
      if (inHeader || seenSection) break;
    }
    seenSection = true;
    if (inHeader || !line.startsWith('[')) {
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      if (key === 'width') info.width = Math.max(0, parseInt(value, 10) || 0);
      else if (key === 'height') info.height = Math.max(0, parseInt(value, 10) || 0);
      else if (key === 'tileset') info.tileset = value;
      else if (key === 'tilewidth') info.tilewidth = value;
      else if (key === 'tileheight') info.tileheight = value;
      else if (key === 'orientation') info.orientation = value;
      else if (key === 'procgen_type') info.procgenType = value;
      else if (key === 'title') info.title = value;
      else if (key === 'hero_pos') {
        const [x, y] = value.split(',');
        info.heroX = parseInt(String(x || '0'), 10) || 0;
        info.heroY = parseInt(String(y || '0'), 10) || 0;
      }
    }
  }
  return info;
}

export function roomSizeFromRooms(rooms: Array<Pick<DungeonRoom, 'width' | 'height' | 'missing'>>): { width: number; height: number } {
  const sized = rooms.filter((room) => !room.missing && room.width > 0 && room.height > 0);
  if (!sized.length) return { width: DEFAULT_ROOM_SIZE, height: DEFAULT_ROOM_SIZE };
  return { width: sized[0].width, height: sized[0].height };
}

export function dungeonStatus(rooms: DungeonRoom[], openingsPresent: boolean): DungeonStatus {
  const usable = rooms.filter((room) => !room.missing);
  if (!usable.some((room) => room.type === 'start')) return 'Entrance missing';
  if (!usable.some((room) => room.type === 'end')) return 'Exit missing';
  if (!openingsPresent) return 'Openings map missing';
  const sized = usable.filter((room) => room.width > 0 && room.height > 0);
  if (sized.length) {
    const first = sized[0];
    if (sized.some((room) => room.width !== first.width || room.height !== first.height)) {
      return 'Rooms are different sizes';
    }
  }
  return 'Ready';
}

function emptyLayerRows(width: number, height: number): number[][] {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  return Array.from({ length: h }, () => Array.from({ length: w }, () => 0));
}

function mapText(opts: {
  width: number;
  height: number;
  style?: MapStyle;
  procgenType?: string;
  title?: string;
  heroX?: number;
  heroY?: number;
  events?: Array<Record<string, string | number>>;
  layers?: Array<{ type: string }>;
}): string {
  const width = Math.max(1, Math.floor(opts.width) || 1);
  const height = Math.max(1, Math.floor(opts.height) || 1);
  const layers = (opts.layers?.length ? opts.layers : [{ type: 'background' }, { type: 'object' }, { type: 'collision' }]).map((layer) => ({
    type: layer.type,
    rows: emptyLayerRows(width, height),
  }));
  const exported = exportMapText({
    width,
    height,
    tilewidth: opts.style?.tilewidth,
    tileheight: opts.style?.tileheight,
    orientation: opts.style?.orientation || 'isometric',
    tileset: opts.style?.tileset,
    backgroundColor: opts.style?.backgroundColor,
    heroX: opts.heroX ?? 0,
    heroY: opts.heroY ?? 0,
    title: opts.title,
    procgen_type: opts.procgenType,
    layers,
    events: opts.events || [],
  });
  return exported.text;
}

export function buildRoomMapText(opts: {
  width: number;
  height: number;
  type: DungeonCardType;
  style?: MapStyle;
  title?: string;
}): string {
  const width = Math.max(1, Math.floor(opts.width) || DEFAULT_ROOM_SIZE);
  const height = Math.max(1, Math.floor(opts.height) || DEFAULT_ROOM_SIZE);
  return mapText({
    width,
    height,
    style: opts.style,
    procgenType: opts.type,
    title: opts.title,
    heroX: Math.floor((width - 1) / 2),
    heroY: Math.floor((height - 1) / 2),
  });
}

export function buildOpeningsMapText(opts: { width: number; height: number; style?: MapStyle; title?: string }): string {
  const width = Math.max(1, Math.floor(opts.width) || DEFAULT_ROOM_SIZE);
  const height = Math.max(1, Math.floor(opts.height) || DEFAULT_ROOM_SIZE);
  const rects = linkRectsForSize(width, height);
  const events = (Object.keys(rects) as LinkSide[]).map((side) => {
    const rect = rects[side];
    return {
      type: 'event',
      location: `${rect.x},${rect.y},${rect.w},${rect.h}`,
      procgen_link: side,
    };
  });
  return mapText({
    width,
    height,
    style: opts.style,
    procgenType: 'links',
    title: opts.title || 'Openings',
    heroX: Math.floor((width - 1) / 2),
    heroY: Math.floor((height - 1) / 2),
    events,
  });
}

export function buildHostMapText(opts: {
  roomWidth: number;
  roomHeight: number;
  rulesPath: string;
  style?: MapStyle;
  title?: string;
  grid?: number;
}): string {
  const roomW = Math.max(1, Math.floor(opts.roomWidth) || DEFAULT_ROOM_SIZE);
  const roomH = Math.max(1, Math.floor(opts.roomHeight) || DEFAULT_ROOM_SIZE);
  const host = hostDimensions(roomW, roomH, opts.grid ?? DEFAULT_GRID);
  const loc = host.event;
  return mapText({
    width: host.width,
    height: host.height,
    style: opts.style,
    title: opts.title,
    heroX: 0,
    heroY: 0,
    events: [
      {
        type: 'event',
        location: `${loc.x},${loc.y},${loc.w},${loc.h}`,
        procgen_filename: opts.rulesPath,
      },
    ],
  });
}

export function buildDungeonRulesFile(opts: {
  settings?: Record<string, string>;
  rooms: string[];
  openingsPath: string;
}): ProcgenFile {
  const settings = { ...DEFAULT_DUNGEON_SETTINGS, ...(opts.settings || {}) };
  const keys: ProcgenKey[] = Object.entries(settings).map(([key, value]) => ({ key, value, comment: '' }));
  const filenames = [opts.openingsPath, ...opts.rooms].filter((path, index, list) => path && list.indexOf(path) === index);
  return {
    header: '',
    parts: [
      { kind: 'settings', keys, comment: '' },
      { kind: 'chunks', keys: filenames.map((value) => ({ key: 'filename', value, comment: '' })), comment: '' },
    ],
    trailing: '',
  };
}

export function rulesRoomPaths(file: ProcgenFile): string[] {
  return collectChunkFilenames(file).map((path) => path.replace(/\\/g, '/'));
}

export function withRulesRooms(file: ProcgenFile, rooms: string[], openingsPath: string): ProcgenFile {
  const next = buildDungeonRulesFile({
    settings: Object.fromEntries(
      file.parts
        .filter((part): part is Extract<ProcgenFile['parts'][number], { kind: 'settings' }> => part.kind === 'settings')
        .flatMap((part) => part.keys)
        .filter((row) => row.key && row.value)
        .map((row) => [row.key, row.value]),
    ),
    rooms,
    openingsPath,
  });
  return { ...next, header: file.header, trailing: file.trailing };
}

export function cardTypeOf(type: string): DungeonCardType | null {
  if (type === 'start' || type === 'normal' || type === 'end') return type;
  return null;
}

export function roomsForCard(rooms: DungeonRoom[], type: DungeonCardType): DungeonRoom[] {
  return rooms.filter((room) => room.type === type);
}

export function intermapForHost(hostRel: string): string {
  const path = hostRel.replace(/\\/g, '/');
  const withMaps = path.startsWith('maps/') ? path : `maps/${path}`;
  const withExt = withMaps.toLowerCase().endsWith('.txt') ? withMaps : `${withMaps}.txt`;
  return withExt;
}

/** maps/slug.txt or maps/slug.txt,x,y → slug when it looks like a dungeon host path. */
export function dungeonSlugFromIntermap(intermap: string): string | null {
  const raw = String(intermap || '').trim().replace(/\\/g, '/');
  if (!raw) return null;
  const mapPath = raw.split(',')[0].trim();
  const match = mapPath.match(/^maps\/([^/]+)\.txt$/i);
  if (!match) return null;
  const slug = match[1];
  if (!slug || slug.toLowerCase() === 'spawn') return null;
  return slug;
}

export function roomLabel(room: DungeonRoom): string {
  if (room.title.trim()) return room.title.trim();
  const leaf = room.path.replace(/\\/g, '/').split('/').pop() || room.path;
  return leaf.replace(/\.txt$/i, '').replace(/_/g, ' ');
}

export function parseRequiresFromProjectFiles(projectJson: string, settingsTxt = ''): string[] {
  const fromJson = parseProjectRequires(projectJson);
  const fromSettings = parseModSettings(settingsTxt).requires.map((row) => row.name.trim()).filter(Boolean);
  const out: string[] = [];
  for (const name of [...fromSettings, ...fromJson]) {
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

async function listTxtUnderAbs(absDir: string, readDir: DungeonFs['readDir']): Promise<string[]> {
  if (!readDir) return [];
  const out: string[] = [];
  const walk = async (dir: string, prefix: string) => {
    const entries = (await readDir(dir).catch(() => [])) || [];
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory) await walk(`${dir}/${entry.name}`, rel);
      else if (entry.name.toLowerCase().endsWith('.txt')) out.push(rel);
    }
  };
  await walk(absDir.replace(/\\/g, '/'), '');
  return out.sort();
}

/** Project and required-mod maps that declare a start/normal/end (or links) procgen_type. */
export async function listProcgenMaps(opts: {
  projectPath: string;
  flarePath: string | null;
  fs: DungeonFs;
  types?: string[];
}): Promise<DungeonRoom[]> {
  const root = projectRoot(opts.projectPath);
  const requires = parseRequiresFromProjectFiles(
    (await opts.fs.readFile(`${root}/project.json`).catch(() => '')) || '',
    (await opts.fs.readFile(`${root}/settings.txt`).catch(() => '')) || '',
  );
  const types = new Set((opts.types || [...CARD_TYPES]).map((type) => type.toLowerCase()));
  const dirs = candidateEnginePaths({
    projectRoot: root,
    flarePath: opts.flarePath,
    requires,
    relative: 'maps',
  });
  const found = new Map<string, DungeonRoom>();
  for (const dir of dirs) {
    const names = await listTxtUnderAbs(dir, opts.fs.readDir);
    for (const rel of names) {
      const path = `maps/${rel}`.replace(/\/+/g, '/');
      if (path.startsWith(`${PROCGEN_RULES_DIR}/`)) continue;
      if (found.has(path)) continue;
      const text = (await opts.fs.readFile(`${dir}/${rel}`).catch(() => '')) || '';
      const header = parseMapHeader(text);
      const type = (header.procgenType || parseMapProcgenType(text)).toLowerCase();
      if (!type || !types.has(type)) continue;
      found.set(path, {
        path,
        type,
        width: header.width,
        height: header.height,
        title: header.title,
      });
    }
  }
  return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function serializeDungeonRules(file: ProcgenFile): string {
  return serializeProcgenFile(file);
}

export { parseProcgenFile, serializeProcgenFile };
