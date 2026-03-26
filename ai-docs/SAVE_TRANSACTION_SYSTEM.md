# Save Transaction System (Atomic/Transactional Saves)

## Overview

The Save Transaction System implements **atomic (all-or-nothing) save operations** with automatic rollback capabilities. This prevents partial saves where some operations succeed while others fail, leaving the application in an inconsistent state.

**Problem Solved**: Multiple async save operations (editor state + individual files) could fail partially with no rollback mechanism, risking data loss.

## Architecture

### Components

1. **SaveTransactionContext** (`src/context/SaveTransactionContext.tsx`)
   - Centralized transaction coordination
   - Atomic operation execution with rollback
   - Comprehensive error tracking and reporting
   - Transaction history for debugging (50 entries max)

2. **useAtomicSave Hook** (`src/hooks/useAtomicSave.ts`)
   - High-level API for atomic save operations
   - Automatic rollback on failure
   - Partial failure detection
   - Error reporting utilities

3. **useManualSave Integration** (`src/hooks/useManualSave.ts`)
   - Now coordinates multiple save operations atomically
   - Detects partial failures
   - Reports rollback events to UI

### App Integration

```tsx
// App.tsx - SaveTransactionProvider wraps the app
<RetryStrategyProvider>
  <SaveTransactionProvider>
    <SaveQueueProvider>
      {/* rest of app */}
    </SaveQueueProvider>
  </SaveTransactionProvider>
</RetryStrategyProvider>
```

## Core Concepts

### Atomic Operations

An "atomic" operation means it completes entirely or not at all. When a save transaction contains multiple operations:

```
Manual Save Transaction:
├─ Save Editor Project Data (priority: 10, critical: true)
└─ [Future] Save Individual Files (priority: 5, critical: true)

Execution:
1. Execute operation 1 → SUCCESS
2. Execute operation 2 → FAILURE
3. Since critical operation failed → ROLLBACK operation 1
4. Final state: No saves applied, application back to pre-save state
```

### Rollback Mechanism

Each operation can define a `rollback()` function that reverses its changes:

```typescript
const operations: SaveOperation[] = [
  {
    name: 'Save Editor State',
    execute: async () => { /* save changes */ },
    rollback: async () => { /* restore from backup */ },
    critical: true
  }
];
```

If any critical operation fails, previously successful operations are rolled back in reverse order.

### Transaction Modes

#### Mode 1: All-or-Nothing (Default)
```typescript
{
  rollbackOnFailure: true,     // Auto-rollback on critical failure
  continueOnError: false        // Stop on first error
}
```
- Uses: Critical manual saves where consistency is paramount
- Result: Either all operations succeed or all roll back

#### Mode 2: Partial Success Allowed
```typescript
{
  rollbackOnFailure: false,     // Don't rollback, keep partial saves
  continueOnError: true         // Continue processing despite errors
}
```
- Uses: Background saves where some success is better than none
- Result: Some operations may succeed, some fail, no rollback

## API Reference

### SaveTransactionContext

#### `executeTransaction(operations, config?)`

Execute multiple save operations as a single atomic transaction.

```typescript
const result = await executeTransaction([
  {
    id: 'op-1',
    name: 'Save Editor Data',
    execute: async () => { /* ... */ },
    rollback: async () => { /* ... */ },
    critical: true,
    priority: 10,
    timeoutMs: 20000
  }
], {
  rollbackOnFailure: true,
  continueOnError: false,
  timeout: 60000,
  strictOrdering: true
});

// Returns: TransactionResult
```

**Parameters:**
- `operations`: Array of SaveOperation definitions
- `config.rollbackOnFailure`: Auto-rollback failed critical operations (default: true)
- `config.continueOnError`: Continue despite errors (default: false)
- `config.timeout`: Overall transaction timeout in ms (default: 60000)
- `config.strictOrdering`: Execute in priority order (default: true)

**Returns: TransactionResult**
```typescript
{
  transactionId: 'txn-1234567890-abc',
  success: boolean,
  duration: number,           // Total execution time in ms
  startedAt: number,          // Timestamp
  completedAt: number,        // Timestamp
  operationResults: OperationResult[],
  failedOperations: OperationResult[],
  rolledBackOperations: OperationResult[],
  summary: {
    total: number,
    successful: number,
    failed: number,
    rolledBack: number
  }
}
```

#### `getTransactionResult(transactionId)`
Retrieve a specific transaction result by ID.

#### `getTransactionHistory()`
Get all recent transactions (max 50).

#### `getCurrentTransaction()`
Get the currently executing transaction (if any).

