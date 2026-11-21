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

  it('derives logo marks: red unsaved, amber backed-up, none saved, error wins, recovery is separate', () => {
    expect(deriveLogoState({ mapStatus: 'saved', editorDirty: false, hasRecovery: false })).toEqual({ mark: 'none', showRecovery: false });
    expect(deriveLogoState({ mapStatus: 'unsaved', editorDirty: false, hasRecovery: false })).toEqual({ mark: 'unsaved', showRecovery: false });
    expect(deriveLogoState({ mapStatus: 'backed-up', editorDirty: false, hasRecovery: false })).toEqual({ mark: 'backed-up', showRecovery: false });
    expect(deriveLogoState({ mapStatus: 'backed-up', editorDirty: true, hasRecovery: false })).toEqual({ mark: 'unsaved', showRecovery: false });
    expect(deriveLogoState({ mapStatus: 'error', editorDirty: false, hasRecovery: true })).toEqual({ mark: 'error', showRecovery: true });
    expect(deriveLogoState({ mapStatus: 'saved', editorDirty: false, hasRecovery: true })).toEqual({ mark: 'none', showRecovery: true });
  });

  it('builds tooltips with the backup time and a recovery hint', () => {
    const at = Date.UTC(2026, 10, 21, 3, 0, 0);
    expect(logoTooltip({ mark: 'backed-up', showRecovery: false }, at)).toMatch(/Backed up at /);
    expect(logoTooltip({ mark: 'backed-up', showRecovery: false }, at)).toContain('Ctrl+S to write project files');
    expect(logoTooltip({ mark: 'error', showRecovery: false }, null, 'disk full')).toBe('disk full');
    expect(logoTooltip({ mark: 'none', showRecovery: true })).toMatch(/recovery backup/i);
    expect(logoTooltip({ mark: 'unsaved', showRecovery: false })).toMatch(/Unsaved changes/);
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
