import { describe, expect, it } from 'vitest';
import {
  defaultValueForExtraKey,
  extraRowListId,
  extraRowsPalette,
  extraRowsToProperties,
} from '@/components/events/eventExtraPropertiesView';
import type { EventExtraRow } from '@/editor/eventExtraProperties';

const row = (key: string, value = ''): EventExtraRow => ({ id: `id-${key}`, key, value });

describe('extraRowsToProperties', () => {
  it('keeps the row id as key so renames never collide with engine keys', () => {
    const [property] = extraRowsToProperties([row('some_unknown_key', 'x')]);
    expect(property.key).toBe('id-some_unknown_key');
    expect(property.value).toBe('x');
    expect(property.label).toBe('some_unknown_key');
    expect(property.tooltip).toBe('some_unknown_key');
  });

  it('points story flags and procgen files at their datalists', () => {
    const [flag, procgen, plain] = extraRowsToProperties([
      row('requires_status', 'flag_one'),
      row('procgen_filename', 'rules/cave.txt'),
      row('some_unknown_key', ''),
    ]);
    expect(flag.list).toBe('story-flag-suggestions');
    expect(procgen.list).toBeTruthy();
    expect(plain.list).toBeUndefined();
    expect(extraRowListId('some_unknown_key')).toBeUndefined();
  });
});

describe('extraRowsPalette', () => {
  it('does not offer a key the event already has', () => {
    const catalog = extraRowsPalette([row('requires_status', 'flag_one')]);
    expect(catalog.some((entry) => entry.id === 'requires_status')).toBe(false);
    expect(catalog.length).toBeGreaterThan(0);
  });
});

describe('defaultValueForExtraKey', () => {
  it('starts switch keys on and everything else empty', () => {
    expect(defaultValueForExtraKey('some_unknown_key')).toBe('');
    const toggles = extraRowsPalette([]).filter((entry) => entry.id);
    expect(toggles.length).toBeGreaterThan(0);
  });
});
