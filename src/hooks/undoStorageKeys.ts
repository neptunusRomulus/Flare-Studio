export const UNDO_STORAGE_PREFIX = 'flare-studio';
export const LEGACY_UNDO_STORAGE_PREFIX = 'ism-tile';
export const UNDO_STORAGE_KEY = `${UNDO_STORAGE_PREFIX}-undo-stack`;

type KeyStorage = {
  length: number;
  key: (index: number) => string | null;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

/** Copy legacy ism-tile* localStorage keys to flare-studio*. Does not delete the old keys. */
export function migrateUndoStorageKeys(storage: KeyStorage): number {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && key.startsWith(LEGACY_UNDO_STORAGE_PREFIX)) keys.push(key);
  }
  let migrated = 0;
  for (const oldKey of keys) {
    const newKey = UNDO_STORAGE_PREFIX + oldKey.slice(LEGACY_UNDO_STORAGE_PREFIX.length);
    if (storage.getItem(newKey) != null) continue;
    const value = storage.getItem(oldKey);
    if (value == null) continue;
    storage.setItem(newKey, value);
    migrated += 1;
  }
  return migrated;
}

export function trackedUndoStorageKeys(storage: KeyStorage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if (key.startsWith(UNDO_STORAGE_PREFIX)) {
      keys.push(key);
      continue;
    }
    if (key.startsWith(LEGACY_UNDO_STORAGE_PREFIX)) {
      const newKey = UNDO_STORAGE_PREFIX + key.slice(LEGACY_UNDO_STORAGE_PREFIX.length);
      if (storage.getItem(newKey) == null) keys.push(key);
    }
  }
  return keys;
}

let undoKeysMigrated = false;

export function ensureUndoStorageKeysMigrated(storage: KeyStorage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): void {
  if (undoKeysMigrated || !storage) return;
  try {
    migrateUndoStorageKeys(storage);
  } catch (error) {
    console.warn('[UndoStack] Failed to migrate storage keys:', error);
  }
  undoKeysMigrated = true;
}

/** Test-only: reset the one-time guard. */
export function resetUndoStorageMigrationForTests(): void {
  undoKeysMigrated = false;
}
