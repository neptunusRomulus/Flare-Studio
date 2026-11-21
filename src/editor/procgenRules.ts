/** maps/procgen_rules/*.txt — Map::procGenFillArea rules. [settings], [chunks] filename=, plus INCLUDE/APPEND. */

export const PROCGEN_RULES_DIR = 'maps/procgen_rules';
export const PROCGEN_RULES_LIST_ID = 'procgen-rules-files';

export const PROCGEN_SETTING_KEYS = [
  'doors_max',
  'main_path_length_min',
  'main_path_length_max',
  'main_path_attempts_max',
  'branch_length_min',
  'branch_length_max',
  'branches_per_door_level_max',
  'door_spacing_min',
] as const;

export const PROCGEN_SETTING_HINTS: Record<(typeof PROCGEN_SETTING_KEYS)[number], string> = {
  doors_max: 'Maximum number of door chunks that can be placed in this region.',
  main_path_length_min: "Minimum length of the 'main' path (start chunk to end chunk).",
  main_path_length_max: "Maximum length of the 'main' path (start chunk to end chunk).",
  main_path_attempts_max: 'Maximum number of attempts to generate the main path to match the min/max constraints.',
  branch_length_min: 'Minimum number of steps taken when creating a branch off the main path.',
  branch_length_max: 'Maximum number of steps taken when creating a branch off the main path.',
  branches_per_door_level_max: "Maximum number of branches between each door level. A door level is the set of chunks between two door chunks (start and end count as doors).",
  door_spacing_min: 'The minimum chunk length of each door level.',
};

const SETTING_KEY_SET = new Set<string>(PROCGEN_SETTING_KEYS);

export type ProcgenKey = { key: string; value: string; comment: string };

export type ProcgenPart =
  | { kind: 'include'; path: string; comment: string }
  | { kind: 'append'; path: string; comment: string }
  | { kind: 'settings'; keys: ProcgenKey[]; comment: string }
  | { kind: 'chunks'; keys: ProcgenKey[]; comment: string }
  | { kind: 'section'; name: string; keys: ProcgenKey[]; comment: string }
  | { kind: 'loose'; keys: ProcgenKey[]; comment: string };

export type ProcgenFile = {
  header: string;
  parts: ProcgenPart[];
  trailing: string;
};

export function emptyProcgenFile(): ProcgenFile {
  return {
    header: '',
    parts: [
      { kind: 'settings', keys: PROCGEN_SETTING_KEYS.map((key) => ({ key, value: '', comment: '' })), comment: '' },
      { kind: 'chunks', keys: [{ key: 'filename', value: '', comment: '' }], comment: '' },
    ],
    trailing: '',
  };
}

export function procgenRulesRelPath(name: string): string {
  const slug = String(name || 'rules').trim().replace(/\\/g, '/').replace(/^.*\//, '').replace(/\.txt$/i, '').replace(/[^A-Za-z0-9._-]+/g, '_') || 'rules';
  return `${PROCGEN_RULES_DIR}/${slug}.txt`;
}

const commentOf = (pending: string[]) => pending.join('\n').replace(/^\n+|\n+$/g, '');

export function parseProcgenFile(text: string): ProcgenFile {
  const file: ProcgenFile = { header: '', parts: [], trailing: '' };
  const header: string[] = [];
  let pending: string[] = [];
  let seen = false;
  let part: Extract<ProcgenPart, { keys: ProcgenKey[] }> | null = null;

  const flush = () => {
    if (part) file.parts.push(part);
    part = null;
  };

  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      if (!seen) header.push(raw);
      else pending.push(raw);
      continue;
    }
    const include = trimmed.match(/^(INCLUDE|APPEND)\s+(.*)$/i);
    if (include) {
      flush();
      seen = true;
      const kind = include[1].toUpperCase() === 'APPEND' ? 'append' : 'include';
      file.parts.push({ kind, path: include[2].trim(), comment: commentOf(pending) });
      pending = [];
      continue;
    }
    const section = trimmed.match(/^\[([^\]]+)\]$/);
    if (section) {
      flush();
      seen = true;
      const name = section[1].trim();
      const comment = commentOf(pending);
      pending = [];
      if (name.toLowerCase() === 'settings') part = { kind: 'settings', keys: [], comment };
      else if (name.toLowerCase() === 'chunks') part = { kind: 'chunks', keys: [], comment };
      else part = { kind: 'section', name, keys: [], comment };
      continue;
    }
    const eq = trimmed.indexOf('=');
    const key = (eq >= 0 ? trimmed.slice(0, eq) : trimmed).trim();
    const value = eq >= 0 ? trimmed.slice(eq + 1) : '';
    if (!key) continue;
    if (!part) {
      seen = true;
      part = { kind: 'loose', keys: [], comment: commentOf(pending) };
      pending = [];
    }
    part.keys.push({ key, value, comment: commentOf(pending) });
    pending = [];
  }
  flush();
  file.header = header.join('\n').replace(/^\n+|\n+$/g, '');
  file.trailing = commentOf(pending);
  return file;
}

function emitKeys(keys: ProcgenKey[]): string[] {
  const lines: string[] = [];
  for (const row of keys) {
    if (!row.key.trim() || !String(row.value ?? '').trim()) continue;
    if (row.comment) lines.push(row.comment);
    lines.push(`${row.key}=${row.value}`);
  }
  return lines;
}

function emitPart(part: ProcgenPart): string | null {
  const comment = part.comment ? part.comment.replace(/\n+$/, '') : '';
  if (part.kind === 'include' || part.kind === 'append') {
    const directive = part.path.trim() ? `${part.kind.toUpperCase()} ${part.path.trim()}` : '';
    const block = [comment, directive].filter(Boolean).join('\n');
    return block || null;
  }
  const heading = part.kind === 'settings' ? '[settings]' : part.kind === 'chunks' ? '[chunks]' : part.kind === 'section' ? `[${part.name}]` : '';
  const keys = emitKeys(part.keys);
  if (part.kind === 'loose') {
    const lines = [comment, ...keys].filter(Boolean);
    return lines.length ? lines.join('\n') : null;
  }
  if (!keys.length && !comment) return null;
  return [comment, heading, ...keys].filter((line): line is string => Boolean(line)).join('\n');
}

export function serializeProcgenFile(file: ProcgenFile): string {
  const blocks: string[] = [];
  if (file.header) blocks.push(file.header.replace(/\n+$/, ''));
  for (const part of file.parts) {
    const block = emitPart(part);
    if (block) blocks.push(block);
  }
  if (file.trailing) blocks.push(file.trailing.replace(/\n+$/, ''));
  return blocks.length ? `${blocks.join('\n\n')}\n` : '';
}

export function isProcgenSettingKey(key: string): boolean {
  return SETTING_KEY_SET.has(key);
}

export function visibleSettingKeys(part: Extract<ProcgenPart, { kind: 'settings' }>): ProcgenKey[] {
  const found = new Map(part.keys.map((row) => [row.key, row]));
  const known = PROCGEN_SETTING_KEYS.map((key) => found.get(key) || { key, value: '', comment: '' });
  const extra = part.keys.filter((row) => !SETTING_KEY_SET.has(row.key));
  return [...known, ...extra];
}
