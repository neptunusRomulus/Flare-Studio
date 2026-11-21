import { describe, expect, it } from 'vitest';
import {
  anythingDirty,
  backupMapName,
  CRASH_BACKUP_MAX_AGE_MS,
  deriveLogoState,
  isCrashBackupFresh,
  logoTooltip,
} from './saveHealth';

describe('saveHealth', () => {
  it('treats backed-up maps and any editor source as dirty', () => {
    expect(anythingDirty('saved', {})).toBe(false);
    expect(anythingDirty('backed-up', {})).toBe(true);
    expect(anythingDirty('unsaved', {})).toBe(true);
    expect(anythingDirty('error', {})).toBe(true);
    expect(anythingDirty('saved', { books: false })).toBe(false);
    expect(anythingDirty('saved', { books: true })).toBe(true);
  });

  it('derives logo marks: red for unsaved or backed-up, none when saved, error wins; no recovery mark', () => {
    expect(deriveLogoState({ mapStatus: 'saved', editorDirty: false })).toEqual({ mark: 'none' });
    expect(deriveLogoState({ mapStatus: 'unsaved', editorDirty: false })).toEqual({ mark: 'unsaved' });
    expect(deriveLogoState({ mapStatus: 'backed-up', editorDirty: false })).toEqual({ mark: 'unsaved' });
    expect(deriveLogoState({ mapStatus: 'backed-up', editorDirty: true })).toEqual({ mark: 'unsaved' });
    expect(deriveLogoState({ mapStatus: 'error', editorDirty: false })).toEqual({ mark: 'error' });
    expect(deriveLogoState({ mapStatus: 'saved', editorDirty: true })).toEqual({ mark: 'unsaved' });
  });

  it('builds tooltips without backup-time or recovery hints', () => {
    expect(logoTooltip({ mark: 'error' }, 'disk full')).toBe('disk full');
    expect(logoTooltip({ mark: 'none' })).toBe('Menu — all changes saved');
    expect(logoTooltip({ mark: 'unsaved' })).toMatch(/Unsaved changes/);
  });

  it('rejects stale or invalid crash backups after 24 hours', () => {
    const now = 1_700_000_000_000;
    expect(isCrashBackupFresh(now, now)).toBe(true);
    expect(isCrashBackupFresh(now - CRASH_BACKUP_MAX_AGE_MS, now)).toBe(true);
    expect(isCrashBackupFresh(now - CRASH_BACKUP_MAX_AGE_MS - 1, now)).toBe(false);
    expect(isCrashBackupFresh('nope', now)).toBe(false);
    expect(isCrashBackupFresh(0, now)).toBe(false);
    expect(backupMapName({ mapName: '  iron_labyrinth_f1  ' })).toBe('iron_labyrinth_f1');
    expect(backupMapName({ mapName: '' })).toBe(null);
    expect(backupMapName(null)).toBe(null);
  });
});
