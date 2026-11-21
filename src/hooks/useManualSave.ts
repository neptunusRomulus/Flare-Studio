import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import { useSaveQueue } from '@/context/SaveQueueContext';
import { useRetryStrategy } from '@/context/RetryStrategyContext';
import { useConflictResolution } from '@/context/ConflictResolutionContext';
import useAtomicSave from './useAtomicSave';
import useSaveSequencing from './useSaveSequencing';
import useSaveErrorNotification from './useSaveErrorNotification';
import useFileConflictDetection from './useFileConflictDetection';
import { debugLog } from '@/lib/debugLog';
import { buildManualSaveTasks, getFileStatsSafe } from './manualSaveTasks';

/**
 * Manual save (Ctrl+S / logo menu).
 *
 * This hook owns sequencing, conflict detection and progress/UI state. The
 * file content itself comes from `@/flare/manualSaveExport` through the task
 * list in `manualSaveTasks`.
 */
export default function useManualSave(args: {
  editor?: TileMapEditor | null;
  currentProjectPath?: string | null;
  setIsManuallySaving: (v: boolean) => void;
  setLastSaveTime: (t: number) => void;
  manualSaveRef?: React.MutableRefObject<(() => Promise<void>) | undefined>;
  onAfterSave?: () => void | Promise<void>;
}) {
  const { editor, currentProjectPath, setIsManuallySaving, setLastSaveTime } = args;
  const { registerSave } = useSaveQueue();
  const { executeWithRetry } = useRetryStrategy();
  const { executeAtomicSave, getErrorSummary, hasPartialFailure } = useAtomicSave();
  const { showConflictPrompt } = useConflictResolution();
  const { notifyManualSaveError, resolveError } = useSaveErrorNotification();
  const { checkFileConflict, registerFileSave: registerFileConflictSave } = useFileConflictDetection();

  // Initialize save sequencing for NPC/Item/Enemy coordination
  const saveSequencing = useSaveSequencing(editor ?? null, {
    onSequencingStart: () => {
      debugLog('[ManualSave] Save sequencing started');
    },
    onSequencingComplete: (order) => {
      debugLog('[ManualSave] Save sequence completed in order:', order.join(' -> '));
    },
    onSequencingError: (error) => {
      console.error('[ManualSave] Save sequencing error:', error);
    }
  });

  const [lastErrorMessage, setLastErrorMessage] = useState<string>('');
  const [partialFailureWarning, setPartialFailureWarning] = useState<string>('');
  const [lastErrorId, setLastErrorId] = useState<string | null>(null);
  const saveCounterRef = useRef(0);

  const handleManualSave = useCallback(async () => {
    if (!editor) {
      console.warn('[ManualSave] Skipping — editor is null');
      return;
    }

    // Skip if a tab switch is currently in progress. Between clearMapGrid() and loadProjectData()
    // the editor holds an empty grid, and saving now would overwrite the previously-saved map
    // file with zero tile data. The auto-save will fire again after the switch completes.
    if ((editor as unknown as { getTabSwitching?: () => boolean }).getTabSwitching?.()) {
      debugLog('[ManualSave] Skipping — tab switch in progress (grid is being reloaded)');
      return;
    }

    const saveId = `manual-save-${++saveCounterRef.current}`;
    debugLog('[ManualSave] ▶ Starting save. id:', saveId, '| projectPath:', currentProjectPath, '| mapName:', typeof editor.getMapName === 'function' ? editor.getMapName() : '(unknown)');

    const savePromise = (async () => {
      // Lock save to prevent edits during save
      editor.lockSave?.();
      setIsManuallySaving(true);
      try {
        setLastErrorMessage('');
        setPartialFailureWarning('');

        // Coordinate saves for NPCs, Items, Enemies to prevent data inconsistency
        // This must happen before the main project save to ensure all objects are in sync
        debugLog('[ManualSave] Coordinating NPC/Item/Enemy saves...');
        const sequencingSuccess = await saveSequencing.coordinateSaveSequence();
        if (!sequencingSuccess) {
          const consistencyErrors = saveSequencing.validateSaveConsistency();
          const errorMsg = `Object save coordination failed: ${consistencyErrors.join('; ')}`;
          setLastErrorMessage(errorMsg);
          const errorId = notifyManualSaveError(
            'NPC/Item/Enemy coordination failed',
            currentProjectPath || undefined
          );
          setLastErrorId(errorId);
          return;
        }

        // Check for file conflicts before attempting save
        if (currentProjectPath) {
          debugLog('[ManualSave] Checking for file conflicts before save');
          try {
            // Get current file stats for conflict detection
            const getFileStats = () => getFileStatsSafe(currentProjectPath);

            // Check if there's actually a conflict
            const currentFileSize = editor.getCurrentProjectFileSize();
            const conflictResult = await checkFileConflict(
              currentProjectPath,
              currentFileSize,
              getFileStats,
              1000 // 1 second tolerance for filesystem timestamp precision
            );

            // Only show conflict prompt if there's actually a real conflict
            if (conflictResult.hasConflict && conflictResult.severity !== 'none') {
              debugLog('[ManualSave] Actual file conflict detected, showing prompt to user');
              const resolution = await showConflictPrompt({
                filePath: currentProjectPath,
                reason: conflictResult.reason || 'File was modified externally',
                severity: conflictResult.severity,
                conflictingFiles: conflictResult.conflictingFiles
              });

              if (resolution === 'cancel') {
                debugLog('[ManualSave] User cancelled save due to conflict');
                setLastErrorMessage('Save cancelled - file conflict detected');
                return;
              } else if (resolution === 'reload') {
                debugLog('[ManualSave] User chose to reload external version');
                setLastErrorMessage('Reload not yet implemented - please use File > Revert');
                return;
              }
              // resolution === 'keep_app' or 'merge' - proceed with save
            } else {
              debugLog('[ManualSave] No file conflict detected, proceeding with save');
            }
          } catch (conflictErr) {
            console.warn('[ManualSave] Error during conflict check:', conflictErr);
            // Continue with save if conflict detection fails
          }
        }

        // Clear any previous success to show new error if this save fails
        resolveError(lastErrorId);

        // Build comprehensive save transactions for all components
        // Each component is saved separately for modularity and better error handling
        const saveTasks = buildManualSaveTasks(editor, currentProjectPath);

        // Execute save with atomic transaction for multi-part saves
        const transactionResult = await executeAtomicSave(saveTasks);

        // Check transaction results
        if (transactionResult.success) {
          setLastSaveTime(Date.now());
          setLastErrorMessage('');
          setPartialFailureWarning('');
          resolveError(lastErrorId);
          editor.markAsFullySaved?.();
          // Refresh spawn.txt with the current hero position after every successful save
          // so moving the hero and saving (Ctrl+S) updates the intermap= line.
          try { await args.onAfterSave?.(); } catch (_e) { void _e; }

          // Update file conflict detection tracking after successful save
          if (currentProjectPath) {
            const currentFileSize = editor.getCurrentProjectFileSize();

            // Get function to retrieve actual file stats
            const getFileStats = () => getFileStatsSafe(currentProjectPath);

            registerFileConflictSave(currentProjectPath, currentFileSize, { getFileStats });
            debugLog('[ManualSave] Updated file conflict tracking after successful save');
          }

          debugLog(
            `[ManualSave] ✅ Complete save successful! All components saved:` +
            `\n  • Map painting data & Layer info` +
            `\n  • Tileset palettes & Images` +
            `\n  • Tab layout & Map structure` +
            `\n  • Layer information` +
            `\n  • Settings & Preferences` +
            `\n  (${transactionResult.summary.successful}/${transactionResult.summary.total} operations)`
          );
        } else {
          const errorMsg = getErrorSummary();
          setLastErrorMessage(errorMsg || 'Save failed - check transaction history');

          const newErrorId = notifyManualSaveError(
            errorMsg || 'Save transaction failed',
            currentProjectPath || undefined
          );
          setLastErrorId(newErrorId);

          // Warn if partial failure occurred
          if (hasPartialFailure()) {
            const partialMsg = `⚠️ Partial save failure: Some data saved, some failed. ${transactionResult.summary.rolledBack} operations rolled back.`;
            setPartialFailureWarning(partialMsg);
            console.warn('[ManualSave]', partialMsg);
          }

          console.error(
            `[ManualSave] Save transaction failed: ${transactionResult.summary.failed} failures, ` +
            `${transactionResult.summary.rolledBack} rolled back`
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setLastErrorMessage(errorMsg);
        const errorId = notifyManualSaveError(errorMsg, currentProjectPath || undefined);
        setLastErrorId(errorId);
        console.error('[ManualSave] Unexpected error:', error);
      } finally {
        // Unlock save to allow edits
        editor.unlockSave?.();
        setIsManuallySaving(false);
      }
      return;
    })();

    // Register this save with the queue
    registerSave(saveId, savePromise, true);

    return savePromise;
  }, [editor, currentProjectPath, setIsManuallySaving, setLastSaveTime, registerSave, executeAtomicSave, getErrorSummary, hasPartialFailure, showConflictPrompt, checkFileConflict, registerFileConflictSave, saveSequencing]);

  // Optionally populate a stable ref so callers (IPC) can call the latest implementation
  const manualSaveRef = args.manualSaveRef;
  useEffect(() => {
    if (manualSaveRef) {
      manualSaveRef.current = handleManualSave;
      return () => { manualSaveRef.current = undefined; };
    }
    return undefined;
  }, [handleManualSave, manualSaveRef, notifyManualSaveError, resolveError]);

  return { handleManualSave, lastErrorMessage, partialFailureWarning };
}
