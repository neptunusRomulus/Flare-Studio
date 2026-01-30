import { useCallback, useEffect, useRef } from 'react';

export interface SaveSerializationWorkerOptions {
  enabled?: boolean;
  workerPath?: string;
}

/**
 * Hook for managing save serialization in a Web Worker
 * 
 * This prevents large JSON serialization from blocking the main thread.
 * Falls back to main thread if workers not supported or disabled.
 * 
 * Features:
 * - Off-main-thread serialization
 * - Async/await API
 * - Automatic fallback for unsupported browsers
 * - Request tracking for multiple concurrent operations
 * - Error handling and logging
 */
export default function useSaveSerializationWorker(
  options?: SaveSerializationWorkerOptions
) {
  const enabledRef = useRef(options?.enabled ?? true);
  const workerRef = useRef<Worker | null>(null);
  const requestMapRef = useRef<Map<
    number,
    {
      resolve: (value: string) => void;
      reject: (reason: Error) => void;
    }
  >>(new Map());
  const requestIdRef = useRef(0);

  /**
   * Initialize worker on first use
   */
  const ensureWorker = useCallback((): Worker | null => {
    if (!enabledRef.current) return null;

    if (workerRef.current) return workerRef.current;

    try {
      // Try to create worker
      // The worker path will be resolved by the build system (vite/webpack)
      const workerPath = options?.workerPath ?? 'saveSerializationWorker.ts';
      
      const worker = new Worker(
        new URL(`./${workerPath}`, import.meta.url),
        { type: 'module' }
      );

      // Setup message handler
      worker.onmessage = (event: MessageEvent) => {
        const { type, id } = event.data;

        if (type === 'worker:ready') {
          console.log('[SaveWorker] Worker initialized and ready');
          return;
        }

        const request = requestMapRef.current.get(id);
        if (!request) {
          console.warn(`[SaveWorker] Received response for unknown request ${id}`);
          return;
        }

        requestMapRef.current.delete(id);

        if (type === 'serialize:success') {
          const { serialized, sizeBytes } = event.data;
          console.log(
            `[SaveWorker] Serialization complete: ${(sizeBytes / 1024).toFixed(2)} KB`
          );
          request.resolve(serialized);
        } else if (type === 'serialize:error') {
          const { error } = event.data;
          console.error('[SaveWorker] Serialization error:', error);
          request.reject(new Error(error));
        } else if (type === 'deserialize:success') {
          const { data } = event.data;
          console.log('[SaveWorker] Deserialization complete');
          // Return stringified data since resolve expects string
          request.resolve(JSON.stringify(data));
        } else if (type === 'deserialize:error') {
          const { error } = event.data;
          console.error('[SaveWorker] Deserialization error:', error);
          request.reject(new Error(error));
        }
      };

      worker.onerror = (error) => {
        console.error('[SaveWorker] Worker error:', error);
      };

      workerRef.current = worker;
      return worker;
    } catch (error) {
      console.warn(
        '[SaveWorker] Failed to create worker, will use main thread:',
        error
      );
      enabledRef.current = false;
      return null;
    }
  }, [options]);

  /**
   * Serialize data using worker or main thread
   */
  const serialize = useCallback(
    async (data: unknown): Promise<string> => {
      const worker = ensureWorker();

      if (!worker) {
        // Fallback to main thread
        console.log('[SaveWorker] Using main thread for serialization');
        try {
          return JSON.stringify(data);
        } catch (error) {
          throw new Error(
            `Main thread serialization failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      // Use worker
      const id = ++requestIdRef.current;

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          requestMapRef.current.delete(id);
          reject(new Error('[SaveWorker] Serialization timeout after 30s'));
        }, 30000);

        requestMapRef.current.set(id, {
          resolve: (value: string) => {
            clearTimeout(timeout);
            resolve(value);
          },
          reject: (reason: Error) => {
            clearTimeout(timeout);
            reject(reason);
          }
        });

        worker.postMessage({ type: 'serialize', data, id });
      });
    },
    [ensureWorker]
  );

  /**
   * Deserialize JSON using worker or main thread
   */
  const deserialize = useCallback(
    async (json: string): Promise<unknown> => {
      const worker = ensureWorker();

      if (!worker) {
        // Fallback to main thread
        console.log('[SaveWorker] Using main thread for deserialization');
        try {
          return JSON.parse(json);
        } catch (error) {
          throw new Error(
            `Main thread deserialization failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      // Use worker
      const id = ++requestIdRef.current;

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          requestMapRef.current.delete(id);
          reject(new Error('[SaveWorker] Deserialization timeout after 30s'));
        }, 30000);

        requestMapRef.current.set(id, {
          resolve: (value: string) => {
            clearTimeout(timeout);
            try {
              resolve(JSON.parse(value));
            } catch (error) {
              reject(
                new Error(
                  `Failed to parse deserialized data: ${
                    error instanceof Error ? error.message : String(error)
                  }`
                )
              );
            }
          },
          reject: (reason: Error) => {
            clearTimeout(timeout);
            reject(reason);
          }
        });

        worker.postMessage({ type: 'deserialize', json, id });
      });
    },
    [ensureWorker]
  );

  /**
   * Cleanup worker on unmount
   */
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        console.log('[SaveWorker] Worker terminated');
      }
    };
  }, []);

  return {
    serialize,
    deserialize,
    isWorkerEnabled: (): boolean => !!workerRef.current,
    getPendingRequests: (): number => requestMapRef.current.size
  } as const;
}
