/**
 * Find and rename references to items, NPCs, quests, Story Flags, enemies and maps
 * across Flare text files. Only key=value (and INCLUDE) lines are touched so
 * comments and unrelated text stay byte-identical.
 */
export type RefKind = 'item' | 'npc' | 'quest' | 'flag' | 'enemy' | 'map';

export type RefUsage = {
  path: string;
  key: string;
  value: string;
  line: number;
  section: string;
};

const ITEM_KEYS = new Set([
  'requires_item', 'requires_not_item', 'reward_item', 'remove_item',
  'loot', 'id', 'item', 'equip', 'equipment',
]);

const FLAG_KEYS = new Set([
  'set_status', 'unset_status', 'requires_status', 'requires_not_status',
  'complete_status', 'show_status', 'defeat_status', 'status_loot',
]);

const PATH_KIND_DIR: Record<Exclude<RefKind, 'item' | 'flag'>, string> = {
  npc: 'npcs/',
  quest: 'quests/',
  enemy: 'enemies/',
  map: 'maps/',
};

function folderOf(kind: RefKind): string | null {
  if (kind === 'item' || kind === 'flag') return null;
  return PATH_KIND_DIR[kind];
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

/** Bare name, name.txt, or dir/name.txt all compare equal for a kind. */
export function pathsMatch(raw: string, id: string, kind: RefKind): boolean {
  const folder = folderOf(kind);
  if (!folder) return false;
  const a = normalizePath(raw.split(',')[0] || '');
  const b = normalizePath(id.split(',')[0] || '');
  if (!a || !b) return false;
  const strip = (p: string) => p.replace(new RegExp(`^${folder}`), '').replace(/\.txt$/i, '');
  return a === b || strip(a) === strip(b) || a === `${folder}${strip(b)}.txt` || b === `${folder}${strip(a)}.txt`;
}

function idsMatch(a: string, b: string): boolean {
  return String(a).trim() === String(b).trim();
}

/** First token of a list entry (`12:3` → `12`, `1101` → `1101`). */
function entryId(token: string): string {
  const t = token.trim();
  const colon = t.indexOf(':');
  return (colon >= 0 ? t.slice(0, colon) : t).trim();
}

function replaceEntryId(token: string, from: string, to: string): string {
  const t = token.trim();
  const colon = t.indexOf(':');
  const id = (colon >= 0 ? t.slice(0, colon) : t).trim();
  if (!idsMatch(id, from)) return token;
  const suffix = colon >= 0 ? t.slice(colon) : '';
  return `${to}${suffix}`;
}

function replacePath(raw: string, from: string, to: string, kind: RefKind): string {
  const comma = raw.indexOf(',');
  const first = comma >= 0 ? raw.slice(0, comma) : raw;
  const rest = comma >= 0 ? raw.slice(comma) : '';
  if (!pathsMatch(first, from, kind)) return raw;
  const folder = folderOf(kind) || '';
  const toNorm = normalizePath(to);
  const withDir = toNorm.includes('/') ? toNorm : `${folder}${toNorm.replace(/\.txt$/i, '')}.txt`;
  const looksLikePath = first.includes('/') || /\.txt$/i.test(first);
  const next = looksLikePath ? withDir : withDir.replace(new RegExp(`^${folder}`), '').replace(/\.txt$/i, '');
  return `${next}${rest}`;
}

function itemValueHolds(value: string, key: string, section: string, id: string): boolean {
  if (key === 'loot' && !value.includes('/')) {
    return idsMatch(entryId(value.split(',')[0] || ''), id);
  }
  if (key === 'id') {
    if (section === 'loot' || section === 'item') return idsMatch(value, id);
    return false;
  }
  if (key === 'equip' || key === 'equipment') {
    return value.split(',').some((tok) => idsMatch(entryId(tok), id));
  }
  if (!ITEM_KEYS.has(key)) return false;
  if (key === 'item' && section === 'loot') return idsMatch(value, id);
  return value.split(',').some((tok) => idsMatch(entryId(tok), id));
}

function replaceItemValue(value: string, key: string, section: string, from: string, to: string): string {
  if (key === 'loot' && !value.includes('/')) {
    const parts = value.split(',');
    if (idsMatch(entryId(parts[0] || ''), from)) parts[0] = replaceEntryId(parts[0], from, to);
    return parts.join(',');
  }
  if (key === 'id' && (section === 'loot' || section === 'item')) {
    return idsMatch(value, from) ? to : value;
  }
  return value.split(',').map((tok) => replaceEntryId(tok, from, to)).join(',');
}

function flagValueHolds(value: string, key: string, id: string): boolean {
  if (key === 'quest_loot') {
    const parts = value.split(',');
    return idsMatch((parts[0] || '').trim(), id) || idsMatch((parts[1] || '').trim(), id);
  }
  if (!FLAG_KEYS.has(key)) return false;
  return value.split(',').some((tok) => idsMatch(tok, id));
}

function replaceFlagValue(value: string, key: string, from: string, to: string): string {
  if (key === 'quest_loot') {
    const parts = value.split(',');
    if (idsMatch((parts[0] || '').trim(), from)) parts[0] = to;
    if (idsMatch((parts[1] || '').trim(), from)) parts[1] = to;
    return parts.join(',');
  }
  return value.split(',').map((tok) => (idsMatch(tok, from) ? to : tok)).join(',');
}

function pathKeyFor(kind: RefKind, key: string, section: string, value: string): boolean {
  if (key === 'INCLUDE' || key === 'include') return true;
  if (kind === 'npc') {
    if (key === 'filename' || key === 'npc') return true;
    return false;
  }
  if (kind === 'enemy') {
    if (key === 'spawn_type' || key === 'filename') return true;
    if ((key === 'type' || key === 'category') && /enemies\//i.test(value)) return true;
    return false;
  }
  if (kind === 'map') {
    return key === 'intermap' || key === 'intramap' || key === 'map' || key === 'procgen_filename';
  }
  if (kind === 'quest') {
    if (key === 'quest') return true;
    return (key === 'filename' || key === 'file') && /quests\//i.test(value);
  }
  return false;
}

type Line = { raw: string; key: string; value: string; section: string; line: number; include: boolean };

function parseLines(text: string): Line[] {
  const out: Line[] = [];
  let section = '';
  const rows = String(text || '').replace(/\r/g, '').split('\n');
  rows.forEach((raw, i) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('INCLUDE ')) {
      out.push({ raw, key: 'INCLUDE', value: trimmed.slice(8).trim(), section, line: i + 1, include: true });
      return;
    }
    const sec = trimmed.match(/^\[([^\]]+)\]$/);
    if (sec) {
      section = sec[1].trim();
      return;
    }
    if (!trimmed || trimmed.startsWith('#') || trimmed === 'APPEND') return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    out.push({
      raw,
      key: trimmed.slice(0, eq).trim(),
      value: trimmed.slice(eq + 1).trim(),
      section,
      line: i + 1,
      include: false,
    });
  });
  return out;
}

