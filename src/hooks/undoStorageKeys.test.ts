import { describe, expect, it } from 'vitest';
import {
  LEGACY_UNDO_STORAGE_PREFIX,
  UNDO_STORAGE_KEY,
  UNDO_STORAGE_PREFIX,
  migrateUndoStorageKeys,
  trackedUndoStorageKeys,
} from './undoStorageKeys';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  const storage = {
    get length() { return Object.keys(data).length; },
    key(index: number) { return Object.keys(data)[index] ?? null; },
    getItem(key: string) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key: string, value: string) { data[key] = value; },
    snapshot: () => ({ ...data }),
  };
  return storage;
}

describe('migrateUndoStorageKeys', () => {
  it('copies ism-tile keys to flare-studio and leaves the old keys', () => {
    const storage = memoryStorage({
      'ism-tile-undo-stack': '{"history":[]}',
      'ism-tile-other': 'x',
      recentMaps: 'keep',
    });

    expect(migrateUndoStorageKeys(storage)).toBe(2);
    expect(storage.getItem(UNDO_STORAGE_KEY)).toBe('{"history":[]}');
    expect(storage.getItem(`${UNDO_STORAGE_PREFIX}-other`)).toBe('x');
    expect(storage.getItem(`${LEGACY_UNDO_STORAGE_PREFIX}-undo-stack`)).toBe('{"history":[]}');
    expect(storage.getItem('recentMaps')).toBe('keep');
  });

  it('does not overwrite a key that already exists under the new prefix', () => {
    const storage = memoryStorage({
      'ism-tile-undo-stack': 'old',
      'flare-studio-undo-stack': 'new',
    });

    expect(migrateUndoStorageKeys(storage)).toBe(0);
    expect(storage.getItem(UNDO_STORAGE_KEY)).toBe('new');
  });

  it('counts only new keys after a copy, and leftover old keys that were not copied', () => {
    const storage = memoryStorage({
      'ism-tile-undo-stack': 'old',
      'flare-studio-undo-stack': 'new',
      'ism-tile-only-old': 'y',
    });
    expect(trackedUndoStorageKeys(storage).sort()).toEqual(['flare-studio-undo-stack', 'ism-tile-only-old'].sort());
    migrateUndoStorageKeys(storage);
    expect(trackedUndoStorageKeys(storage).sort()).toEqual(['flare-studio-only-old', 'flare-studio-undo-stack'].sort());
  });
});
