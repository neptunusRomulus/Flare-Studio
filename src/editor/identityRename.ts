/**
 * Validate and apply an identity rename (item, NPC, quest, Story Flag, enemy, map).
 * File-based kinds also move their project-relative paths; callers persist those moves.
 */
import { questAcceptDialogueId, questClaimedStatus, questTurnInDialogueId } from './questFlow';
import { collectSectionIds } from './engineForms';
import {
  findUsages,
  pathsMatch,
  renameRefs,
  type RefKind,
} from './projectRefs';
import { loadProjectTextMap, projectRoot, writeChangedTextMap } from './projectFiles';

export type IdentityKind = RefKind;

export type RenameCheck = {
  ok: boolean;
  error?: string;
  nextId: string;
  usageCount: number;
};

export type PathMove = { from: string; to: string; optional?: boolean };

const FILE_KINDS = new Set<IdentityKind>(['npc', 'quest', 'enemy', 'map']);

const SAFE: Record<IdentityKind, RegExp> = {
  item: /^[1-9]\d*$/,
  flag: /^[A-Za-z_][A-Za-z0-9_]*$/,
  quest: /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
  npc: /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
  map: /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
  enemy: /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9][A-Za-z0-9_-]*$/,
};

const FOLDER: Record<'npc' | 'quest' | 'enemy' | 'map', string> = {
  npc: 'npcs/',
  quest: 'quests/',
  enemy: 'enemies/',
  map: 'maps/',
};

function stripWrap(kind: IdentityKind, raw: string): string {
  let value = String(raw || '').trim().replace(/\\/g, '/');
  if (FILE_KINDS.has(kind)) {
    const folder = FOLDER[kind as keyof typeof FOLDER];
    if (value.startsWith(folder)) value = value.slice(folder.length);
    value = value.replace(/\.txt$/i, '');
  }
  return value;
}

/** User-facing id (no folder prefix or .txt). */
export function displayIdentity(kind: IdentityKind, id: string): string {
  return stripWrap(kind, id);
}

/** Canonical id used in refs and as a file path for file-based kinds. */
export function canonicalIdentity(kind: IdentityKind, id: string): string {
  const base = stripWrap(kind, id);
  if (!base) return '';
  if (kind === 'item' || kind === 'flag') return base;
  return `${FOLDER[kind]}${base}.txt`;
}

export function validateIdentity(kind: IdentityKind, raw: string): { ok: boolean; error?: string; value: string } {
  const value = stripWrap(kind, raw);
  if (!value) return { ok: false, error: 'Enter a new id.', value };
  if (value.includes('..') || value.startsWith('/') || /\\/.test(String(raw))) {
    return { ok: false, error: 'That id is not a safe path.', value };
  }
  if (!SAFE[kind].test(value)) {
    if (kind === 'item') return { ok: false, error: 'Item ids must be a positive number.', value };
    return { ok: false, error: 'Use letters, numbers, hyphen or underscore only.', value };
  }
  return { ok: true, value };
}

export function identitiesInProject(files: Record<string, string>, kind: IdentityKind): Set<string> {
  if (kind === 'item') return collectSectionIds(files, ['item']);
  if (kind === 'flag') {
    const found = new Set<string>();
    const keys = /^(set_status|unset_status|requires_status|requires_not_status|complete_status|show_status|defeat_status|status_loot)$/;
    for (const text of Object.values(files)) {
      for (const raw of String(text || '').split('\n')) {
        const eq = raw.trim().indexOf('=');
        if (eq <= 0) continue;
        const key = raw.trim().slice(0, eq).trim();
        const value = raw.trim().slice(eq + 1).trim();
        if (key === 'quest_loot') {
          for (const part of value.split(',').slice(0, 2)) if (part.trim()) found.add(part.trim());
          continue;
        }
        if (!keys.test(key)) continue;
        for (const part of value.split(',')) if (part.trim()) found.add(part.trim());
      }
    }
    return found;
  }
  const folder = FOLDER[kind];
  const found = new Set<string>();
  for (const path of Object.keys(files)) {
    const norm = path.replace(/\\/g, '/');
    if (!norm.startsWith(folder) || !/\.txt$/i.test(norm)) continue;
    found.add(canonicalIdentity(kind, norm));
    found.add(displayIdentity(kind, norm));
  }
  return found;
}

export function identityFileMoves(kind: IdentityKind, from: string, to: string): PathMove[] {
  if (!FILE_KINDS.has(kind)) return [];
  const src = canonicalIdentity(kind, from);
  const dest = canonicalIdentity(kind, to);
  if (!src || !dest || src === dest) return [];
  const moves: PathMove[] = [{ from: src, to: dest }];
  if (kind === 'quest') {
    const a = displayIdentity(kind, from);
    const b = displayIdentity(kind, to);
    moves.push({ from: `content/quests/${a}.json`, to: `content/quests/${b}.json`, optional: true });
  }
  if (kind === 'map') {
    const a = displayIdentity(kind, from);
    const b = displayIdentity(kind, to);
    moves.push({ from: `${a}.json`, to: `${b}.json`, optional: true });
  }
  return moves;
}

