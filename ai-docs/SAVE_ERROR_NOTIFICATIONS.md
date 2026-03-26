# Save Error Notifications - Implementation Guide

## Overview

Users may not notice when saves fail due to permissions, disk space, or network issues. This feature provides **persistent, dismissible error notifications** that remain visible until the error is resolved or manually dismissed.

## Architecture

### Components

1. **SaveErrorContext** (`src/context/SaveErrorContext.tsx`)
   - Manages global save error state
   - Tracks error ID, message, code, timestamp, and context
   - Provides methods to add, dismiss, and resolve errors

2. **useSaveErrorNotification** (`src/hooks/useSaveErrorNotification.ts`)
   - High-level hook for notifying save errors
   - Type-specific notification methods for different save operations
   - Automatic duplicate suppression (within 5 seconds)

3. **SaveErrorNotificationPanel** (`src/components/SaveErrorNotificationPanel.tsx`)
   - UI component displaying persistent error notifications
   - Shows at bottom of screen
   - Includes retry button (if handler provided) and dismiss button
   - Auto-collapses after errors are resolved

### Integration Points

- **useManualSave.ts**: Notifies on manual save failures
- **useAutosave.ts**: Notifies on auto-save failures
- **App.tsx**: Wraps app with SaveErrorProvider
- **DialogsContainer.tsx**: Renders SaveErrorNotificationPanel

## Data Flow

```
Save Operation Fails
    ↓
useSaveErrorNotification.notifyManualSaveError()
    ↓
useSaveError.addError() [SaveErrorContext]
    ↓
State: errors array updated
    ↓
SaveErrorNotificationPanel re-renders
    ↓
User sees persistent red banner at bottom
```

## Error Types

### 1. Manual Save Errors
```typescript
notifyManualSaveError(
  message: string,
  filePath?: string,
  retryCount?: number
)
```
- Triggered by explicit user save action (Ctrl+S)
- Most visible to user
- Includes file path if available

### 2. Auto-Save Errors
```typescript
notifyAutoSaveError(
  message: string,
  filePath?: string,
  retryCount?: number
)
```
- Triggered by background auto-save
- Persists even if user doesn't interact
- Shows retry count for multiple failures

### 3. Coordination Errors
```typescript
notifyCoordinationError(message: string, details?: string)
```
- NPC/Item/Enemy save coordination failures
- Prevents partial saves

### 4. Serialization Errors
```typescript
notifySerializationError(message: string, details?: string)
```
- Web Worker serialization failures
- Includes fallback information

## Features

### Persistent Display
- Errors remain visible until:
  - User clicks "Dismiss"
  - Next save succeeds
  - Error is marked as resolved

### Duplicate Prevention
- Same error within 5 seconds is suppressed
- Prevents notification spam

### Error Details
- Operation type (manual, auto, coordination, serialization)
- File path
- Retry count
- Timestamp

### Expandable/Collapsible
- Click "Hide" to collapse notification panel
- Click "Show" to expand
- Auto-collapses after resolution (configurable)

### Retry Support
- "Retry" button available (if handler provided)
- Shows spinning indicator while retrying
- Resolves error on successful retry

### Dark Mode Support
- Full dark mode styling
- Red color adjustments for readability

## Usage Examples

### In useManualSave
```typescript
import useSaveErrorNotification from './useSaveErrorNotification';

const { notifyManualSaveError, resolveError } = useSaveErrorNotification();

try {
  // ... save operation
  if (success) {
    resolveError(lastErrorId);
  } else {
    const errorId = notifyManualSaveError(
      'Failed to save project data',
      currentProjectPath
    );
    setLastErrorId(errorId);
  }
} catch (error) {
  const errorId = notifyManualSaveError(
    error.message,
    currentProjectPath
  );
  setLastErrorId(errorId);
}
```

### In useAutosave
```typescript
const { notifyAutoSaveError, resolveError } = useSaveErrorNotification();

if (result.success) {
  resolveError(lastErrorId);
} else {
  const newErrorId = notifyAutoSaveError(
    result.error?.message || 'Save failed',
    currentFilePath,
    retryCount
  );
  setLastErrorId(newErrorId);
}
```

## Configuration

