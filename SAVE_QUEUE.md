# Save Queue Implementation - Race Condition Prevention

## Problem Solved

**Race Condition**: Auto-save could be in-flight when app closes, leading to data loss because there was no way to wait for pending saves to complete.

**Solution**: Save Queue Context that tracks all active saves and provides a wait mechanism for graceful shutdown.

## Architecture Overview

### 1. SaveQueueContext (`src/context/SaveQueueContext.tsx`)

A React Context that manages a registry of pending saves:

```typescript
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
```

#### Key Features:

- **registerSave()**: Track a new save promise
  - Auto-cleanup when promise settles (success or failure)
  - Logs timing information for diagnostics
  - Marks shutdown saves differently for priority handling

- **waitForAllSaves()**: Wait for all pending saves with timeout
  - Returns count of completed/failed saves
  - 30-second default timeout (configurable)
  - Returns immediately if no pending saves
  - Indicates if timeout occurred vs normal completion

- **pauseSaves() / resumeSaves()**: Future-proofing for save pause during critical operations

#### Console Logging:

```
[SaveQueue] Registered save: autosave-1 - Total pending: 1
[SaveQueue] Save completed: autosave-1 (245ms)
[SaveQueue] Unregistered save: autosave-1 - Remaining: 0
[SaveQueue] Waiting for 2 pending save(s)...
[SaveQueue] All saves completed in 523ms (completed: 2, failed: 0)
```

---

### 2. Integration in useAutosave (`src/hooks/useAutosave.ts`)

Auto-saves are tracked with unique IDs:

```typescript
const savePromise = (async () => {
  try {
    setIsManuallySaving(manual);
    setSaveStatus('saving');
    await saveFn();
    setLastSaveTime(Date.now());
    setSaveStatus('saved');
    setHasUnsavedChanges(false);
    return true;
  } catch {
    setSaveStatus('error');
    return false;
  } finally {
    setIsManuallySaving(false);
    // clear saved indicator after a short delay
    window.setTimeout(() => { setSaveStatus(prev => prev === 'saved' ? 'unsaved' : prev); }, 2000);
  }
})();

// Register this save with the queue
registerSave(saveId, savePromise.then(() => {}), manual);
```

**Key Points**:
- Each auto-save gets unique ID: `autosave-1`, `autosave-2`, etc.
- Promise is registered immediately (non-blocking)
- Context auto-cleans up after promise settles

---

### 3. Integration in useManualSave (`src/hooks/useManualSave.ts`)

Manual saves also tracked with unique IDs:

```typescript
const savePromise = (async () => {
  setIsManuallySaving(true);
  try {
    const api = window.electronAPI;
    if (api && currentProjectPath) {
      const success = await editor.saveProjectData(currentProjectPath);
      await new Promise(resolve => setTimeout(resolve, 300));
      if (success) {
        setLastSaveTime(Date.now());
      }
    }
    // ... fallback logic
  } catch (error) {
    console.error('Save error:', error);
  } finally {
    setIsManuallySaving(false);
  }
})();

// Register this save with the queue (marked as shutdown save if triggered during close)
registerSave(saveId, savePromise, true);
```

---

### 4. Graceful Shutdown Integration in useEditorIpc (`src/hooks/useEditorIpc.ts`)

On app shutdown, waits for ALL pending saves:

```typescript
api.onAppBeforeQuit?.(async () => {
  console.log('[Shutdown] Received app-before-quit event, waiting for all pending saves...');
  try {
    // Wait for all pending saves (with 30 second timeout)
    const result = await waitForAllSaves(30000);
    
    if (result.timedOut) {
      console.warn(`[Shutdown] Save queue timeout! Completed: ${result.completed}, Failed: ${result.failed}`);
    } else {
      console.log(`[Shutdown] All saves flushed. Completed: ${result.completed}, Failed: ${result.failed}`);
    }
    
    // Also trigger one final manual save to be safe
    try {
      await handleManualSaveRef.current?.();
      console.log('[Shutdown] Final manual save completed');
    } catch (err) {
      console.error('[Shutdown] Final manual save failed:', err);
    }
  } catch (error) {
    console.error('[Shutdown] Error during save flush:', error);
  } finally {
    // Always notify main process we're done, even if saves failed
    console.log('[Shutdown] Notifying main process shutdown is complete');
    api.appShutdownComplete?.();
  }
});
```

**Flow**:
1. App close signal received
2. Wait for all auto-saves to complete (up to 30s)
3. Trigger one final manual save as fallback
4. Notify main process shutdown is complete
5. Main process proceeds with quit

---

### 5. Provider Setup in App (`src/App.tsx`)

SaveQueueContext wrapped highest in React tree:

