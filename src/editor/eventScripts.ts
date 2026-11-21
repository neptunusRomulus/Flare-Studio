/**
 * scripts/*.txt parse/serialize and map-event instance keys.
 * A script is a queue of [event] sections (EventManager::executeScript).
 * delay is allowed in scripts even though it is not an EventComponent.
 * Map [event] instances keep location/activate/hotspot/cooldown/reachable_from
 * (and optional instance conditions) and call the script with script=.
 */

import { BOOK_EVENT_KEYS } from '@/editor/bookFile';
import { slugFileName } from '@/adapters/flare/flareAdapter.cjs';

export const EVENT_COMPONENT_KEYS = [...BOOK_EVENT_KEYS] as const;
export const EVENT_COMPONENT_KEY_SET = new Set<string>(EVENT_COMPONENT_KEYS);

/** Keys EventManager::loadEvent reads on a map [event] before falling through to components. */
export const EVENT_INSTANCE_KEYS = [
  'activate',
  'location',
  'hotspot',
  'cooldown',
  'delay',
  'reachable_from',
  'tooltip',
  'repeat',
  'show_on_minimap',
  'requires_status',
  'requires_not_status',
  'requires_level',
  'requires_not_level',
  'requires_currency',
  'requires_not_currency',
  'requires_item',
  'requires_not_item',
  'requires_class',
  'requires_not_class',
  'requires_tile',
  'requires_not_tile',
  'script',
] as const;

export const EVENT_INSTANCE_KEY_SET = new Set<string>(EVENT_INSTANCE_KEYS);

export const EVENT_ACTIVATE_VALUES = [
  'on_trigger',
  'on_interact',
  'on_load',
  'on_leave',
  'on_mapexit',
  'on_clear',
  'static',
] as const;

export type EventScriptComponent = { key: string; value: string };

export type EventScriptStep = {
  delay?: string;
  components: EventScriptComponent[];
};

export type EventScriptFile = {
  header: string;
  steps: EventScriptStep[];
};

export type EventScriptEntry = {
  path: string;
  name: string;
  usage: number;
};

type Entry =
  | { kind: 'blank' }
  | { kind: 'comment'; text: string }
  | { kind: 'raw'; text: string }
  | { kind: 'section'; name: string }
  | { kind: 'key'; key: string; value: string };

function parseEntries(content: string): Entry[] {
  const lines = String(content || '').replace(/\r/g, '').split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed === '') return { kind: 'blank' as const };
    if (trimmed.startsWith('#')) return { kind: 'comment' as const, text: trimmed };
    if (trimmed.startsWith('[') && trimmed.endsWith(']') && !trimmed.includes('=')) {
      return { kind: 'section' as const, name: trimmed.slice(1, -1) };
    }
    if (trimmed.includes('=') && !trimmed.toUpperCase().startsWith('INCLUDE')) {
      const eq = trimmed.indexOf('=');
      return { kind: 'key' as const, key: trimmed.slice(0, eq).trim(), value: trimmed.slice(eq + 1) };
    }
    return { kind: 'raw' as const, text: trimmed };
  });
}

function exportEntries(doc: Entry[]): string {
  const lines = doc.map((entry) => {
    if (entry.kind === 'blank') return '';
    if (entry.kind === 'comment' || entry.kind === 'raw') return entry.text;
    if (entry.kind === 'section') return `[${entry.name}]`;
    if (entry.kind === 'key') return `${entry.key}=${entry.value}`;
    return '';
  });
  return `${lines.join('\n')}\n`;
}

function trimHeader(lines: string[]): string {
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.join('\n');
}

export function emptyEventScript(): EventScriptFile {
  return { header: '', steps: [{ components: [] }] };
}

export function parseEventScript(text: string): EventScriptFile {
  const header: string[] = [];
  const steps: EventScriptStep[] = [];
  let current: EventScriptStep | null = null;
  let seen = false;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (/^\[event\]$/i.test(line)) {
      seen = true;
      current = { components: [] };
      steps.push(current);
      continue;
    }
    if (!seen) {
      header.push(raw);
      continue;
    }
    if (!current) continue;
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === 'delay') current.delay = value;
    else current.components.push({ key, value });
  }
  return { header: trimHeader(header), steps: steps.length ? steps : [{ components: [] }] };
}

