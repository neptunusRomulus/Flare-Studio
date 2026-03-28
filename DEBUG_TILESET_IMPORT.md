# Tileset Import Debug Guide

## Overview
Comprehensive debug logging has been added throughout the tileset import flow to trace where tilesets are lost or fail to display in the TilesetPalette.

## Debug Logging Points

### 1. **BrushToolbar.tsx** - Import Button Click
When you click the import button in the brush toolbar:

```javascript
// Logs when import is triggered
console.log('[BrushToolbar] DEBUG: File selected for import');

// Logs when detected tiles are extracted from imported image
console.log('[BrushToolbar] DEBUG: Extracted detected tiles from activeTab', {
  count: detectedTilesArray.length,
  tabId: targetTabId,
  layerType,
  tiles: detectedTilesArray.slice(0, 3)  // First 3 tiles shown
});

// Logs when onShowImportReview is called
console.log('[BrushToolbar] DEBUG: Calling onShowImportReview with:', {
  tilesetFileName: file.name,
  detectedAssetCount: detectedTilesArray.length,
  layerType,
  tabId: targetTabId
});

// Logs errors during import
console.error('[BrushToolbar] CRITICAL ERROR: Import flow failed', err);
console.error('[BrushToolbar] ERROR DETAILS:', {
  message: String(err),
  stack: err instanceof Error ? err.stack : 'no stack',
  targetTabId,
  layerType,
  manualTileWidth,
  manualTileHeight
});
```

**Look for:**
- Whether detected tiles are being extracted
- If onShowImportReview is being called with data
- Any error details if import fails

---

### 2. **useAppMainBuilder.ts** - Import Review Modal
When the import review modal is shown:

```javascript
// Logs when import review modal handler is triggered
console.log('[useAppMainBuilder] DEBUG: onShowImportReview called with:', {
  tilesetFileName: parsedData?.tilesetFileName,
  detectedAssetCount: parsedData?.detectedAssets?.length,
  defaultWidth,
  defaultHeight,
  layerType: parsedData?._meta?.layerType,
  tabId: parsedData?._meta?.tabId
});

// Logs when modal state is updated
console.log('[useAppMainBuilder] DEBUG: Import review modal state set to true');
```

**Look for:**
- Whether the modal callback receives the import data
- If detected asset count matches what BrushToolbar sent
- If the modal state is being set to true

---

### 3. **TileMapEditor.ts** - Core Import Logic
When the tileset is actually imported into the editor:

```javascript
// Logs when import method is called
console.log('[TileMapEditor] DEBUG: importBrushImageToLayerTab called with:', {
  layerType,
  tabId,
  fileName: file.name,
  manualTileWidth,
  manualTileHeight,
  forceGridSlicing
});

// Logs when image finishes loading
console.log('[TileMapEditor] DEBUG: Image loaded:', { width: img.width, height: img.height });

// Logs when detected tiles are stored on tab
console.log('[TileMapEditor] DEBUG: Set tab.detectedTiles:', {
  count: importedDetectedTiles.size,
  tabId,
  layerType
});

// Logs when global detected data is updated
console.log('[TileMapEditor] DEBUG: Updating global detectedTileData for active layer');

// Logs when tileset is auto-saved
console.log('[TileMapEditor] DEBUG: Auto-saving tileset after import to:', pathToUse);

// Logs when import completes
console.log('[TileMapEditor] DEBUG: Import complete, resolving promise');
```

**Look for:**
- Whether the image loads successfully
- If detected tiles are being stored (count > 0)
- If the tileset is being auto-saved to the project path
- Any failure messages during save

---

### 4. **TilesetPalette.tsx** - Palette Display
When the palette refreshes to show imported tilesets:

```javascript
// Logs when palette starts fetching tileset
console.log('[TilesetPalette] DEBUG: Fetching tileset for layer type:', { layerType, tabTick });

// Logs tab lookup results
console.log('[TilesetPalette] DEBUG: Tab lookup result:', {
  tabCount: tabs.length,
  activeTabId,
  foundTab: !!tab,
  tabHasTileset: !!tab.tileset,
  tabHasImage: !!tab.tileset?.image
});

// Logs when detected tiles are found on tab
console.log('[TilesetPalette] DEBUG: Found detectedTiles on tab:', { count: tabDetected.size });

// Logs fallback detection method
console.log('[TilesetPalette] DEBUG: Fallback getDetectedTilesForLayer returned:', { count: count });

// Logs when tileset image is being set
console.log('[TilesetPalette] DEBUG: Setting tileset image:', {
  imageWidth: img.naturalWidth,
  imageHeight: img.naturalHeight,
  src: img.src.substring(0, 50) + '...'
});

// Logs when tileset is drawn to canvas
console.log('[TilesetPalette] DEBUG: Drawing tileset image to canvas:', {
  imageWidth: img.width,
  imageHeight: img.height,
  canvasWidth: width,
  canvasHeight: height
});
```