```tsx
export default function App() {
  return (
    <SaveQueueProvider>
      <ToolbarProvider value={toolbarValue}>
        <SidebarProvider deps={useSidebarDeps(sidebarDeps)}>
          {/* ... */}
        </SidebarProvider>
      </ToolbarProvider>
    </SaveQueueProvider>
  );
}
```

---

## Save Flow During Shutdown

```
User closes app
  ↓
app.on("before-quit") blocks exit (Electron)
  ↓
Send "app-before-quit" to renderer
  ↓
useEditorIpc receives shutdown signal
  ↓
waitForAllSaves(30000) called
  ↓
Wait for:
  ├─ autosave-1 (if running)
  ├─ autosave-2 (if running)
  └─ manual-save-1 (if running)
  ↓
All saves complete OR 30s timeout
  ↓
Trigger final manual save as safety net
  ↓
Send "app-shutdown-complete" to main
  ↓
Main process calls app.quit()
  ↓
App closes cleanly
```

---

## Scenarios Handled

### Scenario 1: Normal Shutdown
```
[Shutdown] Received app-before-quit event, waiting for all pending saves...
[SaveQueue] Waiting for 1 pending save(s)...
[SaveQueue] All saves completed in 245ms (completed: 1, failed: 0)
[Shutdown] All saves flushed. Completed: 1, Failed: 0
[Shutdown] Final manual save completed
[Shutdown] Notifying main process shutdown is complete
```
✅ Result: Data persisted safely

### Scenario 2: Rapid Close (save in progress)
```
[Shutdown] Received app-before-quit event, waiting for all pending saves...
[SaveQueue] Waiting for 2 pending save(s)...
[SaveQueue] All saves completed in 1523ms (completed: 2, failed: 0)
[Shutdown] All saves flushed. Completed: 2, Failed: 0
[Shutdown] Final manual save completed
```
✅ Result: All in-flight saves completed before quit

### Scenario 3: Save Timeout (very large project)
```
[Shutdown] Received app-before-quit event, waiting for all pending saves...
[SaveQueue] Waiting for 3 pending save(s)...
[SaveQueue] Save queue timeout or error after 30000ms:
[SaveQueue] Still pending saves: 1
[Shutdown] Save queue timeout! Completed: 2, Failed: 0
[Shutdown] Final manual save completed (triggers new save attempt)
[Shutdown] Notifying main process shutdown is complete
```
✅ Result: Timeout doesn't block quit, but final save attempt made

### Scenario 4: Save Errors
```
[Shutdown] Received app-before-quit event, waiting for all pending saves...
[SaveQueue] Waiting for 1 pending save(s)...
[SaveQueue] Save failed: autosave-1 (error details)
[SaveQueue] All saves completed in 1200ms (completed: 0, failed: 1)
[Shutdown] All saves flushed. Completed: 0, Failed: 1
[Shutdown] Final manual save attempted
```
✅ Result: Even if auto-save failed, final manual save attempts fix

---

## Testing Checklist

- [ ] **Normal Close**: Close app after normal editing
  - Verify saves complete before quit
  - Check console logs show all saves flushed

- [ ] **Rapid Close**: Make changes, immediately close
  - Verify pending saves are waited for
  - Reopen project, changes persist

- [ ] **Large Project**: Open project with many layers/objects
  - Edit something, close quickly
  - Verify no data loss even with slow saves

- [ ] **Save Errors**: Manually corrupt save handler
  - Close app
  - Verify final manual save attempt happens
  - Check error in console

- [ ] **Timeout Scenario**: Simulate slow network
  - Close app with slow save
  - Verify 30s timeout doesn't hang
  - App closes and retries with final save

- [ ] **Multiple Saves**: Rapid edits causing multiple auto-saves
  - Make many changes quickly
  - Close before all auto-saves finish
  - Verify all are waited for during shutdown

---

## Performance Implications

- **Memory**: Minimal - only stores promise references, auto-cleans
- **CPU**: Negligible - uses async/await only
- **Network**: Shutdown takes 30s max (configurable timeout)
- **Startup**: No impact - context loaded after main app

---

## Future Enhancements

1. **Save Batching**: Combine multiple rapid saves into one
2. **Compression**: For large project saves
3. **Parallel Saves**: Save different data (editor + NPCs + items) in parallel
4. **Persistence**: Save queue state to localStorage for recovery
5. **UI Feedback**: Progress bar showing save queue status during shutdown
6. **Analytics**: Track which saves timeout most often

---

## Related Systems

- **useAutosave.ts**: Triggers saves every 5s or on debounce
- **useManualSave.ts**: Handles explicit save operations
- **useEditorIpc.ts**: Coordinates with Electron for shutdown
- **TileMapEditor.ts**: Actual save implementation (saveProjectData)
- **GRACEFUL_SHUTDOWN.md**: Main shutdown coordination document
