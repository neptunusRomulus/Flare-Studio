/**
 * "Start with template": NPC and enemy looks from fantasycore are listed for the
 * Edit NPC / Edit Enemy appearance pickers only. They are not turned into project
 * entities or copied as enemies/*.txt — the enemy list of a new project starts empty.
 *
 * Paths stay mod-relative ("animations/npcs/knight.txt", "animations/enemies/goblin.txt"):
 * projects require fantasycore, so Flare resolves them at Play/export without copies.
 */
import type { MapObject } from '@/types';

export type TemplateActorListing = {
  ok: boolean;
  error?: string;
  mod?: string;
  modDir?: string;
  npcLooks: Array<{ key: string; animation: string; image: string | null; imagePath: string | null }>;
  /** fantasycore images/portraits/*.png (mod-relative path + absolute imagePath for thumbnails). */
  portraits?: Array<{ key: string; path: string; imagePath: string | null }>;
  /** fantasycore animations/enemies/*.txt, with the first stance frame rect for thumbnails. */
  enemyLooks?: Array<{
    key: string;
    animation: string;
    image: string | null;
    imagePath: string | null;
    frame: { x: number; y: number; w: number; h: number } | null;
  }>;
  npcs: Array<{ key: string; file: string; raw: string }>;
  enemies: Array<{ key: string; file: string; raw: string; isBase: boolean }>;
  missing: string[];
};

export type PlannedActor = {
  type: 'npc' | 'enemy';
  importKey: string;
  name: string;
  category?: string;
  properties: Record<string, string>;
  /** Project file to create (only when missing), e.g. a minimal enemy definition. */
  file?: { rel: string; content: string };
};

export type ActorImportResult = { npcs: number; enemies: number; skipped: number; files: number; missing: string[]; rawOnly: string[] };

export function titleFromKey(key: string): string {
  return key.replace(/[_-]+/g, ' ').replace(/\d+$/, (d) => ` ${d}`).replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Minimal enemy definition on top of a fantasycore base (looks + sounds come from the INCLUDE). */
export function enemyFileFromBase(baseRel: string, key: string): string {
  return [
    '# Imported from the fantasycore template by Flare Studio',
    `INCLUDE ${baseRel}`,
    `name=${titleFromKey(key)}`,
    `categories=${key}`,
    'level=1',
    '',
  ].join('\n');
}

/** Template listings no longer pre-create enemy entities; looks stay in the appearance picker. */
export function planTemplateActors(_listing: TemplateActorListing): PlannedActor[] {
  return [];
}

/** Drop planned entities already in the project (same import key or enemy file). */
export function dedupeActors(planned: PlannedActor[], existing: Array<Pick<MapObject, 'type' | 'properties' | 'name'>>, existingFiles: Set<string>) {
  const keys = new Set<string>();
  for (const o of existing) {
    const p = (o.properties || {}) as Record<string, unknown>;
    if (typeof p.importKey === 'string') keys.add(p.importKey);
  }
  const keep: PlannedActor[] = [];
  let skipped = 0;
  for (const a of planned) {
    if (keys.has(a.importKey)) { skipped++; continue; }
    keys.add(a.importKey);
    keep.push(a.file && existingFiles.has(a.file.rel) ? { ...a, file: undefined } : a);
  }
  return { keep, skipped };
}

type ActorEditor = {
  getMapObjects: () => MapObject[];
  addMapObject: (type: 'npc' | 'enemy', x: number, y: number, w?: number, h?: number) => MapObject;
  updateMapObject: (id: number, updates: Partial<MapObject>) => boolean;
};

/** Kept for compatibility: listings are used by the appearance pickers; this no longer adds entities. */
export async function importTemplateActors(
  editor: ActorEditor,
  flarePath: string,
  projectPath: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ActorImportResult> {
  const result: ActorImportResult = { npcs: 0, enemies: 0, skipped: 0, files: 0, missing: [], rawOnly: [] };
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (!api?.listTemplateActors) return result;
  const listing = await api.listTemplateActors(flarePath);
  if (!listing.ok) return result;
  result.missing = listing.missing;
  // fantasycore npcs/*.txt stay in the mod (picker uses animations/npcs looks); report paths only.
  result.rawOnly = listing.npcs.map(n => n.file);
  const root = projectPath.replace(/\\/g, '/').replace(/\/$/, '');
  const existingFiles = new Set<string>();
  for (const a of planTemplateActors(listing)) {
    if (a.file && api.fileExists && await api.fileExists(`${root}/${a.file.rel}`)) existingFiles.add(a.file.rel);
  }
  const { keep, skipped } = dedupeActors(planTemplateActors(listing), editor.getMapObjects(), existingFiles);
  result.skipped = skipped;
  onProgress?.(0, keep.length);
  let done = 0;
  for (const a of keep) {
    if (a.file && api.writeFile) {
      if (await api.writeFile(`${root}/${a.file.rel}`, a.file.content)) result.files++;
    }
    const obj = editor.addMapObject(a.type, -1, -1, 1, 1);
    editor.updateMapObject(obj.id, {
      name: a.name,
      x: -1,
      y: -1,
      category: a.type === 'npc' ? 'npc' : (a.category || ''),
      properties: { ...(obj.properties || {}), ...a.properties, importKey: a.importKey },
    });
    if (a.type === 'npc') result.npcs++; else result.enemies++;
    onProgress?.(++done, keep.length);
  }
  return result;
}
