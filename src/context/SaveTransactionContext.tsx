import React, { createContext, useContext, useCallback, useRef } from 'react';

/**
 * Represents a single operation within a save transaction
 */
export interface SaveOperation {
  id: string;
  name: string;
  execute: () => Promise<void>;
  rollback?: () => Promise<void>;
  priority?: number; // Higher priority executes first (default 0)
  critical?: boolean; // If true, transaction fails if this operation fails
  retryable?: boolean; // If true, can retry this operation (default true)
  timeoutMs?: number; // Operation timeout in milliseconds
}

/**
 * Result of a save operation
 */
export interface OperationResult {
  operationId: string;
  operationName: string;
  success: boolean;
  error?: Error;
  duration: number;
  attempts: number;
  rolledBack?: boolean;
}

/**
 * Result of a complete save transaction
 */
export interface TransactionResult {
  transactionId: string;
  success: boolean;
  duration: number;
  startedAt: number;
  completedAt: number;
  operationResults: OperationResult[];
  failedOperations: OperationResult[];
  rolledBackOperations: OperationResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    rolledBack: number;
  };
}

/**
 * Transaction configuration
 */
export interface TransactionConfig {
  rollbackOnFailure?: boolean; // Auto rollback on first critical failure (default true)
  continueOnError?: boolean; // Continue processing remaining operations on error (default false)
  timeout?: number; // Overall transaction timeout in milliseconds (default 60000)
  strictOrdering?: boolean; // Execute in strict order by priority (default true)
}

/**
 * Context type for save transactions
 */
export interface SaveTransactionContextType {
  /**
   * Execute a save transaction with multiple operations
   */
  executeTransaction: (
    operations: SaveOperation[],
    config?: TransactionConfig
  ) => Promise<TransactionResult>;

  /**
   * Get the result of a completed transaction
   */
  getTransactionResult: (transactionId: string) => TransactionResult | undefined;

  /**
   * Get all recent transaction results (last 50)
   */
  getTransactionHistory: () => TransactionResult[];

  /**
   * Clear transaction history
   */
  clearTransactionHistory: () => void;

  /**
   * Get the current transaction (if any)
   */
  getCurrentTransaction: () => TransactionResult | undefined;
}

const SaveTransactionContext = createContext<SaveTransactionContextType | null>(null);

/**
 * Provider component for save transactions
 */
