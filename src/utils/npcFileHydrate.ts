/**
 * Load an existing npcs/*.txt into Studio object properties so the editor
 * shows file values (stock, ratios, vox, dialogs, includes, …).
 * Map-instance keys (facing, waypoints, wander, spawn requirements) are not
 * taken from the definition file.
 */
import { importNpcText } from '@/adapters/flare/flareAdapter.cjs';
import { npcFileBase, type KeyValue } from '@/utils/npcFileUpdate';
import type { MapObject } from '@/types';

const text = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : String(v));

const DEFINITION_STRINGS: Record<string, string> = {
  constant_stock: 'constant_stock',
  random_stock: 'random_stock',
  random_stock_count: 'random_stock_count',
  vendor_requires_status: 'vendor_requires_status',
  vendor_requires_not_status: 'vendor_requires_not_status',
  direction: 'direction',
  show_on_minimap: 'show_on_minimap',
  vendor_ratio_buy: 'vendor_ratio_buy',
  vendor_ratio_sell: 'vendor_ratio_sell',
  vendor_ratio_sell_old: 'vendor_ratio_sell_old',
  craft_constant_stock: 'craft_constant_stock',
  craft_random_stock_count: 'craft_random_stock_count',
  vendor_gamble_buy: 'vendor_gamble_buy',
  vendor_gamble_craft: 'vendor_gamble_craft',
  craft_status_stock: 'craft_status_stock',
  craft_random_stock: 'craft_random_stock',
  vendor_tab_enabled: 'vendor_tab_enabled',
  vox_intro: 'vox_intro',
};

/** status_stock file lines → the editor's status_stock_entries JSON. */
export function statusStockToEntries(lines: string[]): Array<{ requirement: string; items: Record<string, number> }> {
  const out: Array<{ requirement: string; items: Record<string, number> }> = [];
  for (const raw of lines) {
    const parts = String(raw || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const requirement = parts[0];
    const items: Record<string, number> = {};
    for (const token of parts.slice(1)) {
      const at = token.lastIndexOf(':');
      const id = at < 0 ? token : token.slice(0, at);
      const qty = at < 0 ? 1 : Math.max(1, parseInt(token.slice(at + 1), 10) || 1);
      if (id) items[id] = qty;
    }
    if (requirement && Object.keys(items).length) out.push({ requirement, items });
  }
  return out;
}

export function includesFromNpcText(content: string): string[] {
  const npc = importNpcText(content || '') as { _rawMain?: Array<{ raw?: string }> };
  const paths: string[] = [];
  for (const entry of npc._rawMain || []) {
    const line = String(entry.raw || '');
    if (line.startsWith('INCLUDE ')) {
      const path = line.slice('INCLUDE '.length).trim();
      if (path) paths.push(path);
    }
  }
  return paths;
}

/** Definition properties (and dialogue trees) read from a Flare NPC file. */
export function propertiesFromNpcFile(content: string): Record<string, string> {
  const npc = importNpcText(content || '') as Record<string, unknown> & {
    customProperties?: { dialogueTrees?: unknown[] };
    _rawSections?: Array<{ name: string; entries: Array<{ key?: string; value?: string; raw?: string }> }>;
  };
  const out: Record<string, string> = {};
  if (npc.name != null && text(npc.name) !== '') out.name = text(npc.name);
  if (npc.talker != null) out.talker = /^(true|1)$/i.test(text(npc.talker)) ? 'true' : 'false';
  if (npc.vendor != null) out.vendor = /^(true|1)$/i.test(text(npc.vendor)) ? 'true' : 'false';
  const animations = text(npc.animations || npc.gfx);
  if (animations) out.tilesetPath = animations;
  const portrait = text(npc.portrait);
  if (portrait) out.portraitPath = portrait;
  for (const [prop, key] of Object.entries(DEFINITION_STRINGS)) {
    const value = text(npc[key]);
    if (value !== '') out[prop] = value;
  }
  const statusLines = text(npc.status_stock).split('\n').map((s) => s.trim()).filter(Boolean);
  if (statusLines.length) out.status_stock_entries = JSON.stringify(statusStockToEntries(statusLines));
  const includes = includesFromNpcText(content);
  if (includes.length) out.npc_includes = includes.join('\n');
  const stats = (npc._rawSections || []).filter((sec) => sec.name === 'stats')
    .map((sec) => sec.entries.filter((e) => !e.raw && e.key).map((e) => ({ key: String(e.key), value: String(e.value ?? '') }))) as KeyValue[][];
  if (stats.some((s) => s.length)) out.npc_stats = JSON.stringify(stats);
  const vfx = (npc._rawSections || []).filter((sec) => sec.name === 'visual_effect')
    .map((sec) => sec.entries.filter((e) => !e.raw && e.key).map((e) => ({ key: String(e.key), value: String(e.value ?? '') }))) as KeyValue[][];
  if (vfx.some((s) => s.length)) out.npc_visual_effects = JSON.stringify(vfx);
  const trees = npc.customProperties?.dialogueTrees;
  if (Array.isArray(trees) && trees.length) out.dialogueTrees = JSON.stringify(trees);
  return out;
}

function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0 && String(value[0] ?? '') !== '';
  return String(value) !== '';
}

/**
 * Fill missing definition properties from the NPC file. Existing non-empty
 * object properties (including map-instance keys) stay as they are.
 */
export function hydrateNpcObject(object: MapObject, fileText: string): MapObject {
  const fromFile = propertiesFromNpcFile(fileText);
  const current = { ...(object.properties || {}) } as Record<string, unknown>;
  for (const [key, value] of Object.entries(fromFile)) {
    if (key === 'name') continue;
    if (!isPresent(current[key])) current[key] = value;
  }
  const name = object.name && object.name.trim() && !/^npc_/i.test(object.name) ? object.name : (fromFile.name || object.name);
  return { ...object, name, properties: current as MapObject['properties'] };
}

export function npcFilePath(projectPath: string, object: Pick<MapObject, 'name' | 'properties'>): string {
  const raw = String(
    (object.properties as Record<string, unknown> | undefined)?.npcFilename
    || (object.properties as Record<string, unknown> | undefined)?.filename
    || `npcs/${object.name || 'npc'}.txt`,
  );
  const base = npcFileBase(raw.replace(/^.*\/npcs\//, 'npcs/').replace(/^npcs\//, ''));
  return `${projectPath.replace(/\\/g, '/')}/npcs/${base}`;
}
