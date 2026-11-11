/**
 * Load an existing enemies/*.txt into Studio object properties so the editor
 * shows file values. Unsupported StatBlock keys (gold, wander_radius,
 * waypoints, script) are still surfaced so the editor can warn on save.
 */
import { includesFromEnemyText } from '@/adapters/flare/flareAdapter.cjs';
import { propertyText } from '@/editor/propertyText';
import type { MapObject } from '@/types';

const text = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : String(v));

function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0 && String(value[0] ?? '') !== '';
  return String(value) !== '';
}

/** Flatten a Flare enemy file into property keys (repeated keys are newline-joined). */
export function propertiesFromEnemyFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  const render: string[] = [];
  const slots: string[] = [];
  let section = '';
  for (const raw of String(content || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line === 'APPEND' || line.startsWith('INCLUDE ')) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (section === 'render_layers' && key === 'layer') {
      render.push(value);
      continue;
    }
    if (section === 'animation_slots' && key === 'slot') {
      slots.push(value);
      continue;
    }
    if (key === 'render_layers') render.push(value);
    else if (key === 'animation_slots') slots.push(value);
    else if (out[key]) out[key] = `${out[key]}\n${value}`;
    else out[key] = value;
  }
  if (render.length) out.render_layers = render.join('\n');
  if (slots.length) out.animation_slots = slots.join('\n');
  const includes = includesFromEnemyText(content);
  if (includes.length) out.include = includes.join('\n');
  if (out.animations && !out.tilesetPath) out.tilesetPath = out.animations;
  if (out.gfx && !out.animations) out.animations = out.gfx;
  if (out.thread_range && !out.threat_range) out.threat_range = out.thread_range;
  delete out.thread_range;
  return out;
}

/**
 * Fill missing definition properties from the enemy file. Existing non-empty
 * object properties stay as they are.
 */
export function hydrateEnemyObject(object: MapObject, fileText: string): MapObject {
  const fromFile = propertiesFromEnemyFile(fileText);
  const current = { ...(object.properties || {}) } as Record<string, unknown>;
  for (const [key, value] of Object.entries(fromFile)) {
    if (key === 'name') continue;
    if (!isPresent(current[key])) current[key] = value;
  }
  const fileName = text(fromFile.name);
  const name = object.name && object.name.trim() && !/^enemy_/i.test(object.name) ? object.name : (fileName || object.name);
  const level = object.level != null ? object.level : (fromFile.level ? Number(fromFile.level) || object.level : object.level);
  return { ...object, name, ...(level != null ? { level } : {}), properties: current as MapObject['properties'] };
}

export function enemyFilePath(projectPath: string, object: Pick<MapObject, 'name' | 'properties'>): string {
  const props = (object.properties || {}) as Record<string, unknown>;
  const raw = propertyText(props.enemyFilename as string | string[] | undefined) || propertyText(props.sourcePath as string | string[] | undefined) || `enemies/${object.name || 'enemy'}.txt`;
  const rel = raw.replace(/\\/g, '/').replace(/^\//, '');
  const withDir = rel.includes('/') ? rel : `enemies/${rel}`;
  const withExt = withDir.toLowerCase().endsWith('.txt') ? withDir : `${withDir}.txt`;
  return `${projectPath.replace(/\\/g, '/')}/${withExt.replace(/^.*\/enemies\//, 'enemies/')}`;
}
