import { useCallback, useEffect, useRef } from 'react';
import type { MapObject } from '@/types';
import type { TileMapEditor } from '@/editor/TileMapEditor';
import useObjectSaveCoordination from './useObjectSaveCoordination';

/**
 * Integrates object save coordination with the main save flow
 * Ensures NPCs, Items, Enemies are not saved independently
 */

interface SaveSequencing {
  mapSaveStartTime: number | null;
  objectSaveStartTime: number | null;
  completionOrder: Array<'map' | 'objects'>;
}

export default function useSaveSequencing(
  editor: TileMapEditor | null,
  options?: {
    onSequencingStart?: () => void;
    onSequencingComplete?: (order: Array<'map' | 'objects'>) => void;
    onSequencingError?: (error: string) => void;
  }
) {
  const {
    onSequencingStart,
    onSequencingComplete,
    onSequencingError
  } = options || {};

  const objectCoordination = useObjectSaveCoordination(editor);
  const sequencingStateRef = useRef<SaveSequencing>({
    mapSaveStartTime: null,
    objectSaveStartTime: null,
    completionOrder: []
  });

  const previousObjectsRef = useRef<MapObject[]>([]);
  const objectChangeTrackingEnabledRef = useRef(true);

  /**
   * Monitor for object changes and track them for coordination
   * Prevents independent saves of NPCs/Items/Enemies
   */
  const monitorObjectChanges = useCallback(() => {
    if (!editor || !objectChangeTrackingEnabledRef.current) return;

    const currentObjects = editor.getMapObjects();
    const previousObjects = previousObjectsRef.current;

    // Detect changes by comparing objects
    for (const current of currentObjects) {
      const previous = previousObjects.find(obj => obj.id === current.id);

      if (!previous) {
        // New object added
        if (['npc', 'item', 'enemy'].includes(current.type)) {
          console.log(
            `[SaveSequencing] Detected new ${current.type} #${current.id}`
          );
          objectCoordination.trackObjectChange(
            current.id,
            current.type as 'npc' | 'item' | 'enemy',
            current
          );
        }
      } else if (JSON.stringify(previous) !== JSON.stringify(current)) {
        // Object modified
        if (['npc', 'item', 'enemy'].includes(current.type)) {
          const changes: Partial<MapObject> = {};
          let hasChanges = false;

          // Detect what changed
          (Object.keys(current) as Array<keyof MapObject>).forEach(key => {
            if (JSON.stringify(current[key]) !== JSON.stringify(previous[key])) {
              (changes as Record<string, unknown>)[key] = current[key];
              hasChanges = true;
            }
          });

          if (hasChanges) {
            console.log(
              `[SaveSequencing] Detected changes in ${current.type} #${current.id}:`,
              Object.keys(changes).join(', ')
            );
            objectCoordination.trackObjectChange(
              current.id,
              current.type as 'npc' | 'item' | 'enemy',
              changes
            );
          }
        }
      }
    }

    // Detect deleted objects
    for (const previous of previousObjects) {
      if (!currentObjects.find(obj => obj.id === previous.id)) {
        if (['npc', 'item', 'enemy'].includes(previous.type)) {
          console.log(
            `[SaveSequencing] Detected deleted ${previous.type} #${previous.id}`
          );
        }
      }
    }

    // Update reference for next check
    previousObjectsRef.current = currentObjects.map(obj => ({ ...obj }));
  }, [editor, objectCoordination]);

  /**
   * Coordinate full save sequence
   * Ensures map save and object saves are properly ordered
   */
  const coordinateSaveSequence = useCallback(async (): Promise<boolean> => {
    if (!editor) {
      onSequencingError?.('Editor not initialized');
      return false;
    }

    const state = sequencingStateRef.current;
    state.mapSaveStartTime = Date.now();
    state.objectSaveStartTime = null;
    state.completionOrder = [];

    onSequencingStart?.();

    try {
      console.log('[SaveSequencing] Starting coordinated save sequence');

      // Step 1: Ensure all pending object changes are tracked
      monitorObjectChanges();

      // Step 2: Flush any pending object changes
      const pendingSummary = objectCoordination.getPendingSummary();
      if (pendingSummary.totalPending > 0) {
        console.log(
          `[SaveSequencing] Flushing ${pendingSummary.totalPending} pending object changes`
        );
        state.objectSaveStartTime = Date.now();
        const objectSaveSuccess = await objectCoordination.flushPending();

        if (!objectSaveSuccess) {
          onSequencingError?.(
            'Failed to coordinate object saves - some objects may not have been saved'
          );
          return false;
        }

        state.completionOrder.push('objects');
      }

      // Step 3: Map save happens via the main save flow
      // (This should be called by the parent hook after sequencing)
      state.completionOrder.push('map');

      console.log(
        `[SaveSequencing] Sequencing complete - order: ${state.completionOrder.join(' -> ')}`
      );
      onSequencingComplete?.(state.completionOrder);

      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[SaveSequencing] Coordination failed:', error);
      onSequencingError?.(errorMsg);
      return false;
    }
  }, [editor, monitorObjectChanges, objectCoordination, onSequencingStart, onSequencingComplete, onSequencingError]);

  /**
   * Enable/disable automatic object change tracking
   */
  const setObjectTrackingEnabled = useCallback((enabled: boolean) => {
    objectChangeTrackingEnabledRef.current = enabled;
    console.log(`[SaveSequencing] Object change tracking ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  /**
   * Get current save sequencing state
   */
  const getSequencingState = useCallback(() => {
    const state = sequencingStateRef.current;
    return {
      mapSaveStartTime: state.mapSaveStartTime,
      objectSaveStartTime: state.objectSaveStartTime,
      completionOrder: [...state.completionOrder],
      isInProgress: state.mapSaveStartTime !== null && state.completionOrder.length === 0
    };
  }, []);

  /**
   * Validate save consistency
   * Checks that objects and map are in sync
   */
  const validateSaveConsistency = useCallback((): string[] => {
    if (!editor) return ['Editor not initialized'];

    const errors: string[] = [];
    const objects = editor.getMapObjects();
    const npcs = objects.filter(obj => obj.type === 'npc');
    const items = objects.filter(obj => obj.type === 'item');
    const enemies = objects.filter(obj => obj.type === 'enemy');

    console.log(
      `[SaveSequencing] Validating consistency: ${npcs.length} NPCs, ${items.length} Items, ${enemies.length} Enemies`
    );

    // Check for invalid IDs
    const seenIds = new Set<number>();
    for (const obj of objects) {
      if (seenIds.has(obj.id)) {
        errors.push(`Duplicate object ID found: ${obj.id}`);
      }
      seenIds.add(obj.id);
    }

    // Check for invalid positions
    for (const obj of objects) {
      if (obj.x < 0 || obj.y < 0) {
        errors.push(`${obj.type} #${obj.id} has invalid position: (${obj.x}, ${obj.y})`);
      }
    }

    // Check pending changes
    const pendingSummary = objectCoordination.getPendingSummary();
    if (pendingSummary.totalPending > 0) {
      errors.push(
        `${pendingSummary.totalPending} object changes pending save: ${Object.entries(pendingSummary.byType)
          .map(([type, count]) => `${count} ${type}`)
          .join(', ')}`
      );
    }

    return errors;
  }, [editor, objectCoordination]);

  // Monitor for object changes periodically
  useEffect(() => {
    if (!editor || !objectChangeTrackingEnabledRef.current) return;

    const interval = setInterval(() => {
      monitorObjectChanges();
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [editor, monitorObjectChanges]);

  return {
    // Main coordination
    coordinateSaveSequence,

    // Object coordination (from base hook)
    objectCoordination: {
      trackObjectChange: objectCoordination.trackObjectChange,
      getPendingSummary: objectCoordination.getPendingSummary,
      getObjectsByType: objectCoordination.getObjectsByType,
      flushPending: objectCoordination.flushPending
    },

    // Control
    setObjectTrackingEnabled,

    // Introspection
    getSequencingState,
    validateSaveConsistency,

    // State access
    pendingObjectCount: objectCoordination.pendingCount,
    isObjectSaving: objectCoordination.isSaving
  };
}
