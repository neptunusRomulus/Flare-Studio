import React, { createContext, useContext, useCallback, useRef } from 'react';

interface PendingSave {
  id: string;
  promise: Promise<void>;
  startTime: number;
  isShutdownSave?: boolean;
}

interface SaveQueueContextType {
  registerSave: (id: string, promise: Promise<void>, isShutdownSave?: boolean) => void;
  unregisterSave: (id: string) => void;
  getPendingSaves: () => PendingSave[];
  waitForAllSaves: (timeoutMs?: number) => Promise<{ completed: number; failed: number; timedOut: boolean }>;
  getPendingSaveCount: () => number;
  pauseSaves: () => void;
  resumeSaves: () => void;
  areSavesPaused: () => boolean;
}

const SaveQueueContext = createContext<SaveQueueContextType | null>(null);

export function SaveQueueProvider({ children }: { children: React.ReactNode }) {
  const savesMapRef = useRef<Map<string, PendingSave>>(new Map());
  const savesPausedRef = useRef(false);

  const unregisterSave = useCallback((id: string) => {
    if (savesMapRef.current.has(id)) {
      savesMapRef.current.delete(id);
      console.log(`[SaveQueue] Unregistered save: ${id} - Remaining: ${savesMapRef.current.size}`);
    }
  }, []);

  const registerSave = useCallback((id: string, promise: Promise<void>, isShutdownSave = false) => {
    const pendingSave: PendingSave = {
      id,
      promise,
      startTime: Date.now(),
      isShutdownSave,
    };

    savesMapRef.current.set(id, pendingSave);
    console.log(`[SaveQueue] Registered save: ${id}${isShutdownSave ? ' (shutdown)' : ''} - Total pending: ${savesMapRef.current.size}`);

    // Auto-cleanup when promise settles
    promise
      .then(() => {
        console.log(`[SaveQueue] Save completed: ${id} (${Date.now() - pendingSave.startTime}ms)`);
      })
      .catch((err) => {
        console.warn(`[SaveQueue] Save failed: ${id}`, err);
      })
      .finally(() => {
        unregisterSave(id);
      });
  }, [unregisterSave]);

  const getPendingSaves = useCallback((): PendingSave[] => {
    return Array.from(savesMapRef.current.values());
  }, []);

  const getPendingSaveCount = useCallback((): number => {
    return savesMapRef.current.size;
  }, []);

  const waitForAllSaves = useCallback(
    async (timeoutMs = 30000): Promise<{ completed: number; failed: number; timedOut: boolean }> => {
      const saves = getPendingSaves();
      
      if (saves.length === 0) {
        console.log('[SaveQueue] No pending saves to wait for');
        return { completed: 0, failed: 0, timedOut: false };
      }

      console.log(`[SaveQueue] Waiting for ${saves.length} pending save(s)...`);
      
      const startTime = Date.now();
      let completed = 0;
      let failed = 0;

      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Save queue timeout')), timeoutMs)
        );

        // Race: wait for all saves OR timeout
        await Promise.race([
          Promise.allSettled(saves.map(s => s.promise)).then((results) => {
            results.forEach((result) => {
              if (result.status === 'fulfilled') {
                completed++;
              } else {
                failed++;
              }
            });
          }),
          timeoutPromise,
        ]);

        const duration = Date.now() - startTime;
        console.log(`[SaveQueue] All saves completed in ${duration}ms (completed: ${completed}, failed: ${failed})`);
        return { completed, failed, timedOut: false };
      } catch (err) {
        const duration = Date.now() - startTime;
        console.warn(`[SaveQueue] Save wait timeout or error after ${duration}ms:`, err);
        
        // Count what actually completed
        const finalSaves = getPendingSaves();
        const stillPending = finalSaves.length;
        console.warn(`[SaveQueue] Still pending saves: ${stillPending}`);

        return { completed, failed, timedOut: true };
      }
    },
    [getPendingSaves]
  );

  const pauseSaves = useCallback(() => {
    savesPausedRef.current = true;
    console.log('[SaveQueue] Saves paused');
  }, []);

  const resumeSaves = useCallback(() => {
    savesPausedRef.current = false;
    console.log('[SaveQueue] Saves resumed');
  }, []);

  const areSavesPaused = useCallback(() => {
    return savesPausedRef.current;
  }, []);

  const value: SaveQueueContextType = {
    registerSave,
    unregisterSave,
    getPendingSaves,
    waitForAllSaves,
    getPendingSaveCount,
    pauseSaves,
    resumeSaves,
    areSavesPaused,
  };

  return <SaveQueueContext.Provider value={value}>{children}</SaveQueueContext.Provider>;
}

export function useSaveQueue(): SaveQueueContextType {
  const context = useContext(SaveQueueContext);
  if (!context) {
    throw new Error('useSaveQueue must be used within SaveQueueProvider');
  }
  return context;
}

export default SaveQueueContext;
