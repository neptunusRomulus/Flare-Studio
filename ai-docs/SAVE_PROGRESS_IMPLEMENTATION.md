# Save Progress Indication Implementation

## Overview

This implementation adds visual save progress indication to the left sidebar during save operations. Users now see a blue progress bar showing the save operation's completion percentage (0-100%), providing clear feedback when saving large projects.

## Problem Solved

**Issue**: No visual feedback during long save operations - users couldn't tell if the save was stuck or still processing.

**Solution**: Added a blue progress bar in the sidebar that:
- Starts at 0% when save begins
- Updates through save lifecycle (10%, 20%, 30%, 70%, 80%, 90%, 100%)
- Automatically resets after completion
- Appears only during actual saves (doesn't interfere with export progress)

## Architecture

### State Management

**File**: [src/hooks/useAutosave.ts](src/hooks/useAutosave.ts)

```typescript
const [saveProgress, setSaveProgress] = useState<number>(0);
```

The state is initialized at 0 and updated through the save lifecycle:
- **0%**: Initial state / idle
- **10%**: Conflict check starting
- **20%**: Conflict prompt shown (if needed) 
- **30%**: Main save operation starting
- **70%**: Main save operation completed
- **80%**: Settings persistence starting
- **90%**: Settings persisted  
- **100%**: Save fully complete
- **Reset to 0**: After 2000ms delay (provides visual confirmation of completion)

### Progress Tracking Stages

In [src/hooks/useAutosave.ts](src/hooks/useAutosave.ts), the `performSave` function updates progress at each stage:

```typescript
const performSave = useCallback(async (manual = false) => {
  setSaveProgress(0);  // Reset
  
  // ... conflict check ...
  setSaveProgress(10);  // Conflict check starting
  setSaveProgress(20);  // Conflict prompt shown
  
  // ... main save ...
  setSaveProgress(30);  // Save starting
  setSaveProgress(70);  // Save completed
  
  // ... settings persistence ...
  setSaveProgress(80);  // Settings starting
  setSaveProgress(90);  // Settings completed
  
  setSaveProgress(100); // All done
  
  // Reset after delay
  setTimeout(() => setSaveProgress(0), 2000);
}, [...]);
```

### Data Flow

The save progress flows through the application hierarchy:

```
[useAutosave] exports saveProgress
         ↓
[useAppMainBuilder] extracts saveProgress as saveProgressValue
         ↓
[sidebarDeps] includes saveProgress: saveProgressValue
         ↓
[useMapsSidebar] includes saveProgress in exportStatus
         ↓
[useSidebarProps] formats for AppSidebar
         ↓
[AppSidebar] displays blue progress bar
```

### Files Modified

#### 1. [src/hooks/useAutosave.ts](src/hooks/useAutosave.ts)
- **Line 29**: Added `saveProgress` state: `const [saveProgress, setSaveProgress] = useState<number>(0);`
- **Lines 60, 68, 100, 109, 125, 127, 132, 138, 160**: Added `setSaveProgress()` calls at save stages
- **Lines 193-195**: Modified finally block to reset progress with 2s delay
- **Line 273**: Exported `saveProgress` in return object

#### 2. [src/hooks/useAppMainBuilder.ts](src/hooks/useAppMainBuilder.ts)  
- **Line 47**: Added `saveProgress?: number;` to `ProjectManagerView` type
- **Lines 465-467**: Added `saveProgressValue` extraction from `projectManagerRecord`
- **Line 534**: Added `saveProgress: saveProgressValue,` to `sidebarDeps` return

#### 3. [src/hooks/useMapsSidebar.ts](src/hooks/useMapsSidebar.ts)
- **Line 5**: Added `isSaving: p.isManuallySaving, saveProgress: p.saveProgress` to exportStatus

#### 4. [src/hooks/useSidebarProps.ts](src/hooks/useSidebarProps.ts)
- **Line 61**: Added `isSaving: p.isManuallySaving, saveProgress: p.saveProgress` to exportStatus

#### 5. [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx)
- **Lines 86-91**: Updated `exportStatus` type to include `isSaving?: boolean` and `saveProgress?: number`
- **Lines 170-182**: Added conditional rendering for blue save progress bar (when `isSaving` is true)

## Visual Design

### Progress Bar Styling

The save progress bar appears in the bottom of the sidebar with:

- **Color**: Blue gradient (`from-blue-500 to-blue-600`)
- **Size**: Full width, 6px height (h-1.5)
- **Animation**: 300ms transition (smooth, faster than export's 1000ms)
- **Visibility**: Only visible when save is in progress (`exportStatus.isSaving === true`)

```typescript
<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-full overflow-hidden">
  <div 
    className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300 ease-out rounded-full" 
    style={{ width: `${p.exportStatus.saveProgress ?? 0}%` }} 
  />
</div>
```

### Differentiation from Export

- **Save Progress**: Blue bar (0-100% over ~1-3 seconds)
- **Export Progress**: Orange bar (0-100% over longer time period)
- **Rendering**: Conditional (`if exporting` else `if saving`) prevents simultaneous display

## Usage

No changes required to application code. The progress indication is automatic:

1. User presses Save (Ctrl+S) or autosave triggers
2. `useManualSave` calls save functions
3. `saveProgress` state updates through lifecycle
4. UI reactively displays blue progress bar
5. Progress bar resets to 0 after 2s completion delay
6. Edit locking (from Phase 2) prevents user modifications during entire cycle

## Testing

To verify the implementation:

1. **Open a large map** with multiple layers and tilesets
2. **Press Save** (Ctrl+S) or trigger autosave
3. **Observe the blue progress bar** in the sidebar bottom:
   - Starts at 0%
   - Animates smoothly through stages
   - Reaches 100% when save complete
   - Resets after 2 second delay
4. **Verify orange export bar** still works independently
5. **Verify save locking** prevents edits during 0→100% cycle

### Expected Progress Timeline

For a typical map save:
- **0-100ms**: Progress 0% → 10% (conflict check starting)
- **100-200ms**: Progress 10% → 20% (conflict check complete, no conflicts)
- **200-300ms**: Progress 20% → 30% (main save starting)
- **300-700ms**: Progress 30% → 70% (main save executing)
- **700-800ms**: Progress 70% → 80% (settings starting)
- **800-900ms**: Progress 80% → 90% (settings saving)
- **900ms**: Progress 90% → 100% (all complete)
- **900-2900ms**: Progress bar visible at 100%
- **2900ms+**: Progress resets to 0%

## Integration with Previous Phases

This implementation depends on and complements:

1. **Phase 1 - localStorage Serialization** (`LOCALSTORAGE_FIX_*`):
   - Preserves tab state on app crash
   - Ensures progress updates show accurate save state

2. **Phase 2 - Manual Save UI Blocking** (`MANUAL_SAVE_BLOCKING_*`):
   - Locks editor during 0→100% progress cycle
   - Prevents file corruption during save
   - Progress bar confirms lock is active

3. **Phase 3 - Save Progress Indication** (this implementation):
   - Provides visual feedback for locked period
   - Shows completion percentage
   - Auto-reset confirms successful save

## Error Handling

- **Save failure**: Progress may not reach 100%, reverts to 0 after 2s
- **Partial failure**: Progress shows best-effort completion, allows retry
- **Conflict cancellation**: Progress resets to 0 immediately (no 2s delay)

## Performance Considerations

- **State updates**: Minimal impact (6 setSaveProgress calls per save)
- **DOM rendering**: Progress bar is lightweight (single div with inline style)
- **Browser animation**: CSS transition (300ms) handled natively, no JS animation
- **Re-renders**: Only components using `exportStatus` re-render

## Future Enhancements

Optional improvements for future iterations:

1. **Percentage Text**: Add "35%" display centered on progress bar
2. **Time Estimate**: Calculate estimated time remaining based on progress rate
3. **Save Details**: Show "Saving tileset 3/5..." tooltip during operation
4. **Performance Metrics**: Log actual save duration for benchmarking
5. **Network Saves**: Extend progress tracking to networked save operations

## Backward Compatibility

- ✅ No breaking changes to existing APIs
- ✅ Progress is optional (defaults to 0%)
- ✅ Existing export progress unaffected
- ✅ Existing save blocking unaffected

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Progress bar not visible | Verify `isManuallySaving` is true in `exportStatus` |
| Progress bar stuck at 0% | Check browser console for save errors |
| Progress bar doesn't reset | Verify 2s timeout in useAutosave finally block |
| Bar flickers during save | Check for multiple simultaneous save triggers |
| Orange bar visible with blue | Verify conditional rendering in AppSidebar |

## Related Documentation

- [LOCALSTORAGE_FIX_SUMMARY.md](LOCALSTORAGE_FIX_SUMMARY.md) - Tab state serialization
- [MANUAL_SAVE_BLOCKING_FIX.md](MANUAL_SAVE_BLOCKING_FIX.md) - Save UI locking
- [SAVE_SYSTEM_INDEX.md](SAVE_SYSTEM_INDEX.md) - Complete save system overview
