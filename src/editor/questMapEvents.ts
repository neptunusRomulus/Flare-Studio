/**
 * Map events that set statuses, for the Quest Map (e.g. a book that starts
 * the main quest). Reads exported Flare maps and Studio map objects alike.
 */
import { importMapText } from '@/adapters/flare/flareAdapter.cjs';
import type { QuestMapEventInput } from '@/editor/questMap';

const text = (value: unknown): string =>
  Array.isArray(value) ? value.map((v) => String(v ?? '')).join('\n') : value == null ? '' : String(value);

function statuses(value: unknown): string[] {
  return Array.from(new Set(text(value).split(/[,\n]/).map((s) => s.trim()).filter(Boolean)));
}

/** A Flare [event] record or a Studio event MapObject → event source, or null when it sets no status. */
export function questMapEventFromRecord(
  record: Record<string, unknown>,
  mapFile: string,
  mapTitle: string,
  index: number,
): QuestMapEventInput | null {
  const props = (record.properties && typeof record.properties === 'object' ? record.properties : {}) as Record<string, unknown>;
  const pick = (key: string) => (record[key] !== undefined && record[key] !== '' ? record[key] : props[key]);
  const sets = statuses(pick('set_status'));
  if (!sets.length) return null;
  let x = Number(record.x);
  let y = Number(record.y);
  const location = text(pick('location'));
  if (location) {
    const parts = location.split(',').map((p) => parseInt(p.trim(), 10));
    if (Number.isFinite(parts[0]) && Number.isFinite(parts[1])) [x, y] = parts;
  }
  const placed = Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0;
  const tooltip = text(pick('tooltip')).trim();
  const name = (tooltip && tooltip.toLowerCase() !== 'event' ? tooltip : '') || text(record.name).trim() || 'Map event';
  return {
    id: `${mapFile}#${index}`,
    name: name.toLowerCase() === 'event' ? 'Map event' : name,
    mapTitle: mapTitle || mapFile,
    x: placed ? Math.trunc(x) : -1,
    y: placed ? Math.trunc(y) : -1,
    sets,
  };
}

/** Exported Flare maps (`maps/*.txt`). */
export function questMapEventsFromMapText(content: string, mapFile: string): QuestMapEventInput[] {
  let map: { title?: unknown; events?: Array<Record<string, unknown>> };
  try {
    map = importMapText(content) as typeof map;
  } catch {
    return [];
  }
  const title = text(map.title) || mapFile.replace(/\.txt$/i, '');
  return (map.events || [])
    .map((record, i) => questMapEventFromRecord(record, mapFile, title, i))
    .filter((e): e is QuestMapEventInput => e !== null);
}

/** Studio map files (`<name>.json`) or the open map's live objects. */
export function questMapEventsFromObjects(objects: Array<Record<string, unknown>>, mapFile: string, mapTitle: string): QuestMapEventInput[] {
  return objects
    .map((object, i) => (object?.type === 'event' ? questMapEventFromRecord(object, mapFile, mapTitle, Number(object.id ?? i)) : null))
    .filter((e): e is QuestMapEventInput => e !== null);
}

export function questMapEventsFromMapProject(jsonText: string, mapFile: string): QuestMapEventInput[] {
  try {
    const data = JSON.parse(jsonText) as Record<string, unknown>;
    const title = text(data.mapName) || text(data.name) || mapFile.replace(/\.json$/i, '');
    return questMapEventsFromObjects(Array.isArray(data.objects) ? (data.objects as Array<Record<string, unknown>>) : [], mapFile, title);
  } catch {
    return [];
  }
}
