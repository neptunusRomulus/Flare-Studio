/**
 * Validation for the sidebar "+ NPC" draft row: a name is the only required input,
 * and a duplicate name only asks for a confirmation instead of blocking.
 */
export type NpcDraftCheck =
  | { ok: true; name: string }
  | { ok: false; message: string; needsConfirm?: boolean };

export function checkNpcDraftName(raw: string, existingNames: readonly string[], force = false): NpcDraftCheck {
  const name = String(raw ?? '').trim();
  if (!name) return { ok: false, message: 'Name is required.' };
  const clash = existingNames.some((existing) => String(existing ?? '').trim().toLowerCase() === name.toLowerCase());
  if (clash && !force) {
    return { ok: false, message: `An NPC named "${name}" already exists.`, needsConfirm: true };
  }
  return { ok: true, name };
}
