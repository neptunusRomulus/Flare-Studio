/**
 * Flare 1.15 icon atlas helpers.
 *
 * engine/resolutions.txt `icon_size` is the cell size (default 32 if missing or 0).
 * The engine loads a gapless grid: columns = width / icon_size, rows = height / icon_size
 * (integer division; leftover pixels are ignored). Index mapping:
 *   offset = icon_id - first_id
 *   col = offset % columns, row = offset / columns
 * Default set, when engine/icons.txt has no icon_set, is images/icons/icons.png at first_id 0.
 *
 * A project file at the same path completely replaces a required-mod file, so this
 * module never copies a mod atlas into the project and will refuse to create a
 * project icons.png when that would hide inherited icon= indexes.
 *
 * Appending must keep the existing column count. New indexes start after the last
 * cell of the current image (existingCellCount), never by filling holes.
 */
import { parseSectionFile, setBlockValue } from '@/editor/powers/sectionFile';
import { parseIconsFile } from '@/editor/uiEngine';

export const ICONS_PNG = 'images/icons/icons.png';
export const STUDIO_ICONS_DIR = 'images/icons/studio';
export const STUDIO_ICON_MAP_PATH = 'content/icons/studio-map.json';
export const DEFAULT_ICON_SIZE = 32;
export const DEFAULT_ATLAS_COLUMNS = 16;
export const ICON_ATLAS_MAP_VERSION = 1 as const;

export const MOD_ATLAS_OVERRIDE_WARNING =
  "Can't build a project icon atlas: this project has no own icons.png, and existing icon= values still refer to a required mod's icons. A new project icons.png would replace that atlas and break those icons. Imported images are kept, but were not packed.";

export const INHERIT_ATLAS_WARNING =
  "This project uses icons from a required mod. Creating a project icons.png would replace that atlas and change those icons everywhere they are used. Import is available in Start from scratch projects.";

export const MOD_OVERRIDE_BUILD_WARNING =
  "A new project icons.png would replace the required mod's atlas in the game. Confirm that before it can be packed.";

export type StudioIconOwner = { kind: 'power' | 'effect'; id: string };

export type StudioIconMap = {
  version: typeof ICON_ATLAS_MAP_VERSION;
  sources: Record<string, string>;
  indexes: Record<string, number>;
  pending: string[];
  modOverrideConfirmed?: boolean;
};

export function ownerKey(kind: 'power' | 'effect', id: string): string {
  return `${kind}:${String(id || '').trim()}`;
}

export function parseOwnerKey(key: string): StudioIconOwner | null {
  const match = String(key || '').match(/^(power|effect):(.+)$/);
  if (!match) return null;
  return { kind: match[1] as 'power' | 'effect', id: match[2] };
}

export function emptyStudioIconMap(): StudioIconMap {
  return { version: ICON_ATLAS_MAP_VERSION, sources: {}, indexes: {}, pending: [] };
}

export function parseStudioIconMap(text: string | null | undefined): StudioIconMap {
  const empty = emptyStudioIconMap();
  if (!text || !String(text).trim()) return empty;
  try {
    const raw = JSON.parse(String(text)) as Partial<StudioIconMap>;
    const sources: Record<string, string> = {};
    const indexes: Record<string, number> = {};
    if (raw.sources && typeof raw.sources === 'object') {
      for (const [key, value] of Object.entries(raw.sources)) {
        if (typeof value === 'string' && value.trim()) sources[key] = value.replace(/\\/g, '/').replace(/^\/+/, '');
      }
    }
    if (raw.indexes && typeof raw.indexes === 'object') {
      for (const [key, value] of Object.entries(raw.indexes)) {
        const num = Number(value);
        if (Number.isInteger(num) && num >= 0) indexes[key] = num;
      }
    }
    const pending = Array.isArray(raw.pending)
      ? [...new Set(raw.pending.map((entry) => String(entry)).filter((key) => key in sources))]
      : [];
    return {
      version: ICON_ATLAS_MAP_VERSION,
      sources,
      indexes,
      pending,
      ...(raw.modOverrideConfirmed ? { modOverrideConfirmed: true } : {}),
    };
  } catch {
    return empty;
  }
}

