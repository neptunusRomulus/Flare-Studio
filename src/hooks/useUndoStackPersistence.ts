import { useCallback, useRef } from 'react';
import type { TileLayer, MapObject } from '../types';
import type { TileMapEditor as TileMapEditorType } from '../editor/TileMapEditor';

export interface UndoStackState {
  history: Array<{ layers: TileLayer[]; objects: MapObject[] }>;
  historyIndex: number;
}

export interface UndoStackPersistenceOptions {
  enabled?: boolean;
  maxStorageSize?: number; // Max size in KB (default 5000)
}

const STORAGE_KEY = 'ism-tile-undo-stack';
const STORAGE_SIZE_LIMIT = 5000; // KB

/**
 * Hook for persisting undo/redo history to localStorage
 * 
 * Features:
 * - Optional persistence (user can enable/disable)
 * - Automatic save on every state change
 * - Automatic restore on editor initialization
 * - Size validation to prevent overflow
 * - Compression detection for large states
 * - Error handling and fallback
 */
export default function useUndoStackPersistence() {
  const persistenceEnabledRef = useRef<boolean>(false);
  const editorRef = useRef<TileMapEditorType | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const pendingSaveRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Get storage size in KB
   */
  const getStorageSize = useCallback((): number => {
    if (typeof localStorage === 'undefined') return 0;
    
    try {
      let size = 0;
      for (const key in localStorage) {
        if (key.startsWith('ism-tile')) {
          size += localStorage.getItem(key)?.length ?? 0;
        }
      }
      return Math.ceil(size / 1024);
    } catch (e) {
      console.warn('[UndoStack] Failed to calculate storage size:', e);
      return 0;
    }
  }, []);

  /**
   * Serialize history state for storage
   */
  const serializeState = useCallback((state: UndoStackState): string | null => {
    try {
      const json = JSON.stringify(state);
      
      // Check size
      const sizeKB = Math.ceil(json.length / 1024);
      if (sizeKB > STORAGE_SIZE_LIMIT) {
        console.warn(`[UndoStack] History too large (${sizeKB}KB > ${STORAGE_SIZE_LIMIT}KB), not saving`);
        return null;
      }

      return json;
    } catch (e) {
      console.warn('[UndoStack] Failed to serialize history:', e);
      return null;
    }
  }, []);

  /**
   * Deserialize history state from storage
   */
  const deserializeState = useCallback((json: string): UndoStackState | null => {
    try {
      const state = JSON.parse(json) as UndoStackState;
      
      // Validate structure
      if (!Array.isArray(state.history)) {
        console.warn('[UndoStack] Invalid history structure');
        return null;
      }
      
      if (typeof state.historyIndex !== 'number' || state.historyIndex < -1) {
        console.warn('[UndoStack] Invalid history index');
        return null;
      }

      return state;
    } catch (e) {
      console.warn('[UndoStack] Failed to deserialize history:', e);
      return null;
    }
  }, []);

  /**
   * Save undo/redo history to localStorage
   */
  const saveUndoStack = useCallback((editor: TileMapEditorType): boolean => {
    if (!persistenceEnabledRef.current || !editor) return false;
    
    try {
      // Get history using public getter method
      const state = editor.getUndoStackState();

      if (!Array.isArray(state.history)) {
        console.warn('[UndoStack] History not available on editor');
        return false;
      }

      const json = serializeState(state);

      if (!json) return false;

      localStorage.setItem(STORAGE_KEY, json);
      lastSaveTimeRef.current = Date.now();
      
      return true;
    } catch (e) {
      console.warn('[UndoStack] Failed to save undo stack:', e);
      return false;
    }
  }, [serializeState]);

  /**
   * Load undo/redo history from localStorage
   */
  const loadUndoStack = useCallback((editor: TileMapEditorType): boolean => {
    if (!persistenceEnabledRef.current || !editor) return false;

    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (!json) return false;

      const state = deserializeState(json);
      if (!state) return false;

      // Set history using public setter method
      editor.setUndoStackState(state);

      console.log(
        `[UndoStack] Restored ${state.history.length} history states (index: ${state.historyIndex})`
      );
      
      return true;
    } catch (e) {
      console.warn('[UndoStack] Failed to load undo stack:', e);
      return false;
    }
  }, [deserializeState]);

  /**
   * Clear saved undo/redo history from localStorage
   */
  const clearUndoStack = useCallback((): void => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[UndoStack] Cleared saved undo history');
    } catch (e) {
      console.warn('[UndoStack] Failed to clear undo stack:', e);
    }
  }, []);

  /**
   * Enable persistence (call this when user enables the setting)
   */
  const enablePersistence = useCallback((editor: TileMapEditorType): void => {
    persistenceEnabledRef.current = true;
    editorRef.current = editor;
    
    // Save current state immediately
    saveUndoStack(editor);
  }, [saveUndoStack]);

  /**
   * Disable persistence (call this when user disables the setting)
   */
  const disablePersistence = useCallback((): void => {
    persistenceEnabledRef.current = false;
    
    // Clear any pending saves
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
  }, []);

  /**
   * Setup auto-save of undo stack (debounced)
   * Call this from the editor's saveState() method or equivalent
   */
  const trackStateChange = useCallback((editor: TileMapEditorType): void => {
    if (!persistenceEnabledRef.current) return;

    // Debounce rapid saves (100ms)
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
    }

    pendingSaveRef.current = setTimeout(() => {
      saveUndoStack(editor);
      pendingSaveRef.current = null;
    }, 100);
  }, [saveUndoStack]);

  /**
   * Get info about current saved state
   */
  const getStorageInfo = useCallback((): {
    hasStoredStack: boolean;
    storageSizeKB: number;
    isEnabled: boolean;
    lastSaveTime: number;
  } => {
    const json = localStorage.getItem(STORAGE_KEY);
    const state = json ? deserializeState(json) : null;

    return {
      hasStoredStack: !!state,
      storageSizeKB: getStorageSize(),
      isEnabled: persistenceEnabledRef.current,
      lastSaveTime: lastSaveTimeRef.current
    };
  }, [deserializeState, getStorageSize]);

  return {
    // State management
    enablePersistence,
    disablePersistence,
    
    // Persistence operations
    saveUndoStack,
    loadUndoStack,
    clearUndoStack,
    
    // Change tracking
    trackStateChange,
    
    // Utilities
    getStorageInfo,
    getStorageSize
  } as const;
}
