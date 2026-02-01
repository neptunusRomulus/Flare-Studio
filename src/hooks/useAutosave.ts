import { useCallback, useEffect, useRef, useState } from 'react';
import { useSaveQueue } from '@/context/SaveQueueContext';
import { useRetryStrategy } from '@/context/RetryStrategyContext';
import useSettingsPersistence from './useSettingsPersistence';
import useFileConflictDetection from './useFileConflictDetection';
import useSaveErrorNotification from './useSaveErrorNotification';

type SaveStatus = 'saving' | 'saved' | 'error' | 'unsaved';

export default function useAutosave(opts: { 
  manualSaveRef: React.MutableRefObject<(() => Promise<void>) | undefined>; 
  autoSaveInterval?: number; 
  debounceMs?: number;
  currentFilePath?: string;
  currentFileSize?: number;
  onConflictDetected?: (filePath: string, reason: string) => Promise<'proceed' | 'cancel'>;
}) {
  const { manualSaveRef, autoSaveInterval: propInterval = 5000, debounceMs: propDebounce = 2000, currentFilePath, currentFileSize = 0, onConflictDetected } = opts;
  const { registerSave } = useSaveQueue();
  const { executeWithRetry } = useRetryStrategy();
  const { getCurrentSettings, updateAutoSaveSettings } = useSettingsPersistence();
  const { registerFileLoad, registerFileSave, checkFileConflict, getConflictDetectionStatus } = useFileConflictDetection();
  const { notifyAutoSaveError, resolveError } = useSaveErrorNotification();

  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);
  const [autoSaveIntervalMs, setAutoSaveIntervalMs] = useState<number>(propInterval);
  const [autoSaveDebounceMs, setAutoSaveDebounceMs] = useState<number>(propDebounce);
  const [isManuallySaving, setIsManuallySaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('unsaved');
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastErrorMessage, setLastErrorMessage] = useState<string>('');
  const [saveProgress, setSaveProgress] = useState<number>(0);
  const [lastErrorId, setLastErrorId] = useState<string | null>(null);

  const debounceTimer = useRef<number | null>(null);
  const intervalTimer = useRef<number | null>(null);
  const saveCounterRef = useRef(0);
  const retryCountRef = useRef(0);
  
  // Sync settings from UISettings on mount
  useEffect(() => {
    const settings = getCurrentSettings();
    if (settings.autoSaveSettings) {
      if (settings.autoSaveSettings.enabled !== undefined) {
        setAutoSaveEnabled(settings.autoSaveSettings.enabled);
      }
      if (settings.autoSaveSettings.intervalMs !== undefined) {
        setAutoSaveIntervalMs(settings.autoSaveSettings.intervalMs);
      }
      if (settings.autoSaveSettings.debounceMs !== undefined) {
        setAutoSaveDebounceMs(settings.autoSaveSettings.debounceMs);
      }
    }
  }, [getCurrentSettings]);
  
  // Save timing settings when they change
  useEffect(() => {
    updateAutoSaveSettings({
      enabled: autoSaveEnabled,
      intervalMs: autoSaveIntervalMs,
      debounceMs: autoSaveDebounceMs
    });
  }, [autoSaveEnabled, autoSaveIntervalMs, autoSaveDebounceMs, updateAutoSaveSettings]);
  
  // Register file load when file path changes
  useEffect(() => {
    if (currentFilePath && currentFileSize) {
      registerFileLoad(currentFilePath, currentFileSize);
      console.log(`[Autosave] Registered file load for conflict detection: ${currentFilePath}`);
    }
  }, [currentFilePath, currentFileSize, registerFileLoad]);

  // Initialize hasUnsavedChanges from pending changes on mount/update
  useEffect(() => {
    // On mount or if pending changes exist, ensure hasUnsavedChanges reflects reality
    if (pendingChangesRef.current && !hasUnsavedChanges) {
      console.log('[Autosave] Initializing hasUnsavedChanges from pending changes');
      setHasUnsavedChanges(true);
    }
  }, [hasUnsavedChanges]);
  
  // Track pending changes separately from debounce timer
  // Ensures changes aren't lost even if debounce timer clears unexpectedly
  const pendingChangesRef = useRef(false);
  const lastChangeTimeRef = useRef<number>(0);

  const performSave = useCallback(async (manual = false) => {
    const saveFn = manualSaveRef.current;
    if (!saveFn) return false;
    
    const saveId = `autosave-${++saveCounterRef.current}`;
    
    // Create promise for this save operation
    const savePromise = (async () => {
      try {
        setIsManuallySaving(manual);
        setSaveStatus('saving');
        setSaveProgress(0);
        setLastErrorMessage('');
        
        // Clear pending changes flag only after we start saving
        pendingChangesRef.current = false;

        // Capture current UI settings at save time
        const currentSettings = getCurrentSettings();
        setSaveProgress(10); // Conflict check starting
        
        // Check for file conflicts before saving
        if (currentFilePath) {
          console.log(`[Autosave] Checking for file conflicts on ${currentFilePath}`);
          
          try {
            // Get real file stats from Electron if available
            const getFileStats = async (): Promise<{ modifiedTime: number; size: number } | null> => {
              const electronAPI = (window as unknown as { electronAPI?: { invoke?: unknown } }).electronAPI;
              if (electronAPI && typeof electronAPI.invoke === 'function') {
                const invoke = electronAPI.invoke as (channel: string, ...args: unknown[]) => Promise<unknown>;
                const stats = await invoke('get-file-stats', currentFilePath);
                if (stats && typeof stats === 'object' && 'modifiedTime' in stats && 'size' in stats) {
                  return {
                    modifiedTime: (stats as { modifiedTime: number }).modifiedTime,
                    size: (stats as { size: number }).size
                  };
                }
              }
              return null;
            };

            // Check for conflicts with actual file stats
            const conflictResult = await checkFileConflict(
              currentFilePath,
              currentFileSize,
              getFileStats
            );

            if (conflictResult.hasConflict && onConflictDetected) {
              console.warn('[Autosave] File conflict detected, prompting user');
              setSaveProgress(20); // Conflict prompt shown
              const userChoice = await onConflictDetected(
                currentFilePath,
                conflictResult.reason || 'File was modified externally'
              );
              if (userChoice === 'cancel') {
                console.log('[Autosave] User cancelled save due to detected conflict');
                pendingChangesRef.current = true; // Keep changes pending
                setLastErrorMessage('Save cancelled - file conflict detected');
                setSaveProgress(0);
                return false;
              }
            }
          } catch (conflictCheckErr) {
            console.warn('[Autosave] Error during conflict check:', conflictCheckErr);
            // Don't fail save if conflict check fails
          }

          // Register this save with conflict detection system AFTER conflict check passes
          // This ensures the timestamp is only updated if we proceed with the save
          registerFileSave(currentFilePath, currentFileSize);
        }
        
        // Wrap original save function to include settings
        const saveWithSettings = async () => {
          // Call original save function
          setSaveProgress(30); // Main save starting
          await saveFn();
          setSaveProgress(70); // Main save completed
          
          // After main save, persist settings data
          // This is non-blocking - if it fails, main save still succeeded
          try {
            setSaveProgress(80); // Settings persistence starting
            if (typeof (window as unknown as {electronAPI?: {saveSettings?: unknown}}).electronAPI?.saveSettings === 'function') {
              const api = (window as unknown as {electronAPI: {saveSettings: (settings: unknown) => Promise<void>}}).electronAPI;
              await api.saveSettings(currentSettings);
              console.log('[Autosave] Settings persisted to disk');
            }
            setSaveProgress(90); // Settings saved
          } catch (settingsErr) {
            console.warn('[Autosave] Failed to persist settings:', settingsErr);
            // Don't fail the main save if settings persistence fails
          }
        };

        // Execute save with exponential backoff retry strategy
        const result = await executeWithRetry(
          saveWithSettings,
          `autosave-${saveId}`,
          {
            maxRetries: manual ? 4 : 2, // More retries for manual saves
            initialDelayMs: manual ? 300 : 500,
            maxDelayMs: manual ? 20000 : 15000,
            backoffMultiplier: 2,
            jitterFactor: 0.1
          }
        );

        if (result.success) {
          retryCountRef.current = 0; // Reset retry counter on success
          setSaveProgress(100); // Save complete
          setLastSaveTime(Date.now());
          setSaveStatus('saved');
          setHasUnsavedChanges(false);
          setLastErrorMessage('');
          resolveError(lastErrorId);

          // Update file conflict detection tracking after successful save
          if (currentFilePath) {
            const getFileStats = async (): Promise<{ modifiedTime: number; size: number } | null> => {
              if (typeof window !== 'undefined' && (window as unknown as {electronAPI?: {getFileStats?: unknown}}).electronAPI) {
                const api = (window as unknown as {electronAPI: {getFileStats: (path: string) => Promise<{modifiedTime: number; size: number} | null>}}).electronAPI;
                if (typeof api.getFileStats === 'function') {
                  try {
                    return await api.getFileStats(currentFilePath);
                  } catch (err) {
                    console.warn('[Autosave] Failed to get file stats:', err);
                    return null;
                  }
                }
              }
              return null;
            };

            registerFileSave(currentFilePath, currentFileSize, { getFileStats });
            console.log('[Autosave] Updated file conflict tracking after successful save');
          }

          console.log(
            `[Autosave] Save succeeded (${result.attempts} attempt${result.attempts > 1 ? 's' : ''}) - Map data + Settings`
          );
          return true;
        } else {
          retryCountRef.current++;
          const errorMsg = result.error?.message || 'Save failed after retries';
          setSaveStatus('error');
          setLastErrorMessage(errorMsg);
          const newErrorId = notifyAutoSaveError(
            errorMsg,
            currentFilePath || undefined,
            retryCountRef.current
          );
          setLastErrorId(newErrorId);
          // Restore pending changes flag and state since save failed
          pendingChangesRef.current = true;
          setHasUnsavedChanges(true);
          console.error(
            `[Autosave] Save failed after ${result.attempts} attempts: ${errorMsg}`
          );
          return false;
        }
      } catch (error) {
        retryCountRef.current++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        setSaveStatus('error');
        setLastErrorMessage(errorMsg);
        const newErrorId = notifyAutoSaveError(
          errorMsg,
          currentFilePath || undefined,
          retryCountRef.current
        );
        setLastErrorId(newErrorId);
        // Restore pending changes flag and state on exception
        pendingChangesRef.current = true;
        setHasUnsavedChanges(true);
        console.error('[Autosave] Unexpected error during save:', error);
        return false;
      } finally {
        setIsManuallySaving(false);
        // Reset progress after a delay to show completion
        window.setTimeout(() => { 
          setSaveProgress(0);
          setSaveStatus(prev => prev === 'saved' ? 'unsaved' : prev); 
        }, 2000);
      }
    })();

    // Register this save with the queue
    registerSave(saveId, savePromise.then(() => {}), manual);

    return savePromise;
  }, [manualSaveRef, registerSave, executeWithRetry, getCurrentSettings, currentFilePath, currentFileSize, onConflictDetected, registerFileSave, checkFileConflict, notifyAutoSaveError, resolveError, lastErrorId]);

  const triggerManualSave = useCallback(async () => performSave(true), [performSave]);

  // Sync hasUnsavedChanges with actual pending changes
  // This effect keeps the state reactive to actual editor changes
  useEffect(() => {
    // If hasUnsavedChanges changes to true, mark as pending
    if (hasUnsavedChanges) {
      lastChangeTimeRef.current = Date.now();
      pendingChangesRef.current = true;
    } else {
      // Only clear pending flag if we've actually saved (not just UI update)
      // If there are still pending changes but flag is false, restore it
      if (pendingChangesRef.current) {
        // Pending changes exist but flag is false - sync them
        console.log('[Autosave] Restoring hasUnsavedChanges from pending flag');
        setHasUnsavedChanges(true);
      }
    }
  }, [hasUnsavedChanges]);

  // Periodically check if pending changes exist but flag is out of sync
  // This catches cases where changes occur without triggering the effect
  useEffect(() => {
    const syncTimer = window.setInterval(() => {
      if (pendingChangesRef.current && !hasUnsavedChanges) {
        console.log('[Autosave] Syncing hasUnsavedChanges from pending changes');
        setHasUnsavedChanges(true);
      }
    }, 500); // Check every 500ms for drift
    return () => window.clearInterval(syncTimer);
  }, [hasUnsavedChanges]);

  // Debounced autosave when hasUnsavedChanges flips true
  // Tracks pending changes separately to avoid losing track during rapid edits
  useEffect(() => {
    if (!autoSaveEnabled) return;
    if (!hasUnsavedChanges) return;
    
    // Mark that we have pending changes requiring save
    pendingChangesRef.current = true;
    lastChangeTimeRef.current = Date.now();
    
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    
    debounceTimer.current = window.setTimeout(() => {
      // Check if we still have pending changes (in case multiple effects interfered)
      if (pendingChangesRef.current && hasUnsavedChanges) {
        console.log(
          `[Autosave] Debounce expired - triggering save (pending for ${Date.now() - lastChangeTimeRef.current}ms)`
        );
        void performSave(false);
      }
    }, autoSaveDebounceMs) as unknown as number;
    
    return () => { 
      if (debounceTimer.current) { 
        window.clearTimeout(debounceTimer.current); 
        debounceTimer.current = null; 
      } 
    };
  }, [hasUnsavedChanges, autoSaveEnabled, autoSaveDebounceMs, performSave]);

  // Periodic autosave heartbeat (saves if there are unsaved changes)
  // Checks both state and pending changes flag for redundancy
  useEffect(() => {
    if (!autoSaveEnabled) return;
    intervalTimer.current = window.setInterval(() => {
      // Use both hasUnsavedChanges state AND pendingChangesRef for redundancy
      if ((hasUnsavedChanges || pendingChangesRef.current) && !isManuallySaving) {
        const reason = hasUnsavedChanges ? 'state' : 'pending flag';
        console.log(`[Autosave] Interval save triggered (reason: ${reason})`);
        void performSave(false);
      }
    }, autoSaveIntervalMs) as unknown as number;
    return () => { if (intervalTimer.current) { window.clearInterval(intervalTimer.current); intervalTimer.current = null; } };
  }, [autoSaveEnabled, autoSaveIntervalMs, hasUnsavedChanges, isManuallySaving, performSave]);

  return {
    autoSaveEnabled,
    setAutoSaveEnabled,
    autoSaveIntervalMs,
    setAutoSaveIntervalMs,
    autoSaveDebounceMs,
    setAutoSaveDebounceMs,
    isManuallySaving,
    setIsManuallySaving,
    saveStatus,
    setSaveStatus,
    lastSaveTime,
    setLastSaveTime,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    lastErrorMessage,
    saveProgress,
    triggerManualSave,
    // Expose pending changes tracking for debugging
    getPendingChangesStatus: () => ({
      hasPendingChanges: pendingChangesRef.current,
      lastChangeTime: lastChangeTimeRef.current,
      timeSinceLastChange: lastChangeTimeRef.current ? Date.now() - lastChangeTimeRef.current : null
    }),
    // Settings persistence
    getUiSettings: getCurrentSettings,
    // File conflict detection
    getConflictDetectionStatus
  } as const;
}
