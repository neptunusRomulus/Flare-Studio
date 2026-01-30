# Graceful Shutdown Implementation

## Overview
This document describes the graceful shutdown mechanism added to prevent data loss when the application closes. The system ensures that all pending saves are flushed to disk before the app actually quits.

## Architecture

### 1. **Electron Main Process** (`electron/main.cjs`)
Added three new event handlers:

#### `app.on("before-quit", (event) => {})`
- Triggered when app is about to quit (user closes window or uses Cmd+Q)
- **Prevents immediate quit** by calling `event.preventDefault()`
- Sends `"app-before-quit"` message to renderer process
- Sets a **15-second timeout** as safety net:
  - If renderer doesn't confirm saves within 15s, forces quit anyway
  - Prevents app from hanging if renderer crashes

#### `ipcMainLocal.on("app-shutdown-complete", () => {})`
- Listener for when renderer confirms all saves are flushed
- Clears the timeout
- Calls `app.quit()` to proceed with shutdown

#### `app.on("will-quit", () => {})`
- Final cleanup before app actually closes
- Ensures timeout is cleared

### 2. **Renderer Process** (`electron/preload.js`)
Exposed two new IPC methods:

```javascript
onAppBeforeQuit: (callback) => ipcRenderer.on("app-before-quit", () => callback())
appShutdownComplete: () => ipcRenderer.send("app-shutdown-complete")
```

### 3. **React Hook** (`src/hooks/useEditorIpc.ts`)
Registers handler for graceful shutdown:

```typescript
api.onAppBeforeQuit?.(async () => {
  console.log('[Shutdown] Received app-before-quit event, flushing pending saves...');
  try {
    // Wait for any pending manual saves to complete
    await handleManualSaveRef.current?.();
    console.log('[Shutdown] Pending saves flushed, notifying main process');
  } catch (error) {
    console.error('[Shutdown] Error during save flush:', error);
  } finally {
    // Always notify main process we're done, even if save failed
    api.appShutdownComplete?.();
  }
});
```

### 4. **TypeScript Definitions** (`src/electron.d.ts`)
Added type definitions for new IPC methods.

## Flow Diagram

```
User closes app
    ↓
app.on("before-quit") fires
    ↓
event.preventDefault() (block quit)
    ↓
Send "app-before-quit" to renderer
    ↓
Renderer receives message
    ↓
Wait for handleManualSaveRef.current() to complete
    ↓
All editor data saved to disk
    ↓
Send "app-shutdown-complete" back to main
    ↓
Main process receives message
    ↓
Clear timeout + call app.quit()
    ↓
app.on("will-quit") cleanup
    ↓
App closes
```

## Safety Features

### Timeout Protection (15 seconds)
- Prevents infinite hang if renderer process crashes or becomes unresponsive
- Logs timeout event for debugging
- Forces quit after timeout expires

### Error Resilience
- Even if save fails, `appShutdownComplete()` is called in `finally` block
- Prevents "stuck in shutdown" scenario
- Errors are logged for diagnostics

### Fallback Scenario
- If mainWindow is destroyed before shutdown, direct `app.quit()` is called
- No blocking or timeout in this case

## Console Logging

The shutdown sequence logs clearly to help with debugging:

```
[Shutdown] Requesting renderer to flush pending saves...
[Shutdown] Received app-before-quit event, flushing pending saves...
[Shutdown] Pending saves flushed, notifying main process
[Shutdown] Renderer confirmed all saves flushed, proceeding with quit
[Shutdown] App is about to quit - performing final cleanup
```

Or if timeout:
```
[Shutdown] Timeout: forcing quit after 15 seconds
```

## What Gets Saved

The `handleManualSaveRef.current?.()` call in the shutdown handler triggers:

1. **Map Editor Data** - Current map layers, objects, hero position
2. **Tileset Information** - Loaded tilesets and their mappings
3. **Project Metadata** - Map name, dimensions, tile size
4. **Session Data** - Open tabs and active tab (via `writeSession`)
5. **localStorage Backup** - Emergency backup to browser storage

See [useManualSave.ts](src/hooks/useManualSave.ts) for implementation details.

## Testing the Graceful Shutdown

### Manual Test Steps:
1. Open the app
2. Load a map project
3. Make some changes to the map (add tiles, move objects, etc.)
4. Close the app window or use Cmd+Q / Alt+F4
5. Watch console for `[Shutdown]` log messages
6. Verify that saves complete before app closes
7. Reopen the project - changes should be persisted

### Edge Cases to Test:
- **Rapid Close**: Close immediately after making changes (test debounce)
- **Large Project**: Close app with many layers/objects loaded
- **Broken Save**: Manually break save to test error handling
- **Network Delay**: If using remote storage, test with simulated latency

## Related Systems

- **Auto-save**: Continuous background saves (see [useAutosave.ts](src/hooks/useAutosave.ts))
- **Manual Save**: User-triggered save via menu or hotkey (see [useManualSave.ts](src/hooks/useManualSave.ts))
- **localStorage Backup**: Emergency fallback (see [TileMapEditor.ts](src/editor/TileMapEditor.ts#L7378))

## Future Improvements

1. **Save Queue**: Track multiple pending save operations, wait for all to complete
2. **Save Progress**: Show user progress during shutdown save
3. **Retry Logic**: Implement exponential backoff for failed saves during shutdown
4. **Database Transactions**: Atomic multi-file saves with rollback on failure
5. **Unload Prevention**: Browser `beforeunload` event for web version
