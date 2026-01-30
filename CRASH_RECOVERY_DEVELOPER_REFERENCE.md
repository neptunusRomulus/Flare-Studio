# Developer Reference - Crash Recovery System

## Quick Start for Developers

### Add Crash Recovery to Your Component

```typescript
import { useCrashRecovery } from '@/hooks/useCrashRecovery';
import SessionRecoveryDialog from '@/components/SessionRecoveryDialog';

function MyComponent() {
  const [showDialog, setShowDialog] = useState(false);
  
  const {
    hasCrashBackup,
    mapName,
    isRecovering,
    recoveryError,
    recoverSession,
    dismissRecovery,
    getCrashTimeFormatted,
    getTimeSinceCrash
  } = useCrashRecovery({
    onRecoveryFound: () => setShowDialog(true),
    onRecoveryDismissed: () => setShowDialog(false)
  });

  const handleRecover = async () => {
    const success = await recoverSession();
    if (success) setShowDialog(false);
  };

  const handleDismiss = () => {
    dismissRecovery();
    setShowDialog(false);
  };

  return (
    <>
      <SessionRecoveryDialog
        isOpen={showDialog && hasCrashBackup}
        mapName={mapName}
        crashTime={getCrashTimeFormatted()}
        timeSinceCrash={getTimeSinceCrash()}
        isRecovering={isRecovering}
        error={recoveryError}
        onRecover={handleRecover}
        onDismiss={handleDismiss}
      />
    </>
  );
}
```

## API Reference

### useCrashRecovery Hook

#### Import
```typescript
import useCrashRecovery from '@/hooks/useCrashRecovery';
```

#### Type Definition
```typescript
interface SessionRecoveryState {
  hasCrashBackup: boolean;
  backupTimestamp: number | null;
  mapName: string | null;
  isRecovering: boolean;
  recoveryError: string | null;
}

interface CrashRecoveryOptions {
  onRecoveryFound?: () => void;      // Called when crash detected
  onRecoveryDismissed?: () => void;  // Called when recovery dismissed
  checkInterval?: number;             // Heartbeat interval (default: 15000ms)
  backupMaxAge?: number;             // Max backup age (default: 86400000ms = 24h)
}

function useCrashRecovery(options?: CrashRecoveryOptions): {
  // State
  hasCrashBackup: boolean;
  backupTimestamp: number | null;
  mapName: string | null;
  isRecovering: boolean;
  recoveryError: string | null;
  
  // Actions
  recoverSession: () => Promise<boolean>;
  dismissRecovery: () => void;
  clearOldBackups: () => void;
  clearCrashMarker: () => void;
  
  // Helpers
  getCrashTimeFormatted: () => string | null;
  getTimeSinceCrash: () => string | null;
}
```

#### State Properties

| Property | Type | Description |
|----------|------|-------------|
| `hasCrashBackup` | boolean | Is crash recovery available? |
| `backupTimestamp` | number \| null | Backup creation time (ms since epoch) |
| `mapName` | string \| null | Name of crashed map |
| `isRecovering` | boolean | Is recovery in progress? |
| `recoveryError` | string \| null | Error message if recovery failed |

#### Methods

**recoverSession()**
- Returns: `Promise<boolean>`
- Recovers app state from localStorage backup
- Clears crash marker on success
- Returns true if successful, false otherwise
- Errors are stored in `recoveryError` state

**dismissRecovery()**
- Returns: `void`
- Clears crash marker without recovery
- App continues with empty state
- No side effects

**clearOldBackups()**
- Returns: `void`
- Removes backups older than `backupMaxAge`
- Called automatically during recovery
- Safe to call manually

**clearCrashMarker()**
- Returns: `void`
- Removes crash detection markers
- Called by dismissRecovery and recoverSession
- Prevents false recovery on next start

**getCrashTimeFormatted()**
- Returns: `string | null`
- Formats crash time as: "Jan 30, 2025, 3:45 PM"
- Returns null if no crash detected
- Uses browser locale for formatting

**getTimeSinceCrash()**
- Returns: `string | null`
- Returns relative time: "2 minutes ago", "1 hour ago", etc.
- Returns null if no crash detected
- Updates reactively

#### Options

**onRecoveryFound**
```typescript
useCrashRecovery({
  onRecoveryFound: () => {
    // Called when crash detected with backup available
    // Use this to show dialog or notification
    console.log('Show recovery dialog');
  }
});
```

**onRecoveryDismissed**
```typescript
useCrashRecovery({
  onRecoveryDismissed: () => {
    // Called when recovery is dismissed or completed
    // Use this to hide dialog or clean up
    console.log('Hide recovery dialog');
  }
});
```

**checkInterval**
```typescript
useCrashRecovery({
  checkInterval: 30000 // Check session health every 30 seconds
});
```

**backupMaxAge**
```typescript
useCrashRecovery({
  backupMaxAge: 604800000 // Keep backups for 7 days
});
```

### SessionRecoveryDialog Component