#### `clearTransactionHistory()`
Clear all stored transaction history.

### useAtomicSave Hook

#### `executeAtomicSave(saveFunctions)`

High-level helper for executing atomic saves with sensible defaults.

```typescript
const { executeAtomicSave, getErrorSummary, hasPartialFailure } = useAtomicSave();

const result = await executeAtomicSave([
  {
    name: 'Save Editor',
    execute: async () => { /* ... */ },
    rollback: async () => { /* ... */ },
    critical: true
  }
]);

if (result.success) {
  // All operations succeeded
} else if (hasPartialFailure()) {
  // Some succeeded before failure
  const summary = getErrorSummary();
  console.log(summary);
  // "Failed operations: Save Editor: Connection timeout (1 rolled back)"
}
```

#### `getAtomicSaveReport()`

Get comprehensive report of atomic save operations.

```typescript
const report = getAtomicSaveReport();
// {
//   lastTransaction: TransactionResult | null,
//   allTransactions: TransactionResult[],
//   failedOperations: Array<{operationName, error, duration}>,
//   successCount: number,
//   failureCount: number,
//   rollbackCount: number
// }
```

#### `hasPartialFailure()`

Detect if some operations succeeded and some failed.

```typescript
if (hasPartialFailure()) {
  // Show warning: "Partial save - some data saved, some failed"
  // Suggest manual save or recovery
}
```

#### `getErrorSummary()`

Get human-readable error message.

```typescript
const msg = getErrorSummary();
// "Failed operations: Save Editor: Connection timeout; Save Files: Disk full (2 rolled back)"
```

## Usage Examples

### Example 1: Manual Save with Multiple Operations

```typescript
// In useManualSave.ts
const { executeAtomicSave, getErrorSummary, hasPartialFailure } = useAtomicSave();

const handleManualSave = useCallback(async () => {
  const result = await executeAtomicSave([
    {
      name: 'Save Editor Project Data',
      execute: async () => {
        const success = await editor.saveProjectData(currentProjectPath);
        if (!success) throw new Error('saveProjectData returned false');
      },
      rollback: async () => {
        // Restore from .flare-backup/
        console.log('Rolling back editor changes');
      },
      critical: true,
      priority: 10
    },
    {
      name: 'Save Individual Tilesets',
      execute: async () => {
        // Save each tileset file
      },
      rollback: async () => {
        // Restore tileset files
      },
      critical: true,
      priority: 5
    }
  ]);

  if (result.success) {
    showNotification('✓ Project saved successfully');
  } else if (hasPartialFailure()) {
    showWarning(`⚠️ ${getErrorSummary()}`);
  } else {
    showError(`✗ Save failed: ${getErrorSummary()}`);
  }
}, [executeAtomicSave, getErrorSummary, hasPartialFailure]);
```

### Example 2: Checking Transaction History for Debugging

```typescript
const { getAtomicSaveReport } = useAtomicSave();

function DebugPanel() {
  const report = getAtomicSaveReport();
  
  return (
    <div>
      <h3>Recent Save Attempts: {report.allTransactions.length}</h3>
      {report.failedOperations.length > 0 && (
        <div className="error">
          <h4>Failed Operations:</h4>
          {report.failedOperations.map(op => (
            <p key={op.operationName}>
              {op.operationName}: {op.error?.message} ({op.duration}ms)
            </p>
          ))}
        </div>
      )}
      <p>Rollbacks executed: {report.rollbackCount}</p>
    </div>
  );
}
```

### Example 3: Custom Save Operation with Timeout

```typescript
const saveOperations: SaveOperation[] = [
  {
    id: 'backup-save',
    name: 'Save to Backup',
    execute: async () => {
      // This operation has a 10s timeout
      const data = await generateBackup();
      await saveBackupFile(data);
    },
    rollback: async () => {
      await deleteBackupFile();
    },
    priority: 5,
    critical: false,         // Don't fail entire transaction if backup fails
    timeoutMs: 10000,        // 10 second timeout
    retryable: false         // Don't retry backups
  }
];
```

## Transaction Lifecycle

```
1. Initialize Transaction
   ├─ Assign unique transactionId
   ├─ Set startedAt timestamp
   └─ Sort operations by priority

2. Execute Operations
   ├─ For each operation (in order):
   │  ├─ Record startTime
   │  ├─ Execute operation.execute()
   │  ├─ Record result (success/failure/duration)
   │  └─ Check: Stop? (critical failure + continueOnError=false)
   └─ Update summary counts

3. Handle Failure
   ├─ Check: rollbackOnFailure enabled?
   ├─ If yes:
   │  ├─ Collect successful operations
   │  ├─ Reverse their order
   │  └─ Call rollback() on each
   └─ Record rolled back count

4. Complete Transaction
   ├─ Set completedAt timestamp
   ├─ Calculate final duration
   ├─ Finalize success status
   ├─ Store in history (keep 50 max)
   └─ Clear current transaction ref
```

