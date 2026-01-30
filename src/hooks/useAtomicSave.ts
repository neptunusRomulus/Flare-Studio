import { useCallback, useRef } from 'react';
import { useSaveTransaction, SaveOperation, TransactionResult } from '@/context/SaveTransactionContext';

/**
 * Atomic save handler with transaction support
 * Coordinates multiple save operations (editor, individual files, etc.)
 * with automatic rollback on failure
 */
export default function useAtomicSave() {
  const { executeTransaction, getTransactionHistory, getCurrentTransaction } = useSaveTransaction();
  const lastTransactionRef = useRef<TransactionResult | null>(null);

  /**
   * Execute atomic save with multiple operations
   * Returns success status and detailed results
   */
  const executeAtomicSave = useCallback(
    async (
      saveFunctions: {
        name: string;
        execute: () => Promise<void>;
        rollback?: () => Promise<void>;
        critical?: boolean;
        priority?: number;
      }[]
    ): Promise<TransactionResult> => {
      // Convert to SaveOperation format
      const operations: SaveOperation[] = saveFunctions.map((fn, idx) => ({
        id: `op-${idx}-${Date.now()}`,
        name: fn.name,
        execute: fn.execute,
        rollback: fn.rollback,
        critical: fn.critical ?? true, // Default to critical
        priority: fn.priority ?? 0,
        retryable: true,
        timeoutMs: 20000
      }));

      const result = await executeTransaction(operations, {
        rollbackOnFailure: true,
        continueOnError: false,
        timeout: 60000,
        strictOrdering: true
      });

      lastTransactionRef.current = result;

      return result;
    },
    [executeTransaction]
  );

  /**
   * Get results of atomic saves (editor + files + any other operations)
   * Returns comprehensive error information
   */
  const getAtomicSaveReport = useCallback((): {
    lastTransaction: TransactionResult | null;
    allTransactions: TransactionResult[];
    failedOperations: Array<{
      operationName: string;
      error: Error | undefined;
      duration: number;
    }>;
    successCount: number;
    failureCount: number;
    rollbackCount: number;
  } => {
    const allTransactions = getTransactionHistory();
    const lastTransaction = lastTransactionRef.current;

    const failedOperations = lastTransaction?.failedOperations.map(op => ({
      operationName: op.operationName,
      error: op.error,
      duration: op.duration
    })) ?? [];

    return {
      lastTransaction,
      allTransactions,
      failedOperations,
      successCount: lastTransaction?.summary.successful ?? 0,
      failureCount: lastTransaction?.summary.failed ?? 0,
      rollbackCount: lastTransaction?.summary.rolledBack ?? 0
    };
  }, [getTransactionHistory]);

  /**
   * Check if a partial save occurred (some succeeded, some failed)
   */
  const hasPartialFailure = useCallback((): boolean => {
    const tx = lastTransactionRef.current;
    return tx !== null && tx.summary.successful > 0 && tx.summary.failed > 0;
  }, []);

  /**
   * Get a human-readable error summary
   */
  const getErrorSummary = useCallback((): string => {
    const tx = lastTransactionRef.current;
    if (!tx || tx.success) return '';

    if (tx.failedOperations.length === 0) return 'Transaction failed for unknown reason';

    const failedNames = tx.failedOperations.map(op => `${op.operationName}: ${op.error?.message || 'Unknown'}`);
    const rolledBack = tx.summary.rolledBack > 0 ? ` (${tx.summary.rolledBack} rolled back)` : '';

    return `Failed operations: ${failedNames.join('; ')}${rolledBack}`;
  }, []);

  return {
    /**
     * Execute atomic save with automatic rollback on failure
     */
    executeAtomicSave,

    /**
     * Get detailed report of atomic saves
     */
    getAtomicSaveReport,

    /**
     * Check if there was a partial failure (some succeeded, some failed)
     */
    hasPartialFailure,

    /**
     * Get human-readable error summary
     */
    getErrorSummary,

    /**
     * Get current transaction in progress (if any)
     */
    getCurrentTransaction,

    /**
     * Get last transaction result
     */
    getLastTransaction: () => lastTransactionRef.current
  } as const;
}