#### Import
```typescript
import SessionRecoveryDialog from '@/components/SessionRecoveryDialog';
```

#### Type Definition
```typescript
interface SessionRecoveryDialogProps {
  isOpen: boolean;
  mapName: string | null;
  crashTime: string | null;
  timeSinceCrash: string | null;
  isRecovering: boolean;
  error: string | null;
  onRecover: () => Promise<void>;
  onDismiss: () => void;
}
```

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | boolean | Yes | Show/hide dialog |
| `mapName` | string \| null | No | Map being edited (e.g., "Forest Village") |
| `crashTime` | string \| null | No | Formatted crash time (e.g., "Jan 30, 2025, 3:45 PM") |
| `timeSinceCrash` | string \| null | No | Relative crash time (e.g., "2 minutes ago") |
| `isRecovering` | boolean | Yes | Show loading spinner? |
| `error` | string \| null | No | Error message if recovery failed |
| `onRecover` | Function | Yes | Called when user clicks "Recover Session" |
| `onDismiss` | Function | Yes | Called when user clicks "Start Fresh" |

#### Usage Example

```typescript
<SessionRecoveryDialog
  isOpen={showRecoveryDialog && hasCrashBackup}
  mapName={crashedMapName}
  crashTime={getCrashTimeFormatted()}
  timeSinceCrash={getTimeSinceCrash()}
  isRecovering={isRecovering}
  error={recoveryError}
  onRecover={async () => {
    const success = await recoverSession();
    if (success) setShowRecoveryDialog(false);
  }}
  onDismiss={() => {
    dismissRecovery();
    setShowRecoveryDialog(false);
  }}
/>
```

## Storage Format

### Crash Detection Markers

#### sessionStorage
```javascript
// Marks current session as active
sessionStorage.setItem('app_session_active', JSON.stringify({
  timestamp: 1706596800000,  // When session started
  uuid: 'abc123...'          // Session identifier
}));

// If this exists when app starts → previous session crashed
```

#### localStorage
```javascript
// Records last known crash (for debugging)
localStorage.getItem('app_last_crash_time');
// Returns: "1706596800000" (timestamp)

// Contains app state for recovery
localStorage.getItem('tilemap_autosave_backup');
// Returns: backup object (see below)
```

### Backup Format

```typescript
interface BackupData {
  // Map metadata
  timestamp: number;              // When backup was made
  mapName: string;               // Name of map
  
  // Map dimensions
  mapWidth: number;              // 32, 64, 128, etc.
  mapHeight: number;             // 32, 64, 128, etc.
  
  // Tile data
  layers: Array<{                // Array of layer data
    name: string;
    visible: boolean;
    opacity: number;
    data: Uint8Array;           // Tile indices
  }>;
  tilesetFileName: string;       // "tileset.png"
  tilesetImage: string;          // data:image/png;base64,...
  tileSizeX: number;             // 32, 64, 128, etc.
  tileSizeY: number;             // 32, 64, 128, etc.
  
  // Game objects
  objects: Array<{
    id: string;
    type: string;               // 'hero', 'item', 'actor', etc.
    x: number;
    y: number;
    data: Record<string, any>;
  }>;
  
  // Hero position
  heroX: number;
  heroY: number;
  
  // UI state
  layerTabs: Record<string, string>;
  layerActiveTabId: Record<string, string>;
  
  // Additional map settings
  detectedTileData: any;
  [key: string]: any;            // Extensible
}
```

## Error Scenarios & Handling

### Scenario 1: Backup Doesn't Exist
```typescript
if (!hasCrashBackup) {
  // No recovery available
  // This is NOT an error, just normal startup
}
```

### Scenario 2: Invalid Backup Format
```typescript
if (recoveryError) {
  console.error('Recovery failed:', recoveryError);
  // User sees error in dialog
  // Can click "Close" and start fresh
}
```

### Scenario 3: Recovery Fails Mid-Process
```typescript
const success = await recoverSession();
if (!success) {
  // Check recoveryError state for message
  console.error('Recovery failed:', recoveryError);
}
```

### Scenario 4: Backup Older Than 24 Hours
```typescript
// Hook automatically ignores old backups
// hasCrashBackup will be false
// No recovery offered
```

## Testing

### Unit Test Example
```typescript
describe('useCrashRecovery', () => {
  it('should detect crash on startup', () => {
    // Setup: Create session marker and backup
    sessionStorage.setItem('app_session_active', '{}');
    localStorage.setItem('tilemap_autosave_backup', JSON.stringify({
      mapWidth: 32,
      mapHeight: 32,
      mapName: 'Test Map',
      timestamp: Date.now()
    }));

    // Act: Render hook
    const { result } = renderHook(() => useCrashRecovery());

    // Assert: Should detect crash
    expect(result.current.hasCrashBackup).toBe(true);
    expect(result.current.mapName).toBe('Test Map');
  });

  it('should recover from backup', async () => {
    // ... setup ...
    
    const { result } = renderHook(() => useCrashRecovery());
    
    // Act: Recover
    const success = await result.current.recoverSession();
    
    // Assert: Should succeed
    expect(success).toBe(true);
    expect(sessionStorage.getItem('app_session_active')).toBeNull();
  });

  it('should handle invalid backup', async () => {
    // Setup: Create invalid backup
    localStorage.setItem('tilemap_autosave_backup', '{}'); // Missing required fields
    
    const { result } = renderHook(() => useCrashRecovery());
    
    // Act: Try to recover
    const success = await result.current.recoverSession();
    
    // Assert: Should fail with error
    expect(success).toBe(false);
    expect(result.current.recoveryError).toBeDefined();
  });
});
```

