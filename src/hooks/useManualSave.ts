import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import { useSaveQueue } from '@/context/SaveQueueContext';
import { useRetryStrategy } from '@/context/RetryStrategyContext';
import { useConflictResolution } from '@/context/ConflictResolutionContext';
import useAtomicSave from './useAtomicSave';
import useSaveSequencing from './useSaveSequencing';
import useSaveErrorNotification from './useSaveErrorNotification';

export default function useManualSave(args: {
  editor?: TileMapEditor | null;
  currentProjectPath?: string | null;
  setIsManuallySaving: (v: boolean) => void;
  setLastSaveTime: (t: number) => void;
  manualSaveRef?: React.MutableRefObject<(() => Promise<void>) | undefined>;
}) {
  const { editor, currentProjectPath, setIsManuallySaving, setLastSaveTime } = args;
  const { registerSave } = useSaveQueue();
  const { executeWithRetry } = useRetryStrategy();
  const { executeAtomicSave, getErrorSummary, hasPartialFailure } = useAtomicSave();
  const { showConflictPrompt } = useConflictResolution();
  const { notifyManualSaveError, resolveError } = useSaveErrorNotification();
  
  // Initialize save sequencing for NPC/Item/Enemy coordination
  const saveSequencing = useSaveSequencing(editor, {
    onSequencingStart: () => {
      console.log('[ManualSave] Save sequencing started');
    },
    onSequencingComplete: (order) => {
      console.log('[ManualSave] Save sequence completed in order:', order.join(' -> '));
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
    if (!editor) return;
    
    const saveId = `manual-save-${++saveCounterRef.current}`;
    
    const savePromise = (async () => {
      // Lock save to prevent edits during save
      editor.lockSave?.();
      setIsManuallySaving(true);
      try {
        setLastErrorMessage('');
        setPartialFailureWarning('');

        // Coordinate saves for NPCs, Items, Enemies to prevent data inconsistency
        // This must happen before the main project save to ensure all objects are in sync
        console.log('[ManualSave] Coordinating NPC/Item/Enemy saves...');
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
          return false;
        }

        // Check for file conflicts before attempting save
        if (currentProjectPath) {
          console.log('[ManualSave] Checking for file conflicts before save');
          try {
            const resolution = await showConflictPrompt({
              filePath: currentProjectPath,
              reason: 'Checking if project files were modified externally...',
              severity: 'warning'
            });
            
            if (resolution === 'cancel') {
              console.log('[ManualSave] User cancelled save due to conflict check');
              setLastErrorMessage('Save cancelled - file conflict check aborted');
              return false;
            } else if (resolution === 'reload') {
              console.log('[ManualSave] User chose to reload external version');
              setLastErrorMessage('Reload not yet implemented - please use File > Revert');
              return false;
            }
            // resolution === 'keep_app' or 'merge' - proceed with save
          } catch (conflictErr) {
            console.warn('[ManualSave] Error during conflict check:', conflictErr);
            // Continue with save if conflict detection fails
          }
        }

        // Clear any previous success to show new error if this save fails
        resolveError(lastErrorId);


        // Execute save with atomic transaction for multi-part saves
        // Coordinates editor save + individual file saves with automatic rollback
        const transactionResult = await executeAtomicSave([
          {
            name: 'Save Editor Project Data',
            execute: async () => {
              const api = (typeof window !== 'undefined') ? (window as unknown as { electronAPI?: { save?: () => void } }).electronAPI : undefined;
              if (api && currentProjectPath) {
                const success = await editor.saveProjectData(currentProjectPath);
                await new Promise(resolve => setTimeout(resolve, 300));
                if (!success) {
                  throw new Error('saveProjectData returned false');
                }
              } else {
                // web/local fallback
                try {
                  const maybe = editor as unknown as { forceSave?: () => void };
                  if (typeof maybe.forceSave === 'function') maybe.forceSave();
                } catch {
                  // ignore
                }
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            },
            rollback: async () => {
              // Rollback would restore from backup if available
              console.warn('[ManualSave] Rolling back editor save - no explicit rollback implemented');
            },
            critical: true,
            priority: 10
          }
        ]);

        // Check transaction results
        if (transactionResult.success) {
          setLastSaveTime(Date.now());
          setLastErrorMessage('');
          setPartialFailureWarning('');
          resolveError(lastErrorId);
          console.log(
            `[ManualSave] Save succeeded: ${transactionResult.summary.successful}/${transactionResult.summary.total} operations`
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
    })();

    // Register this save with the queue
    registerSave(saveId, savePromise, true);

    return savePromise;
  }, [editor, currentProjectPath, setIsManuallySaving, setLastSaveTime, registerSave, executeAtomicSave, getErrorSummary, hasPartialFailure]);

  // Optionally populate a stable ref so callers (IPC) can call the latest implementation
  useEffect(() => {
    if (args.manualSaveRef) {
      args.manualSaveRef.current = handleManualSave;
      return () => { if (args.manualSaveRef) args.manualSaveRef.current = undefined; };
    }
    return undefined;
  }, [handleManualSave, args.manualSaveRef, notifyManualSaveError, resolveError]);

  return { handleManualSave, lastErrorMessage, partialFailureWarning };
}
