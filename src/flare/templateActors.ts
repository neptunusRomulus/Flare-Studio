/**
 * "Start with template": bring fantasycore's NPC looks and enemy definitions into the
 * new project as (unplaced) Entities, next to the tileset import.
 *
 * Paths stay mod-relative ("animations/npcs/knight.txt", "enemies/base/goblin.txt"):
 * projects require fantasycore, so Flare resolves them at Play/export without copies.
 */
import type { MapObject } from '@/types';

export type TemplateActorListing = {
  ok: boolean;
  error?: string;
  mod?: string;
  modDir?: string;
  npcLooks: Array<{ key: string; animation: string; image: string | null; imagePath: string | null }>;
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

function firstValue(text: string, key: string): string | null {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim();
  }
  return null;
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

/** Entities to create for a template listing (pure). */
export function planTemplateActors(listing: TemplateActorListing): PlannedActor[] {
  const mod = listing.mod || 'fantasycore';
  const out: PlannedActor[] = [];
  for (const look of listing.npcLooks) {
    out.push({
      type: 'npc',
      importKey: `${mod}:npc:${look.key}`,
      name: titleFromKey(look.key),
      // tilesetPath that is mod-relative is written as gfx= on export (useManualSave)
      properties: { tilesetPath: look.animation, ...(look.image ? { templateImage: look.image } : {}) },
    });
  }
  for (const e of listing.enemies) {
    // Bases without their own look (e.g. beacon.txt, a shared behaviour block) are not enemies.
    if (e.isBase && !firstValue(e.raw, 'animations')) continue;
    if (e.isBase) {
      const rel = `enemies/${e.key}.txt`;
      out.push({
        type: 'enemy',
        importKey: `${mod}:enemy:${e.key}`,
        name: titleFromKey(e.key),
        category: e.key,
        properties: {
          include: e.file,
          categories: e.key,
          ...(firstValue(e.raw, 'animations') ? { animations: firstValue(e.raw, 'animations') as string } : {}),
          enemyFilename: rel,
        },
        file: { rel, content: enemyFileFromBase(e.file, e.key) },
      });
    } else {
      // Full definition from a mod: keep the raw file as is (no re-serialisation).
      const cats = (firstValue(e.raw, 'categories') || e.key).split(',').map(s => s.trim()).filter(Boolean);
      out.push({
        type: 'enemy',
        importKey: `${mod}:enemy:${e.key}`,
        name: firstValue(e.raw, 'name') || titleFromKey(e.key),
        category: cats[0],
        properties: { categories: cats.join(','), enemyFilename: e.file },
        file: { rel: e.file, content: e.raw },
      });
    }
  }
  return out;
}

/** Drop planned entities already in the project (same import key, or same NPC/enemy file). */
export function dedupeActors(planned: PlannedActor[], existing: Array<Pick<MapObject, 'type' | 'properties' | 'name'>>, existingFiles: Set<string>) {
  const keys = new Set<string>();
  const npcFiles = new Set<string>();
  for (const o of existing) {
    const p = (o.properties || {}) as Record<string, unknown>;
    if (typeof p.importKey === 'string') keys.add(p.importKey);
    if (o.type === 'npc' && typeof p.tilesetPath === 'string') npcFiles.add(p.tilesetPath);
  }
  const keep: PlannedActor[] = [];
  let skipped = 0;
  for (const a of planned) {
    if (keys.has(a.importKey) || (a.type === 'npc' && npcFiles.has(a.properties.tilesetPath))) { skipped++; continue; }
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

/** Read the template listing, write missing project files, add unplaced Entities. */
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
  // NPC definition files (npcs/*.txt) have dialog sections Studio's NPC model can't hold yet: report, don't convert.
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
