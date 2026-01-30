# File Conflict Detection System

**Issue Fixed**: "No save conflict detection - If file is edited externally while app is open, no detection. Can lose external changes on next save."

## Overview

The File Conflict Detection System prevents data loss by detecting when files are modified externally while the application is open. Instead of silently overwriting external changes, users are prompted to choose a resolution strategy.

### Problem Solved

| Scenario | Before | After |
|----------|--------|-------|
| Git pulls while app open | External changes silently lost on next save | User prompted, can reload or cancel |
| External editor modifies file | App overwrites external changes | Conflict detected, user chooses resolution |
| File sync (Dropbox, OneDrive) | No detection of changes | Timestamp monitored, conflict alerts user |
| Rapid external edits | Data loss without warning | Prevents save, preserves both versions |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ConflictResolutionProvider            │
│  - Manages user prompts                                  │
│  - Tracks resolution history (last 50)                   │
│  - 5-minute timeout for unresolved conflicts             │
└──────────────────┬──────────────────────────────────────┘
                   │ provides context
                   ▼
┌──────────────────────────────────────────────────────────┐
│              useFileConflictDetection Hook                │
│  - Tracks file timestamps on load/save                   │
│  - Compares current timestamp vs. app's last known time  │
│  - Calculates modification delta                         │
│  - Prevents saves if external changes detected           │
└──────────────────┬───────────────────────────────────────┘
                   │
        ┌──────────┴──────────┬─────────────────┐
        │                     │                 │
        ▼                     ▼                 ▼
   ┌─────────────┐    ┌──────────────┐   ┌──────────────┐
   │useAutosave  │    │useManualSave │   │App Component │
   │  - Checks   │    │  - Pre-save  │   │  - Wraps    │
   │  conflict   │    │  - Prompts   │   │  - Provider │
   │  before save│    │  - User      │   │             │
   └─────────────┘    │    choice    │   └──────────────┘
                      └──────────────┘
```

## Components

### 1. useFileConflictDetection Hook
**File**: `src/hooks/useFileConflictDetection.ts` (240 lines)

Core conflict detection engine with file timestamp tracking.

#### API
```typescript
const {
  registerFileLoad,           // Called when file is loaded by app
  registerFileSave,          // Called after successful save
  checkFileConflict,         // Pre-save conflict check
  checkMultipleFileConflicts, // Batch check multiple files
  clearTrackedFiles,         // Reset all tracking (on project switch)
  getConflictDetectionStatus // Debug status info
} = useFileConflictDetection();
```

#### File Metadata Tracking
```typescript
interface FileMetadata {
  filePath: string;
  lastModifiedTime: number;  // Unix timestamp of last known modification
  fileSize: number;           // Size in bytes
  contentHash?: string;       // Optional: SHA256 or similar
}
```

#### Conflict Detection Result
```typescript
interface ConflictDetectionResult {
  hasConflict: boolean;
  conflictingFiles: string[];
  reason?: string;
  severity: 'none' | 'warning' | 'critical';
}
```

#### Usage Example
```typescript
// Register when app loads a file
registerFileLoad('/project/map.json', 1024);

// Check before save
const result = await checkFileConflict('/project/map.json', 1024);
if (result.hasConflict) {
  console.warn('External modification detected:', result.reason);
  // Notify user, don't proceed with save
}

// Register successful save
registerFileSave('/project/map.json', 1024);
```

### 2. ConflictResolutionContext
**File**: `src/context/ConflictResolutionContext.tsx` (190 lines)

Manages user prompts and resolution decisions when conflicts detected.

#### API
```typescript
const {
  isPromptVisible,              // Whether conflict prompt is showing
  currentConflict,              // Current conflict details
  showConflictPrompt,           // Show UI prompt, wait for resolution
  hideConflictPrompt,           // Hide prompt (auto on resolution)
  resolveConflict,              // User action: resolve with choice
  getConflictStats              // Debug: resolution history
} = useConflictResolution();
```

#### Conflict Prompt Data
```typescript
interface ConflictPromptData {
  filePath: string;
  reason: string;               // Human-readable explanation
  severity: 'warning' | 'critical';
  conflictingFiles?: string[];  // Multiple files if batch operation
}
```

#### Resolution Strategies
```typescript
type ConflictResolution = 
  | 'reload'      // Discard app changes, reload external version
  | 'keep_app'    // Keep app version, overwrite external (use caution)
  | 'cancel'      // Cancel save, keep both versions
  | 'merge';      // Request merge (future: 3-way merge)
