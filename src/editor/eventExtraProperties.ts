/**
 * Map-event keys the main Event form has no dedicated field for.
 * They are edited as rows in the Properties list (+ Add property palette).
 * Raw keys stay in Tooltips; labels are plain.
 */

import type { EventPropertyValue } from './eventFormProperties';

export type EventExtraKind = 'text' | 'toggle';

export type EventExtraEntry = {
  key: string;
  label: string;
  tooltip: string;
  kind: EventExtraKind;
  /** The engine adds one component per line, so these keys may appear more than once. */
  repeatable: boolean;
  synonyms?: string;
};

export const EVENT_EXTRA_CATALOG: EventExtraEntry[] = [
  { key: 'set_status', label: 'Turns on status', tooltip: 'set_status — turns these statuses on (comma list)', kind: 'text', repeatable: true, synonyms: 'flag set quest progress' },
  { key: 'unset_status', label: 'Turns off status', tooltip: 'unset_status — turns these statuses off (comma list)', kind: 'text', repeatable: true, synonyms: 'flag clear remove quest' },
  { key: 'requires_not_status', label: 'Only if status is off', tooltip: 'requires_not_status — runs only while these statuses are off', kind: 'text', repeatable: true, synonyms: 'condition not flag' },
  { key: 'requires_not_level', label: 'Only below level', tooltip: 'requires_not_level — runs only while the hero is below this level', kind: 'text', repeatable: false, synonyms: 'condition max level' },
  { key: 'requires_not_currency', label: 'Only with less gold than', tooltip: 'requires_not_currency — runs only while the hero has less than this much currency', kind: 'text', repeatable: false, synonyms: 'condition money gold max' },
  { key: 'requires_class', label: 'Only for class', tooltip: 'requires_class — runs only for this base class', kind: 'text', repeatable: true, synonyms: 'condition class warrior mage' },
  { key: 'requires_not_class', label: 'Not for class', tooltip: 'requires_not_class — never runs for this base class', kind: 'text', repeatable: true, synonyms: 'condition class exclude' },
  { key: 'cutscene', label: 'Plays cutscene', tooltip: 'cutscene — shows this cutscene file, e.g. cutscenes/intro.txt', kind: 'text', repeatable: false, synonyms: 'movie story scene' },
  { key: 'stash', label: 'Opens stash', tooltip: 'stash — opens the stash menu', kind: 'toggle', repeatable: false, synonyms: 'storage chest bank' },
  { key: 'repeat', label: 'Can run again', tooltip: 'repeat — the event can fire more than once', kind: 'toggle', repeatable: false, synonyms: 'repeatable again loop' },
  { key: 'intramap', label: 'Moves hero on this map', tooltip: 'intramap — jumps the hero to X,Y on the current map', kind: 'text', repeatable: false, synonyms: 'teleport warp jump position' },
  { key: 'intermap_random', label: 'Teleports to a random map', tooltip: 'intermap_random — picks a map from this map list file', kind: 'text', repeatable: false, synonyms: 'teleport random map list' },
  { key: 'tooltip', label: 'Hover text', tooltip: 'tooltip — text shown when hovering the event', kind: 'text', repeatable: false, synonyms: 'label name hover' },
  { key: 'reachable_from', label: 'Reachable from area', tooltip: 'reachable_from — X,Y,W,H area the hero must stand in to use it', kind: 'text', repeatable: false, synonyms: 'range area rectangle' },
  { key: 'loot_count', label: 'Loot amount', tooltip: 'loot_count — min,max number of loot drops', kind: 'text', repeatable: false, synonyms: 'drop count number' },
  { key: 'shakycam', label: 'Shakes camera', tooltip: 'shakycam — shakes the camera for this long, e.g. 500ms or 1s', kind: 'text', repeatable: false, synonyms: 'screen shake earthquake' },
];

export const EVENT_EXTRA_KEYS = new Set(EVENT_EXTRA_CATALOG.map((entry) => entry.key));

export type EventExtraRow = { id: string; key: string; value: string };

let rowCounter = 0;
export function newEventExtraRowId(): string {
  rowCounter += 1;
  return `extra-${rowCounter}`;
}

/** Existing event properties → one row per value of every catalog key (catalog order). */
export function eventExtraRowsFrom(
  properties: Record<string, EventPropertyValue | undefined> | null | undefined,
): EventExtraRow[] {
  const rows: EventExtraRow[] = [];
  const props = properties || {};
  for (const entry of EVENT_EXTRA_CATALOG) {
    const raw = props[entry.key];
    if (raw == null) continue;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) rows.push({ id: newEventExtraRowId(), key: entry.key, value: String(value) });
  }
  return rows;
}

/** Rows → event properties. Repeated keys become arrays; empty text rows are dropped; toggles write "true". */
export function eventExtraPropsFrom(rows: EventExtraRow[]): Record<string, EventPropertyValue> {
  const out: Record<string, EventPropertyValue> = {};
  for (const row of rows) {
    const entry = EVENT_EXTRA_CATALOG.find((item) => item.key === row.key);
    if (!entry) continue;
    const value = entry.kind === 'toggle' ? (row.value.trim().toLowerCase() === 'false' ? 'false' : row.value.trim() || 'true') : row.value.trim();
    if (!value) continue;
    const prev = out[row.key];
    if (prev == null) out[row.key] = value;
    else out[row.key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
  }
  return out;
}

/** Palette entries: repeatable keys always, single keys only while unused. */
export function eventExtraPaletteKeys(rows: EventExtraRow[]): EventExtraEntry[] {
  const used = new Set(rows.map((row) => row.key));
  return EVENT_EXTRA_CATALOG.filter((entry) => entry.repeatable || !used.has(entry.key));
}
