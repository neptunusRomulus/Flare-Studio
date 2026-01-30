import { useCallback, useEffect, useRef } from 'react';
import type { TileMapEditor as TileMapEditorType } from '../editor/TileMapEditor';
import useUndoStackPersistence from './useUndoStackPersistence';
import useSettingsPersistence from './useSettingsPersistence';

export interface UseUndoPersistenceIntegrationParams {
  editor: TileMapEditorType | null;
}

/**
 * Hook to integrate undo stack persistence with the editor
 * 
 * This hook:
 * - Enables/disables persistence based on settings
 * - Loads saved undo history when editor initializes
 * - Saves undo history on every state change
 * - Provides callbacks to clear history and manage settings
 */
export default function useUndoPersistenceIntegration({
  editor
}: UseUndoPersistenceIntegrationParams) {
  const { enablePersistence, disablePersistence, saveUndoStack, loadUndoStack, clearUndoStack, trackStateChange, getStorageInfo } = useUndoStackPersistence();
  const { getCurrentSettings, updateUndoPersistence } = useSettingsPersistence();
  const isInitializedRef = useRef(false);

  /**
   * Initialize persistence when editor is first available
   */
  useEffect(() => {
    if (!editor || isInitializedRef.current) return;

    const settings = getCurrentSettings();
    const persistenceEnabled = settings.undoPersistence?.enabled ?? false;

    if (persistenceEnabled) {
      enablePersistence(editor);
      
      // Try to load existing undo history
      const loaded = loadUndoStack(editor);
      if (loaded) {
        console.log('[UndoPersistence] Loaded saved undo history');
      }
    }

    isInitializedRef.current = true;
  }, [editor, enablePersistence, loadUndoStack, getCurrentSettings]);

  /**
   * Enable persistence (called from UI when user toggles it on)
   */
  const handleEnablePersistence = useCallback(() => {
    if (!editor) return;

    updateUndoPersistence({ enabled: true });
    enablePersistence(editor);
    
    // Save current state immediately
    saveUndoStack(editor);
    console.log('[UndoPersistence] Persistence enabled and current state saved');
  }, [editor, updateUndoPersistence, enablePersistence, saveUndoStack]);

  /**
   * Disable persistence (called from UI when user toggles it off)
   */
  const handleDisablePersistence = useCallback(() => {
    updateUndoPersistence({ enabled: false });
    disablePersistence();
    console.log('[UndoPersistence] Persistence disabled');
  }, [updateUndoPersistence, disablePersistence]);

  /**
   * Clear saved undo history (called from UI button)
   */
  const handleClearHistory = useCallback(() => {
    clearUndoStack();
    console.log('[UndoPersistence] Saved undo history cleared');
  }, [clearUndoStack]);

  /**
   * Track state change for debounced saving
   * Call this from editor's saveState() or equivalent
   */
  const handleStateChange = useCallback(() => {
    if (!editor) return;
    trackStateChange(editor);
  }, [editor, trackStateChange]);

  /**
   * Get current storage info for display
   */
  const getInfo = useCallback(() => {
    return getStorageInfo();
  }, [getStorageInfo]);

  return {
    // Control functions
    enablePersistence: handleEnablePersistence,
    disablePersistence: handleDisablePersistence,
    clearHistory: handleClearHistory,
    
    // Tracking
    onStateChange: handleStateChange,
    
    // Info
    getInfo
  } as const;
}
