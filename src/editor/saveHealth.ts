/** App-level save health: map status plus dirty flags from every editor. */

export type MapSaveStatus = 'saving' | 'saved' | 'unsaved' | 'backed-up' | 'error';

/** Visible logo mark. A crash backup is silent: backed-up maps still show as unsaved (red). */
export type LogoSaveMark = 'none' | 'unsaved' | 'error';

export const CRASH_BACKUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type LogoSaveState = {
  mark: LogoSaveMark;
};

export function isMapDirty(status: MapSaveStatus): boolean {
  return status === 'unsaved' || status === 'backed-up' || status === 'error' || status === 'saving';
}

export function anythingDirty(mapStatus: MapSaveStatus, sources: Record<string, boolean>): boolean {
  if (isMapDirty(mapStatus)) return true;
  return Object.values(sources).some(Boolean);
}

/** Red if the map or any editor has unsaved work or a save failed. No amber backup mark. */
export function deriveLogoState(args: {
  mapStatus: MapSaveStatus;
  editorDirty: boolean;
}): LogoSaveState {
  const { mapStatus, editorDirty } = args;
  if (mapStatus === 'error') return { mark: 'error' };
  if (editorDirty || mapStatus === 'unsaved' || mapStatus === 'saving' || mapStatus === 'backed-up') {
    return { mark: 'unsaved' };
  }
  return { mark: 'none' };
}

export function logoTooltip(state: LogoSaveState, errorMessage?: string | null): string {
  if (state.mark === 'error') return errorMessage?.trim() || 'Save failed — open the menu to try again';
  if (state.mark === 'unsaved') return 'Unsaved changes — open the menu to save (Ctrl+S)';
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
