import type { EditorProperty } from '@/components/EditorPropertyList';
import type { SearchablePaletteEntry } from '@/components/ui/searchable-palette';
import { EVENT_EXTRA_CATALOG, eventExtraPaletteKeys, type EventExtraRow } from '@/editor/eventExtraProperties';
import { isStoryFlagType, STORY_FLAG_LIST_ID } from '@/editor/powers/storyFlags';
import { PROCGEN_RULES_LIST_ID } from '@/editor/procgenRules';

/** The datalist a key's value should suggest from, if any. */
export function extraRowListId(key: string): string | undefined {
  if (isStoryFlagType(key)) return STORY_FLAG_LIST_ID;
  if (key === 'procgen_filename') return PROCGEN_RULES_LIST_ID;
  return undefined;
}

/** Rows as the shared property-list widget wants them: catalog label first, raw key as the fallback. */
export function extraRowsToProperties(rows: EventExtraRow[]): EditorProperty[] {
  return rows.map((row) => {
    const entry = EVENT_EXTRA_CATALOG.find((item) => item.key === row.key);
    return {
      key: row.id,
      label: entry?.label || row.key,
      value: row.value,
      tooltip: entry?.tooltip || row.key,
      kind: entry?.kind,
      list: extraRowListId(row.key),
    };
  });
}

/** Add-property palette, minus the keys already on the event. */
export function extraRowsPalette(rows: EventExtraRow[]): SearchablePaletteEntry[] {
  return eventExtraPaletteKeys(rows).map((entry) => ({
    id: entry.key,
    label: entry.label,
    tooltip: entry.tooltip,
    searchText: `${entry.key} ${entry.synonyms || ''}`,
  }));
}

/** New rows start "on" for switch keys and empty otherwise. */
export function defaultValueForExtraKey(key: string): string {
  const entry = EVENT_EXTRA_CATALOG.find((item) => item.key === key);
  return entry?.kind === 'toggle' ? 'true' : '';
}