function writeStep(step: EventScriptStep): string[] {
  const lines = ['[event]'];
  if (step.delay?.trim()) lines.push(`delay=${step.delay.trim()}`);
  for (const component of step.components) {
    if (!component.key.trim() || !String(component.value ?? '').trim()) continue;
    lines.push(`${component.key.trim()}=${String(component.value).trim()}`);
  }
  return lines;
}

export function serializeEventScript(file: EventScriptFile, previous = ''): string {
  const header = file.header || parseEventScript(previous).header;
  const steps = file.steps.filter((step) => (step.delay && step.delay.trim()) || step.components.some((row) => row.key.trim() && String(row.value ?? '').trim()));
  const blocks = (steps.length ? steps : [{ components: [] }]).map((step) => writeStep(step).join('\n'));
  const parts: string[] = [];
  if (header.trim()) parts.push(header.replace(/\n+$/, ''));
  parts.push(...blocks);
  return `${parts.join('\n\n').replace(/\n+$/, '')}\n`;
}

/** When the step list is unchanged in count, patch in place so comments stay. */
export function mergeEventScript(existing: string, next: EventScriptFile): string {
  const text = String(existing || '').replace(/\r/g, '');
  if (!text.trim()) return serializeEventScript(next, text);
  const parsed = parseEventScript(text);
  const steps = next.steps;
  const doc = parseEntries(text);
  const starts: number[] = [];
  doc.forEach((entry, i) => { if (entry.kind === 'section' && entry.name.toLowerCase() === 'event') starts.push(i); });
  const sameCount = starts.length === steps.length || (starts.length === 0 && steps.length === 1 && !steps[0].components.length && !steps[0].delay);
  const sameShape = starts.length === steps.length;
  if (!sameShape || !sameCount) return serializeEventScript({ header: parsed.header || next.header, steps }, text);
  for (let i = starts.length - 1; i >= 0; i -= 1) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : doc.length;
    const step = steps[i];
    const original = parsed.steps[i];
    if (original && sameStep(original, step)) continue;
    const body: Entry[] = [{ kind: 'section', name: 'event' }];
    if (step.delay?.trim()) body.push({ kind: 'key', key: 'delay', value: step.delay.trim() });
    for (const component of step.components) {
      if (!component.key.trim() || !String(component.value ?? '').trim()) continue;
      body.push({ kind: 'key', key: component.key.trim(), value: String(component.value).trim() });
    }
    doc.splice(start, end - start, ...body);
  }
  return exportEntries(doc);
}

function sameStep(a: EventScriptStep, b: EventScriptStep): boolean {
  if ((a.delay || '') !== (b.delay || '')) return false;
  if (a.components.length !== b.components.length) return false;
  return a.components.every((row, i) => row.key === b.components[i].key && row.value === b.components[i].value);
}

