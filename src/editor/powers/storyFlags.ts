/** Story Flag (Flare campaign status) suggestions shared by every status field. */
import type { FlagUsage } from './powerProject';

export const STORY_FLAG_LIST_ID = 'story-flag-suggestions';
/** Folders that can set or read campaign statuses. Quest files are only read. */
export const STORY_FLAG_DIRS = ['maps', 'npcs', 'enemies', 'items', 'quests', 'powers'];

/** Condition / effect types (Studio or raw Flare) whose value is a story flag. */
export function isStoryFlagType(type: string | null | undefined): boolean {
  const t = String(type || '');
  return t !== 'random_status' && /(^|_)status$/.test(t);
}

export type FlagSuggestion = { value: string; label: string };

export function flagSuggestions(flags: Record<string, FlagUsage>, extra: string[] = []): FlagSuggestion[] {
  const names = new Set([...Object.keys(flags), ...extra.map((s) => s.trim()).filter(Boolean)]);
  return [...names].sort((a, b) => a.localeCompare(b)).map((value) => {
    const usage = flags[value];
    const setBy = usage?.setBy[0];
    const readBy = usage?.readBy[0];
    const label = setBy ? `set by ${setBy}${usage!.setBy.length > 1 ? ` +${usage!.setBy.length - 1}` : ''}` : readBy ? `checked by ${readBy} (never set)` : 'new';
    return { value, label };
  });
}
