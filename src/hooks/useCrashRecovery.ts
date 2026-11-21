import { useCallback, useEffect, useRef, useState } from 'react';
import { backupMapName, isCrashBackupFresh } from '@/editor/saveHealth';

export type CrashBackupPayload = {
  timestamp?: number;
  mapName?: string;
  mapWidth?: number;
  mapHeight?: number;
  [key: string]: unknown;
};

interface SessionRecoveryState {
  hasCrashBackup: boolean;
  backupTimestamp: number | null;
  mapName: string | null;
  isRecovering: boolean;
  recoveryError: string | null;
}

interface CrashRecoveryOptions {
  projectPath?: string | null;
  onRecoveryFound?: (backup: unknown) => void;
  onRecoveryDismissed?: () => void;
  onRecoverBackup?: (backup: unknown) => boolean | Promise<boolean>;
}

async function readCrashBackup(projectPath: string | null | undefined): Promise<CrashBackupPayload | null> {
  try {
    if (!projectPath || !window.electronAPI?.readCrashBackup) return null;
    const backup = await window.electronAPI.readCrashBackup(projectPath);
    return backup && typeof backup === 'object' ? backup as CrashBackupPayload : null;
  } catch (err) {
    console.warn('[CrashRecovery] Failed to read crash backup:', err);
    return null;
  }
}

async function clearCrashBackupFile(projectPath: string | null | undefined): Promise<void> {
  try {
    if (!projectPath || !window.electronAPI?.clearCrashBackup) return;
    await window.electronAPI.clearCrashBackup(projectPath);
  } catch (err) {
    console.warn('[CrashRecovery] Failed to clear crash backup file:', err);
  }
}

/** Wait until `probe` is truthy or `timeoutMs` elapses. Used so Recover can wait for the editor. */
export async function waitUntil<T>(probe: () => T | Promise<T>, timeoutMs = 15000, intervalMs = 50): Promise<T | null> {
  const started = Date.now();
  while (Date.now() - started <= timeoutMs) {
    const value = await probe();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

/**
 * Detects a leftover project crash backup on open and lets the user recover or discard it.
 * Does not use sessionStorage. Stale backups (>24h) are deleted and ignored.
 */
export default function useCrashRecovery(options: CrashRecoveryOptions = {}) {
  const { projectPath, onRecoveryFound, onRecoveryDismissed, onRecoverBackup } = options;

  const [recoveryState, setRecoveryState] = useState<SessionRecoveryState>({
    hasCrashBackup: false,
    backupTimestamp: null,
    mapName: null,
    isRecovering: false,
    recoveryError: null,
  });

  const onRecoveryFoundRef = useRef(onRecoveryFound);
  onRecoveryFoundRef.current = onRecoveryFound;
  const onRecoverBackupRef = useRef(onRecoverBackup);
  onRecoverBackupRef.current = onRecoverBackup;
  const onRecoveryDismissedRef = useRef(onRecoveryDismissed);
  onRecoveryDismissedRef.current = onRecoveryDismissed;
  const backupRef = useRef<CrashBackupPayload | null>(null);
  const projectPathRef = useRef(projectPath);
  projectPathRef.current = projectPath;

  useEffect(() => {
    let cancelled = false;

    const detect = async () => {
      if (!projectPath) {
        backupRef.current = null;
        if (!cancelled) {
          setRecoveryState({
            hasCrashBackup: false,
            backupTimestamp: null,
            mapName: null,
            isRecovering: false,
            recoveryError: null,
          });
        }
        return;
      }

      const backup = await readCrashBackup(projectPath);
      if (cancelled) return;

      if (!backup || !isCrashBackupFresh(backup.timestamp)) {
        if (backup) await clearCrashBackupFile(projectPath);
        backupRef.current = null;
        setRecoveryState({
          hasCrashBackup: false,
          backupTimestamp: null,
          mapName: null,
          isRecovering: false,
          recoveryError: null,
        });
        return;
      }

      backupRef.current = backup;
      setRecoveryState({
        hasCrashBackup: true,
        backupTimestamp: typeof backup.timestamp === 'number' ? backup.timestamp : Date.now(),
        mapName: backupMapName(backup) || 'Unknown Map',
        isRecovering: false,
        recoveryError: null,
      });
      onRecoveryFoundRef.current?.(backup);
    };

    void detect();
    return () => { cancelled = true; };
  }, [projectPath]);

  const recoverSession = useCallback(async (): Promise<boolean> => {
    if (!backupRef.current && !projectPathRef.current) return false;

    setRecoveryState((prev) => ({ ...prev, isRecovering: true, recoveryError: null }));

    try {
      const backup = backupRef.current ?? await readCrashBackup(projectPathRef.current);
      if (!backup) throw new Error('Backup data not found in project backup folder');
      if (!isCrashBackupFresh(backup.timestamp)) throw new Error('Backup is older than 24 hours');
      backupRef.current = backup;

      const recovered = await onRecoverBackupRef.current?.(backup);
      if (recovered !== true) throw new Error('Failed to restore backup into editor state');

      await clearCrashBackupFile(projectPathRef.current);
      backupRef.current = null;
      setRecoveryState({
        hasCrashBackup: false,
        backupTimestamp: null,
        mapName: null,
        isRecovering: false,
        recoveryError: null,
      });
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('[CrashRecovery] Recovery failed:', error);
      setRecoveryState((prev) => ({ ...prev, isRecovering: false, recoveryError: error, hasCrashBackup: true }));
      return false;
    }
  }, []);

  const dismissRecovery = useCallback((): void => {
    void clearCrashBackupFile(projectPathRef.current);
    backupRef.current = null;
    setRecoveryState({
      hasCrashBackup: false,
      backupTimestamp: null,
      mapName: null,
      isRecovering: false,
      recoveryError: null,
    });
    onRecoveryDismissedRef.current?.();
  }, []);

  const getCrashTimeFormatted = (): string | null => {
    if (!recoveryState.backupTimestamp) return null;
    try { return new Date(recoveryState.backupTimestamp).toLocaleString(); } catch { return null; }
  };

  const getTimeSinceCrash = (): string | null => {
    if (!recoveryState.backupTimestamp) return null;
    try {
      const elapsed = Date.now() - recoveryState.backupTimestamp;
      const seconds = Math.floor(elapsed / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
      if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
    } catch {
      return null;
    }
  };

  return {
    hasCrashBackup: recoveryState.hasCrashBackup,
    backupTimestamp: recoveryState.backupTimestamp,
    mapName: recoveryState.mapName,
    isRecovering: recoveryState.isRecovering,
    recoveryError: recoveryState.recoveryError,
    recoverSession,
    dismissRecovery,
    getCrashTimeFormatted,
    getTimeSinceCrash,
  };
}
