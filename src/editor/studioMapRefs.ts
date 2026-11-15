/**
 * Turn Studio map-JSON objects into key=value texts so the Problems scan and
 * findUsages can see references that live only on a map object (no enemies/*.txt yet).
 */
import type { MapObject } from '@/types';
import { loadProjectTextMap, projectRoot } from '@/editor/projectFiles';
import { propertyRecord, propertyText } from '@/editor/propertyText';

export type StudioMapDocument = { objects?: Array<Partial<MapObject> & { id?: number; type?: string; name?: string; properties?: Record<string, unknown> }> };

function withExt(rel: string): string {
  return /\.txt$/i.test(rel) ? rel : `${rel}.txt`;
}

/** Project-relative definition path for an enemy or NPC map object, if one is recorded. */
export function objectDefinitionPath(object: { type?: string; name?: string; properties?: Record<string, unknown> }): string | null {
  const props = propertyRecord(object.properties as Record<string, string | string[]> | undefined);
  if (object.type === 'enemy') {
    const raw = propertyText(props.enemyFilename) || propertyText(props.sourcePath);
    if (!raw && !String(object.name || '').trim()) return null;
    const rel = (raw || `enemies/${object.name || 'enemy'}.txt`).replace(/\\/g, '/').replace(/^\//, '');
    const withDir = rel.includes('/') ? rel : `enemies/${rel}`;
    return withExt(withDir).replace(/^.*\/enemies\//, 'enemies/');
  }
  if (object.type === 'npc') {
    const raw = propertyText(props.npcFilename) || propertyText(props.sourcePath);
    if (!raw) return null;
    const rel = raw.replace(/\\/g, '/').replace(/^\//, '');
    const withDir = rel.includes('/') ? rel : `npcs/${rel}`;
    return withExt(withDir).replace(/^.*\/npcs\//, 'npcs/');
  }
  return null;
}

export function virtualMapObjectPath(mapFile: string, object: { type?: string; id?: number; name?: string }): string {
  const kind = object.type || 'object';
  const id = object.id != null ? String(object.id) : (object.name || 'unknown');
  return `${mapFile}#${kind}/${id}`;
}

export function textFromMapObject(object: { name?: string; properties?: Record<string, unknown> }): string {
  const props = propertyRecord(object.properties as Record<string, string | string[]> | undefined);
  const lines: string[] = [];
  if (object.name) lines.push(`name=${object.name}`);
  for (const [key, value] of Object.entries(props)) {
    if (!value) continue;
    for (const part of value.split(/\r?\n/)) {
      const line = part.trim();
      if (line) lines.push(line.includes('=') ? line : `${key}=${line}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Add a virtual file for each map object whose definition .txt is not already in `files`.
 * That way a loot line in both the enemy file and the JSON is only reported once.
 */
export function mergeMapObjectRefs(
  files: Record<string, string>,
  maps: Record<string, StudioMapDocument>,
): Record<string, string> {
  const out: Record<string, string> = { ...files };
  for (const [mapFile, doc] of Object.entries(maps)) {
    for (const object of doc.objects || []) {
      const defPath = objectDefinitionPath(object);
      if (defPath && files[defPath]) continue;
      out[virtualMapObjectPath(mapFile, object)] = textFromMapObject(object);
    }
  }
  return out;
}

export async function loadStudioMapDocuments(projectPath: string | null): Promise<Record<string, StudioMapDocument>> {
  if (!projectPath || !window.electronAPI?.listMaps || !window.electronAPI?.readFile) return {};
  const root = projectRoot(projectPath);
  let names: string[] = [];
  try {
    names = await window.electronAPI.listMaps(projectPath);
  } catch {
    return {};
  }
  const out: Record<string, StudioMapDocument> = {};
  for (const name of names || []) {
    if (!String(name).toLowerCase().endsWith('.json')) continue;
    try {
      const text = await window.electronAPI.readFile(`${root}/${name}`);
      if (!text) continue;
      const parsed = JSON.parse(text) as StudioMapDocument;
      if (Array.isArray(parsed.objects)) out[name] = { objects: parsed.objects };
    } catch {
      /* skip unreadable maps */
    }
  }
  return out;
}

/** .txt scan plus Studio map-JSON object properties, for Problems and usage checks. */
export async function loadProjectRefMap(projectPath: string | null): Promise<Record<string, string>> {
  const files = await loadProjectTextMap(projectPath);
  const maps = await loadStudioMapDocuments(projectPath);
  return mergeMapObjectRefs(files, maps);
}
