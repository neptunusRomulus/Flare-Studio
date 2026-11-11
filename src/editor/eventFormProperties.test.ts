import { describe, expect, it } from 'vitest';
import { mergeEventFormProperties } from './eventFormProperties';
import {
  EVENT_EXTRA_CATALOG,
  eventExtraPaletteKeys,
  eventExtraPropsFrom,
  eventExtraRowsFrom,
} from './eventExtraProperties';

const existing = {
  tooltip: 'Door',
  activate: 'on_trigger',
  location: '2,3,1,1',
  requires_status: 'has_key',
  set_status: ['door_open', 'quest_door'],
  unset_status: 'door_closed',
  cutscene: 'cutscenes/door.txt',
  stash: 'true',
  repeat: 'false',
  intramap: '10,12',
  requires_not_status: 'door_open',
  requires_not_level: '10',
  requires_not_currency: '500',
  requires_class: 'warrior',
  requires_not_class: 'mage',
  intermap_random: 'maps/random.txt',
  reachable_from: '1,1,3,3',
  loot_count: '1,3',
  shakycam: '500ms',
  custom_note: 'keep',
};

describe('mergeEventFormProperties', () => {
  it('keeps keys the form does not own and clears a form field the user emptied', () => {
    const formProps = {
      activate: 'on_interact',
      location: '2,3,1,1',
      msg: 'The door opens.',
      ...eventExtraPropsFrom(eventExtraRowsFrom(existing)),
    };
    const merged = mergeEventFormProperties(existing, formProps);
    expect(merged.requires_status).toBeUndefined();
    expect(merged.custom_note).toBe('keep');
    expect(merged.activate).toBe('on_interact');
    for (const entry of EVENT_EXTRA_CATALOG) {
      expect(merged[entry.key]).toEqual((existing as Record<string, unknown>)[entry.key]);
    }
  });

  it('drops an extra key whose row was removed', () => {
    const rows = eventExtraRowsFrom(existing).filter((row) => row.key !== 'cutscene');
    const merged = mergeEventFormProperties(existing, eventExtraPropsFrom(rows));
    expect(merged.cutscene).toBeUndefined();
    expect(merged.custom_note).toBe('keep');
  });
});

describe('event extra properties', () => {
  it('round-trips every engine key, including repeated values', () => {
    const rows = eventExtraRowsFrom(existing);
    expect(rows.filter((row) => row.key === 'set_status').map((row) => row.value)).toEqual(['door_open', 'quest_door']);
    const back = eventExtraPropsFrom(rows);
    const expected = Object.fromEntries(EVENT_EXTRA_CATALOG.map((entry) => [entry.key, (existing as Record<string, unknown>)[entry.key]]));
    expect(back).toEqual(expected);
  });

  it('drops empty text rows, writes true for a fresh toggle, and hides used single keys from the palette', () => {
    const rows = [
      { id: 'a', key: 'cutscene', value: '  ' },
      { id: 'b', key: 'stash', value: 'true' },
      { id: 'c', key: 'set_status', value: 'x' },
    ];
    expect(eventExtraPropsFrom(rows)).toEqual({ stash: 'true', set_status: 'x' });
    const palette = eventExtraPaletteKeys(rows).map((entry) => entry.key);
    expect(palette).toContain('set_status');
    expect(palette).not.toContain('stash');
    expect(palette).not.toContain('cutscene');
  });

  it('covers every event key flare-engine c6772106 loads that the form has no field for', () => {
    const keys = EVENT_EXTRA_CATALOG.map((entry) => entry.key).sort();
    expect(keys).toEqual([
      'cutscene', 'intermap_random', 'intramap', 'loot_count', 'reachable_from', 'repeat',
      'requires_class', 'requires_not_class', 'requires_not_currency', 'requires_not_level',
      'requires_not_status', 'set_status', 'shakycam', 'stash', 'tooltip', 'unset_status',
    ]);
  });
});