export function serializeStudioIconMap(map: StudioIconMap): string {
  const pending = [...new Set(map.pending.filter((key) => key in map.sources))].sort();
  const sources = sortRecord(map.sources);
  const indexes = sortRecord(map.indexes);
  return `${JSON.stringify({
    version: ICON_ATLAS_MAP_VERSION,
    sources,
    indexes,
    pending,
    ...(map.modOverrideConfirmed ? { modOverrideConfirmed: true } : {}),
  }, null, 2)}\n`;
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(record).sort()) out[key] = record[key];
  return out;
}

export function parseIconSize(resolutionsText: string | null | undefined): number {
  for (const raw of String(resolutionsText || '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    if (line.slice(0, eq).trim() !== 'icon_size') continue;
    const value = Number(line.slice(eq + 1).trim());
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
  }
  return DEFAULT_ICON_SIZE;
}

export function uniqueStudioFileName(desired: string, used: Iterable<string>): string {
  const taken = new Set([...used].map((name) => name.toLowerCase()));
  const base = String(desired || '').replace(/\\/g, '/').split('/').pop() || 'icon.png';
  const stemRaw = base.toLowerCase().endsWith('.png') ? base.slice(0, -4) : base;
  const stem = stemRaw.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'icon';
  const first = `${stem}.png`;
  if (!taken.has(first.toLowerCase())) return first;
  let index = 2;
  while (taken.has(`${stem}_${index}.png`.toLowerCase())) index += 1;
  return `${stem}_${index}.png`;
}

export function atlasMetrics(width: number, height: number, iconSize: number): { columns: number; rows: number; cellCount: number } {
  const size = iconSize > 0 ? iconSize : DEFAULT_ICON_SIZE;
  const columns = Math.max(1, Math.floor(Math.max(0, width) / size) || 1);
  const rows = Math.max(0, Math.floor(Math.max(0, height) / size));
  return { columns, rows, cellCount: columns * rows };
}

export type IconWorkflow = 'inherit' | 'author';

export function parseStudioStart(projectJson: string | null | undefined): 'scratch' | 'template' | null {
  try {
    const parsed = JSON.parse(String(projectJson || '')) as { meta?: { studioStart?: unknown }; studioStart?: unknown };
    const raw = parsed.meta?.studioStart ?? parsed.studioStart;
    if (raw === 'scratch' || raw === 'template') return raw;
  } catch {
    /* ignore malformed project.json */
  }
  return null;
}

export function resolveIconWorkflow(opts: {
  studioStart?: 'scratch' | 'template' | null;
  projectHasAtlas: boolean;
  requiredModProvidesIcons: boolean;
}): { workflow: IconWorkflow; source: 'marker' | 'derived' } {
  if (opts.studioStart === 'scratch') return { workflow: 'author', source: 'marker' };
  if (opts.studioStart === 'template') return { workflow: 'inherit', source: 'marker' };
  if (!opts.projectHasAtlas && opts.requiredModProvidesIcons) return { workflow: 'inherit', source: 'derived' };
  return { workflow: 'author', source: 'derived' };
}

export function shouldSkipProjectAtlasBuild(opts: {
  workflow: IconWorkflow;
  projectHasAtlas: boolean;
  importedSourceCount: number;
  requiredModProvidesIcons?: boolean;
  overrideConfirmed?: boolean;
}): { skip: boolean; reason: string | null } {
  if (opts.projectHasAtlas) return { skip: false, reason: null };
  if (opts.importedSourceCount <= 0) return { skip: false, reason: null };
  if (opts.workflow === 'inherit') return { skip: true, reason: INHERIT_ATLAS_WARNING };
  if (opts.requiredModProvidesIcons && !opts.overrideConfirmed) return { skip: true, reason: MOD_OVERRIDE_BUILD_WARNING };
  return { skip: false, reason: null };
}

const ICON_LINE = /^\s*icon\s*=\s*(-?\d+)\s*$/;

export function countNumericIconRefs(files: Record<string, string>): number {
  let count = 0;
  for (const text of Object.values(files)) {
    for (const line of String(text || '').split('\n')) {
      if (ICON_LINE.test(line)) count += 1;
    }
  }
  return count;
}

export function resolveProjectIconAtlas(opts: {
  projectHasFile: (rel: string) => boolean;
  iconsTxt?: string | null;
}): { rel: string; firstId: number; exists: boolean } {
  const sets = parseIconsFile(opts.iconsTxt || '').sets
    .map((set) => ({
      rel: set.file.replace(/\\/g, '/').replace(/^\/+/, ''),
      firstId: Number(set.firstId),
    }))
    .filter((set) => set.rel);
  const existing = sets.filter((set) => Number.isInteger(set.firstId) && set.firstId >= 0 && opts.projectHasFile(set.rel));
  const preferred = existing.find((set) => set.rel === ICONS_PNG) || existing[0];
  if (preferred) return { rel: preferred.rel, firstId: preferred.firstId, exists: true };
  if (opts.projectHasFile(ICONS_PNG)) return { rel: ICONS_PNG, firstId: 0, exists: true };
  const listed = sets.find((set) => set.rel === ICONS_PNG && Number.isInteger(set.firstId) && set.firstId >= 0);
  return { rel: ICONS_PNG, firstId: listed?.firstId ?? 0, exists: false };
}

export type PackedIconCell = { pixels: Uint8ClampedArray; index?: number };

export type PackedIconAtlas = {
  width: number;
  height: number;
  columns: number;
  rows: number;
  firstId: number;
  existingCellCount: number;
  pixels: Uint8ClampedArray;
  assignments: number[];
};

export function packIconAtlas(opts: {
  iconSize: number;
  firstId?: number;
  defaultColumns?: number;
  existing?: { width: number; height: number; pixels: Uint8ClampedArray } | null;
  cells: PackedIconCell[];
}): PackedIconAtlas {
  const iconSize = opts.iconSize > 0 ? Math.floor(opts.iconSize) : DEFAULT_ICON_SIZE;
  const firstId = Number.isInteger(opts.firstId) && (opts.firstId || 0) >= 0 ? Math.floor(opts.firstId || 0) : 0;
  const existing = opts.existing && opts.existing.width > 0 && opts.existing.height > 0 ? opts.existing : null;
  const metrics = existing
    ? atlasMetrics(existing.width, existing.height, iconSize)
    : { columns: Math.max(1, opts.defaultColumns || DEFAULT_ATLAS_COLUMNS), rows: 0, cellCount: 0 };
  const columns = metrics.columns;
  let nextRel = metrics.cellCount;
  const assignments: number[] = [];
  const writes: Array<{ rel: number; pixels: Uint8ClampedArray }> = [];

  for (const cell of opts.cells) {
    const requested = cell.index;
    const rel = requested != null && Number.isInteger(requested) ? requested - firstId : -1;
    if (rel >= 0 && rel < metrics.cellCount) {
      assignments.push(firstId + rel);
      writes.push({ rel, pixels: cell.pixels });
      continue;
    }
    assignments.push(firstId + nextRel);
    writes.push({ rel: nextRel, pixels: cell.pixels });
    nextRel += 1;
  }

  const rows = Math.max(metrics.rows, Math.ceil(nextRel / columns) || 0);
  const width = columns * iconSize;
  const height = rows * iconSize;
  const pixels = new Uint8ClampedArray(width * height * 4);

  if (existing) {
    for (let rel = 0; rel < metrics.cellCount; rel += 1) {
      copyCell(pixels, width, columns, iconSize, rel, readCell(existing.pixels, existing.width, columns, iconSize, rel));
    }
  }
  for (const write of writes) {
    copyCell(pixels, width, columns, iconSize, write.rel, normalizeIconCell(write.pixels, iconSize, iconSize, iconSize));
  }

  return {
    width,
    height,
    columns,
    rows,
    firstId,
    existingCellCount: metrics.cellCount,
    pixels,
    assignments,
  };
}

export function normalizeIconCell(
  src: Uint8ClampedArray | ArrayLike<number>,
  srcW: number,
  srcH: number,
  size: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(Math.max(0, size) * Math.max(0, size) * 4);
  if (size <= 0 || srcW <= 0 || srcH <= 0) return out;
  if (srcW === size && srcH === size) {
    const expected = size * size * 4;
    return src.length === expected ? new Uint8ClampedArray(src) : copyInto(out, src, expected);
  }
  const scale = Math.min(size / srcW, size / srcH);
  const destW = Math.max(1, Math.round(srcW * scale));
  const destH = Math.max(1, Math.round(srcH * scale));
  const offsetX = Math.floor((size - destW) / 2);
  const offsetY = Math.floor((size - destH) / 2);
  for (let y = 0; y < destH; y += 1) {
    const srcY = Math.min(srcH - 1, Math.floor((y + 0.5) / scale));
    for (let x = 0; x < destW; x += 1) {
      const srcX = Math.min(srcW - 1, Math.floor((x + 0.5) / scale));
      const srcIndex = (srcY * srcW + srcX) * 4;
      const destIndex = ((offsetY + y) * size + (offsetX + x)) * 4;
      out[destIndex] = Number(src[srcIndex] || 0);
      out[destIndex + 1] = Number(src[srcIndex + 1] || 0);
      out[destIndex + 2] = Number(src[srcIndex + 2] || 0);
      out[destIndex + 3] = Number(src[srcIndex + 3] || 0);
    }
  }
  return out;
}

function copyInto(out: Uint8ClampedArray, src: ArrayLike<number>, expected: number): Uint8ClampedArray {
  const length = Math.min(out.length, expected, src.length);
  for (let i = 0; i < length; i += 1) out[i] = Number(src[i] || 0);
  return out;
}

function readCell(
  pixels: Uint8ClampedArray,
  width: number,
  columns: number,
  size: number,
  rel: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  const col = rel % columns;
  const row = Math.floor(rel / columns);
  const originX = col * size;
  const originY = row * size;
  for (let y = 0; y < size; y += 1) {
    const srcRow = ((originY + y) * width + originX) * 4;
    out.set(pixels.subarray(srcRow, srcRow + size * 4), y * size * 4);
  }
  return out;
}

function copyCell(
  dest: Uint8ClampedArray,
  destWidth: number,
  columns: number,
  size: number,
  rel: number,
  src: Uint8ClampedArray,
): void {
  const col = rel % columns;
  const row = Math.floor(rel / columns);
  const originX = col * size;
  const originY = row * size;
  const cell = src.length === size * size * 4 ? src : normalizeIconCell(src, size, size, size);
  for (let y = 0; y < size; y += 1) {
    const destRow = ((originY + y) * destWidth + originX) * 4;
    dest.set(cell.subarray(y * size * 4, (y + 1) * size * 4), destRow);
  }
}

export function cropIconCell(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  iconSize: number,
  iconId: number,
  firstId = 0,
): Uint8ClampedArray | null {
  const metrics = atlasMetrics(width, height, iconSize);
  const rel = iconId - firstId;
  if (rel < 0 || rel >= metrics.cellCount) return null;
  return readCell(pixels, width, metrics.columns, iconSize, rel);
}

export function sectionForPowerPath(path: string): 'power' | 'effect' | null {
  const rel = String(path || '').replace(/\\/g, '/').replace(/^\.\//, '');
  if (/(^|\/)powers\/effects\.txt$/.test(rel) || /(^|\/)effects\.txt$/.test(rel)) return 'effect';
  if (/(^|\/)powers\//.test(rel)) return 'power';
  return null;
}

export function applyIconAssignments(text: string, section: 'power' | 'effect', assignments: Record<string, number>): string {
  const file = parseSectionFile(text, section);
  const ops: Array<{ index: number; value: string }> = [];
  file.blocks.forEach((block, index) => {
    const key = ownerKey(section, block.id);
    if (Object.prototype.hasOwnProperty.call(assignments, key)) ops.push({ index, value: String(assignments[key]) });
  });
  let out = text;
  for (const op of ops.reverse()) out = setBlockValue(out, section, op.index, 'icon', op.value);
  return out;
}

export function applyIconAssignmentsToFiles(
  files: Record<string, string>,
  assignments: Record<string, number>,
): Record<string, string> {
  const next: Record<string, string> = { ...files };
  for (const [path, text] of Object.entries(files)) {
    const section = sectionForPowerPath(path);
    if (!section) continue;
    const updated = applyIconAssignments(text, section, assignments);
    if (updated !== text) next[path] = updated;
  }
  return next;
}

export function markPending(map: StudioIconMap, key: string, sourceRel: string): StudioIconMap {
  const sources = { ...map.sources, [key]: sourceRel.replace(/\\/g, '/') };
  const pending = [...new Set([...map.pending, key])];
  return { ...map, sources, pending };
}

export function applyPackedAssignments(map: StudioIconMap, packed: Record<string, number>): StudioIconMap {
  const indexes = { ...map.indexes, ...packed };
  const pending = map.pending.filter((key) => !(key in packed));
  return { ...map, indexes, pending };
}

export function mapsEqual(a: StudioIconMap, b: StudioIconMap): boolean {
  return serializeStudioIconMap(a) === serializeStudioIconMap(b);
}