### Integration Test Example
```typescript
describe('Crash Recovery Flow', () => {
  it('should show dialog and recover on user action', async () => {
    const { getByText, getByRole } = render(<AppMain />);
    
    // Wait for recovery dialog to appear
    await screen.findByText('App Crashed');
    
    // User clicks recover
    fireEvent.click(getByRole('button', { name: 'Recover Session' }));
    
    // Dialog should close
    await waitFor(() => {
      expect(queryByText('App Crashed')).not.toBeInTheDocument();
    });
  });
});
```

## Debugging

### Check Session State
```javascript
// In browser console:
sessionStorage.getItem('app_session_active')
// Returns: '{"timestamp":1706596800000,"uuid":"..."}' if session is active
// Returns: null if no active session

localStorage.getItem('app_last_crash_time')
// Returns: last crash timestamp, or null
```

### View Backup Data
```javascript
// In browser console:
const backup = JSON.parse(localStorage.getItem('tilemap_autosave_backup'));
console.log('Map:', backup.mapName);
console.log('Size:', backup.mapWidth, 'x', backup.mapHeight);
console.log('Backup age:', Date.now() - backup.timestamp, 'ms');
```

### Clear All Recovery Data
```javascript
// In browser console:
sessionStorage.removeItem('app_session_active');
localStorage.removeItem('app_last_crash_time');
localStorage.removeItem('tilemap_autosave_backup');
location.reload();
```

### Simulate Crash
```javascript
// In browser console:
// Force crash marker without closing app
sessionStorage.setItem('app_session_active', JSON.stringify({
  timestamp: Date.now() - 60000, // 1 minute ago
  uuid: 'simulated'
}));
localStorage.setItem('tilemap_autosave_backup', JSON.stringify({
  mapName: 'Test',
  mapWidth: 32,
  mapHeight: 32,
  timestamp: Date.now(),
  layers: []
}));
location.reload();
// Should show recovery dialog on reload
```

## Performance Optimization Tips

1. **Minimize backup size**
   - Only serialize necessary fields
   - Use compression for large tilesets
   - Consider differential backups for incremental saves

2. **Optimize heartbeat**
   - Default 15s interval is good for most apps
   - Increase if battery life critical (30s-60s)
   - Decrease if crash detection critical (5s-10s)

3. **Clean up old backups**
   - Hook auto-cleans backups >24h old
   - Can manually call `clearOldBackups()` if needed
   - Consider background cleanup task

## Contributing

When modifying crash recovery system:

1. **Keep sessionStorage marker synchronized**
   - Always set when app starts
   - Always clear when recovery complete
   - Use consistent key names

2. **Validate backup before recovery**
   - Check required fields exist
   - Validate data types
   - Check backup age

3. **Maintain heartbeat reliability**
   - Don't block heartbeat with long operations
   - Use separate effect/interval
   - Handle cleanup properly

4. **Test all error paths**
   - Invalid backup format
   - Missing backup fields
   - Network errors during recovery
   - Storage quota exceeded

5. **Update documentation**
   - Keep API docs in sync with code
   - Add examples for new features
   - Document breaking changes

## Frequently Asked Questions

**Q: How often does heartbeat check?**
A: Every 15 seconds by default (configurable via `checkInterval` option)

**Q: How old can backup be?**
A: Maximum 24 hours (configurable via `backupMaxAge` option)

**Q: Will recovery work if browser is offline?**
A: Yes, recovery uses localStorage which is local-only

**Q: Can I have multiple backups?**
A: Current system has one backup. Future phase could add backup history

**Q: Does recovery preserve undo/redo?**
A: No, only app state is recovered (not undo stack)

**Q: Can user cancel recovery after starting?**
A: Current implementation doesn't support cancellation mid-recovery

## Related Documentation

- [CRASH_RECOVERY_SYSTEM.md](CRASH_RECOVERY_SYSTEM.md) - Full system documentation
- [CRASH_RECOVERY_QUICK_REF.md](CRASH_RECOVERY_QUICK_REF.md) - Quick reference guide
- [SAVE_SYSTEM_COMPLETE_SUMMARY.md](SAVE_SYSTEM_COMPLETE_SUMMARY.md) - All 5 phases overview
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Deployment guide

---

**Last Updated**: January 30, 2025
**Status**: ✅ Production Ready