function rewriteQuestStudioIds(files: Record<string, string>, from: string, to: string): Record<string, string> {
  const pairs = [
    [questAcceptDialogueId(from), questAcceptDialogueId(to)],
    [questTurnInDialogueId(from), questTurnInDialogueId(to)],
    [questClaimedStatus(from), questClaimedStatus(to)],
  ];
  let next = files;
  for (const [src, dest] of pairs) {
    if (src === dest) continue;
    const afterIds = Object.fromEntries(
      Object.entries(next).map(([path, text]) => {
        const rewritten = text.replace(
          new RegExp(`^(\\s*id=)${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'gm'),
          `$1${dest}`,
        );
        return [path, rewritten];
      }),
    );
    next = renameRefs(afterIds, 'flag', src, dest);
  }
  return next;
}

export function validateRename(
  files: Record<string, string>,
  kind: IdentityKind,
  from: string,
  rawTo: string,
): RenameCheck {
  const current = kind === 'item' || kind === 'flag' ? String(from || '').trim() : canonicalIdentity(kind, from);
  const parsed = validateIdentity(kind, rawTo);
  const nextId = kind === 'item' || kind === 'flag' ? parsed.value : canonicalIdentity(kind, parsed.value);
  const usageCount = current
    ? Math.max(findUsages(files, kind, current).length, findUsages(files, kind, displayIdentity(kind, from)).length)
    : 0;
  if (!parsed.ok) return { ok: false, error: parsed.error, nextId: parsed.value, usageCount };
  if (!current) return { ok: false, error: 'Nothing to rename.', nextId, usageCount };
  const same = kind === 'item' || kind === 'flag'
    ? current === parsed.value
    : pathsMatch(current, nextId, kind);
  if (same) return { ok: false, error: 'That is already the current id.', nextId, usageCount };
  const existing = identitiesInProject(files, kind);
  const collision = kind === 'item' || kind === 'flag'
    ? existing.has(parsed.value)
    : existing.has(nextId) || existing.has(displayIdentity(kind, nextId));
  if (collision) return { ok: false, error: 'An id with that name already exists.', nextId, usageCount };
  return { ok: true, nextId, usageCount };
}

export function applyIdentityRename(
  files: Record<string, string>,
  kind: IdentityKind,
  from: string,
  to: string,
): { files: Record<string, string>; moves: PathMove[] } {
  const src = kind === 'item' || kind === 'flag' ? String(from).trim() : canonicalIdentity(kind, from);
  const dest = kind === 'item' || kind === 'flag' ? String(to).trim() : canonicalIdentity(kind, to);
  let next = renameRefs(files, kind, src, dest);
  if (kind === 'quest') next = rewriteQuestStudioIds(next, displayIdentity('quest', from), displayIdentity('quest', dest));
  const moves = identityFileMoves(kind, from, dest);
  for (const move of moves) {
    if (next[move.from] != null) {
      next[move.to] = next[move.from];
      if (move.from !== move.to) delete next[move.from];
    }
  }
  return { files: next, moves };
}

export function usageCountMessage(count: number): string {
  if (count <= 0) return 'No other references will change.';
  return `${count} reference${count === 1 ? '' : 's'} will be updated.`;
}

export async function renameProjectIdentity(
  projectPath: string,
  kind: IdentityKind,
  from: string,
  rawTo: string,
): Promise<RenameCheck & { moved?: PathMove[] }> {
  const files = await loadProjectTextMap(projectPath);
  const check = validateRename(files, kind, from, rawTo);
  if (!check.ok) return check;
  const applied = applyIdentityRename(files, kind, from, check.nextId);
  const root = projectRoot(projectPath);
  const api = window.electronAPI as typeof window.electronAPI & {
    renameProjectFile?: (fromPath: string, toPath: string) => Promise<{ success: boolean; error?: string; missing?: boolean }>;
    createFolderIfNotExists?: (folder: string) => Promise<boolean>;
  };
  for (const move of applied.moves) {
    const fromPath = `${root}/${move.from}`;
    const toPath = `${root}/${move.to}`;
    if (api.renameProjectFile) {
      const folder = toPath.slice(0, toPath.lastIndexOf('/'));
      if (folder) await api.createFolderIfNotExists?.(folder);
      const result = await api.renameProjectFile(fromPath, toPath);
      if (!result?.success && !(move.optional && result?.missing)) {
        return { ok: false, error: result?.error || `Could not rename ${move.from}.`, nextId: check.nextId, usageCount: check.usageCount };
      }
    } else if (!move.optional) {
      const text = applied.files[move.to] ?? files[move.from];
      if (text == null) {
        return { ok: false, error: `Could not rename ${move.from}.`, nextId: check.nextId, usageCount: check.usageCount };
      }
      const { writeProjectFiles } = await import('./projectFiles');
      const written = await writeProjectFiles(projectPath, [{ path: move.to, content: text }]);
      if (!written) {
        return { ok: false, error: `Could not write ${move.to}.`, nextId: check.nextId, usageCount: check.usageCount };
      }
    }
  }
  const previousAfterMoves: Record<string, string> = { ...files };
  for (const move of applied.moves) {
    if (previousAfterMoves[move.from] != null) {
      previousAfterMoves[move.to] = previousAfterMoves[move.from];
      delete previousAfterMoves[move.from];
    }
  }
  const saved = await writeChangedTextMap(projectPath, applied.files, previousAfterMoves);
  if (!saved) return { ok: false, error: 'Could not update project files.', nextId: check.nextId, usageCount: check.usageCount };
  return { ...check, moved: applied.moves };
}
