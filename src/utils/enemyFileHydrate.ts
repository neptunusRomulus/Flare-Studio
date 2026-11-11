/**
 * Load an existing enemies/*.txt into Studio object properties so the editor
 * shows file values. Unsupported StatBlock keys (gold, wander_radius,
 * waypoints, script) are still surfaced so the editor can warn on save.
 */
import { includesFromEnemyText } from '@/adapters/flare/flareAdapter.cjs';
import { propertyText } from '@/editor/propertyText';
import type { MapObject } from '@/types';

const text = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : String(v));

/** StatBlock ids the enemy form edits as `stat=id,value` (not bare hp=). */
export const ENEMY_STAT_IDS = [
  'hp', 'mp', 'hp_regen', 'mp_regen', 'accuracy', 'avoidance', 'crit', 'poise', 'stealth',
  'absorb_min', 'absorb_max', 'xp_gain', 'currency_find', 'item_find',
  'reflect_chance', 'return_damage', 'hp_steal', 'mp_steal',
  'resist_damage_over_time', 'resist_slow', 'resist_stun', 'resist_knockback',
  'resist_stat_debuff', 'resist_damage_reflect', 'resist_hp_steal', 'resist_mp_steal',
  'dmg_melee_min', 'dmg_melee_max', 'dmg_ranged_min', 'dmg_ranged_max',
  'dmg_ment_min', 'dmg_ment_max',
] as const;

/** Parse newline-joined `stat=` values (`hp,40` / `accuracy,75`) into a map. */
export function parseStatMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of String(raw || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const comma = trimmed.indexOf(',');
    if (comma <= 0) continue;
    const id = trimmed.slice(0, comma).trim();
    const value = trimmed.slice(comma + 1).trim();
    if (id) out[id] = value;
  }
  return out;
}

/**
 * Stats for the enemy form: `stat=` lines win, then leftover top-level keys
 * (older Studio saves wrote properties.hp instead of stat=hp).
 */
export function statsFromProperties(properties: Record<string, unknown> | null | undefined): Record<string, string> {
  const props = properties || {};
  const out = parseStatMap(props.stat);
  for (const id of ENEMY_STAT_IDS) {
    if (out[id] != null) continue;
    const value = text(props[id]);
    if (value) out[id] = value;
  }
  return out;
}

/** Keep previous `stat=` order, update values, drop empty, append new ids. */
export function formatStatProperty(
  stats: Record<string, string>,
  previousRaw?: unknown,
): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const line of String(previousRaw || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const id = trimmed.split(',')[0].trim();
    if (!id) continue;
    seen.add(id);
    const next = stats[id];
    if (next == null || next === '') continue;
    lines.push(`${id},${next}`);
  }
  for (const [id, value] of Object.entries(stats)) {
    if (!id || value == null || value === '' || seen.has(id)) continue;
    lines.push(`${id},${value}`);
  }
  return lines.join('\n');
}


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
  const fromStat = parseStatMap(out.stat);
  for (const [id, value] of Object.entries(fromStat)) {
    if (!out[id]) out[id] = value;
  }
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
