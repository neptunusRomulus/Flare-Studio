# File Conflict Detection - Quick Integration Guide

## For Developers

### Step 1: Import the Hook
```typescript
import useFileConflictDetection from '@/hooks/useFileConflictDetection';
```

### Step 2: Use in Your Component
```typescript
const {
  registerFileLoad,
  registerFileSave,
  checkFileConflict,
  getConflictDetectionStatus
} = useFileConflictDetection();
```

### Step 3: Register Files When Loaded
```typescript
useEffect(() => {
  if (mapPath && mapSize) {
    registerFileLoad(mapPath, mapSize);
  }
}, [mapPath, mapSize]);
```

### Step 4: Check Before Saving
```typescript
const result = await checkFileConflict(mapPath, mapSize);
if (result.hasConflict) {
  // Handle conflict - show user prompt
}
```

### Step 5: Update Tracking After Save
```typescript
registerFileSave(mapPath, newMapSize);
```

## For UI Developers

### Show Conflict Prompt
```typescript
import { useConflictResolution } from '@/context/ConflictResolutionContext';

function MyComponent() {
  const { showConflictPrompt, currentConflict, resolveConflict } = useConflictResolution();

  const handleSave = async () => {
    const resolution = await showConflictPrompt({
      filePath: '/project/map.json',
      reason: 'File was modified externally',
      severity: 'critical'
    });

    if (resolution === 'keep_app') {
      // Proceed with save
    } else if (resolution === 'reload') {
      // Load external version
    } else if (resolution === 'cancel') {
      // Cancel save
    }
  };

  return (
    <>
      {/* Show prompt UI when isPromptVisible = true */}
      {currentConflict && (
        <ConflictDialog
          conflict={currentConflict}
          onResolve={(res) => resolveConflict(res)}
        />
      )}
    </>
  );
}
```

## API Reference

### useFileConflictDetection()
Returns object with methods:

| Method | Params | Returns | Purpose |
|--------|--------|---------|---------|
| `registerFileLoad` | `(path, size)` | void | Mark file as "loaded by app" |
| `registerFileSave` | `(path, size)` | void | Update tracking after save |
| `checkFileConflict` | `(path, size, getStats?, tolerance)` | Promise<Result> | Check if file changed externally |
| `clearTrackedFiles` | none | void | Reset all tracking |
| `getConflictDetectionStatus` | none | Status | Debug info about tracked files |

### useConflictResolution()
Returns object with:

| Property | Type | Purpose |
|----------|------|---------|
| `isPromptVisible` | boolean | Is conflict prompt showing? |
| `currentConflict` | ConflictPromptData | Current conflict details |
| `showConflictPrompt` | async fn | Show prompt, wait for resolution |
| `hideConflictPrompt` | fn | Hide prompt programmatically |
| `resolveConflict` | fn | User action: pick resolution |
| `getConflictStats` | fn | Debug: resolution history |

## Common Patterns

### Pattern 1: Check Before Autosave
```typescript
useEffect(() => {
  if (!currentFilePath) return;
  
  const timer = setInterval(async () => {
    const result = await checkFileConflict(currentFilePath, currentFileSize);
    if (result.hasConflict) {
      console.warn('Conflict detected, notifying user');
      // Pause autosave, wait for user action
    }
  }, 5000);
  
  return () => clearInterval(timer);
}, [currentFilePath, currentFileSize]);
```

### Pattern 2: Pre-Save Conflict Check
```typescript
async function handleSave() {
  // 1. Check for conflicts
  const conflicts = await checkFileConflict(mapPath, mapSize);
  
  if (conflicts.hasConflict) {
    // 2. Ask user what to do
    const resolution = await showConflictPrompt({
      filePath: mapPath,
      reason: conflicts.reason,
      severity: conflicts.severity
    });
    
    // 3. Handle resolution
    if (resolution !== 'keep_app') {
      return; // Don't save
    }
  }
  
  // 4. Save normally
  await save();
  
  // 5. Update tracking
  registerFileSave(mapPath, newFileSize);
}
```

### Pattern 3: Project Switch Reset
```typescript
function switchProject(newProjectPath) {
  // Clear all old file tracking
  clearTrackedFiles();
  
  // Load new project
  loadProject(newProjectPath);
  
  // Register new project files
  registerFileLoad(mapPath, mapSize);
}
```

## Debugging

### Check What Files Are Being Tracked
```typescript
const status = getConflictDetectionStatus();
console.table(status.trackedFiles);
```

### See Resolution History
```typescript
const stats = getConflictStats();
console.log('Recent resolutions:', stats.resolutionHistory.slice(-5));
```

### Enable Verbose Logging
All conflict operations already log with `[FileConflict]` and `[ConflictResolution]` prefixes.

Check console for:
- File load/save registration
- Timestamp mismatches
- User resolution choices
- Prompt timeouts

## Component Integration Checklist

- [ ] Import `useFileConflictDetection`
- [ ] Import `useConflictResolution` if handling conflicts
- [ ] Register file on load: `registerFileLoad(path, size)`
- [ ] Check before save: `checkFileConflict(path, size)`
- [ ] Show prompt if conflict: `showConflictPrompt(...)`
- [ ] Update tracking after save: `registerFileSave(path, size)`
- [ ] Clear on project switch: `clearTrackedFiles()`
- [ ] Test with external file edits
- [ ] Test all resolution paths (reload, keep_app, cancel)

## FAQ

**Q: What if I don't provide file paths?**
A: Conflict detection is skipped. No errors, just no protection.

**Q: How often is conflict checked?**
A: Only before saves (manual or autosave). Not continuous monitoring.

**Q: Can I check multiple files at once?**
A: Yes, use `checkMultipleFileConflicts()` for batch checking.

**Q: What if the user takes 5+ minutes?**
A: Conflict prompt auto-cancels, preventing save indefinitely.

**Q: How much memory does this use?**
A: ~100 bytes per tracked file. Max 100 files = ~10KB.

**Q: Can I change the tolerance?**
A: Yes, pass `toleranceMs` to `checkFileConflict()`. Default is 1000ms.

**Q: What about network drives?**
A: Works but may be slower. Tolerance helps account for lag.

## Next Steps

1. **Component UI**: Create ConflictDialog component for the prompt
2. **Electron Integration**: Add file stat reading to Electron main process
3. **Testing**: Manual test with git pulls, external editors
4. **Documentation**: Add to user manual about external file changes