function lineHolds(line: Line, kind: RefKind, id: string): boolean {
  if (kind === 'item') {
    if (line.key === 'quest_loot') {
      const item = (line.value.split(',')[2] || '').trim();
      return idsMatch(entryId(item), id);
    }
    if (line.key === 'status_stock') {
      return line.value.split(',').slice(1).some((tok) => idsMatch(entryId(tok), id));
    }
    return itemValueHolds(line.value, line.key, line.section, id);
  }
  if (kind === 'flag') {
    if (line.key === 'quest_loot') return flagValueHolds(line.value, 'quest_loot', id);
    return flagValueHolds(line.value, line.key, id);
  }
  if (line.include || pathKeyFor(kind, line.key, line.section, line.value)) {
    return pathsMatch(line.value, id, kind);
  }
  return false;
}

function replaceLineValue(line: Line, kind: RefKind, from: string, to: string): string {
  if (kind === 'item') {
    if (line.key === 'quest_loot') {
      const parts = line.value.split(',');
      if (parts[2] != null && idsMatch(entryId(parts[2]), from)) parts[2] = replaceEntryId(parts[2], from, to);
      return parts.join(',');
    }
    if (line.key === 'status_stock') {
      const parts = line.value.split(',');
      return [parts[0], ...parts.slice(1).map((tok) => replaceEntryId(tok, from, to))].join(',');
    }
    return replaceItemValue(line.value, line.key, line.section, from, to);
  }
  if (kind === 'flag') return replaceFlagValue(line.value, line.key === 'quest_loot' ? 'quest_loot' : line.key, from, to);
  return replacePath(line.value, from, to, kind);
}

