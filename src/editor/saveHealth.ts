/** App-level save health: map status plus dirty flags from every editor. */

export type MapSaveStatus = 'saving' | 'saved' | 'unsaved' | 'backed-up' | 'error';

export type LogoSaveMark = 'none' | 'unsaved' | 'backed-up' | 'error';

export const CRASH_BACKUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type LogoSaveState = {
  mark: LogoSaveMark;
  showRecovery: boolean;
};

export function isMapDirty(status: MapSaveStatus): boolean {
  return status === 'unsaved' || status === 'backed-up' || status === 'error' || status === 'saving';
}

export function anythingDirty(mapStatus: MapSaveStatus, sources: Record<string, boolean>): boolean {
  if (isMapDirty(mapStatus)) return true;
  return Object.values(sources).some(Boolean);
}

/** Red if the map or any editor is unsaved (no backup yet) or a save failed. Amber only when the map is crash-backed-up and nothing else is dirty. */
export function deriveLogoState(args: {
  mapStatus: MapSaveStatus;
  editorDirty: boolean;
  hasRecovery: boolean;
}): LogoSaveState {
  const { mapStatus, editorDirty, hasRecovery } = args;
  if (mapStatus === 'error') return { mark: 'error', showRecovery: hasRecovery };
  if (editorDirty || mapStatus === 'unsaved' || mapStatus === 'saving') {
    return { mark: 'unsaved', showRecovery: hasRecovery };
  }
  if (mapStatus === 'backed-up') return { mark: 'backed-up', showRecovery: hasRecovery };
  return { mark: 'none', showRecovery: hasRecovery };
}

export function logoTooltip(state: LogoSaveState, backedUpAt?: number | null, errorMessage?: string | null): string {
  if (state.mark === 'error') return errorMessage?.trim() || 'Save failed — open the menu to try again';
  if (state.mark === 'unsaved') return 'Unsaved changes — open the menu to save (Ctrl+S)';
  if (state.mark === 'backed-up') {
    const when = backedUpAt ? ` at ${new Date(backedUpAt).toLocaleTimeString()}` : '';
    return `Backed up${when} — Ctrl+S to write project files`;
  }
  if (state.showRecovery) return 'A recovery backup is waiting — click the mark to recover or discard it';
  return 'Menu — all changes saved';
}

export function isCrashBackupFresh(timestamp: unknown, now = Date.now(), maxAge = CRASH_BACKUP_MAX_AGE_MS): boolean {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) return false;
  return now - timestamp <= maxAge;
}

export function backupMapName(backup: unknown): string | null {
  if (!backup || typeof backup !== 'object') return null;
  const name = (backup as { mapName?: unknown }).mapName;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}