export function eventScriptRelPath(name: string): string {
  const slug = String(name || 'event')
    .trim()
    .toLowerCase()
    .replace(/\.txt$/i, '')
    .replace(/\\/g, '/')
    .replace(/^scripts\//, '')
    .replace(/[^a-z0-9/]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/\/+/g, '/') || 'event';
  return `scripts/${slug}.txt`;
}

export function normalizeEventScriptPath(value: unknown): string {
  const path = (Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')).trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!path) return '';
  if (/^[a-z]:\//i.test(path) || path.startsWith('/')) return '';
  const lower = path.toLowerCase();
  const relative = lower.startsWith('content/') ? lower.slice('content/'.length) : lower;
  const withFolder = relative.includes('/') || relative.startsWith('scripts/') ? relative : `scripts/${relative}`;
  const prefixed = withFolder.startsWith('scripts/') ? withFolder : `scripts/${withFolder}`;
  return prefixed.endsWith('.txt') ? prefixed : `${prefixed}.txt`;
}

export function eventScriptDisplayName(path: string): string {
  return path.replace(/^scripts\//, '').replace(/\.txt$/i, '');
}

export function instancePropertiesFrom(
  properties: Record<string, string | string[] | undefined> | null | undefined,
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of EVENT_INSTANCE_KEYS) {
    const value = properties?.[key];
    if (value == null || value === '') continue;
    out[key] = value;
  }
  return out;
}

export function actionPropertiesFrom(
  properties: Record<string, string | string[] | undefined> | null | undefined,
): EventScriptComponent[] {
  const components: EventScriptComponent[] = [];
  for (const [key, raw] of Object.entries(properties || {})) {
    if (EVENT_INSTANCE_KEY_SET.has(key) || key.startsWith('_')) continue;
    if (raw == null || raw === '') continue;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (String(value).trim()) components.push({ key, value: String(value) });
    }
  }
  return components;
}

export type ScriptUsageObject = {
  id?: number;
  type?: string;
  properties?: Record<string, string | string[] | undefined>;
};

export type ScriptUsageLiveMap = {
  name: string;
  objects: ScriptUsageObject[];
};

/** Stable map key used to match a live/draft map to its saved maps/*.txt or root .json. */
export function scriptUsageMapKey(name: string): string {
  const stem = String(name || '').replace(/\\/g, '/').replace(/^.*\//, '').replace(/\.(txt|json)$/i, '');
  return slugFileName(stem) || stem.trim().toLowerCase();
}

/** Map key for a project file, or null when the file is not a map. */
export function fileScriptUsageMapKey(file: string): string | null {
  const path = file.replace(/\\/g, '/');
  const lower = path.toLowerCase();
  if (lower.startsWith('maps/procgen_rules/')) return null;
  if (lower.endsWith('/spawn.txt') || lower === 'maps/spawn.txt') return null;
  if (lower.startsWith('maps/') && lower.endsWith('.txt')) {
    return scriptUsageMapKey(path.slice('maps/'.length));
  }
  if (lower.endsWith('.json') && !path.includes('/')) {
    return scriptUsageMapKey(path);
  }
  return null;
}

function scriptValues(properties: ScriptUsageObject['properties']): string[] {
  const script = properties?.script;
  const values = script == null ? [] : Array.isArray(script) ? script : [script];
  return values.map((value) => String(value)).filter((value) => value.trim());
}

/**
 * Count every script= placement. Live/draft maps replace the saved file for that map
 * so unsaved place/delete/undo is reflected immediately and not double-counted.
 */
export function collectScriptUsages(
  files: Record<string, string>,
  liveMaps: ScriptUsageLiveMap[] = [],
): Map<string, string[]> {
  const uses = new Map<string, string[]>();
  const add = (script: string, where: string) => {
    const path = normalizeEventScriptPath(script);
    if (!path) return;
    const list = uses.get(path) ?? [];
    list.push(where);
    uses.set(path, list);
  };
  const liveKeys = new Set(
    liveMaps.map((map) => scriptUsageMapKey(map.name)).filter(Boolean),
  );

  for (const [file, content] of Object.entries(files || {})) {
    const mapKey = fileScriptUsageMapKey(file);
    if (mapKey && liveKeys.has(mapKey)) continue;
    const lines = String(content || '').replace(/\r/g, '').split('\n');
    lines.forEach((line, index) => {
      const match = line.match(/^\s*script\s*=\s*(.+)$/i);
      if (match) add(match[1], `${file}:${index + 1}`);
    });
  }

  liveMaps.forEach((map, mapIndex) => {
    const mapKey = scriptUsageMapKey(map.name) || `map-${mapIndex}`;
    (map.objects || []).forEach((object, objectIndex) => {
      if (object.type !== 'event') return;
      const id = object.id ?? objectIndex;
      scriptValues(object.properties).forEach((value, valueIndex) => {
        add(value, `map:${mapKey}:event:${id}:${valueIndex}`);
      });
    });
  });
  return uses;
}

export const DEFAULT_EVENT_SCRIPT = `[event]
`;