export function SaveTransactionProvider({ children }: { children: React.ReactNode }) {
  const transactionHistoryRef = useRef<TransactionResult[]>([]);
  const currentTransactionRef = useRef<TransactionResult | null>(null);
  const transactionMapRef = useRef<Map<string, TransactionResult>>(new Map());

  /**
   * Execute a single operation with timeout support
   */
  const executeOperation = useCallback(
    async (operation: SaveOperation, timeoutMs?: number): Promise<OperationResult> => {
      const startTime = Date.now();
      let attempts = 0;

      const executeWithTimeout = async (fn: () => Promise<void>): Promise<void> => {
        if (!timeoutMs) {
          return fn();
        }

        return Promise.race([
          fn(),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs)
          )
        ]);
      };

      try {
        attempts++;
        await executeWithTimeout(operation.execute);

        return {
          operationId: operation.id,
          operationName: operation.name,
          success: true,
          duration: Date.now() - startTime,
          attempts
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        return {
          operationId: operation.id,
          operationName: operation.name,
          success: false,
          error: err,
          duration: Date.now() - startTime,
          attempts
        };
      }
    },
    []
  );

  /**
   * Execute a save transaction with multiple operations
   */
  const executeTransaction = useCallback(
    async (
      operations: SaveOperation[],
      config: TransactionConfig = {}
    ): Promise<TransactionResult> => {
      const {
        rollbackOnFailure = true,
        continueOnError = false,
        timeout = 60000,
        strictOrdering = true
      } = config;

      const transactionId = `txn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const transactionStartTime = Date.now();

      const result: TransactionResult = {
        transactionId,
        success: true,
        duration: 0,
        startedAt: transactionStartTime,
        completedAt: 0,
        operationResults: [],
        failedOperations: [],
        rolledBackOperations: [],
        summary: {
          total: operations.length,
          successful: 0,
          failed: 0,
          rolledBack: 0
        }
      };

      currentTransactionRef.current = result;
      transactionMapRef.current.set(transactionId, result);

      console.log(`[SaveTransaction] Starting transaction: ${transactionId} with ${operations.length} operations`);

      try {
        // Sort operations by priority if strict ordering enabled
        const sortedOps = strictOrdering
          ? [...operations].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
          : operations;

        // Execute operations
        for (const operation of sortedOps) {
          const opResult = await executeOperation(operation, operation.timeoutMs || timeout);
          result.operationResults.push(opResult);

          if (opResult.success) {
            result.summary.successful++;
            console.log(`[SaveTransaction] ✓ Operation succeeded: ${operation.name} (${opResult.duration}ms)`);
          } else {
            result.summary.failed++;
            result.failedOperations.push(opResult);
            result.success = false;
            console.error(`[SaveTransaction] ✗ Operation failed: ${operation.name}`, opResult.error);

            // Stop on critical failure or if continueOnError is false
            if ((operation.critical ?? false) || !continueOnError) {
              if (rollbackOnFailure) {
                console.log(`[SaveTransaction] Critical failure detected, initiating rollback...`);
                break;
              }
            }
          }
        }

        // Rollback on failure if enabled
        if (!result.success && rollbackOnFailure) {
          console.log(`[SaveTransaction] Executing rollback for failed operations...`);

          // Rollback in reverse order
          const successfulOps = result.operationResults
            .filter(r => r.success)
            .reverse();

          for (const opResult of successfulOps) {
            const originalOp = operations.find(op => op.id === opResult.operationId);
            if (originalOp?.rollback) {
              try {
                const rollbackStart = Date.now();
                await originalOp.rollback();
                const rollbackDuration = Date.now() - rollbackStart;

                opResult.rolledBack = true;
                result.rolledBackOperations.push(opResult);
                result.summary.rolledBack++;

                console.log(
                  `[SaveTransaction] ✓ Rollback succeeded: ${originalOp.name} (${rollbackDuration}ms)`
                );
              } catch (rollbackError) {
                console.error(
                  `[SaveTransaction] ✗ Rollback failed for ${originalOp.name}:`,
                  rollbackError
                );
                // Mark as critical - rollback failure is severe
                result.success = false;
              }
            }
          }
        }

        result.completedAt = Date.now();
        result.duration = result.completedAt - result.startedAt;

        console.log(
          `[SaveTransaction] Transaction ${result.success ? 'SUCCEEDED' : 'FAILED'}: ` +
          `${result.summary.successful}/${result.summary.total} operations successful` +
          `${result.summary.rolledBack > 0 ? `, ${result.summary.rolledBack} rolled back` : ''}`
        );

        return result;
      } catch (error) {
        result.completedAt = Date.now();
        result.duration = result.completedAt - result.startedAt;
        result.success = false;

        console.error(`[SaveTransaction] Unexpected error in transaction ${transactionId}:`, error);

        return result;
      } finally {
        currentTransactionRef.current = null;

        // Keep only last 50 transactions in history
        transactionHistoryRef.current.unshift(result);
        if (transactionHistoryRef.current.length > 50) {
          transactionHistoryRef.current = transactionHistoryRef.current.slice(0, 50);
        }
      }
    },
    [executeOperation]
  );

  /**
   * Get transaction result by ID
   */
  const getTransactionResult = useCallback((transactionId: string): TransactionResult | undefined => {
    return transactionMapRef.current.get(transactionId) || transactionHistoryRef.current.find(t => t.transactionId === transactionId);
  }, []);

  /**
   * Get transaction history (last 50)
   */
  const getTransactionHistory = useCallback((): TransactionResult[] => {
    return [...transactionHistoryRef.current];
  }, []);

  /**
   * Clear transaction history
   */
  const clearTransactionHistory = useCallback((): void => {
    transactionHistoryRef.current = [];
    transactionMapRef.current.clear();
    console.log('[SaveTransaction] Transaction history cleared');
  }, []);

  /**
   * Get current transaction
   */
  const getCurrentTransaction = useCallback((): TransactionResult | undefined => {
    return currentTransactionRef.current ?? undefined;
  }, []);

  return (
    <SaveTransactionContext.Provider
      value={{
        executeTransaction,
        getTransactionResult,
        getTransactionHistory,
        clearTransactionHistory,
        getCurrentTransaction
      }}
    >
      {children}
    </SaveTransactionContext.Provider>
  );
}

/**
 * Hook to access save transaction context
 */
export function useSaveTransaction(): SaveTransactionContextType {
  const context = useContext(SaveTransactionContext);
  if (!context) {
    throw new Error('useSaveTransaction must be used within SaveTransactionProvider');
  }
  return context;
}

/**
 * Hook for convenient transaction execution with error handling
 */
export function useTransactionExecutor() {
  const { executeTransaction } = useSaveTransaction();

  const executeWithErrorTracking = useCallback(
    async (
      operations: SaveOperation[],
      config?: TransactionConfig
    ) => {
      const result = await executeTransaction(operations, config);

      if (!result.success && result.failedOperations.length > 0) {
        console.group('[SaveTransaction] Transaction Failed');
        console.error('Failed Operations:');
        result.failedOperations.forEach(op => {
          console.error(
            `  - ${op.operationName}: ${op.error?.message || 'Unknown error'}`
          );
        });
        console.groupEnd();
      }

      return result;
    },
    [executeTransaction]
  );

  return { executeWithErrorTracking, executeTransaction };
}