## Error Handling

### Network Failures
```typescript
// If editor.saveProjectData() throws network error:
execute: async () => {
  try {
    const success = await editor.saveProjectData(path);
    if (!success) throw new Error('Save returned false');
  } catch (err) {
    // Transaction captures error, can rollback if critical
    throw err;
  }
}
```

### Partial Failures Detected
```typescript
// In useManualSave, after transaction:
if (!transactionResult.success && hasPartialFailure()) {
  setPartialFailureWarning(
    `⚠️ Partial save failure: Some data saved, some failed. ` +
    `${transactionResult.summary.rolledBack} operations rolled back.`
  );
}
```

### Rollback Failures
If rollback itself fails, the transaction is marked as failed (most severe condition). This is logged prominently for manual recovery.

## Comparison: Before vs After

### Before (No Transactions)
```
Manual Save:
1. Save editor project data → SUCCESS
2. Save individual files → FAILURE
3. Result: Editor saved, but individual files didn't
4. Application state: INCONSISTENT
5. Recovery: Manual user action required
```

### After (With Transactions)
```
Manual Save Transaction:
1. Save editor project data → SUCCESS
2. Save individual files → FAILURE
3. Critical operation failed → ROLLBACK step 1
4. Result: No saves applied
5. Application state: CONSISTENT (pre-save)
6. Recovery: User can retry or review error message
```

## Integration with Other Systems

### With Retry Strategy
Transactions work alongside retry strategy:
- **Retry Strategy**: Handles transient failures (network timeouts, temporary locks)
- **Transactions**: Handle logical coordination (if operation B fails, undo operation A)

```typescript
// Future: Retry within transaction operations
execute: async () => {
  const result = await executeWithRetry(() => saveFile(), 'save-op', config);
  if (!result.success) throw result.error;
}
```

### With Save Queue
Transactions register with SaveQueueContext for app shutdown coordination:
```typescript
registerSave(saveId, transactionPromise, true);
```

### With Per-Project Backups
Rollback operations can restore from `.flare-backup/` files:
```typescript
rollback: async () => {
  const backup = await loadFromBackup(projectPath);
  await restoreProjectData(backup);
}
```

## Configuration & Defaults

| Setting | Default | Used For |
|---------|---------|----------|
| `maxRetries` | Per operation | Attempts before failure |
| `timeoutMs` | Operation level | Max execution time |
| `priority` | 0 (lowest) | Execution order |
| `critical` | true | Must succeed for transaction success |
| `retryable` | true | Can retry on failure |
| `rollbackOnFailure` | true | Auto-rollback on critical failure |
| `continueOnError` | false | Stop processing on error |
| `strictOrdering` | true | Execute in priority order |
| `transactionTimeout` | 60000ms | Max total transaction time |

## Debugging

### View Transaction History
```typescript
const { getAtomicSaveReport } = useAtomicSave();
const report = getAtomicSaveReport();
console.log(report.allTransactions); // Last 50 transactions
```

### Check Failed Operations
```typescript
const { lastTransaction } = getAtomicSaveReport();
lastTransaction?.failedOperations.forEach(op => {
  console.log(`${op.operationName}: ${op.error?.message}`);
});
```

### Monitor Rollbacks
```typescript
const { lastTransaction } = getAtomicSaveReport();
if (lastTransaction?.summary.rolledBack > 0) {
  console.warn(`${lastTransaction.summary.rolledBack} operations rolled back`);
}
```

## Future Enhancements

1. **Nested Transactions**: Support sub-transactions for complex saves
2. **Savepoint Support**: Rollback to intermediate points, not just all-or-nothing
3. **Conflict Detection**: Identify conflicting operations automatically
4. **Persistence**: Store transaction logs to disk for crash recovery
5. **Compensation**: Beyond simple rollback, support complex compensation logic
6. **Metrics**: Track transaction success rates, average duration, failure causes

## Related Files

- [Per-Project Backup System](./PROJECT_BACKUP_SYSTEM.md)
- [Retry Strategy](./RETRY_STRATEGY.md)
- [Save Queue Coordination](../context/SaveQueueContext.tsx)
- [Autosave Management](../hooks/useAutosave.ts)