export function findUsages(files: Record<string, string>, kind: RefKind, id: string): RefUsage[] {
  const want = String(id || '').trim();
  if (!want) return [];
  const out: RefUsage[] = [];
  for (const [path, text] of Object.entries(files)) {
    for (const line of parseLines(text)) {
      if (!lineHolds(line, kind, want)) continue;
      out.push({ path, key: line.key, value: line.value, line: line.line, section: line.section });
    }
  }
  return out;
}

function rewriteText(text: string, kind: RefKind, src: string, dest: string): string {
  const rows = String(text || '').replace(/\r/g, '').split('\n');
  let changed = false;
  let section = '';
  const out = rows.map((raw) => {
    const trimmed = raw.trim();
    const sec = trimmed.match(/^\[([^\]]+)\]$/);
    if (sec) {
      section = sec[1].trim();
      return raw;
    }
    const isInclude = trimmed.startsWith('INCLUDE ');
    const eq = trimmed.indexOf('=');
    if (!isInclude && (eq <= 0 || !trimmed || trimmed.startsWith('#') || trimmed === 'APPEND')) return raw;
    const line: Line = isInclude
      ? { raw, key: 'INCLUDE', value: trimmed.slice(8).trim(), section, line: 0, include: true }
      : { raw, key: trimmed.slice(0, eq).trim(), value: trimmed.slice(eq + 1).trim(), section, line: 0, include: false };
    if (!lineHolds(line, kind, src)) return raw;
    const newValue = replaceLineValue(line, kind, src, dest);
    if (newValue === line.value) return raw;
    changed = true;
    const indent = raw.slice(0, raw.length - raw.trimStart().length);
    return isInclude ? `${indent}INCLUDE ${newValue}` : `${indent}${line.key}=${newValue}`;
  });
  return changed ? out.join('\n') : text;
}

/** Returns a new files map; unchanged texts keep the same string reference. */
export function renameRefs(
  files: Record<string, string>,
  kind: RefKind,
  from: string,
  to: string,
): Record<string, string> {
  const src = String(from || '').trim();
  const dest = String(to || '').trim();
  if (!src || !dest || src === dest) return files;
  const next: Record<string, string> = { ...files };
  for (const [path, text] of Object.entries(files)) {
    const rewritten = rewriteText(text, kind, src, dest);
    if (rewritten !== text) next[path] = rewritten;
  }
  return next;
}

export function formatUsageList(usages: RefUsage[], limit = 8): string {
  if (usages.length === 0) return 'Not used anywhere else in the project.';
  const lines = usages.slice(0, limit).map((u) => `${u.path}:${u.line} ${u.key}=${u.value}`);
  if (usages.length > limit) lines.push(`…and ${usages.length - limit} more`);
  return lines.join('\n');
}

export function compactUsageMessage(kind: string, id: string, usages: RefUsage[]): string {
  if (usages.length === 0) return `Delete ${kind} ${id}? It is not used anywhere else.`;
  const places = [...new Set(usages.map((u) => u.path))];
  const shown = places.slice(0, 3).join(', ');
  const extra = places.length > 3 ? ` +${places.length - 3}` : '';
  const n = usages.length;
  return `Used in ${n} place${n === 1 ? '' : 's'} (${shown}${extra}). Delete anyway? References will stay.`;
}