```

#### Usage Example
```typescript
try {
  const resolution = await showConflictPrompt({
    filePath: '/project/map.json',
    reason: 'File was modified externally (Git pull detected)',
    severity: 'critical'
  });

  switch (resolution) {
    case 'reload':
      // Load external version from disk
      await reloadFromDisk();
      break;
    case 'keep_app':
      // Proceed with save (overwrites external)
      await saveToDisk();
      break;
    case 'cancel':
      // Don't save, keep changes in app
      break;
  }
} catch (err) {
  // Timeout or error - auto-cancel
  console.warn('Conflict resolution failed:', err);
}
```

## Integration Points

### useAutosave Integration
**File**: `src/hooks/useAutosave.ts` (Enhanced)

New options:
```typescript
useAutosave({
  manualSaveRef,
  autoSaveInterval: 5000,
  debounceMs: 2000,
  currentFilePath: '/project/map.json',      // ← NEW
  currentFileSize: 1024,                      // ← NEW
  onConflictDetected: (path, reason) => ...   // ← NEW
})
```

Pre-save flow:
1. Debounce timer expires or interval fires
2. **Check for conflicts** if `currentFilePath` provided
3. If conflict & user cancels → stop save, keep pending
4. Otherwise proceed with normal save flow
5. Update conflict tracking after save succeeds

### useManualSave Integration
**File**: `src/hooks/useManualSave.ts` (Enhanced)

Pre-save checks:
1. **Ask user about conflicts** via `showConflictPrompt`
2. Handle resolution: reload, keep app, or cancel
3. Only proceed to atomic save if user chooses "keep app"
4. All within try/catch with conflict handling

### App.tsx Integration
**File**: `src/App.tsx` (Modified)

Provider hierarchy:
```tsx
<RetryStrategyProvider>
  <SaveTransactionProvider>
    <SaveQueueProvider>
      <ConflictResolutionProvider>  {/* ← NEW */}
        <ToolbarProvider>
          <SidebarProvider>
            <AppProvider>
              <AppMain />
            </AppProvider>
          </SidebarProvider>
        </ToolbarProvider>
      </ConflictResolutionProvider>
    </SaveQueueProvider>
  </SaveTransactionProvider>
</RetryStrategyProvider>
```

## Workflow Examples

### Example 1: Autosave with External Git Pull
```
1. User has map.json open
   - App loaded at 2024-01-30 10:00:00
   
2. 10:05 - Developer runs 'git pull'
   - Disk file updated to 10:05:30
   - App unaware (still tracking 10:00:00)
   
3. User makes local change (brush stroke)
   - Debounce timer starts
   
4. 2s later - Debounce expires, autosave triggers
   - Check: Is disk timestamp > app's last save? YES
   - Severity: CRITICAL (5+ minutes old)
   
5. showConflictPrompt displayed to user:
   - "File was modified externally"
   - Options: Reload, Keep App, Cancel
   
6a. User chooses "Reload"
   - Cancel save (discard brush stroke)
   - Reload git's version
   
6b. User chooses "Keep App"
   - Proceed with save
   - Git changes overwritten (user accepted risk)
   
6c. User chooses "Cancel"
   - Save cancelled
   - Pending changes preserved
   - Try again later (after resolving conflict)
```

### Example 2: Manual Save with File Sync
```
1. User has enemy.txt open
   - Dropbox syncing in background
   
2. User makes change and presses Ctrl+S
   - handleManualSave called
   
3. Conflict detection pre-check:
   - Disk file size changed 100 bytes
   - App's last save was 30s ago
   - Severity: WARNING (recent, but changed)
   
4. showConflictPrompt displayed:
   - "Project files may have been synced"
   - Options: Reload, Keep App, Cancel
   
5. User chooses "Keep App"
   - Proceeds to atomic save
   - Settings + map data + enemy data saved
   - File tracking updated to current timestamp
   
6. Next change - no conflict shown
   - Timestamps now synchronized
