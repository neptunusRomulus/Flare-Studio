# Unsaved Changes Flag - Quick Reference

## What Was Fixed

The `hasUnsavedChanges` flag can now properly sync with actual editor state and won't get out of sync.

## How It Works (3-Layer Sync)

### Layer 1: State Change Sync
- Runs when `hasUnsavedChanges` changes
- Keeps `pendingChangesRef` in sync
- Detects if pending changes exist but flag is false
- Immediately restores flag if drift detected

### Layer 2: Periodic Drift Detection  
- Runs every 500ms
- Checks if `pendingChangesRef && !hasUnsavedChanges`
- Auto-syncs flag if drift detected
- Ensures max 500ms lag

### Layer 3: Initialization
- Runs on mount and when flag changes
- Seeds `hasUnsavedChanges` from `pendingChangesRef`
- Ensures no stale state on startup

### Layer 4: Save Failure Recovery
- When save fails: restores BOTH `pendingChangesRef` AND `hasUnsavedChanges`
- Ensures UI reflects unsaved state after failed save

## File Modified

[src/hooks/useAutosave.ts](src/hooks/useAutosave.ts):
- Line 45-52: Initialization sync effect
- Line 174-184: Save failure recovery (2 locations)
- Line 218-251: Reactive sync effects (2 effects)

## Key Changes Summary

| What | Before | After | Impact |
|------|--------|-------|--------|
| Drift detection | Manual/external only | 3 automatic layers | Catches drift in <500ms |
| Save failure | Pending flag only | Both flags restored | UI shows correct state |
| Sync timing | On callback only | Always + periodic | Guaranteed accuracy |
| Console logging | None | Sync events logged | Debugging easier |

## User Experience

### Before
- Make edit → "Unsaved" ✓
- Callback fails → Still "Unsaved" ✓
- External change → Could show "Saved" ✗ (WRONG)
- Manual save fails → Shows "Saved" ✗ (WRONG)

### After
- Make edit → "Unsaved" ✓
- Callback fails → Detects drift, shows "Unsaved" ✓
- External change → Periodic sync detects it ✓
- Manual save fails → Both flags restored, shows "Unsaved" ✓

## Performance

- **Memory**: No additional state
- **CPU**: 
  - Sync effect: Runs only on state changes (minimal)
  - Periodic check: Single boolean comparison every 500ms (negligible)
- **Impact**: Negligible, no user-visible performance change

## Debugging

### Check Sync in Console
```javascript
// Look for these log messages
console.log('Initializing hasUnsavedChanges from pending changes');
console.log('Restoring hasUnsavedChanges from pending flag');
console.log('Syncing hasUnsavedChanges from pending changes');
```

### Monitor Sync Behavior
Open DevTools → Console and watch for these messages. You should see:
- 1 "Initializing" message on mount
- Sync messages appear when drift is detected
- "Syncing" appears roughly every 500ms if drift persists

## Test Checklist

- [ ] Open map, make edit → shows "Unsaved"
- [ ] Autosave succeeds → shows "Saved" 
- [ ] Autosave fails → shows "Unsaved" again
- [ ] Force drift (console) → syncs within 500ms
- [ ] Rapid edits → never shows false "Saved"
- [ ] Save button tooltip correct → matches state
- [ ] beforeunload prevents close with changes

## Related Features

- ✅ Phase 1: localStorage serialization (unaffected)
- ✅ Phase 2: Manual save blocking (unaffected)
- ✅ Phase 3: Save progress indication (unaffected)

## Rollback Instructions

If needed, this change can be safely reverted:

1. Remove initialization effect (lines 45-52)
2. Remove two sync effects (lines 218-251)
3. Remove `setHasUnsavedChanges(true)` from save failure (lines 174-184)

Changes are isolated to useAutosave.ts and don't affect other parts of the system.

## Error Handling

If sync doesn't work:
1. Check browser console for error messages
2. Verify pendingChangesRef exists and updates
3. Verify React DevTools shows state updates
4. Check if component is remounting unexpectedly

## Further Optimization

Future improvements could include:
- Event-based sync instead of polling (eliminate 500ms interval)
- Exponential backoff if drift detected frequently
- Hash-based validation for extra safety
- Metrics tracking for monitoring
