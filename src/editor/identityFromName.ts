/**
 * Derive a unique id/filename from a display name, and rename an already-saved
 * object with the reference engine when that name changes on save.
 * Item ids stay numeric in the Flare engine and are not slugged.
 */
import { slugFileName } from '../adapters/flare/flareAdapter.cjs';
import { loadProjectTextMap } from './projectFiles';
import {
  canonicalIdentity,
  displayIdentity,
  identitiesInProject,
  renameProjectIdentity,
  type IdentityKind,
  type RenameCheck,
} from './identityRename';

/** Kinds whose engine id or filename is derived from the display name. */
export const NAME_SLUG_KINDS = ['npc', 'quest', 'enemy', 'map', 'flag'] as const;
export type NameSlugKind = (typeof NAME_SLUG_KINDS)[number];

function isNameSlugKind(kind: IdentityKind): kind is NameSlugKind {
  return (NAME_SLUG_KINDS as readonly string[]).includes(kind);
}

/** Folder prefix of a current file id, so enemies/base/antlion.txt stays under base/. */
export function preservedDir(kind: IdentityKind, currentId: string | undefined): string {
  if (kind !== 'enemy' || !currentId) return '';
  const display = displayIdentity(kind, currentId);
  const slash = display.lastIndexOf('/');
  return slash >= 0 ? display.slice(0, slash + 1) : '';
}

/** Shared slug, with a leading underscore when a Story Flag would start with a digit. */
export function slugFromDisplayName(kind: IdentityKind, name: string): string {
  if (kind === 'item') return '';
  let slug = slugFileName(name);
  if (kind === 'flag' && /^[0-9]/.test(slug)) slug = `_${slug}`;
  return slug;
}

function candidateId(kind: IdentityKind, slug: string, currentId?: string): string {
  return `${preservedDir(kind, currentId)}${slug}`;
}

function sameIdentity(kind: IdentityKind, left: string, right: string): boolean {
  if (!left || !right) return false;
  if (kind === 'flag' || kind === 'item') return left.trim() === right.trim();
  return canonicalIdentity(kind, left) === canonicalIdentity(kind, right);
}

function isTaken(files: Record<string, string>, kind: IdentityKind, candidate: string, currentId?: string): boolean {
  if (currentId && sameIdentity(kind, candidate, currentId)) return false;
  const existing = identitiesInProject(files, kind);
  if (kind === 'flag' || kind === 'item') return existing.has(candidate);
  return existing.has(canonicalIdentity(kind, candidate)) || existing.has(displayIdentity(kind, candidate));
}

/** Slug the display name and append _2, _3, … when that id is already used. */
export function uniqueSlugFromName(
  files: Record<string, string>,
  kind: IdentityKind,
  name: string,
  currentId?: string,
): string {
  if (!isNameSlugKind(kind)) return kind === 'item' ? String(currentId || '').trim() : slugFileName(name);
  const base = slugFromDisplayName(kind, name);
  const first = candidateId(kind, base, currentId);
  if (!isTaken(files, kind, first, currentId)) return first;
  let n = 2;
  let next = candidateId(kind, `${base}_${n}`, currentId);
  while (isTaken(files, kind, next, currentId)) {
    n += 1;
    next = candidateId(kind, `${base}_${n}`, currentId);
  }
  return next;
}

export type RenameFromNameResult = RenameCheck & { changed: boolean };

/**
 * If the object already has an id and the display name slugs to a different id,
 * rename it in the background. No-op for items, empty names, or unchanged slugs.
 * Never mass-renames: only this one object, and only when the name changed.
 */
export async function renameIfNameChanged(
  projectPath: string,
  kind: IdentityKind,
  currentId: string,
  displayName: string,
): Promise<RenameFromNameResult> {
  const current = String(currentId || '').trim();
  if (kind === 'item' || !projectPath || !current || !String(displayName || '').trim()) {
    return { ok: true, nextId: current, usageCount: 0, changed: false };
  }
  const files = await loadProjectTextMap(projectPath);
  const desired = uniqueSlugFromName(files, kind, displayName, current);
  if (sameIdentity(kind, desired, current)) {
    return { ok: true, nextId: current, usageCount: 0, changed: false };
  }
  const result = await renameProjectIdentity(projectPath, kind, current, desired);
  if (!result.ok) return { ...result, nextId: current, changed: false };
  return { ...result, changed: true };
}
