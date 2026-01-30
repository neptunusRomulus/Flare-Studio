import React, { createContext, useContext, useCallback, useRef } from 'react';

export interface RetryConfig {
  maxRetries: number;           // Maximum number of retry attempts (0 = no retries)
  initialDelayMs: number;       // Initial delay before first retry in milliseconds
  maxDelayMs: number;           // Maximum delay between retries (backoff cap)
  backoffMultiplier: number;    // Multiplier for exponential backoff (e.g., 2 = double each time)
  jitterFactor: number;         // Random jitter (0-1) to add to delay (prevents thundering herd)
}

export interface RetryMetrics {
  attempt: number;              // Current attempt number (1-based)
  nextRetryDelayMs: number;     // Milliseconds until next retry
  totalFailures: number;        // Total failures across all attempts
}

export type RetryableFunction<T> = () => Promise<T>;

// Default configuration: 3 retries with exponential backoff
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1
};

interface RetryContextType {
  executeWithRetry<T>(
    fn: RetryableFunction<T>,
    operationName?: string,
    config?: Partial<RetryConfig>
  ): Promise<{ success: boolean; result?: T; error?: Error; attempts: number; metrics: RetryMetrics }>;
  
  getCurrentRetryConfig(): RetryConfig;
  setGlobalRetryConfig(config: Partial<RetryConfig>): void;
  
  getRetryHistory(operationName?: string): Array<{
    operationName: string;
    timestamp: number;
    attempt: number;
    error: string;
  }>;
}

const RetryStrategyContext = createContext<RetryContextType | null>(null);

export const RetryStrategyProvider: React.FC<{
  children: React.ReactNode;
  initialConfig?: Partial<RetryConfig>;
}> = ({ children, initialConfig = {} }) => {
  const configRef = useRef<RetryConfig>({ ...DEFAULT_RETRY_CONFIG, ...initialConfig });
  const historyRef = useRef<Array<{
    operationName: string;
    timestamp: number;
    attempt: number;
    error: string;
  }>>([]);

  // Calculate delay for nth retry using exponential backoff with jitter
  const calculateDelay = useCallback((attempt: number, config: RetryConfig): number => {
    const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
    const jitter = cappedDelay * config.jitterFactor * Math.random();
    return Math.round(cappedDelay + jitter);
  }, []);

  // Main retry execution function
  const executeWithRetry = useCallback(async <T,>(
    fn: RetryableFunction<T>,
    operationName = 'unknown',
    customConfig?: Partial<RetryConfig>
  ): Promise<{ success: boolean; result?: T; error?: Error; attempts: number; metrics: RetryMetrics }> => {
    const config = { ...configRef.current, ...customConfig };
    let lastError: Error | null = null;
    let attempts = 0;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      attempts = attempt + 1;

      try {
        console.log(`[Retry] Executing ${operationName} (attempt ${attempts}/${config.maxRetries + 1})`);
        const result = await fn();
        console.log(`[Retry] ✓ ${operationName} succeeded on attempt ${attempts}`);

        return {
          success: true,
          result,
          attempts,
          metrics: {
            attempt: attempts,
            nextRetryDelayMs: 0,
            totalFailures: 0
          }
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMsg = lastError.message || String(error);

        // Log error
        console.warn(`[Retry] ✗ ${operationName} failed on attempt ${attempts}: ${errorMsg}`);
        historyRef.current.push({
          operationName,
          timestamp: Date.now(),
          attempt: attempts,
          error: errorMsg
        });

        // Keep history limited to last 100 entries
        if (historyRef.current.length > 100) {
          historyRef.current.shift();
        }

        // If we have retries left, calculate delay and wait
        if (attempt < config.maxRetries) {
          const delayMs = calculateDelay(attempt + 1, config);
          console.log(`[Retry] Retrying ${operationName} in ${delayMs}ms...`);

          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retries exhausted
    console.error(`[Retry] ✗ ${operationName} failed after ${attempts} attempts`);

    return {
      success: false,
      error: lastError || new Error(`${operationName} failed after ${attempts} attempts`),
      attempts,
      metrics: {
        attempt: attempts,
        nextRetryDelayMs: 0,
        totalFailures: attempts
      }
    };
  }, [calculateDelay]);

  const getCurrentRetryConfig = useCallback((): RetryConfig => {
    return { ...configRef.current };
  }, []);

  const setGlobalRetryConfig = useCallback((config: Partial<RetryConfig>): void => {
    configRef.current = { ...configRef.current, ...config };
    console.log('[Retry] Updated global retry config:', configRef.current);
  }, []);

  const getRetryHistory = useCallback((operationName?: string): typeof historyRef.current => {
    if (operationName) {
      return historyRef.current.filter(entry => entry.operationName === operationName);
    }
    return [...historyRef.current];
  }, []);

  const value: RetryContextType = {
    executeWithRetry,
    getCurrentRetryConfig,
    setGlobalRetryConfig,
    getRetryHistory
  };

  return (
    <RetryStrategyContext.Provider value={value}>
      {children}
    </RetryStrategyContext.Provider>
  );
};

export const useRetryStrategy = (): RetryContextType => {
  const context = useContext(RetryStrategyContext);
  if (!context) {
    throw new Error('useRetryStrategy must be used within RetryStrategyProvider');
  }
  return context;
};

// Hook for executing a single operation with retry
export const useRetry = () => {
  const { executeWithRetry } = useRetryStrategy();

  return {
    executeWithRetry,
    // Common presets for different operation types
    retryWithDefaults: async <T,>(
      fn: RetryableFunction<T>,
      operationName?: string
    ) => executeWithRetry(fn, operationName),

    // Aggressive retry for critical operations (saves)
    retryAggressively: async <T,>(
      fn: RetryableFunction<T>,
      operationName?: string
    ) => executeWithRetry(fn, operationName, {
      maxRetries: 5,
      initialDelayMs: 300,
      maxDelayMs: 15000,
      backoffMultiplier: 1.5
    }),

    // Conservative retry for non-critical operations
    retryConservatively: async <T,>(
      fn: RetryableFunction<T>,
      operationName?: string
    ) => executeWithRetry(fn, operationName, {
      maxRetries: 1,
      initialDelayMs: 1000,
      maxDelayMs: 2000,
      backoffMultiplier: 2
    }),

    // No retry - fail fast
    executeOnce: async <T,>(
      fn: RetryableFunction<T>,
      operationName?: string
    ) => executeWithRetry(fn, operationName, {
      maxRetries: 0,
      initialDelayMs: 0
    })
  };
};