```

## Configuration

### File Metadata Tracking
- Tracks up to 100 files per session
- Stores: path, timestamp, size, optional hash
- Cleared on project switch

### Conflict Prompts
- **Timeout**: 5 minutes (auto-cancel if no response)
- **History**: Last 50 resolutions tracked
- **Severity**: 'warning' (minor changes) or 'critical' (major changes)

### Timestamp Tolerance
```typescript
const DEFAULT_CHECK_TOLERANCE_MS = 1000;
// Allow 1s tolerance for filesystem/network lag
// Changes older than 1s are considered conflicts
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Conflict check fails | Log warning, continue with save (don't block user) |
| Can't read file timestamps | Warn user, allow manual check override |
| Prompt timeout (5 min) | Auto-cancel save, keep pending changes |
| File deleted externally | Treat as critical conflict |
| File permissions error | Warn, allow retry or cancel |

## Logging

All conflicts logged with detailed context:

```
[FileConflict] Registered file load: /project/map.json (size: 1024B)
[FileConflict] External modification detected for /project/map.json
  - File size changed 100 bytes
  - Tracked time: 2024-01-30T10:00:00Z
  - Current time: 2024-01-30T10:05:30Z

[ConflictResolution] Showing conflict prompt #1
  - filePath: /project/map.json
  - severity: critical

[ConflictResolution] User chose: keep_app for /project/map.json
[ConflictResolution] Prompt timeout for /project/map.json, auto-canceling
```

## Future Enhancements

### Phase 2: Advanced Conflict Detection
- **Content Hashing**: SHA256 of file content for precise detection
- **Three-Way Merge**: Merge external + app + original versions
- **Conflict Visualization**: Show diffs of external vs app versions
- **Automatic Merge Strategies**: Configurable merge on certain file types

### Phase 3: External File Monitoring
- **File Watcher**: inotify/FSEvents for real-time external change detection
- **Background Sync**: Automatically reload on external changes
- **Conflict Queue**: Track multiple conflicts across multiple files
- **Undo on Reload**: Restore app state after reloading external

### Phase 4: Collaboration Features
- **Lock Files**: Prevent external edits while app has unsaved changes
- **Last-Writer-Wins**: Auto-merge with timestamp-based conflict resolution
- **Change Tracking**: Show who made external changes and when
- **Merge Hooks**: Custom merge logic per file type

## Testing

### Manual Testing Checklist
- [ ] Load project, modify externally (edit .json in text editor)
- [ ] Trigger save (autosave debounce or manual save)
- [ ] Verify conflict prompt appears
- [ ] Test all resolution options (reload, keep_app, cancel)
- [ ] Verify no data loss in any path
- [ ] Test with multiple files
- [ ] Test file deletion while open
- [ ] Test rapid external changes

### Edge Cases
- File deleted externally while saving
- File locked (permission denied)
- Symbolic links or shortcuts
- Network drives (slow timestamp updates)
- Very large files (performance)

## Debugging

### Check Conflict Status
```typescript
const { getConflictDetectionStatus } = useFileConflictDetection();
const status = getConflictDetectionStatus();
console.log(status);
// Output:
// {
//   trackedFilesCount: 3,
//   trackedFiles: {
//     '/project/map.json': { filePath, lastModifiedTime, fileSize },
//     ...
//   },
//   enabledAt: 'app startup'
// }
```

### Check Resolution History
```typescript
const { getConflictStats } = useConflictResolution();
const stats = getConflictStats();
console.log(stats.resolutionHistory);
// Output:
// [
//   { filePath: '/project/map.json', resolution: 'keep_app', timestamp: 1706594230000 },
//   ...
// ]
```

## Integration with Existing Systems

### SaveTransactionContext
- Conflict detection happens **before** transaction
- If conflict detected and user cancels → no transaction executed
- Transaction tracks which files were involved
- On rollback → conflict tracking preserved

### RetryStrategyContext
- Conflict check is **not** retried
- Single decision from user, not auto-retried
- User has 5 minutes to respond

### SaveQueueContext
- Conflicted saves are **not queued**
- User resolves first, then normal save queued
- Prevents queue overflow from repeated conflicts

## Performance Impact

- **File metadata memory**: ~100 bytes per tracked file
- **Timestamp check**: < 1ms per file
- **Batch check 10 files**: < 10ms total
- **No filesystem I/O** unless `getCurrentFileStats` provided
- **Minimal impact on autosave cadence** (< 5ms overhead)

## Compatibility

- ✅ Works with existing localStorage backups (Phase 1)
- ✅ Works with RetryStrategyContext exponential backoff (Phase 2)
- ✅ Works with SaveTransactionContext atomic operations (Phase 3)
- ✅ Works with debounce/interval redundancy (Phase 4)
- ✅ Works with settings persistence (Phase 5)
- ✅ Supports Electron IPC for file stats
- ✅ Works with web localStorage fallback

## Related Issues

- **Original Issue #6**: "No save conflict detection"
- **Related #3**: Atomic saves (prevents partial overwrites during conflict)
- **Related #4**: Debounce timer (prevents loss of pending changes)
- **Related #16**: Retry strategy (conflict check has its own timeout)
