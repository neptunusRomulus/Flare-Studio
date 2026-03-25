import { useEffect, useState, useRef } from 'react';

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
  checkInterval?: number; // How often to check session health (ms)
}

/**
 * Crash Recovery Hook
 * 
 * Detects app crashes by tracking session health and manages recovery from localStorage backups.
 * 
 * Features:
 * - Automatic crash detection (tracks app startup states)
 * - Session recovery from localStorage backup
 * - User prompt to confirm recovery
 * - Automatic cleanup of crash markers
 * - Timestamped backups to detect recent crashes
 * 
 * @param options Configuration options
 * @returns Recovery state and control functions
 */
export default function useCrashRecovery(options: CrashRecoveryOptions = {}) {
  const { projectPath, onRecoveryFound, onRecoveryDismissed, onRecoverBackup, checkInterval = 30000 } = options;
  
  const [recoveryState, setRecoveryState] = useState<SessionRecoveryState>({
    hasCrashBackup: false,
    backupTimestamp: null,
    mapName: null,
    isRecovering: false,
    recoveryError: null
  });

  const sessionHealthRef = useRef<{ startTime: number; lastHeartbeat: number }>({
    startTime: Date.now(),
    lastHeartbeat: Date.now()
  });

  // Keep callback refs stable so the crash-detection effect only runs once on mount
  const onRecoveryFoundRef = useRef(onRecoveryFound);
  onRecoveryFoundRef.current = onRecoveryFound;

  const onRecoverBackupRef = useRef(onRecoverBackup);
  onRecoverBackupRef.current = onRecoverBackup;

  const backupRef = useRef<unknown | null>(null);

  const crashMarkerKey = 'app_session_active';
  const lastCrashTimeKey = 'app_last_crash_time';

  const readCrashBackup = async (): Promise<unknown | null> => {
    try {
      if (!projectPath || !window.electronAPI?.readCrashBackup) {
        return null;
      }
      return await window.electronAPI.readCrashBackup(projectPath);
    } catch (err) {
      console.warn('[CrashRecovery] Failed to read crash backup:', err);
      return null;
    }
  };

  const clearCrashBackupFile = async (): Promise<void> => {
    try {
      if (!projectPath || !window.electronAPI?.clearCrashBackup) {
        return;
      }
      await window.electronAPI.clearCrashBackup(projectPath);
    } catch (err) {
      console.warn('[CrashRecovery] Failed to clear crash backup file:', err);
    }
  };

  // Detect if app crashed (crash marker exists from previous session)
  useEffect(() => {
    const detectCrash = async () => {
      try {
        const sessionActive = sessionStorage.getItem(crashMarkerKey);
        const backup = await readCrashBackup();

        if (sessionActive && backup) {
          // Previous session was active when this session started → likely crash
          console.log('[CrashRecovery] Detected crash from previous session');
          
          try {
            const parsedBackup = backup as { timestamp?: number; mapName?: string };
            const backupTimestamp = parsedBackup.timestamp || Date.now();
            const mapName = parsedBackup.mapName || 'Unknown Map';
            backupRef.current = backup;

            // Update crash time marker
            const now = Date.now();
            localStorage.setItem(lastCrashTimeKey, String(now));

            setRecoveryState(prev => ({
              ...prev,
              hasCrashBackup: true,
              backupTimestamp,
              mapName,
              isRecovering: false,
              recoveryError: null
            }));

            // Notify parent component of recovery option
            onRecoveryFoundRef.current?.(backup);
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            console.error('[CrashRecovery] Failed to parse backup data:', error);
            setRecoveryState(prev => ({
              ...prev,
              recoveryError: error,
              hasCrashBackup: false
            }));
          }
        }

        // Mark current session as active
        sessionStorage.setItem(crashMarkerKey, String(Date.now()));
      } catch (err) {
        console.error('[CrashRecovery] Crash detection error:', err);
      }
    };

    void detectCrash();
  }, [projectPath]); // eslint-disable-line react-hooks/exhaustive-deps -- callback accessed via ref

  // Session heartbeat to track app health
  useEffect(() => {
    const heartbeatInterval = window.setInterval(() => {
      try {
        sessionHealthRef.current.lastHeartbeat = Date.now();
        // Continuously update session marker to indicate app is running
        sessionStorage.setItem(crashMarkerKey, String(Date.now()));
      } catch (err) {
        console.warn('[CrashRecovery] Heartbeat error:', err);
      }
    }, checkInterval / 2); // Heartbeat every half the check interval

    return () => window.clearInterval(heartbeatInterval);
  }, [checkInterval]);

  // Recover from backup (restore editor state)
  const recoverSession = async (): Promise<boolean> => {
    if (!recoveryState.hasCrashBackup) {
      return false;
    }

    setRecoveryState(prev => ({
      ...prev,
      isRecovering: true,
      recoveryError: null
    }));

    try {
      const backup = backupRef.current ?? await readCrashBackup();
      if (!backup) {
        throw new Error('Backup data not found in project backup folder');
      }
      backupRef.current = backup;

      // Validate backup data
      const parsedBackup = backup as { mapWidth?: number; mapHeight?: number };
      if (!parsedBackup.mapWidth || !parsedBackup.mapHeight) {
        throw new Error('Invalid backup format: missing map dimensions');
      }

      const recovered = await onRecoverBackupRef.current?.(backup);
      if (recovered !== true) {
        throw new Error('Failed to restore backup into editor state');
      }

      console.log('[CrashRecovery] Session recovered from crash backup');

      // Clear crash marker now that recovery is complete
      clearCrashMarker();
      await clearCrashBackupFile();
      backupRef.current = null;

      setRecoveryState(prev => ({
        ...prev,
        isRecovering: false,
        hasCrashBackup: false
      }));

      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('[CrashRecovery] Recovery failed:', error);

      setRecoveryState(prev => ({
        ...prev,
        isRecovering: false,
        recoveryError: error
      }));

      return false;
    }
  };

  // Dismiss recovery (don't recover from crash)
  const dismissRecovery = (): void => {
    console.log('[CrashRecovery] User dismissed crash recovery');
    clearCrashMarker();
    void clearCrashBackupFile();
    backupRef.current = null;

    setRecoveryState(prev => ({
      ...prev,
      hasCrashBackup: false,
      recoveryError: null
    }));

    onRecoveryDismissed?.();
  };

  // Clear crash marker and reset session
  const clearCrashMarker = (): void => {
    try {
      // Clear the old crash marker but keep timestamp
      sessionStorage.removeItem(crashMarkerKey);
      // Note: Don't clear lastCrashTimeKey, keep it for debugging
    } catch (err) {
      console.warn('[CrashRecovery] Failed to clear crash marker:', err);
    }
  };

  // Clean up old backups if crash recovery is dismissed
  const clearOldBackups = (): void => {
    try {
      // Only clear if we're sure recovery was dismissed
      // This prevents accidental loss of recent backups
      const lastCrashTime = localStorage.getItem(lastCrashTimeKey);
      const now = Date.now();

      if (lastCrashTime) {
        const timeSinceCrash = now - parseInt(lastCrashTime, 10);
        // Only clear if crash was more than 1 hour ago
        if (timeSinceCrash > 60 * 60 * 1000) {
          console.log('[CrashRecovery] Clearing old crash backups (>1 hour old)');
          void clearCrashBackupFile();
          backupRef.current = null;
        }
      }
    } catch (err) {
      console.warn('[CrashRecovery] Failed to clear old backups:', err);
    }
  };

  // Get human-readable crash timestamp
  const getCrashTimeFormatted = (): string | null => {
    if (!recoveryState.backupTimestamp) return null;
    try {
      const date = new Date(recoveryState.backupTimestamp);
      return date.toLocaleString();
    } catch {
      return null;
    }
  };

  // Get time since crash (e.g., "2 minutes ago")
  const getTimeSinceCrash = (): string | null => {
    if (!recoveryState.backupTimestamp) return null;
    try {
      const now = Date.now();
      const elapsed = now - recoveryState.backupTimestamp;
      
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
    // State
    hasCrashBackup: recoveryState.hasCrashBackup,
    backupTimestamp: recoveryState.backupTimestamp,
    mapName: recoveryState.mapName,
    isRecovering: recoveryState.isRecovering,
    recoveryError: recoveryState.recoveryError,

    // Actions
    recoverSession,
    dismissRecovery,
    clearOldBackups,

    // Helpers
    getCrashTimeFormatted,
    getTimeSinceCrash,
    clearCrashMarker
  };
}
