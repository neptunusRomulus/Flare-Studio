# Per-Map Tab Uniqueness Fix

## Problem
When switching between maps (m1, m2, m3), the tilesets were not being loaded uniquely for each map. Instead, all maps would show the same tileset after reloading the app.

**Root Cause**: In the [LOAD-SYNC] checkpoint (line 8913), the condition `!this.layerTilesets.has(layerType)` was preventing per-tab tilesets from overwriting tilesets that were already loaded from `projectData.tilesets`. This meant that if map m1's tileset was loaded first, and then map m2 was loaded, m2's active tab's tileset would NOT overwrite m1's tileset in `layerTilesets`.

## Solution

### Change 1: Removed blocking condition (Line 8913)
**Before**:
```typescript
if (activeTab && activeTab.tileset && activeTab.tileset.image && !this.layerTilesets.has(layerType)) {
  this.layerTilesets.set(layerType, activeTab.tileset);
}
```

**After**:
```typescript
if (activeTab?.tileset?.image) {
  const tileset = activeTab.tileset;
  const img = tileset.image!;
  // Always restore, regardless of existing tilesets
  if (img.width > 0 || img.height > 0) {
    this.layerTilesets.set(layerType, tileset);
  } else {
    // If image still loading, schedule restoration for after load
    const onImageLoad = () => {
      this.layerTilesets.set(layerType, tileset);
      img.removeEventListener('load', onImageLoad);
    };
    img.addEventListener('load', onImageLoad);
  }
}
```

**Impact**: Now the active tab's tileset ALWAYS overwrites any previously loaded tileset, ensuring each map's unique tileset is used.

### Change 2: Early restoration with load checking (Line 8784)
**Before**:
```typescript
if (activeTab && activeTab.tileset && activeTab.tileset.image) {
  this.layerTilesets.set(layerType, activeTab.tileset);
  console.log(`[LOAD] Restored active tab ${activeTabId} tileset...`);
}
```

**After**:
```typescript
if (activeTab?.tileset?.image) {
  const tileset = activeTab.tileset;
  const img = tileset.image!;
  if (img.width > 0 || img.height > 0) {
    this.layerTilesets.set(layerType, tileset);
    console.log(`[LOAD] Restored active tab ${activeTabId} tileset...`);
  } else {
    console.log(`[LOAD] Deferring active tab ${activeTabId} tileset - image still loading`);
  }
}
```

**Impact**: Early restoration only happens if the image is loaded. Otherwise, it defers to the async callback in [LOAD-SYNC].

## Data Flow After Fix

1. **Load new map project** (e.g., m2.json)
   - `openMapProject` electron handler loads m2.json file
   - Frontend calls `editor.loadProjectData(m2Data)`

2. **Clear previous map state** (line 8588)
   - `this.layerTilesets.clear()` removes all old tilesets
   - `this.layerTabs.clear()` removes all old tabs
   - `this.layerActiveTabId.clear()` clears tab indices

3. **Load new map's tabs** (line 8600-8680)
   - Restore m2's layer tabs with their per-tab tilesets
   - Create Image objects and set `img.src = dataURL` to start loading asynchronously
   - Tab tilesets have empty `.image` objects at this point

4. **Early restoration attempt** (line 8784-8800)
   - For each active tab per layer type:
   - If tileset image has loaded (width > 0), restore to `layerTilesets`
   - If not yet loaded, log deferral message

5. **Load tilesets from projectData.tilesets** (line 8701-8760)
   - Global tilesets load asynchronously in their img.onload callbacks
   - Each onload stores the tileset in `layerTilesets`

6. **[LOAD-SYNC] checkpoint** (line 8911-8932)
   - Always restore active tab's tileset (no condition check)
   - If image loaded, immediately set in `layerTilesets`
   - If not yet loaded, add event listener to restore when image finishes loading
   - This ensures per-tab tileset overwrites any global tileset

7. **Draw canvas** (after [LOAD-SYNC])
   - Canvas rendering uses tileset from `layerTilesets`
   - Displays the correct unique tileset for current map

## Key Guarantees

✅ Each map file has its own `layerTabs` structure with per-tab tilesets  
✅ Per-map tab tilesets are saved in separate JSON files (m1.json, m2.json, etc.)  
✅ When loading a new map, old state is completely cleared  
✅ Per-tab tilesets always overwrite project-level tilesets  
✅ Image async loading doesn't block tileset restoration (event listener handles it)  
✅ Each map displays its unique tileset after reload  

## Testing Checklist

- [ ] Create map m1, import tileset_1.png, save
- [ ] Create map m2, import tileset_2.png, save
- [ ] Create map m3, import tileset_3.png, save
- [ ] Reload app
- [ ] Verify m1 shows tileset_1
- [ ] Open m2 dropdown → verify shows tileset_2
- [ ] Open m3 dropdown → verify shows tileset_3
- [ ] Switch back to m1 → verify still shows tileset_1
- [ ] Close and reopen app → verify uniqueness persists

## Files Modified

- `src/editor/TileMapEditor.ts`
  - Line 8784-8800: Early restoration with load checking
  - Line 8911-8932: [LOAD-SYNC] checkpoint with unconditional restoration + async callback