**Look for:**
- Whether tabs are found for the active layer
- If the tileset image is being set from the tab
- If detected tiles are visible in the palette
- If the image is successfully drawn to canvas

---

### 5. **Import Confirmation Handler** - Profile Saving
When you confirm the import in the review modal:

```javascript
// Re-import with tile size change
console.log('[useAppMainBuilder] DEBUG: Re-import succeeded, refreshing tab state');
console.log('[useAppMainBuilder] DEBUG: Set active layer tab to', { layerType, tabId });
console.log('[useAppMainBuilder] DEBUG: Incremented tabTick');

// Profile saving
console.log('[useAppMainBuilder] DEBUG: Saving tileset profile after re-import:', {
  profileId: profile.id,
  tilesetFileName: importReviewData?.tilesetFileName,
  assetCount: profileToSave.assets?.length,
  projectPath: currentProjectPath
});

// Save success/failure
console.log('[useAppMainBuilder] DEBUG: Tileset profile saved successfully');
console.error('[useAppMainBuilder] ERROR: Failed to save tileset profile:', result.error);
```

---

## How to Use the Debug Logs

### Step 1: Open Browser DevTools
Press `F12` to open Developer Tools → Go to **Console** tab

### Step 2: Try Importing a Tileset
1. Click the **Import** button in the brush toolbar
2. Select an image file (PNG recommended)
3. Review the console logs at each stage

### Step 3: Follow the Flow
Expected flow with successful logs:
```
1. [BrushToolbar] Extracted detected tiles from activeTab ✓
2. [BrushToolbar] Calling onShowImportReview with ✓
3. [useAppMainBuilder] onShowImportReview called with ✓
4. [useAppMainBuilder] Import review modal state set to true ✓
5. [TileMapEditor] Image loaded ✓
6. [TileMapEditor] Set tab.detectedTiles ✓
7. [TileMapEditor] Auto-saving tileset after import ✓
8. [TileMapEditor] Import complete, resolving promise ✓
9. [TilesetPalette] Fetching tileset for layer type ✓
10. [TilesetPalette] Tab lookup result (foundTab: true) ✓
11. [TilesetPalette] Setting tileset image ✓
12. [TilesetPalette] Found detectedTiles on tab ✓
```

### Step 4: Look for Breaking Points
If a step is missing:
- **Missing step 1**: File wasn't properly selected
- **Missing step 2**: onShowImportReview callback not called
- **Missing step 3**: Modal handler not triggered
- **Missing step 4**: Modal state not updating
- **Missing steps 5-7**: TileMapEditor import failed
- **Missing steps 9-12**: TilesetPalette not refreshing

---

## Common Issues and Fixes

### Issue: "No detected tiles extracted"
- Check: Step 1 console log shows `count: 0`
- Cause: Image might have solid colors; try an image with clear distinct tiles
- Solution: Ensure import image has visible tile boundaries

### Issue: "Import review modal never appears"
- Check: Step 3 console log is missing
- Cause: onShowImportReview not being called
- Solution: The fix in useAppMainBuilder.ts should resolve this
- Verify: BrushToolbar logs show call to onShowImportReview

### Issue: "Tileset saved but palette stays empty"
- Check: Steps 1-7 all present but steps 9-12 fail
- Cause: TilesetPalette not detecting the imported tileset
- Solution: Check if tabTick is being incremented (step 7)
- Verify: [TilesetPalette] debug logs show tabTick change

### Issue: "Error saving tileset profile"
- Check: Step 8 shows error message
- Cause: saveTilesetProfiles electron API failed
- Solution: Verify project path exists and is writable
- Check: [useAppMainBuilder] shows projectPath value

---

## Key Debug Values to Monitor

| Value | Expected | Issue If... |
|-------|----------|-----------|
| `detectedAssetCount` | > 0 | Image detection failed |
| `foundTab` | true | Active tab not found |
| `tabHasImage` | true | Tileset image not stored on tab |
| `detectedTiles.count` | > 0 | Palette won't show tiles |
| `image.naturalWidth` | > 0 | Canvas won't render |
| `tabTick` | increments | Palette won't refresh |
| `projectPath` | non-empty | Profile won't save |

---

## Quick Test Script

Paste this in the browser console to check current tileset state:

```javascript
// Check if tilesets are loaded
if (window.__DEBUG_STATE) {
  console.log('Tileset State:', window.__DEBUG_STATE);
} else {
  console.log('Debug state not available - try importing a tileset first');
}
```

---

## Next Steps If Issues Persist

1. **Check the browser console** for any errors (red messages)
2. **Note the exact step where logs stop**
3. **Try different image files** (solid color vs. grid-based)
4. **Check project path** is correctly set
5. **Verify browser DevTools is open** before clicking Import