### SaveErrorNotificationPanel Props
```typescript
interface SaveErrorNotificationPanelProps {
  position?: 'top' | 'bottom';      // Default: 'bottom'
  maxHeight?: string;                 // Default: 'max-h-96'
  onRetry?: (errorId: string) => Promise<void>;  // Optional retry handler
  autoCollapseMs?: number;           // Auto-collapse delay (ms)
}
```

### Example with Retry Handler
```tsx
<SaveErrorNotificationPanel
  position="bottom"
  maxHeight="max-h-96"
  onRetry={async (errorId) => {
    // Attempt to retry the failed save
    await manualSaveRef.current?.();
  }}
  autoCollapseMs={2000}
/>
```

## Testing

### Manual Testing
1. Open a project
2. Make changes
3. Simulate save failure (disable write permissions, fill disk)
4. Trigger save (Ctrl+S)
5. Verify red notification appears at bottom
6. Verify error details are shown
7. Fix issue
8. Click "Retry" - should succeed and auto-resolve
9. Verify notification auto-collapses

### Auto-Save Testing
1. Enable auto-save
2. Simulate save failure
3. Verify notification appears without user action
4. Verify multiple failures don't spam notifications
5. Fix issue
6. Verify next auto-save succeeds and resolves

### Duplicate Suppression
1. Trigger same error twice rapidly
2. Verify only one notification appears
3. Wait 5 seconds
4. Trigger same error again
5. Verify new notification appears

## State Management

### SaveErrorContext State
```typescript
interface SaveError {
  id: string;                    // Unique ID
  message: string;               // Error message
  code?: string;                 // Error code (MANUAL_SAVE_FAILED, etc.)
  timestamp: number;             // When error occurred
  context?: {
    filePath?: string;          // File being saved
    operationType?: 'manual' | 'auto' | 'coordination' | 'serialization';
    retryCount?: number;        // Number of retry attempts
    isResolved?: boolean;       // Whether error is resolved
  };
}
```

### Context Methods
```typescript
const {
  errors,                           // Array of all errors
  addError,                         // Add new error
  dismissError,                     // Remove error from display
  clearAllErrors,                   // Remove all errors
  markErrorResolved,                // Mark error as resolved
  hasUnresolvedErrors,              // Boolean flag
  getErrorCount,                    // Total error count
  getUnresolvedErrorCount           // Unresolved count
} = useSaveError();
```

## Error Messages

### Common Error Messages
- "Save failed - check file permissions"
- "Disk space full - unable to save"
- "Network error - please check connection"
- "File locked by another process"
- "Save cancelled - file conflict detected"
- "NPC/Item/Enemy coordination failed: [details]"
- "Serialization timeout - using fallback"

### Severity Indicators
- Red background = Error requiring action
- Alert icon = Save at risk
- Retry button = Recoverable error
- Timestamp = When error occurred

## Performance Impact

- **Memory**: ~1KB per error notification
- **Rendering**: Minimal (only when errors change)
- **Event Handling**: Lightweight dismiss/retry handlers
- **Duplicate Detection**: O(n) scan where n = number of errors

## Browser Compatibility

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Future Enhancements

1. **Error Analytics**
   - Track error frequency
   - Monitor retry success rate
   - Identify common failure patterns

2. **Smart Retry**
   - Exponential backoff
   - Jitter for retries
   - Maximum retry limits

3. **Error Categories**
   - Group related errors
   - Color-coded severity levels
   - Suggested fixes

4. **Undo on Error**
   - Rollback unsaved changes
   - Restore from backup
   - Previous version recovery

## Troubleshooting

### Notifications Not Appearing
- Check SaveErrorProvider is wrapping app in App.tsx
- Verify SaveErrorNotificationPanel in DialogsContainer
- Check browser console for errors

### Duplicate Notifications
- Suppress timeout is 5 seconds - wait longer for new
- Check error message is identical
- Verify save is actually failing both times

### Retry Button Not Working
- Verify onRetry prop provided to SaveErrorNotificationPanel
- Check retry handler is calling save function
- Verify error is actually being resolved on success

### Dark Mode Issues
- Verify dark: classes in SaveErrorNotificationPanel
- Check Tailwind dark mode enabled in config
- Inspect element styles in DevTools
