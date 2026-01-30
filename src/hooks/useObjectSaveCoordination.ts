import { useCallback, useRef, useEffect } from 'react';
import type { MapObject } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';

/**
 * Coordinates saves for NPCs, Items, and Enemies
 * Ensures all object changes are sequenced together or rolled back together
 * Prevents data inconsistency from independent saves
 */

type ObjectType = 'npc' | 'item' | 'enemy' | 'actor' | 'rule' | 'event' | 'object' | 'background';

interface PendingObjectChange {
  type: ObjectType;
  objectId: number;
  changes: Partial<MapObject>;
  timestamp: number;
  originalObject: MapObject;
}

interface SaveCoordinationState {
  pendingChanges: Map<number, PendingObjectChange>;
  isSaving: boolean;
  lastSaveTime: number;
  changesSinceLastSave: number;
}

export default function useObjectSaveCoordination(editor: TileMapEditor | null) {
  // Track all pending object changes
  const coordinationStateRef = useRef<SaveCoordinationState>({
    pendingChanges: new Map(),
    isSaving: false,
    lastSaveTime: 0,
    changesSinceLastSave: 0
  });

  // Debounce timer for batching changes
  const batchDebounceRef = useRef<number | null>(null);

  // Callbacks for save events
  const onObjectChangeCallbackRef = useRef<((objects: MapObject[]) => void) | null>(null);
  const onSaveStartCallbackRef = useRef<(() => void) | null>(null);
  const onSaveCompleteCallbackRef = useRef<((success: boolean) => void) | null>(null);

  /**
   * Rollback changes for objects that failed to save
   */
  const rollbackChanges = useCallback(async (): Promise<number> => {
    if (!editor) return 0;

    const state = coordinationStateRef.current;
    let rolledBackCount = 0;

    for (const [objId, pendingChange] of state.pendingChanges.entries()) {
      // Restore original object by applying inverse changes
      const originalData = pendingChange.originalObject;
      editor.updateMapObject(objId, originalData);
      rolledBackCount++;
    }

    return rolledBackCount;
  }, [editor]);

  /**
   * Coordinate save operation for all pending object changes
   * Ensures NPCs, Items, Enemies are saved together
   */
  const coordinateSave = useCallback(async () => {
    if (!editor) return;

    const state = coordinationStateRef.current;

    // Don't start new save if one is in progress
    if (state.isSaving) {
      console.log('[ObjectSaveCoordination] Save already in progress, queuing changes');
      return;
    }

    if (state.pendingChanges.size === 0) {
      console.log('[ObjectSaveCoordination] No pending changes to save');
      return;
    }

    state.isSaving = true;
    console.log(
      `[ObjectSaveCoordination] Starting coordinated save for ${state.pendingChanges.size} objects`
    );

    // Notify save start
    onSaveStartCallbackRef.current?.();

    try {
      // Get all affected objects by type
      const affectedByType = new Map<ObjectType, MapObject[]>();
      const objectIds = Array.from(state.pendingChanges.keys());

      for (const objId of objectIds) {
        const obj = editor.getMapObjects().find(o => o.id === objId);
        if (obj) {
          const type = obj.type as ObjectType;
          if (!affectedByType.has(type)) {
            affectedByType.set(type, []);
          }
          affectedByType.get(type)!.push(obj);
        }
      }

      // Log what's being saved
      const typeSummary = Array.from(affectedByType.entries())
        .map(([type, objs]) => `${type}(${objs.length})`)
        .join(', ');
      console.log(`[ObjectSaveCoordination] Saving: ${typeSummary}`);

      // Apply all pending changes to editor state
      for (const [objId, pendingChange] of state.pendingChanges.entries()) {
        editor.updateMapObject(objId, pendingChange.changes);
      }

      // Clear pending changes before marking as saved
      const completedChanges = state.pendingChanges.size;
      state.pendingChanges.clear();
      state.lastSaveTime = Date.now();

      // Notify save complete
      onSaveCompleteCallbackRef.current?.(true);

      console.log(
        `[ObjectSaveCoordination] Save completed: ${completedChanges} objects updated`
      );
    } catch (error) {
      console.error('[ObjectSaveCoordination] Save failed:', error);

      // Rollback: restore original objects
      const rolledBack = await rollbackChanges();

      // Notify save failure
      onSaveCompleteCallbackRef.current?.(false);

      console.error(
        `[ObjectSaveCoordination] Rolled back ${rolledBack} objects after save failure`
      );
    } finally {
      state.isSaving = false;

      // If more changes came in during save, do another save
      if (state.pendingChanges.size > 0) {
        batchDebounceRef.current = window.setTimeout(() => {
          coordinateSave();
        }, 100);
      }
    }
  }, [editor, rollbackChanges]);

  /**
   * Track object change with coordination awareness
   * Groups NPCs, Items, Enemies together for atomic saves
   */
  const trackObjectChange = useCallback(
    (objectId: number, objectType: ObjectType, changes: Partial<MapObject>) => {
      if (!editor) return;

      const state = coordinationStateRef.current;
      const currentObject = editor.getMapObjects().find(obj => obj.id === objectId);

      if (!currentObject) {
        console.warn(`[ObjectSaveCoordination] Object ${objectId} not found`);
        return;
      }

      // Create pending change record
      const pendingChange: PendingObjectChange = {
        type: objectType,
        objectId,
        changes,
        timestamp: Date.now(),
        originalObject: { ...currentObject } // Backup for potential rollback
      };

      // Add to pending changes
      state.pendingChanges.set(objectId, pendingChange);
      state.changesSinceLastSave++;

      console.log(
        `[ObjectSaveCoordination] Tracked change for ${objectType} #${objectId}: ` +
        `${state.changesSinceLastSave} changes pending`
      );

      // Batch multiple changes together
      if (batchDebounceRef.current) {
        clearTimeout(batchDebounceRef.current);
      }

      batchDebounceRef.current = window.setTimeout(() => {
        coordinateSave();
      }, 500); // Wait 500ms for additional changes before saving
    },
    [editor, coordinateSave]
  );

  /**
   * Get summary of pending changes
   */
  const getPendingSummary = useCallback(() => {
    const state = coordinationStateRef.current;
    const typeCounts = new Map<ObjectType, number>();

    for (const pending of state.pendingChanges.values()) {
      const count = (typeCounts.get(pending.type) || 0) + 1;
      typeCounts.set(pending.type, count);
    }

    return {
      totalPending: state.pendingChanges.size,
      byType: Object.fromEntries(typeCounts),
      lastSaveTime: state.lastSaveTime,
      isSaving: state.isSaving,
      changesSinceLastSave: state.changesSinceLastSave
    };
  }, []);

  /**
   * Get objects grouped by type for coordinated operations
   */
  const getObjectsByType = useCallback(() => {
    if (!editor) return new Map<ObjectType, MapObject[]>();

    const allObjects = editor.getMapObjects();
    const byType = new Map<ObjectType, MapObject[]>();

    for (const obj of allObjects) {
      const type = obj.type as ObjectType;
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type)!.push(obj);
    }

    return byType;
  }, [editor]);

  /**
   * Force save all pending changes immediately
   */
  const flushPending = useCallback(async (): Promise<boolean> => {
    const state = coordinationStateRef.current;

    if (state.pendingChanges.size === 0) {
      console.log('[ObjectSaveCoordination] No pending changes to flush');
      return true;
    }

    console.log(
      `[ObjectSaveCoordination] Flushing ${state.pendingChanges.size} pending changes`
    );

    if (batchDebounceRef.current) {
      clearTimeout(batchDebounceRef.current);
    }

    // Wait for coordinated save
    await coordinateSave();

    // Return success if no more pending changes
    return state.pendingChanges.size === 0;
  }, [coordinateSave]);

  /**
   * Set callback for when objects change
   */
  const setOnObjectChange = useCallback((callback: (objects: MapObject[]) => void) => {
    onObjectChangeCallbackRef.current = callback;
  }, []);

  /**
   * Set callback for when save starts
   */
  const setOnSaveStart = useCallback((callback: () => void) => {
    onSaveStartCallbackRef.current = callback;
  }, []);

  /**
   * Set callback for when save completes
   */
  const setOnSaveComplete = useCallback((callback: (success: boolean) => void) => {
    onSaveCompleteCallbackRef.current = callback;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchDebounceRef.current) {
        clearTimeout(batchDebounceRef.current);
      }
    };
  }, []);

  return {
    // Main coordination method
    trackObjectChange,
    coordinateSave,
    flushPending,

    // Introspection methods
    getPendingSummary,
    getObjectsByType,

    // Callback registration
    setOnObjectChange,
    setOnSaveStart,
    setOnSaveComplete,

    // State access
    isSaving: coordinationStateRef.current.isSaving,
    pendingCount: coordinationStateRef.current.pendingChanges.size,
    lastSaveTime: coordinationStateRef.current.lastSaveTime
  };
}
