import type { MapObject } from '@/types';
import { importMapText, slugFileName } from '@/adapters/flare/flareAdapter.cjs';

/** One placed copy of an NPC definition on a project map. */
export type NpcInstance = {
  /** Normalized NPC file the instance points at, e.g. "npcs/guard.txt". */
  file: string;
  mapTitle: string;
  mapFile: string;
  x: number;
  y: number;
};

const asText = (value: unknown): string => {
  if (Array.isArray(value)) return value.length > 0 ? String(value[0] ?? '') : '';
  return value == null ? '' : String(value);
};

/**
 * Flare references NPCs by their file (`npcs/x.txt`). Normalize map records and
 * Studio objects to the same key so counts line up.
 */
export function normalizeNpcFile(value: unknown): string {
  const path = asText(value).trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!path) return '';
  // Absolute paths cannot be project-relative NPC references.
  if (/^[a-z]:\//i.test(path) || path.startsWith('/')) return '';
  const lower = path.toLowerCase();
  const relative = lower.startsWith('content/') ? lower.slice('content/'.length) : lower;
  const withFolder = relative.includes('/') ? relative : `npcs/${relative}`;
  return withFolder.endsWith('.txt') ? withFolder : `${withFolder}.txt`;
}

/** The NPC definition a sidebar entry belongs to. */
export function npcFileForActor(actor: Partial<Pick<MapObject, 'name' | 'properties'>>): string {
  const properties = (actor.properties ?? {}) as Record<string, unknown>;
  const explicit = normalizeNpcFile(properties.npcFilename);
  if (explicit) return explicit;
  // Placed/imported map NPCs keep their map `filename` key in properties.
  const fromMap = normalizeNpcFile(properties.filename);
  if (fromMap) return fromMap;
  // New NPCs have no file yet; export writes npcs/<slug>.txt from the name.
  return normalizeNpcFile(`npcs/${slugFileName(actor.name || 'npc')}`);
}

function locationXY(value: unknown): { x: number; y: number } | null {
  const parts = asText(value).split(',').map((part) => parseInt(part.trim(), 10));
  if (!Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  if (parts[0] < 0 || parts[1] < 0) return null;
  return { x: parts[0], y: parts[1] };
}

/** An NPC MapObject counts only when it is placed on a map (unplaced templates are not instances). */
export function npcInstanceFromObject(
  object: Partial<MapObject>,
  mapFile: string,
  mapTitle: string,
): NpcInstance | null {
  if (object.type !== 'npc') return null;
  const x = Number(object.x);
  const y = Number(object.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return null;
  const file = npcFileForActor({
    name: String(object.name ?? ''),
    properties: (object.properties ?? {}) as Record<string, string | string[]>,
  });
  if (!file) return null;
  return { file, mapFile, mapTitle: mapTitle || mapFile, x: Math.trunc(x), y: Math.trunc(y) };
}

/** An [npc] section of an exported Flare map (`maps/*.txt`). */
export function npcInstanceFromMapRecord(
  record: Record<string, unknown>,
  mapFile: string,
  mapTitle: string,
): NpcInstance | null {
  const position = locationXY(record.location);
  if (!position) return null;
  const file = normalizeNpcFile(record.filename ?? record.npcFilename);
  if (!file) return null;
  return { file, mapFile, mapTitle: mapTitle || mapFile, x: position.x, y: position.y };
}

/** Editor map files (`<name>.json`) store the same MapObjects the sidebar shows. */
export function npcInstancesFromMapProject(jsonText: string, mapFile: string): NpcInstance[] {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    return [];
  }
  const title = asText(data.mapName) || asText(data.name) || mapFile.replace(/\.json$/i, '');
  const objects = Array.isArray(data.objects) ? (data.objects as Array<Partial<MapObject>>) : [];
  return objects
    .map((object) => npcInstanceFromObject(object, mapFile, title))
    .filter((instance): instance is NpcInstance => instance !== null);
}

/** Exported Flare maps (`maps/*.txt`). */
export function npcInstancesFromMapText(text: string, mapFile: string): NpcInstance[] {
  let map: { title?: unknown; npcs?: Array<Record<string, unknown>> };
  try {
    map = importMapText(text) as { title?: unknown; npcs?: Array<Record<string, unknown>> };
  } catch {
    return [];
  }
  const title = asText(map.title) || mapFile.replace(/\.txt$/i, '');
  return (map.npcs ?? [])
    .map((record) => npcInstanceFromMapRecord(record, mapFile, title))
    .filter((instance): instance is NpcInstance => instance !== null);
}

export function dedupeNpcInstances(instances: NpcInstance[]): NpcInstance[] {
  const seen = new Set<string>();
  const unique: NpcInstance[] = [];
  for (const instance of instances) {
    const key = `${instance.file}|${instance.mapFile}|${instance.x},${instance.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(instance);
  }
  return unique;
}

export function sortNpcInstances(instances: NpcInstance[]): NpcInstance[] {
  return [...instances].sort(
    (a, b) =>
      a.mapTitle.localeCompare(b.mapTitle) ||
      a.y - b.y ||
      a.x - b.x ||
      a.file.localeCompare(b.file),
  );
}

export function npcInstancesForFile(instances: NpcInstance[], file: string): NpcInstance[] {
  if (!file) return [];
  return sortNpcInstances(instances.filter((instance) => instance.file === file));
}

export function npcInstanceCounts(instances: NpcInstance[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const instance of instances) {
    counts.set(instance.file, (counts.get(instance.file) ?? 0) + 1);
  }
  return counts;
}
