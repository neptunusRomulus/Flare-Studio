import { useCallback } from 'react';
import useSaveSerializationWorker from './useSaveSerializationWorker';

export interface UseBackgroundSaveSerializationOptions {
  enabled?: boolean;
  onSerializationStart?: () => void;
  onSerializationComplete?: (sizeBytes: number, durationMs: number) => void;
  onSerializationError?: (error: Error) => void;
}

/**
 * Hook to integrate Web Worker-based serialization into save flow
 * 
 * This provides a simple API for save operations:
 * - serializeForSave(data) - async JSON serialization off-thread
 * - Automatic fallback to main thread if workers unavailable
 * - Performance metrics and error handling
 */
export default function useBackgroundSaveSerializationIntegration(
  options?: UseBackgroundSaveSerializationOptions
) {
  const { serialize } = useSaveSerializationWorker({
    enabled: options?.enabled ?? true
  });

  /**
   * Serialize project data for saving
   * Runs in worker if available, falls back to main thread
   */
  const serializeForSave = useCallback(
    async (data: unknown): Promise<string> => {
      const startTime = performance.now();
      
      try {
        options?.onSerializationStart?.();
        
        const serialized = await serialize(data);
        
        const duration = performance.now() - startTime;
        const sizeBytes = new Blob([serialized]).size;
        
        console.log(
          `[SaveSerialization] Completed in ${duration.toFixed(0)}ms, ` +
          `${(sizeBytes / 1024).toFixed(2)} KB`
        );
        
        options?.onSerializationComplete?.(sizeBytes, duration);
        
        return serialized;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('[SaveSerialization] Error:', err);
        options?.onSerializationError?.(err);
        throw err;
      }
    },
    [serialize, options]
  );

  return {
    serializeForSave
  } as const;
}
